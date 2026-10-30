import json
from pathlib import Path

import pytest

from provenance.build import ACCESSIONS
from provenance.cleanup import build, is_reversed

RAW = Path(__file__).resolve().parents[1] / "data/raw/cleveland"
MODEL = build(RAW, ACCESSIONS).model
NAMES = {p.id: p.preferred_name for p in MODEL.parties}


def rows(acc):
    return json.loads((RAW / f"{acc}.json").read_text(encoding="utf-8"))["payload"]["provenance"]


@pytest.mark.parametrize("acc,oldest", [("1959.190", "Wouter Valckenier"), ("1962.256", "Marquis de La Rochebousseau")])
def test_latest_first_records_run_oldest_first(acc, oldest):
    assert is_reversed(rows(acc))
    ev = [e for e in MODEL.events if e.artwork == f"cma-{acc}"]
    dates = [e.date_end or e.date_start or "" for e in ev]
    known = [d for d in dates if d]
    assert known == sorted(known)
    assert oldest in NAMES[ev[0].from_party]
    assert "Cleveland Museum of Art" in NAMES[ev[-1].to_party]


@pytest.mark.parametrize("acc", ["1958.32", "1948.137"])
def test_ascending_records_unchanged(acc):
    assert not is_reversed(rows(acc))
    ev = [e for e in MODEL.events if e.artwork == f"cma-{acc}"]
    assert "Cleveland Museum of Art" in NAMES[ev[-1].to_party]
    assert "Cleveland Museum of Art" not in NAMES[ev[0].from_party]


def test_only_those_two_are_reversed():
    assert {a for a in ACCESSIONS if is_reversed(rows(a))} == {"1959.190", "1962.256"}
