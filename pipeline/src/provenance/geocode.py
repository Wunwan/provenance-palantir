"""Precompute coordinates for every distinct event place label, from Wikidata, into static JSON.

Run `python -m provenance.geocode` (needs network). The web app never geocodes; it reads
web/src/generated/places.json. Candidates are disambiguated by CONTEXT (the expected country, read from how
the label appears in the provenance texts), never by label alone. Hand-checked values in
data/places.overrides.json win over Wikidata.
"""

import json
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

API = "https://www.wikidata.org/w/api.php"
USER_AGENT = "provenance-palantir/0.1 (art provenance journey map; https://github.com/Wunwan/provenance-palantir)"
DELAY = 1.0

# Expected country per label, confirmed against pipeline/data/raw/cleveland texts
# (e.g. "Oakhill, Hertfordshire", "Leith Hill, Surrey", "Cleveland, OH", "Hoevelaken, The Netherlands",
# "Connecticut Collects ... Wadsworth Atheneum" for Hartford, "Max Siller, Barmen, Germany").
# Not directly confirmed from a country-qualified phrase (inferred from the institution/person): Oslo, Prague,
# Amsterdam, The Hague, Zurich, Basel, St. Gallen, Munich, Berlin, Vienna, London, Paris, Washington, D.C.
CONTEXT = {
    "Amsterdam": "Netherlands", "Austria": "Austria", "Barmen": "Germany", "Basel": "Switzerland",
    "Berlin": "Germany", "Berlin-Zehlendorf": "Germany", "Boston": "United States", "Chantilly": "France",
    "Cleveland": "United States", "Düsseldorf": "Germany", "Ferrières": "France", "Hartford": "United States",
    "Hertfordshire": "United Kingdom", "Hoevelaken": "Netherlands", "London": "United Kingdom",
    "Lucerne": "Switzerland", "Munich": "Germany", "New York": "United States", "Oslo": "Norway",
    "Paris": "France", "Prague": "Czech Republic", "Shaker Heights": "United States",
    "St. Gallen": "Switzerland", "Surrey": "United Kingdom", "The Hague": "Netherlands",
    "Utrecht": "Netherlands", "Vienna": "Austria", "Washington, D.C.": "United States", "Zurich": "Switzerland",
}
# Accept only these kinds of item (instance of), by Wikidata class.
COUNTRY_TYPES = {"Q6256", "Q3624078", "Q179164"}
REGION_TYPES = {"Q180673", "Q21451", "Q35657", "Q10742", "Q171441", "Q1187580", "Q22721"}
CITY_TYPES = {
    "Q515", "Q3957", "Q1549591", "Q1637706", "Q5119", "Q486972", "Q15284", "Q484170", "Q262166", "Q2039348",
    "Q70208", "Q747074", "Q13218357", "Q42744322", "Q1115575", "Q200250", "Q133346", "Q123705", "Q5084",
    "Q2989398", "Q1500350", "Q29946056", "Q14770", "Q702492", "Q15116915", "Q1093829", "Q15127012", "Q532",
    "Q1021645", "Q3184121", "Q3199915", "Q1266818",
}


def slug(label: str) -> str:
    s = unicodedata.normalize("NFKD", label).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def classify(instance_ids: set[str]) -> str | None:
    """Precision from the item's types, or None when it is not a place kind we accept."""
    if instance_ids & COUNTRY_TYPES:
        return "country"
    if instance_ids & CITY_TYPES:
        return "city"  # a city-state such as Vienna is still drawn as a city
    if instance_ids & REGION_TYPES:
        return "region"
    return None


def _claim_ids(entity: dict, prop: str) -> set[str]:
    out = set()
    for c in entity.get("claims", {}).get(prop, []):
        v = c.get("mainsnak", {}).get("datavalue", {}).get("value")
        if isinstance(v, dict) and "id" in v:
            out.add(v["id"])
    return out


def _coord(entity: dict):
    for c in entity.get("claims", {}).get("P625", []):
        v = c.get("mainsnak", {}).get("datavalue", {}).get("value")
        if isinstance(v, dict) and "latitude" in v:
            return v["latitude"], v["longitude"]
    return None


def _get(params: dict) -> dict:
    url = API + "?" + urllib.parse.urlencode({**params, "format": "json"})
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.loads(r.read().decode("utf-8"))
    time.sleep(DELAY)
    return data


def search(label: str) -> list[str]:
    data = _get({"action": "wbsearchentities", "search": label, "language": "en", "limit": 7})
    return [h["id"] for h in data.get("search", [])]


def entities(ids: list[str], props: str = "claims|labels") -> dict:
    if not ids:
        return {}
    return _get({"action": "wbgetentities", "ids": "|".join(ids), "props": props, "languages": "en"}).get("entities", {})


def pick(label: str, candidate_ids: list[str], ents: dict, country_labels: dict, expected_country: str):
    """First candidate (search order) that is an accepted place type in the expected country, or None."""
    for qid in candidate_ids:
        e = ents.get(qid)
        if not e:
            continue
        precision = classify(_claim_ids(e, "P31"))
        coord = _coord(e)
        if precision is None or coord is None:
            continue
        if precision == "country":
            countries = {e.get("labels", {}).get("en", {}).get("value", "")}
        else:
            countries = {country_labels.get(c, "") for c in _claim_ids(e, "P17")}
        if expected_country not in countries:
            continue
        return {"qid": qid, "lat": coord[0], "lon": coord[1], "precision": precision}
    return None


def resolve(label: str, expected_country: str):
    ids = search(label)
    ents = entities(ids)
    cids = sorted({c for e in ents.values() for c in _claim_ids(e, "P17")})
    cents = entities(cids, "labels")
    country_labels = {k: v.get("labels", {}).get("en", {}).get("value", "") for k, v in cents.items()}
    return pick(label, ids, ents, country_labels, expected_country)


def event_labels(evidence: dict) -> list[str]:
    return sorted({e["place"] for e in evidence.get("events", []) if e.get("place") and e["place"] != "Unknown"})


def build(labels: list[str], overrides: dict, resolver, today: str) -> dict:
    places, mapping = [], {}
    for label in labels:
        if label == "Unknown":
            continue
        ov = overrides.get(label)
        if ov:
            p = {"id": slug(label), "label": label, "lat": ov["lat"], "lon": ov["lon"], "precision": ov["precision"],
                 "source": "manual", "retrievedAt": ov.get("retrievedAt", today)}
            if ov.get("wikidataId"):
                p["wikidataId"] = ov["wikidataId"]
            if ov.get("note"):
                p["note"] = ov["note"]
        else:
            r = resolver(label) if label in CONTEXT else None
            if not r:
                mapping[label] = None
                continue
            p = {"id": slug(label), "label": label, "lat": r["lat"], "lon": r["lon"], "precision": r["precision"],
                 "wikidataId": r["qid"], "source": "wikidata", "retrievedAt": today}
        places.append(p)
        mapping[label] = p["id"]
    return {"places": places, "labels": mapping}


def main() -> None:
    root = Path(__file__).resolve().parents[3]
    evidence = json.loads((root / "web/src/generated/evidence.json").read_text(encoding="utf-8"))
    ov_path = root / "pipeline/data/places.overrides.json"
    overrides = json.loads(ov_path.read_text(encoding="utf-8")) if ov_path.exists() else {}
    labels = event_labels(evidence)
    out = build(labels, overrides, lambda l: resolve(l, CONTEXT[l]), date.today().isoformat())
    text = json.dumps(out, ensure_ascii=False, indent=2) + "\n"
    (root / "pipeline/data/places.json").write_text(text, encoding="utf-8")
    (root / "web/src/generated/places.json").write_text(text, encoding="utf-8")
    unresolved = [l for l, v in out["labels"].items() if v is None]
    manual = [p for p in out["places"] if p["source"] == "manual"]
    print(f"resolved {len(out['places'])} ({len(manual)} manual), unresolved {len(unresolved)}: {unresolved}")


if __name__ == "__main__":
    sys.exit(main())
