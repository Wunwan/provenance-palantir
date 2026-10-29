"""Rule-based cleanup: Cleveland's provenance steps become parties, claims and events.

Rules only (ADR 0003). Steps the rules cannot read are kept in `skipped` and never dropped silently.
"""

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from provenance.contract import (
    Artwork,
    Claim,
    Collection,
    Event,
    EvidenceModel,
    Party,
    PartyAlias,
    SourceRecord,
)

MONTHS = {m: i for i, m in enumerate(
    ["January", "February", "March", "April", "May", "June", "July", "August",
     "September", "October", "November", "December"], 1)}
DATE_TOKEN = re.compile(r"(?:(" + "|".join(MONTHS) + r")\s+(?:(\d{1,2}),\s*)?)?(\d{4})")
NAME = re.compile(r"^\(?\s*((?:[^,\[\(;]|\([A-Z][a-z]+\))+?)\s*(?:,|\[|\(|;|$)")
LIFE_DATES = re.compile(r"[\[\(](?:b\. )?(\d{4})\s*-\s*(\d{4})[\]\)]")
HIDDEN = re.compile(r"^(private collection|a swiss private collector|possibly)", re.I)
ORG = re.compile(r"Co\.|Cie|Galerie|Gallery|Museum|Fine Arts|Christie|Drouot|Knoedler|Wildenstein|Petit|"
                 r"Kunsthandlung|Heirs|Nazis|Palais|Boussod|Bernheim|Salon|sale|collection", re.I)
LINKS = [
    (re.compile(r"sold (?:back )?to"), "sale"),
    (re.compile(r"by descent"), "descent"),
    (re.compile(r"by gift"), "gift"),
    (re.compile(r"by bequest"), "bequest"),
]


def parse_token(m: re.Match) -> str:
    month, day, year = m.group(1), m.group(2), m.group(3)
    out = year
    if month:
        out += f"-{MONTHS[month]:02d}"
        if day:
            out += f"-{int(day):02d}"
    return out


def parse_date(text: str | None) -> tuple[str | None, str | None, bool]:
    """Return (lo, hi, open_end). lo or hi is None when the source does not say."""
    if text is None or text.strip() in ("", "?"):
        return None, None, False
    t = text.strip().replace("–", "-").replace("—", "-")
    toks = [parse_token(m) for m in DATE_TOKEN.finditer(t)]
    low = t.lower()
    if not toks:
        return None, None, False
    if low.startswith("until"):
        return None, toks[0], False
    if low.startswith("-"):
        return None, toks[0], False
    if low.startswith("from") or (low.endswith("-") and len(toks) == 1):
        return toks[0], None, True
    if len(toks) >= 2:
        return toks[0], toks[1], False
    return toks[0], toks[0], False


def year(d: str) -> int:
    return int(d[:4])


@dataclass
class Holder:
    row: int
    name: str
    span: tuple[int, int]
    hidden: bool
    lo: str | None
    hi: str | None
    open_end: bool
    life: str | None
    claim: str = ""


@dataclass
class Result:
    model: EvidenceModel
    skipped: list[str] = field(default_factory=list)


def holder_of(row: int, desc: str, date: str | None) -> Holder | None:
    s = desc
    if s[:1].islower() or s.startswith("Artist") or s.startswith("While") or s.startswith("(["):
        return None
    if s.startswith("In the possession of the Nazis"):
        name, span = "the Nazis", (s.index("the Nazis"), s.index("the Nazis") + 9)
    elif s.startswith("Restituted to "):
        name = s[len("Restituted to "):]
        span = (len("Restituted to "), len(s))
    elif s.startswith("Recovered by"):
        m = re.search(r"widow, ([A-Z][\w ]+?) \(", s)
        if not m:
            return None
        name, span = m.group(1), m.span(1)
    elif re.match(r"^\((?:S|s)old,\s*", s):
        m = re.match(r"^\((?:S|s)old,\s*([^,\[\(]+)", s)
        name, span = m.group(1).strip(), m.span(1)
    else:
        m = NAME.match(s)
        if not m:
            return None
        name, span = m.group(1).strip(), m.span(1)
        if s[span[1]:].startswith(", Jr"):
            tail = ", Jr." if s[span[1]:].startswith(", Jr.") else ", Jr"
            name += tail
            span = (span[0], span[1] + len(tail))
    lo, hi, open_end = parse_date(date)
    life = LIFE_DATES.search(s)
    return Holder(row, name, span, bool(HIDDEN.match(name)), lo, hi, open_end,
                  f"{life.group(1)}-{life.group(2)}" if life else None)


def party_key(name: str) -> str:
    return re.sub(r"[^a-z]", "", name.lower().removesuffix(", jr.").removesuffix(", jr"))


def merge(holders: list[Holder]) -> list[list[Holder]]:
    groups: list[list[Holder]] = []
    for h in holders:
        if groups and party_key(groups[-1][-1].name) == party_key(h.name):
            groups[-1].append(h)
        else:
            groups.append([h])
    return groups


def bounds(group: list[Holder]) -> tuple[str | None, str | None, bool]:
    los = [h.lo for h in group if h.lo]
    his = [h.hi for h in group if h.hi]
    lo = min(los) if los else (min(his) if his else None)
    hi = max(his) if his else (max(los) if los else None)
    return lo, hi, group[-1].open_end


def build(raw_dir: Path, accessions: list[str]) -> Result:
    collection = Collection(id="cleveland-demo", name="Cleveland Museum of Art, demo set",
                            source="cleveland", snapshot_date="")
    records, claims, artworks, parties, aliases, events = [], [], [], {}, [], []
    skipped: list[str] = []
    latest = ""

    for accession in accessions:
        snap = json.loads((raw_dir / f"{accession}.json").read_text(encoding="utf-8"))
        payload = snap["payload"]
        latest = max(latest, snap["retrieved_at"][:10])
        sr = f"sr-{accession}"
        records.append(SourceRecord(id=sr, collection=collection.id, url=snap["url"],
                                    retrieved_at=snap["retrieved_at"], version=snap["version"],
                                    raw_path=f"data/raw/cleveland/{accession}.json"))
        creators = payload.get("creators") or []
        artist = creators[0]["description"].split(" (")[0] if creators else "Unknown"
        art_id = f"cma-{accession}"
        artworks.append(Artwork(id=art_id, title=payload["title"], artist=artist,
                                created=payload.get("creation_date") or "", accession=accession,
                                image=(payload.get("images") or {}).get("web", {}).get("url", "")))
        rows = payload.get("provenance") or []
        counter = [0]

        def claim(row: int, fld: str, start: int, end: int, text: str) -> str:
            counter[0] += 1
            cid = f"c-{accession}-{counter[0]:03d}"
            claims.append(Claim(id=cid, source_record=sr, field_path=f"provenance[{row}].{fld}",
                                start=start, end=end, text=text, method="rule", certainty="stated"))
            return cid

        holders = []
        for i, r in enumerate(rows):
            h = holder_of(i, r["description"], r.get("date"))
            if h is None:
                skipped.append(f"{accession}[{i}]: {r['description'][:60]!r}")
            else:
                holders.append(h)
        groups = merge(holders)

        pid: dict[str, str] = {}
        for g in groups:
            for h in g:
                key = party_key(h.name)
                if key not in pid:
                    pid[key] = f"p-{len(parties) + 1:03d}"
                    parties[pid[key]] = Party(
                        id=pid[key], preferred_name=g[0].name,
                        kind="organization" if ORG.search(h.name) else "person", life_dates=h.life)
                elif h.life and parties[pid[key]].life_dates is None:
                    parties[pid[key]].life_dates = h.life
                text = rows[h.row]["description"][h.span[0]:h.span[1]]
                alias_claim = claim(h.row, "description", h.span[0], h.span[1], text)
                if not any(a.party == pid[key] and a.name_as_written == text for a in aliases):
                    aliases.append(PartyAlias(id=f"pa-{len(aliases) + 1:03d}", party=pid[key],
                                              name_as_written=text, claim=alias_claim))
                h.claim = alias_claim

        for a, b in zip(groups, groups[1:]):
            a_lo, a_hi, a_open = bounds(a)
            b_lo, b_hi, _ = bounds(b)
            start = a_hi if not a_open or a_hi else None
            if a_open and a_hi is None:
                start = b_lo or b_hi  # an open-ended holding runs to the next holder
            end = b_lo or b_hi
            first_b, last_a = b[0], a[-1]
            link, cite_link = "unknown", None
            desc_a = rows[last_a.row]["description"]
            for pattern, kind in LINKS:
                m = pattern.search(desc_a)
                if m:
                    link, cite_link = kind, claim(last_a.row, "description", m.start(), m.end(), m.group(0))
                    break
            else:
                desc_b = rows[first_b.row]["description"]
                m = re.match(r"Restituted to", desc_b) or re.search(r"purchased", desc_b)
                if m:
                    link = "restitution" if desc_b.startswith("Restituted") else "sale"
                    cite_link = claim(first_b.row, "description", m.start(), m.end(), m.group(0))
            cites: dict[str, list[str]] = {
                "from_party": [last_a.claim], "to_party": [first_b.claim]}
            if cite_link:
                cites["link_type"] = [cite_link]
            a_src = next((h for h in reversed(a) if h.hi == start or h.lo == start), last_a)
            b_src = next((h for h in b if h.lo == end or h.hi == end), first_b)
            a_date, b_date = rows[a_src.row].get("date"), rows[b_src.row].get("date")
            if start and a_date:
                cites["date_start"] = [claim(a_src.row, "date", 0, len(a_date), a_date)]
            else:
                start = None
            if end and b_date:
                cites["date_end"] = [claim(b_src.row, "date", 0, len(b_date), b_date)]
            else:
                end = None
            if start and end and start > end:  # overlapping holdings leave no silence between them
                if start[:4] == end[:4]:
                    end = start
                    cites["date_end"] = cites["date_start"]
                else:
                    start = end
                    cites["date_start"] = cites["date_end"]
            if start is None and end is None:
                precision, certainty = "unknown", "unknown"
            elif start is None:
                precision, certainty = "until", "approximate"
            elif end is None:
                precision, certainty = "after", "approximate"
            elif start == end:
                precision, certainty = "exact", "confirmed" if link != "unknown" else "approximate"
            else:
                precision, certainty = "range", "approximate"
            events.append(Event(
                id=f"e-{accession}-{len(events) + 1:03d}", artwork=art_id,
                from_party=pid[party_key(a[0].name)], to_party=pid[party_key(b[0].name)],
                link_type=link, date_start=start, date_end=end, precision=precision,
                certainty=certainty, place=None, cites=cites))

    collection.snapshot_date = latest
    model = EvidenceModel(collections=[collection], source_records=records, claims=claims,
                          artworks=artworks, parties=list(parties.values()), party_aliases=aliases,
                          events=events)
    return Result(model, skipped)
