from provenance.places import place_for


def test_city_before_country():
    seg = ", Paris, France"
    assert place_for(seg) == ("Paris", (2, 7))


def test_stops_at_transfer_wording():
    assert place_for(" [1863-1932] Amsterdam, Netherlands, sold to Alfred Flechtheim")[0] == "Amsterdam"
    assert place_for(", Barmen, Germany")[0] == "Barmen"


def test_buyer_place_after_sold_is_not_holders():
    assert place_for(", sold to Louis Schoengrün, Paris") is None


def test_ambiguous_returns_none():
    assert place_for(", Munich, Berlin, Lucerne") is None
    assert place_for(", Paris and Tours, France") is None


def test_no_place():
    assert place_for("") is None
    assert place_for(", sold to Dr. Tobler") is None


def test_normalises_and_new_york():
    assert place_for(", Zürich, sold to the Cleveland Museum of Art")[0] == "Zurich"
    assert place_for(", New York, NY")[0] == "New York"


def test_region_and_country_tiers():
    seg = " (1795-1880) of Leith Hill Place, Surrey"
    place, (a, b) = place_for(seg)
    assert (place, seg[a:b]) == ("Surrey", "Surrey")
    assert place_for(", Oslo, Norway")[0] == "Oslo"
    assert place_for(", Prague, Czech Republic.")[0] == "Prague"
    assert place_for(", Saint-Germain-en Laye, Paris, France") is None
