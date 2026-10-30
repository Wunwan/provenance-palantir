import hashlib
import json
from pathlib import Path

import pytest

from provenance import preview
from provenance.preview import ACCESSION, PreviewError

DATA = Path(__file__).parent.parent / "data"
RAW = DATA / "raw" / "cleveland"


def tree_hash() -> str:
    h = hashlib.sha256()
    for path in sorted(p for p in DATA.rglob("*") if p.is_file()):
        h.update(str(path).encode())
        h.update(path.read_bytes())
    return h.hexdigest()


def snapshot(accession: str) -> dict:
    return json.loads((RAW / f"{accession}.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("good", ["1965.233", "1958.32", "2003.225", "1958.1a", "1999.12345"])
def test_accession_pattern_accepts(good):
    assert ACCESSION.fullmatch(good)


@pytest.mark.parametrize("bad", ["", "abc", "1965", "1965.", "65.233", "1965.233; ls", "1965.233\n", "../x", "1965.123456"])
def test_accession_pattern_rejects(bad):
    assert not ACCESSION.fullmatch(bad)


def test_bad_request_never_fetches(monkeypatch):
    monkeypatch.setattr(preview, "fetch_snapshot", lambda a: pytest.fail("fetched"))
    out = preview.preview("nope")
    assert out["ok"] is False and out["code"] == "bad_request"


def test_stages_and_fragment_from_existing_snapshot(monkeypatch):
    snap = snapshot("1958.32")
    monkeypatch.setattr(preview, "fetch_snapshot", lambda a: (snap, 200))
    before = tree_hash()
    out = preview.preview("1958.32")
    assert tree_hash() == before
    assert out["ok"] is True
    assert out["alreadyInCollection"] == "cma-1958.32"
    assert out["artwork"]["title"] == snap["payload"]["title"]
    rows = snap["payload"]["provenance"]
    assert [r["description"] for r in out["raw"]] == [r["description"] for r in rows]
    assert [r["index"] for r in out["raw"]] == list(range(len(rows)))
    st = out["stages"]
    assert st["fetch"]["httpStatus"] == 200 and st["fetch"]["rawSteps"] == len(rows)
    assert st["snapshot"]["license"] == snap["payload"]["share_license_status"]
    assert st["snapshot"]["bytes"] > 0
    frag = out["fragment"]
    assert set(frag) == {"artworks", "parties", "party_aliases", "events", "claims", "source_records"}
    assert [a["id"] for a in frag["artworks"]] == ["cma-1958.32"]
    assert [r["id"] for r in frag["source_records"]] == ["sr-1958.32"]
    assert st["clean"] == {"events": len(frag["events"]), "parties": len(frag["parties"]),
                           "aliases": len(frag["party_aliases"]), "skippedSteps": st["clean"]["skippedSteps"]}
    assert st["claims"]["count"] == len(frag["claims"])
    assert st["claims"]["withPlace"] == sum(1 for e in frag["events"] if e["place"])
    assert all(e["artwork"] == "cma-1958.32" for e in frag["events"])
    party_ids = {p["id"] for p in frag["parties"]}
    assert all(e["from_party"] in party_ids and e["to_party"] in party_ids for e in frag["events"])
    assert isinstance(st["match"]["newMatches"], int)
    json.dumps(out)


def test_no_provenance(monkeypatch):
    snap = snapshot("1958.32")
    snap["payload"] = {**snap["payload"], "provenance": []}
    monkeypatch.setattr(preview, "fetch_snapshot", lambda a: (snap, 200))
    out = preview.preview("1958.32")
    assert out["ok"] is False and out["code"] == "no_provenance"


def test_not_found_and_api_error(monkeypatch):
    def missing(a):
        raise PreviewError("not_found", "none")

    monkeypatch.setattr(preview, "fetch_snapshot", missing)
    assert preview.preview("1900.1")["code"] == "not_found"

    def boom(a):
        raise RuntimeError("down")

    monkeypatch.setattr(preview, "fetch_snapshot", boom)
    assert preview.preview("1900.1")["code"] == "api_error"
