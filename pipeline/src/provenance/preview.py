"""Live preview: run the real pipeline on one accession number in a temp folder, print one JSON object.

Usage: python -m provenance.preview <accession>. Writes only inside a temporary directory,
never under data/. Expected errors are returned as JSON with ok=false and exit code 0.
"""

import datetime
import json
import re
import shutil
import socket
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

from provenance import matching
from provenance.build import ACCESSIONS
from provenance.cleanup import build
from provenance.ingest import API

ACCESSION = re.compile(r"^\d{4}\.\d{1,5}[A-Za-z]?$")
RAW_DIR = Path(__file__).parent.parent.parent / "data" / "raw" / "cleveland"
TIMEOUT = 20


class PreviewError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def fetch_snapshot(accession: str) -> tuple[dict, int]:
    """Fetch one Cleveland record as a snapshot (same shape ingest stores) plus the HTTP status."""
    url = f"{API}?accession_number={accession}"
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 provenance-palantir"})
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            status = response.status
            data = json.load(response)["data"]
    except (urllib.error.URLError, socket.timeout, TimeoutError, ValueError, KeyError, OSError) as error:
        raise PreviewError("api_error", f"The Cleveland API could not be reached ({error}).") from error
    if len(data) != 1:
        raise PreviewError("not_found", f"No Cleveland record has the accession number {accession}.")
    snapshot = {
        "source": "cleveland",
        "url": f"{API}{accession}",
        "retrieved_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "version": data[0].get("updated_at"),
        "payload": data[0],
    }
    return snapshot, status


def _run(accession: str) -> dict:
    if not ACCESSION.fullmatch(accession):
        raise PreviewError("bad_request", "An accession number looks like 1965.233 (year, a dot, a number).")
    snapshot, status = fetch_snapshot(accession)
    payload = snapshot["payload"]
    if not (payload.get("provenance") or []):
        raise PreviewError("no_provenance", f"Record {accession} has no provenance text to read.")

    already = accession in ACCESSIONS
    accessions = list(ACCESSIONS) if already else [*ACCESSIONS, accession]
    with tempfile.TemporaryDirectory(prefix="provenance-preview-") as tmp:
        raw = Path(tmp) / "data" / "raw" / "cleveland"
        raw.mkdir(parents=True)
        for name in ACCESSIONS:  # existing records, so ids match a normal build
            if name != accession:
                shutil.copy(RAW_DIR / f"{name}.json", raw / f"{name}.json")
        snapshot_bytes = (json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        (raw / f"{accession}.json").write_bytes(snapshot_bytes)
        result = build(raw, accessions)

    model = result.model
    art_id = f"cma-{accession}"
    sr_id = f"sr-{accession}"
    artwork = next(a for a in model.artworks if a.id == art_id)
    events = [e for e in model.events if e.artwork == art_id]
    claims = [c for c in model.claims if c.source_record == sr_id]
    claim_ids = {c.id for c in claims}
    aliases = [a for a in model.party_aliases if a.claim in claim_ids]
    party_ids = {e.from_party for e in events} | {e.to_party for e in events} | {a.party for a in aliases}
    parties = [p for p in model.parties if p.id in party_ids]
    records = [r for r in model.source_records if r.id == sr_id]

    names = {p.id: p.preferred_name for p in model.parties}
    alias_by_id = {a.id: a for a in model.party_aliases}
    claim_record = {c.id: c.source_record for c in model.claims}
    party_arts: dict[str, set[str]] = {}
    for e in model.events:
        for pid in (e.from_party, e.to_party):
            party_arts.setdefault(pid, set()).add(e.artwork)
    new_matches, with_artworks = 0, set()
    for m in matching.compute(model):
        alias = alias_by_id[m.alias]
        if "Cleveland Museum" in names[m.candidate_party] or "Cleveland Museum" in alias.name_as_written:
            continue
        alias_art = claim_record[alias.claim].removeprefix("sr-")
        alias_art = f"cma-{alias_art}"
        cand_arts = party_arts.get(m.candidate_party, set())
        others: set[str] = set()
        if alias_art == art_id:
            others = cand_arts - {art_id}
        elif art_id in cand_arts:
            others = {alias_art}
        if others:
            new_matches += 1
            with_artworks |= others

    rows = payload.get("provenance") or []
    return {
        "ok": True,
        "accession": accession,
        "alreadyInCollection": art_id if already else None,
        "artwork": {"title": artwork.title, "artist": artwork.artist, "created": artwork.created,
                    "image": artwork.image},
        "stages": {
            "fetch": {"endpoint": f"{API}?accession_number={accession}", "httpStatus": status,
                      "rawSteps": len(rows)},
            "snapshot": {"retrievedAt": snapshot["retrieved_at"], "version": snapshot["version"],
                         "bytes": len(snapshot_bytes), "license": payload.get("share_license_status")},
            "clean": {"events": len(events), "parties": len(parties), "aliases": len(aliases),
                      "skippedSteps": sum(1 for s in result.skipped if s.startswith(f"{accession}["))},
            "claims": {"count": len(claims), "withPlace": sum(1 for e in events if e.place)},
            "match": {"newMatches": new_matches, "withArtworks": sorted(with_artworks)},
        },
        "raw": [{"index": i, "description": r.get("description", ""), "date": r.get("date")}
                for i, r in enumerate(rows)],
        "fragment": {
            "artworks": [artwork.model_dump(mode="json")],
            "parties": [p.model_dump(mode="json") for p in parties],
            "party_aliases": [a.model_dump(mode="json") for a in aliases],
            "events": [e.model_dump(mode="json") for e in events],
            "claims": [c.model_dump(mode="json") for c in claims],
            "source_records": [r.model_dump(mode="json") for r in records],
        },
    }


def preview(accession: str) -> dict:
    try:
        return _run(accession)
    except PreviewError as error:
        return {"ok": False, "code": error.code, "message": error.message}
    except Exception as error:  # the web app only needs a clean failure
        return {"ok": False, "code": "api_error", "message": f"Preview failed: {error}"}


if __name__ == "__main__":
    print(json.dumps(preview(sys.argv[1] if len(sys.argv) > 1 else ""), ensure_ascii=False))
