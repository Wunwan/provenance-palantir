"""Build the evidence model from the raw snapshots and write one JSON file per table."""

import json
import sys
from pathlib import Path

import datetime

from provenance import matching, suggest
from provenance.cleanup import build
from provenance.contract import TABLES

ACCESSIONS = ["1958.32", "1958.34", "1990.7", "1983.155", "1999.173", "1963.502"]


def write(root: Path, out_dir: Path) -> list[str]:
    result = build(root / "data/raw/cleveland", ACCESSIONS)
    model = result.model
    names = {p.id: p.preferred_name for p in model.parties}
    aliases = {a.id: a.name_as_written for a in model.party_aliases}
    # the holding institution appears once per artwork; matching it to itself is noise, not a lead
    model.matches = [
        m for m in matching.compute(model)
        if "Cleveland Museum" not in names[m.candidate_party] and "Cleveland Museum" not in aliases[m.alias]
    ]
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    model.suggestions = suggest.existing(model, now) + suggest.external(model)
    out_dir.mkdir(parents=True, exist_ok=True)
    dumped = result.model.model_dump(mode="json")
    for name, filename in TABLES.items():
        (out_dir / filename).write_text(json.dumps(dumped[name], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out_dir / "skipped_steps.json").write_text(json.dumps(result.skipped, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return result.skipped


if __name__ == "__main__":
    skipped = write(Path(sys.argv[1]), Path(sys.argv[2]))
    print(len(skipped), "steps skipped")
