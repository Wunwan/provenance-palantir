"""Rules-first party matching (ADR 0003): propose which party aliases may be the same real-world party.

Every Match explains itself in plain words. The numeric similarity appears only inside the reasons.
"""

from __future__ import annotations

import re
import unicodedata

from rapidfuzz import fuzz

from .contract import EvidenceModel, Match, Party

STRONG, POSSIBLE, WEAK = 90, 75, 60
_RANK = {"strong": 0, "possible": 1, "weak": 2}
_NOISE = {"dr", "mrs", "mr", "ms", "baron", "baroness", "herr", "frau", "the", "sir", "galerie",
          "gallery", "hotel", "co", "company", "und", "von", "van", "de"}
_TITLES = {"dr", "mrs", "mr", "ms", "baron", "baroness", "herr", "frau", "sir"}


def _fold(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.lower().replace("&", " and "))
    return "".join(c for c in text if not unicodedata.combining(c))


def _tokens(name: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", _fold(name))
    return [w for w in words if w not in _NOISE and w != "and" and w != "jr"] or words


def _dropped(name: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", _fold(name))
    return [w for w in words if w in _TITLES or w in {"galerie", "hotel", "co"}]


def _years(life_dates: str | None) -> set[str]:
    return set(re.findall(r"\d{4}", life_dates or ""))


def _life_relation(a: Party, b: Party) -> str | None:
    """'equal', 'shared' (one year in common), 'conflict', or None when either is unknown."""
    ya, yb = _years(a.life_dates), _years(b.life_dates)
    if not ya or not yb:
        return None
    if a.life_dates == b.life_dates:
        return "equal"
    return "shared" if ya & yb else "conflict"


def _name_score(a: str, b: str) -> tuple[int, bool]:
    """Similarity of two names after normalizing; second value is True when it rests on a subset only."""
    ta, tb = _tokens(a), _tokens(b)
    full = fuzz.token_sort_ratio(" ".join(ta), " ".join(tb))
    short, long_ = (ta, tb) if len(ta) <= len(tb) else (tb, ta)
    if short and set(short) < set(long_):
        # One name is contained in the other ("Nathan" in "Fritz Nathan"): never better than possible.
        return max(min(full, 85), min(int(fuzz.partial_ratio(" ".join(ta), " ".join(tb))), 85) if len(short) > 1 else min(85, 80)), True
    return int(round(full)), False


def compute(model: EvidenceModel) -> list[Match]:
    parties = {p.id: p for p in model.parties}
    names: dict[str, list[str]] = {p.id: [p.preferred_name] for p in model.parties}
    for alias in model.party_aliases:
        if alias.name_as_written not in names[alias.party]:
            names[alias.party].append(alias.name_as_written)

    artworks: dict[str, set[str]] = {p: set() for p in parties}
    received_from: dict[str, set[str]] = {p: set() for p in parties}
    sold_to: dict[str, set[str]] = {p: set() for p in parties}
    for e in model.events:
        for pid in (e.from_party, e.to_party):
            artworks[pid].add(e.artwork)
        received_from[e.to_party].add(e.from_party)
        sold_to[e.from_party].add(e.to_party)

    matches: list[Match] = []
    for alias in model.party_aliases:
        own = parties[alias.party]
        for cand in model.parties:
            if cand.id == own.id:
                continue
            best = (0, False, "")
            for other in names[cand.id]:
                score, subset = _name_score(alias.name_as_written, other)
                if score > best[0]:
                    best = (score, subset, other)
            score, subset, other = best
            if score < WEAK:
                continue

            reasons = [_name_reason(alias.name_as_written, other, score, subset)]
            corroborated = False
            relation = _life_relation(own, cand)
            if relation in ("equal", "shared"):
                what = "the same life dates" if relation == "equal" else "a life date in common"
                reasons.append(f"Both have {what} ({own.life_dates} and {cand.life_dates})")
                corroborated = True
            shared = sorted((artworks[own.id] & artworks[cand.id]))
            if shared and relation != "conflict":
                reasons.append("Both appear in artwork " + ", ".join(shared))
                corroborated = True
            for label, table in (("received it from", received_from), ("passed it on to", sold_to)):
                common = sorted((table[own.id] & table[cand.id]) - {own.id, cand.id})
                if common and relation != "conflict":
                    reasons.append(f"Both {label} {parties[common[0]].preferred_name}")
                    corroborated = True

            band = "strong" if score >= STRONG else "possible" if score >= POSSIBLE else "weak"
            if band == "strong" and not corroborated:
                band = "possible"
                reasons.append("No other evidence yet beyond the name")
            if relation == "conflict":
                band = "weak"
                reasons.append(f"Life dates differ ({own.life_dates} and {cand.life_dates}), which points to different people")
            matches.append(Match(id=f"m-{alias.id}-{cand.id}", alias=alias.id,
                                 candidate_party=cand.id, reasons=reasons, band=band))
    return sorted(matches, key=lambda m: (_RANK[m.band], m.id))


def _name_reason(written: str, other: str, score: int, subset: bool) -> str:
    dropped = sorted(set(_dropped(written)) | set(_dropped(other)))
    if written == other:
        return f"Names are identical: '{written}' (100% similar)"
    base = f"Names '{written}' and '{other}' are {score}% similar"
    if subset:
        base += ", one name containing the other"
    if dropped:
        base += " after dropping " + ", ".join(f"'{w}'" for w in dropped)
    return base
