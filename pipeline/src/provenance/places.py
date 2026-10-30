"""Place extraction by rule: the place a holder is named at, in the words of the provenance step.

The gazetteer lists only places that appear in the 16 records' provenance text.
A place is returned only (city, then county or region, then country) when the text states exactly one; otherwise None (a question, not a guess).
"""

import re

CITIES = [
    "Berlin-Zehlendorf", "Saint-Germain-en Laye", "Washington, D.C.", "Shaker Heights", "The Hague",
    "Hoevelaken", "Carmarten", "Chantilly", "Ferrières", "Budapest", "Orrouy", "Utrecht", "Prague",
    "Boston", "Linz", "Oslo",
    "Alt Aussee", "St. Gallen", "New York", "Amsterdam", "Düsseldorf", "Kremsmünster", "Innsbruck",
    "Cleveland", "Hartford", "Barmen", "Lucerne", "Munich", "Vienna", "London", "Berlin", "Zürich",
    "Zurich", "Basel", "Paris", "Tours",
]
REGIONS = ["Hertfordshire", "Surrey"]
COUNTRIES = ["Czech Republic", "United Kingdom", "Netherlands", "Germany", "Austria", "France", "Norway"]
CANONICAL = {"Zürich": "Zurich"}
ENDS = re.compile(r",?\s*(?:sold|by descent|by gift|by bequest|purchased|consigned|to the)\b", re.I)


def _finder(names: list[str]) -> re.Pattern:
    alts = "|".join(re.escape(n) for n in sorted(names, key=len, reverse=True))
    return re.compile(rf"(?<![\w])({alts})(?![\w])")


CITY_RE, REGION_RE, COUNTRY_RE = _finder(CITIES), _finder(REGIONS), _finder(COUNTRIES)


def place_for(segment: str) -> tuple[str, tuple[int, int]] | None:
    """Return (place, (start, end)) for the one place the segment states before any transfer wording."""
    end = ENDS.search(segment)
    text = segment[:end.start()] if end else segment
    for pattern in (CITY_RE, REGION_RE, COUNTRY_RE):  # the most specific tier that matches decides
        found = [(CANONICAL.get(m.group(1), m.group(1)), m.span(1)) for m in pattern.finditer(text)]
        if found:
            return found[0] if len({c for c, _ in found}) == 1 else None
    return None
