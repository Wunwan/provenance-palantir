"""Write web/src/generated/sources.json: which sources the evidence came from, read from the pipeline data."""

import json
from pathlib import Path

from provenance.ingest import API

CLEVELAND_DESCRIPTION = (
    "The museum's public collection API. Each record is stored exactly as fetched, then its provenance steps "
    "are cleaned into events, parties and claims that point back to the original words."
)
GETTY_DESCRIPTION = (
    "Dealer stock books and sales catalogs, searched ahead of time for the names in a gap. It only produces "
    "leads: suggestions to review. Nothing from this source is added to a chain, and accepting a lead does not yet change a gap."
)


def _read(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def build_sources(data_dir: Path, out_existing: Path) -> dict:
    records = []
    for path in sorted((data_dir / "raw" / "cleveland").glob("*.json")):
        snap = _read(path)
        accession = path.stem
        records.append({
            "id": f"sr-{accession}", "accession": accession, "artworkId": f"cma-{accession}",
            "license": snap["payload"]["share_license_status"], "retrievedAt": snap["retrieved_at"],
            "version": snap["version"], "url": snap["url"],
        })

    suggestions = _read(data_dir / "evidence" / "suggestion.json")
    lookups = []
    for path in sorted((data_dir / "getty").glob("*.json")):
        cache = _read(path)
        # a suggestion came from this lookup when it carries the lookup's own stored query
        results = sum(1 for s in suggestions if s["origin"] == "external" and s["query"] == cache["query"])
        lookups.append({"name": cache["name"], "query": cache["query"], "endpoint": cache["endpoint"],
                        "retrievedAt": cache["retrieved_at"], "results": results})
    # Not derivable from stored data: getty_fetch saves a file only on success and records no failures,
    # so a name with no file may have timed out or never been run. Keep the hand-curated list.
    not_covered = []
    if out_existing.exists():
        prior = next((p for p in _read(out_existing)["providers"] if p.get("id") == "getty"), {})
        not_covered = prior.get("notCovered", [])

    return {"providers": [
        {"id": "cleveland", "name": "Cleveland Museum of Art Open Access API", "kind": "API", "role": "records",
         "description": CLEVELAND_DESCRIPTION, "endpoint": API, "license": "CC0 (per record)",
         "retrievedAt": max((r["retrievedAt"] for r in records), default=""), "records": records},
        {"id": "getty", "name": "Getty Provenance Index", "kind": "Cached lookup", "role": "suggestions",
         "description": GETTY_DESCRIPTION, "endpoint": "https://data.getty.edu/provenance/sparql",
         "license": "See Getty's terms of use",
         "retrievedAt": max((l["retrievedAt"] for l in lookups), default=""), "lookups": lookups,
         "notCovered": not_covered},
    ]}


def write_sources(data_dir: Path, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "sources.json").write_text(
        json.dumps(build_sources(data_dir, out_dir / "sources.json"), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
