"""Write the contract's JSON Schema and the fixture model for the web app."""

import json
import sys
from pathlib import Path

from provenance.contract import EvidenceModel, load_evidence


def export(fixture: Path, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    schema = EvidenceModel.model_json_schema()
    (out_dir / "contract.schema.json").write_text(json.dumps(schema, indent=2) + "\n", encoding="utf-8")
    model = load_evidence(fixture)
    (out_dir / "evidence.json").write_text(
        json.dumps(model.model_dump(mode="json"), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    export(Path(sys.argv[1]), Path(sys.argv[2]))
