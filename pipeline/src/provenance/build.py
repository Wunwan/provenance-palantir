"""Build the evidence model from the raw snapshots and write one JSON file per table."""

import json
import sys
from pathlib import Path

from provenance.cleanup import build
from provenance.contract import TABLES

ACCESSIONS = ["1958.32", "1958.34", "1990.7", "1983.155", "1999.173", "1963.502"]


def write(root: Path, out_dir: Path) -> list[str]:
    result = build(root / "data/raw/cleveland", ACCESSIONS)
    out_dir.mkdir(parents=True, exist_ok=True)
    dumped = result.model.model_dump(mode="json")
    for name, filename in TABLES.items():
        (out_dir / filename).write_text(json.dumps(dumped[name], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out_dir / "skipped_steps.json").write_text(json.dumps(result.skipped, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return result.skipped


if __name__ == "__main__":
    skipped = write(Path(sys.argv[1]), Path(sys.argv[2]))
    print(len(skipped), "steps skipped")
