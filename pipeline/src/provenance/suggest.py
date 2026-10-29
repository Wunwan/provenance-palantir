"""Suggestions for silences: from loaded data (existing) and from the Getty cache (external).

Rules first (ADR 0003). Real records only: no match means no suggestion.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from .contract import EvidenceModel, Event, Suggestion

PROVIDER_EXISTING = "loaded data"
PROVIDER_GETTY = "Getty Provenance Index"
DEFAULT_CACHE = Path(__file__).parent.parent.parent / "data" / "getty"


def _year(value: str | None) -> int | None:
    match = re.match(r"-?\d{4}", value or "")
    return int(match.group()) if match else None


def is_silence(event: Event) -> bool:
    return event.date_start != event.date_end or event.date_start is None or event.date_end is None


def _span(start: str | None, end: str | None) -> tuple[int, int] | None:
    lo, hi = _year(start), _year(end)
    if lo is None and hi is None:
        return None
    return (lo if lo is not None else hi, hi if hi is not None else lo)  # type: ignore[return-value]


def _touches(a: tuple[int, int], b: tuple[int, int]) -> bool:
    return a[0] <= b[1] and b[0] <= a[1]


def existing(model: EvidenceModel, retrieved_at: str) -> list[Suggestion]:
    claims = {c.id: c for c in model.claims}
    records = {r.id: r for r in model.source_records}
    titles = {a.id: a.title for a in model.artworks}
    parties = {p.id: p.preferred_name for p in model.parties}
    out: list[Suggestion] = []
    for silent in model.events:
        if not is_silence(silent):
            continue
        gap = _span(silent.date_start, silent.date_end)
        if gap is None:
            continue
        mine = {silent.from_party, silent.to_party}
        for other in model.events:
            if other.artwork == silent.artwork:
                continue
            shared = sorted(mine & {other.from_party, other.to_party})
            span = _span(other.date_start, other.date_end)
            if not shared or span is None or not _touches(gap, span):
                continue
            cited = next((c for ids in other.cites.values() for c in ids if c in claims), None)
            if cited is None:
                continue
            claim = claims[cited]
            record = records[claim.source_record]
            name = parties[shared[0]]
            when = other.date_start if other.date_start == other.date_end else (
                f"{other.date_start or '?'} to {other.date_end or '?'}"
            )
            out.append(
                Suggestion(
                    id=f"s-existing-{silent.id}-{other.id}",
                    event=silent.id,
                    origin="existing",
                    provider=PROVIDER_EXISTING,
                    query=None,
                    preview=(
                        f"{name} also appears in the history of {titles[other.artwork]} "
                        f"({when}); its source says “{claim.text}”."
                    ),
                    url=record.url,
                    retrieved_at=retrieved_at,
                    covers_start=other.date_start,
                    covers_end=other.date_end,
                )
            )
    return out


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _record_url(acquisition_uri: str) -> str:
    return acquisition_uri.split("/tile/")[0]


def _label_dates(label: str) -> tuple[str | None, str | None]:
    found = re.search(r"\((\d{4})(?:-\d{2}(?:-\d{2})?)?\)", label)
    return (found.group(1), found.group(1)) if found else (None, None)


def external(model: EvidenceModel, cache_dir: Path = DEFAULT_CACHE) -> list[Suggestion]:
    """Read ONLY the cache. Never touches the network."""
    cache_dir = Path(cache_dir)
    if not cache_dir.is_dir():
        return []
    parties = {p.id: p.preferred_name for p in model.parties}
    files = []
    for path in sorted(cache_dir.glob("*.json")):
        cached = json.loads(path.read_text(encoding="utf-8"))
        files.append((path.stem, cached))

    out: list[Suggestion] = []
    seen: set[str] = set()
    for silent in model.events:
        if not is_silence(silent):
            continue
        names = {_norm(parties[silent.from_party]), _norm(parties[silent.to_party])}
        for stem, cached in files:
            if _norm(cached["name"]) not in names:
                continue
            for row in cached["raw"]["results"]["bindings"]:
                label = row["label"]["value"]
                url = _record_url(row["acquisition"]["value"])
                start, end = _label_dates(label)
                record_span = _span(start, end)
                gap = _span(silent.date_start, silent.date_end)
                if record_span and gap and not _touches(gap, record_span):
                    continue
                sid = f"s-getty-{silent.id}-{stem}-{url.rsplit('/', 1)[-1][:8]}"
                if sid in seen:
                    continue
                seen.add(sid)
                out.append(
                    Suggestion(
                        id=sid,
                        event=silent.id,
                        origin="external",
                        provider=PROVIDER_GETTY,
                        query=cached["query"],
                        preview=(
                            f"Getty Provenance Index records “{label}” involving "
                            f"{row['party_label']['value'].rstrip('.')}."
                        ),
                        url=url,
                        retrieved_at=cached["retrieved_at"],
                        covers_start=start,
                        covers_end=end,
                    )
                )
    return out
