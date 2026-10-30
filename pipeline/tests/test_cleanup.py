from pathlib import Path

from provenance.cleanup import build
from provenance.build import ACCESSIONS
from provenance.contract import check_claims_against_raw

ROOT = Path(__file__).parent.parent


def _events(model, accession):
    names = {p.id: p.preferred_name for p in model.parties}
    return [
        (names[e.from_party], names[e.to_party], e.link_type, e.date_start, e.date_end, e.precision)
        for e in model.events
        if e.artwork == f"cma-{accession}"
    ]


def test_every_cleaned_value_cites_words_that_are_really_in_the_source():
    model = build(ROOT / "data/raw/cleveland", ACCESSIONS).model

    assert len(model.artworks) == len(ACCESSIONS)
    assert check_claims_against_raw(model, ROOT) == []


def test_the_silence_between_thannhauser_and_sperling_keeps_its_range():
    model = build(ROOT / "data/raw/cleveland", ACCESSIONS).model

    assert ("Justin Thannhauser", "Harry Sperling", "unknown", "1927", "1940-07", "range") in _events(model, "1958.32")


def test_an_undated_holder_between_an_auction_and_a_sale_spans_the_whole_silence():
    model = build(ROOT / "data/raw/cleveland", ACCESSIONS).model

    assert ("Hotel Drouot", "Octave Linet", "unknown", "1910-12-02", "1963-03-23", "range") in _events(model, "1963.502")


def test_the_hals_seizure_and_restitution_are_both_kept():
    model = build(ROOT / "data/raw/cleveland", ACCESSIONS).model
    events = _events(model, "1999.173")

    assert any(e[1] == "the Nazis" for e in events)
    assert any(e[2] == "restitution" for e in events)


def test_steps_the_rules_cannot_read_are_reported_not_dropped():
    result = build(ROOT / "data/raw/cleveland", ACCESSIONS)

    assert any("Artist's studio inventory" in s for s in result.skipped)
