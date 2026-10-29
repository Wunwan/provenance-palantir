"""One-off fetch of Getty Provenance Index records for parties next to gaps.

Run once: `uv run python -m provenance.getty_fetch`. Each raw SPARQL result is
saved under data/getty/<slug>.json. suggest.external() reads only those files.
"""

from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ENDPOINT = "https://data.getty.edu/provenance/sparql"
CACHE_DIR = Path(__file__).parent.parent.parent / "data" / "getty"

# (name as it appears next to a gap in the loaded data, lowercase label fragment to search for)
NAMES = [
    ("Justin Thannhauser", "thannhauser"),
    ("Alfred Flechtheim", "flechtheim"),
    ("Paul Cassirer", "cassirer"),
    ("Knoedler & Co.", "knoedler"),
    ("Fritz Nathan", "nathan, fritz"),
    ("Georges Petit", "petit, georges"),
    ("Hotel Drouot", "drouot"),
    ("Boussod", "boussod"),
    ("Max Behrendt", "behrendt"),
    ("Jules Strauss", "strauss, jules"),
    ("Harry Sperling", "sperling"),
    ("August Pellerin", "pellerin"),
]

QUERY = """PREFIX crm: <http://www.cidoc-crm.org/cidoc-crm/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT DISTINCT ?party ?party_label ?acquisition ?label WHERE {{
  ?party a ?kind ; rdfs:label ?party_label .
  FILTER(?kind IN (crm:E21_Person, crm:E74_Group))
  FILTER(CONTAINS(LCASE(STR(?party_label)), "{fragment}"))
  ?acquisition (crm:P22_transferred_title_to|crm:P23_transferred_title_from) ?party ;
               a crm:E8_Acquisition ; rdfs:label ?label .
}} LIMIT 25"""


def slug(name: str) -> str:
    return "".join(c.lower() if c.isalnum() else "-" for c in name).strip("-")


def run_query(query: str) -> dict:
    request = urllib.request.Request(
        ENDPOINT,
        data=query.encode("utf-8"),
        headers={
            "Content-Type": "application/sparql-query",
            "Accept": "application/sparql-results+json",
            "User-Agent": "provenance-palantir/0.1 (research prototype)",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    for name, fragment in NAMES:
        query = QUERY.format(fragment=fragment)
        try:
            raw = run_query(query)
        except Exception as error:  # report honestly, keep going
            print(f"{name}: FAILED ({error})")
            time.sleep(2)
            continue
        out = {
            "name": name,
            "query": query,
            "endpoint": ENDPOINT,
            "retrieved_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "raw": raw,
        }
        (CACHE_DIR / f"{slug(name)}.json").write_text(
            json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"{name}: {len(raw['results']['bindings'])} results")
        time.sleep(2)


if __name__ == "__main__":
    main()
