import json
import urllib.request
from pathlib import Path

import pytest

from provenance import suggest
from provenance.contract import load_evidence

EVIDENCE = Path(__file__).parent.parent / "data" / "evidence"
STAMP = "2026-10-29T00:00:00Z"


@pytest.fixture(scope="module")
def model():
    return load_evidence(EVIDENCE)


def _write_cache(directory, name, bindings):
    directory.mkdir(exist_ok=True)
    (directory / "x.json").write_text(
        json.dumps(
            {
                "name": name,
                "query": "SELECT ...",
                "endpoint": "https://example.test/sparql",
                "retrieved_at": "2026-10-01T10:00:00Z",
                "raw": {"results": {"bindings": bindings}},
            }
        ),
        encoding="utf-8",
    )


def _row(label="Knoedler Sale of Stock Number A1 (1920-03-28)"):
    return {
        "party_label": {"value": "Thannhauser, Justin K."},
        "label": {"value": label},
        "acquisition": {"value": "https://data.getty.edu/provenance/abcd1234-0/tile/t/node/n"},
    }


def _no_network(monkeypatch):
    def boom(*a, **k):
        raise AssertionError("network used")

    monkeypatch.setattr(urllib.request, "urlopen", boom)


def _with_shared_party(model):
    """The real six artworks share no party inside a silence, so add one cross-artwork event."""
    silent = next(e for e in model.events if suggest.is_silence(e) and e.date_start and e.date_end)
    donor = next(e for e in model.events if e.artwork != silent.artwork and e.cites.get("date_start"))
    twin = donor.model_copy(
        update={"id": "e-twin", "from_party": silent.to_party,
                "date_start": silent.date_start, "date_end": silent.date_start}
    )
    return model.model_copy(update={"events": [*model.events, twin]}), silent, twin


def test_existing_on_real_data_is_honest_about_finding_nothing(model):
    for s in suggest.existing(model, STAMP):
        assert s.origin == "existing"


def test_existing_suggestions_are_complete_and_stable(model):
    extended, silent, twin = _with_shared_party(model)
    first = [s for s in suggest.existing(extended, STAMP) if s.event == silent.id]
    assert first
    for s in first:
        assert s.origin == "existing" and s.provider == "loaded data"
        assert s.preview and s.retrieved_at == STAMP and s.url
        assert s.covers_start == silent.date_start
    assert [s.id for s in first] == [
        s.id for s in suggest.existing(extended, STAMP) if s.event == silent.id
    ]
    assert len({s.id for s in first}) == len(first)


def test_external_reads_cache_without_network(model, tmp_path, monkeypatch):
    _no_network(monkeypatch)
    _write_cache(tmp_path / "g", "Justin Thannhauser", [_row()])
    found = suggest.external(model, tmp_path / "g")
    assert found
    for s in found:
        assert s.origin == "external" and s.provider == "Getty Provenance Index"
        assert s.query == "SELECT ..." and s.retrieved_at == "2026-10-01T10:00:00Z"
        assert s.preview and s.url == "https://data.getty.edu/provenance/abcd1234-0"
        assert s.covers_start == "1920"
    assert [s.id for s in found] == [s.id for s in suggest.external(model, tmp_path / "g")]


def test_name_with_no_results_yields_nothing(model, tmp_path, monkeypatch):
    _no_network(monkeypatch)
    _write_cache(tmp_path / "g", "Justin Thannhauser", [])
    assert suggest.external(model, tmp_path / "g") == []


def test_missing_cache_yields_nothing(model, tmp_path):
    assert suggest.external(model, tmp_path / "nope") == []
