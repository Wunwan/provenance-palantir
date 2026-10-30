from pathlib import Path

from provenance.build import ACCESSIONS
from provenance.cleanup import build
from provenance.matching import compute

ROOT = Path(__file__).parent.parent


def _model():
    return build(ROOT / "data/raw/cleveland", ACCESSIONS).model


def _by_names(model, matches, written, candidate_name):
    aliases = {a.id: a.name_as_written for a in model.party_aliases}
    parties = {p.id: p.preferred_name for p in model.parties}
    return [m for m in matches
            if aliases[m.alias] == written and parties[m.candidate_party] == candidate_name]


def test_fritz_nathan_and_dr_fritz_nathan_are_proposed_and_not_weak():
    model = _model()
    found = _by_names(model, compute(model), "Fritz Nathan", "Dr. Fritz Nathan")

    assert len(found) == 1
    assert found[0].band == "strong"  # same name bar the title, same artwork cma-1983.155
    assert any("cma-1983.155" in r for r in found[0].reasons)


def test_every_match_explains_itself_and_never_matches_a_party_to_itself():
    model = _model()
    matches = compute(model)
    alias_party = {a.id: a.party for a in model.party_aliases}

    assert matches
    assert all(m.reasons and all(r.strip() for r in m.reasons) for m in matches)
    assert all(alias_party[m.alias] != m.candidate_party for m in matches)
    assert len({m.id for m in matches}) == len(matches)
    assert all(m.id == f"m-{m.alias}-{m.candidate_party}" for m in matches)


def test_results_are_deterministic_and_ordered_by_band_then_id():
    model = _model()
    first, second = compute(model), compute(model)

    assert [m.model_dump() for m in first] == [m.model_dump() for m in second]
    rank = {"strong": 0, "possible": 1, "weak": 2}
    assert [(rank[m.band], m.id) for m in first] == sorted((rank[m.band], m.id) for m in first)


def test_different_people_with_similar_names_do_not_become_strong():
    model = _model()
    matches = compute(model)
    parties = {p.id: p.preferred_name for p in model.parties}
    aliases = {a.id: a.name_as_written for a in model.party_aliases}

    # Barons Albert and Alphonse von Rothschild have different life dates (1844-1911, 1878-1942).
    # The same Baron Albert recorded under two artworks is one person, so a strong match there is right.
    rothschilds = [m for m in matches if "Rothschild" in aliases[m.alias]
                   and "Rothschild" in parties[m.candidate_party]
                   and aliases[m.alias] != parties[m.candidate_party]
                   and "Heirs" not in aliases[m.alias] + parties[m.candidate_party]]
    # Different Rothschilds may be a lead ("possible") but never "strong"; strong needs the same life dates.
    assert rothschilds and all(m.band != "strong" or any("same life dates" in r for r in m.reasons) for m in rothschilds)
    # Theo van Gogh and the dealers (Knoedler, Wildenstein, Salz, ...) are nowhere near each other.
    van_gogh = [m for m in matches if "van Gogh" in aliases[m.alias]]
    assert all(m.band != "strong" for m in van_gogh)
    # Jacques Balsan (1868-1956) is not Mrs. Jules Balsan (1877-1964).
    balsans = _by_names(model, matches, "Jacques Balsan", "Mrs. Jules Balsan")
    assert balsans and balsans[0].band == "weak"


def test_a_name_with_nothing_but_the_name_behind_it_stays_possible():
    model = _model()
    drouot = _by_names(model, compute(model), "Drouot", "Hotel Drouot")

    assert [m.band for m in drouot] == ["possible"]
