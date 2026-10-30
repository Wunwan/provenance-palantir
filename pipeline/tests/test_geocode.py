from provenance import geocode as g


def entity(types, country, lat=1.0, lon=2.0, label="X"):
    claims = {"P31": [{"mainsnak": {"datavalue": {"value": {"id": t}}}} for t in types]}
    if country:
        claims["P17"] = [{"mainsnak": {"datavalue": {"value": {"id": country}}}}]
    if lat is not None:
        claims["P625"] = [{"mainsnak": {"datavalue": {"value": {"latitude": lat, "longitude": lon}}}}]
    return {"claims": claims, "labels": {"en": {"value": label}}}


def test_slug():
    assert g.slug("Washington, D.C.") == "washington-d-c"
    assert g.slug("Düsseldorf") == "dusseldorf"
    assert g.slug("St. Gallen") == "st-gallen"


def test_classify():
    assert g.classify({"Q515"}) == "city"
    assert g.classify({"Q180673"}) == "region"
    assert g.classify({"Q6256"}) == "country"
    assert g.classify({"Q515", "Q35657"}) == "city"  # city-state
    assert g.classify({"Q5"}) is None


def test_context_filtering_picks_right_country_and_type():
    ents = {
        "Q1": entity(["Q515"], "Q30"),
        "Q2": entity(["Q4167410"], "Q142"),
        "Q3": entity(["Q515"], "Q142", 48.8, 2.3),
    }
    countries = {"Q30": "United States", "Q142": "France"}
    r = g.pick("Paris", ["Q1", "Q2", "Q3"], ents, countries, "France")
    assert r["qid"] == "Q3" and r["precision"] == "city"
    assert g.pick("Paris", ["Q1", "Q2"], ents, countries, "France") is None


def test_country_item_matches_own_label_and_needs_coordinates():
    ents = {"Q40": entity(["Q6256"], None, 47.3, 13.3, "Austria")}
    assert g.pick("Austria", ["Q40"], ents, {}, "Austria")["precision"] == "country"
    ents["Q40"] = entity(["Q6256"], None, None, None, "Austria")
    assert g.pick("Austria", ["Q40"], ents, {}, "Austria") is None


def test_resolve_with_monkeypatched_http(monkeypatch):
    ents = {"Q3": entity(["Q180673"], "Q145", 51.7, -0.2)}

    def fake_get(params):
        if params["action"] == "wbsearchentities":
            return {"search": [{"id": "Q3"}]}
        if params["props"] == "labels":
            return {"entities": {"Q145": {"labels": {"en": {"value": "United Kingdom"}}}}}
        return {"entities": ents}

    monkeypatch.setattr(g, "_get", fake_get)
    r = g.resolve("Hertfordshire", "United Kingdom")
    assert r["precision"] == "region" and r["qid"] == "Q3"


def test_override_wins_and_unknown_never_emitted():
    overrides = {"Barmen": {"lat": 51.27, "lon": 7.2, "precision": "city", "wikidataId": "Q1", "note": "historical"}}
    calls = []

    def resolver(label):
        calls.append(label)
        return {"qid": "Q9", "lat": 0.0, "lon": 0.0, "precision": "city"}

    out = g.build(["Barmen", "Unknown", "Paris", "Nowhere"], overrides, resolver, "2026-01-01")
    by = {p["label"]: p for p in out["places"]}
    assert by["Barmen"]["source"] == "manual" and by["Barmen"]["lat"] == 51.27
    assert "Barmen" not in calls
    assert by["Paris"]["source"] == "wikidata"
    assert "Unknown" not in out["labels"] and all(p["label"] != "Unknown" for p in out["places"])
    assert out["labels"]["Nowhere"] is None  # no CONTEXT entry, so unresolved


def test_event_labels_skip_unknown_and_null():
    ev = {"events": [{"place": "Paris"}, {"place": None}, {"place": "Unknown"}, {"place": "Paris"}, {}]}
    assert g.event_labels(ev) == ["Paris"]
