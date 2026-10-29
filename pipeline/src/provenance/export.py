"""Write the contract's JSON Schema and the fixture dataset for the web app."""

import json
import sys
from pathlib import Path

from provenance.contract import Dataset, load_dataset


def export(fixture: Path, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    schema = Dataset.model_json_schema()
    (out_dir / "contract.schema.json").write_text(json.dumps(schema, indent=2) + "\n", encoding="utf-8")
    dataset = load_dataset(fixture)
    (out_dir / "dataset.json").write_text(
        json.dumps(dataset.model_dump(mode="json"), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    export(Path(sys.argv[1]), Path(sys.argv[2]))
