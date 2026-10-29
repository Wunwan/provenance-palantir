"""The shared evidence contract: one model per table, one JSON file per table."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, model_validator


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Collection(Strict):
    id: str
    name: str
    source: str
    snapshot_date: str


class SourceRecord(Strict):
    id: str
    collection: str
    url: str
    retrieved_at: str
    version: str | None
    raw_path: str  # the raw payload exactly as fetched, relative to the pipeline root


class Claim(Strict):
    id: str
    source_record: str
    field_path: str  # e.g. "provenance[2].description"
    start: int
    end: int
    text: str
    method: Literal["hand", "rule", "ai"]
    certainty: str  # as stated by the source, e.g. "stated"


class Artwork(Strict):
    id: str
    title: str
    artist: str
    created: str
    accession: str
    image: str


class Party(Strict):
    id: str
    preferred_name: str
    kind: Literal["person", "organization"]
    life_dates: str | None


class PartyAlias(Strict):
    id: str
    party: str
    name_as_written: str
    claim: str


LinkType = Literal["sale", "gift", "descent", "bequest", "restitution", "unknown"]
Precision = Literal["exact", "range", "by", "until", "after", "circa", "unknown"]
Certainty = Literal["confirmed", "approximate", "unknown"]

# Event values that must each cite at least one claim when they are set.
CITED_FIELDS = ("from_party", "to_party", "link_type", "date_start", "date_end")


class Event(Strict):
    id: str
    artwork: str
    from_party: str
    to_party: str
    link_type: LinkType
    date_start: str | None
    date_end: str | None
    precision: Precision
    certainty: Certainty
    place: str | None
    cites: dict[str, list[str]]  # value name -> claim ids

    @model_validator(mode="after")
    def every_value_cites_a_claim(self) -> Event:
        for name in CITED_FIELDS:
            if name == "link_type" and self.link_type == "unknown":
                continue  # the evidence is the absence of linking words
            if getattr(self, name) is not None and not self.cites.get(name):
                raise ValueError(f"event {self.id}: {name} has no claim")
        return self


class Match(Strict):
    id: str
    alias: str  # party_alias id: the name as written
    candidate_party: str
    reasons: list[str]
    band: Literal["strong", "possible", "weak"]


class Suggestion(Strict):
    id: str
    event: str  # the event whose date range is the silence this suggestion could fill
    origin: Literal["existing", "external"]
    provider: str  # e.g. "loaded data", "Getty Provenance Index"
    query: str | None
    preview: str
    url: str | None
    retrieved_at: str
    covers_start: str | None  # the span this evidence could fill, if it says
    covers_end: str | None


class Decision(Strict):
    """A person's call. Lives in the browser (ADR 0002); the model is here so the types are shared."""

    id: str
    target: str  # a match id or an event id
    choice: Literal["accepted", "rejected", "evidence_added"]
    suggestion: str | None
    note: str
    at: str


class EvidenceModel(Strict):
    collections: list[Collection]
    source_records: list[SourceRecord]
    claims: list[Claim]
    artworks: list[Artwork]
    parties: list[Party]
    party_aliases: list[PartyAlias]
    events: list[Event]
    matches: list[Match] = []
    suggestions: list[Suggestion] = []

    @model_validator(mode="after")
    def references_resolve(self) -> EvidenceModel:
        ids = {
            "collection": {c.id for c in self.collections},
            "source_record": {r.id for r in self.source_records},
            "claim": {c.id for c in self.claims},
            "artwork": {a.id for a in self.artworks},
            "party": {p.id for p in self.parties},
        }

        def need(kind: str, ref: str, owner: str) -> None:
            if ref not in ids[kind]:
                raise ValueError(f"{owner}: unknown {kind} {ref!r}")

        for r in self.source_records:
            need("collection", r.collection, f"source_record {r.id}")
        for c in self.claims:
            need("source_record", c.source_record, f"claim {c.id}")
        for a in self.party_aliases:
            need("party", a.party, f"party_alias {a.id}")
            need("claim", a.claim, f"party_alias {a.id}")
        for e in self.events:
            need("artwork", e.artwork, f"event {e.id}")
            need("party", e.from_party, f"event {e.id}")
            need("party", e.to_party, f"event {e.id}")
            for claim_ids in e.cites.values():
                for claim_id in claim_ids:
                    need("claim", claim_id, f"event {e.id}")
        return self


TABLES = {
    "collections": "collection.json",
    "source_records": "source_record.json",
    "claims": "claim.json",
    "artworks": "artwork.json",
    "parties": "party.json",
    "party_aliases": "party_alias.json",
    "events": "event.json",
    "matches": "match.json",
    "suggestions": "suggestion.json",
}


def load_evidence(directory: Path) -> EvidenceModel:
    tables = {
        name: json.loads((directory / filename).read_text(encoding="utf-8"))
        for name, filename in TABLES.items()
        if (directory / filename).exists()
    }
    return EvidenceModel.model_validate(tables)


def _resolve(payload: object, field_path: str) -> object:
    """Follow a path like "provenance[2].description" into a raw payload."""
    value = payload
    for part in field_path.split("."):
        name, _, index = part.partition("[")
        value = value[name]
        if index:
            value = value[int(index.rstrip("]"))]
    return value


def check_claims_against_raw(model: EvidenceModel, root: Path) -> list[str]:
    """Return one message per claim whose span does not hold its text in the raw record."""
    records = {r.id: r for r in model.source_records}
    payloads: dict[str, object] = {}
    problems = []
    for claim in model.claims:
        record = records[claim.source_record]
        if record.id not in payloads:
            snapshot = json.loads((root / record.raw_path).read_text(encoding="utf-8"))
            payloads[record.id] = snapshot["payload"]
        try:
            source_text = _resolve(payloads[record.id], claim.field_path)
        except (KeyError, IndexError, TypeError):
            problems.append(f"{claim.id}: {claim.field_path} not found in the raw record")
            continue
        if source_text[claim.start : claim.end] != claim.text:
            problems.append(f"{claim.id}: span does not hold {claim.text!r} in {claim.field_path}")
    return problems
