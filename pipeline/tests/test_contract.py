from pathlib import Path

from provenance.contract import load_evidence

FIXTURE = Path(__file__).parent.parent / "fixtures" / "van-gogh"


def test_the_van_gogh_fixture_validates_against_the_contract():
    model = load_evidence(FIXTURE)

    assert [a.accession for a in model.artworks] == ["1958.32"]
    assert len(model.events) == 11


def _copy_fixture(tmp_path):
    import shutil

    target = tmp_path / "fixture"
    shutil.copytree(FIXTURE, target)
    return target


def _edit(directory, table, change):
    import json

    path = directory / table
    rows = json.loads(path.read_text(encoding="utf-8"))
    change(rows)
    path.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")


def test_an_event_value_without_a_claim_is_rejected(tmp_path):
    import pytest
    from pydantic import ValidationError

    broken = _copy_fixture(tmp_path)
    _edit(broken, "event.json", lambda rows: rows[0]["cites"].pop("date_end"))

    with pytest.raises(ValidationError, match="date_end has no claim"):
        load_evidence(broken)


def test_an_event_citing_a_claim_that_does_not_exist_is_rejected(tmp_path):
    import pytest
    from pydantic import ValidationError

    broken = _copy_fixture(tmp_path)
    _edit(broken, "event.json", lambda rows: rows[0]["cites"].update(to_party=["c-99"]))

    with pytest.raises(ValidationError, match="unknown claim"):
        load_evidence(broken)


def test_every_claim_quotes_the_real_source_text():
    from provenance.contract import check_claims_against_raw

    model = load_evidence(FIXTURE)

    assert check_claims_against_raw(model, FIXTURE.parent.parent) == []


def test_a_claim_whose_words_are_not_in_the_source_is_reported(tmp_path):
    from provenance.contract import check_claims_against_raw

    broken = _copy_fixture(tmp_path)
    _edit(broken, "claim.json", lambda rows: rows[0].update(text="Vincent"))
    model = load_evidence(broken)

    problems = check_claims_against_raw(model, FIXTURE.parent.parent)

    assert len(problems) == 1 and problems[0].startswith("c-01")
