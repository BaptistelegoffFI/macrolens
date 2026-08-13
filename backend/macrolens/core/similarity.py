"""Distance pondérée, exclusions du pool, recherche des k plus proches
(§8.3, §8.4, §8.5). Code métier pur : numpy/dataclasses seulement.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

FEATURE_FAMILIES: tuple[str, ...] = (
    "prices",
    "activity",
    "rates",
    "debt",
    "credit",
    "markets",
    "external",
)


@dataclass(frozen=True)
class StateVector:
    """Un point (pays, année) : rangs percentiels des 14 features (§8.2),
    déjà calculés par normalize.py. `ranks[f]` peut être NaN si la feature
    n'était pas calculable — un tel point ne devrait pas entrer dans le pool
    si `is_complete=False`."""

    country: str
    year: int
    ranks: dict[str, float]
    is_complete: bool = True
    is_break: bool = False
    coverage_partial: bool = False


@dataclass(frozen=True)
class AnalogResult:
    country: str
    year: int
    distance: float
    similarity: float
    feature_contributions: dict[str, float]


@dataclass(frozen=True)
class ExclusionCounts:
    incomplete: int = 0
    self_adjacent: int = 0
    too_recent: int = 0
    breaks: int = 0
    partial_coverage: int = 0
    user_excluded: int = 0

    @property
    def total(self) -> int:
        return (
            self.incomplete
            + self.self_adjacent
            + self.too_recent
            + self.breaks
            + self.partial_coverage
            + self.user_excluded
        )


@dataclass(frozen=True)
class PoolEntry:
    country: str
    year: int
    is_complete: bool
    is_break: bool
    coverage_partial: bool
    last_year_available: int  # dernière année de données connue pour ce pays (règle 3, §8.4)


def normalize_weights(raw_weights: dict[str, float]) -> dict[str, float]:
    """Renormalise à somme 1 (§8.3). Un poids nul reste nul (dimension ignorée)."""
    total = sum(raw_weights.values())
    if total <= 0:
        raise ValueError("la somme des poids doit être strictement positive")
    return {f: w / total for f, w in raw_weights.items()}


def weighted_distance(
    a: StateVector, b: StateVector, weights: dict[str, float]
) -> tuple[float, dict[str, float]]:
    """§8.3 : d(a,b) = sqrt(Σ w_f (rank_a - rank_b)²), poids déjà renormalisés
    à somme 1 en amont (normalize_weights) — d est alors directement dans
    [0,1] (§8.3 : d_norm = d / sqrt(Σw_f), qui vaut d quand Σw_f=1).
    Retourne (distance, contribution par feature = w_f·Δ_f², §8.5)."""
    contributions: dict[str, float] = {}
    sq_sum = 0.0
    for f, w in weights.items():
        if w == 0.0:
            continue
        ra, rb = a.ranks.get(f), b.ranks.get(f)
        if ra is None or rb is None or math.isnan(ra) or math.isnan(rb):
            continue
        contrib = w * (ra - rb) ** 2
        contributions[f] = contrib
        sq_sum += contrib
    return math.sqrt(sq_sum), contributions


def similarity_score(distance: float) -> float:
    return 100.0 * (1.0 - distance)


def filter_pool(
    entries: list[PoolEntry],
    *,
    query_country: str,
    query_year: int,
    horizon_max: int,
    include_breaks: bool = False,
    include_partial_coverage: bool = False,
    excluded_countries: frozenset[str] = frozenset(),
    excluded_years: frozenset[int] = frozenset(),
) -> tuple[list[int], ExclusionCounts]:
    """§8.4 : règles d'exclusion du pool, appliquées dans l'ordre du plan.
    Retourne les indices éligibles et le décompte par motif d'exclusion
    (pour `excluded` dans la réponse API, §10.1)."""
    eligible: list[int] = []
    incomplete = self_adjacent = too_recent = breaks = partial_coverage = user_excluded = 0

    for i, e in enumerate(entries):
        if not e.is_complete:
            incomplete += 1
            continue
        if e.country == query_country and abs(e.year - query_year) <= 3:
            self_adjacent += 1
            continue
        if e.last_year_available - e.year < horizon_max:
            too_recent += 1
            continue
        if e.is_break and not include_breaks:
            breaks += 1
            continue
        if e.coverage_partial and not include_partial_coverage:
            partial_coverage += 1
            continue
        if e.country in excluded_countries or e.year in excluded_years:
            user_excluded += 1
            continue
        eligible.append(i)

    counts = ExclusionCounts(
        incomplete=incomplete,
        self_adjacent=self_adjacent,
        too_recent=too_recent,
        breaks=breaks,
        partial_coverage=partial_coverage,
        user_excluded=user_excluded,
    )
    return eligible, counts


def find_analogs(
    query: StateVector,
    pool: list[StateVector],
    *,
    weights: dict[str, float],
    k: int = 20,
) -> list[AnalogResult]:
    """§8.5 : les k plus proches voisins de `query` dans `pool` (déjà filtré
    par filter_pool si besoin), triés par distance croissante."""
    norm_weights = normalize_weights(weights)
    results: list[AnalogResult] = []
    for candidate in pool:
        d, contributions = weighted_distance(query, candidate, norm_weights)
        results.append(
            AnalogResult(
                country=candidate.country,
                year=candidate.year,
                distance=d,
                similarity=similarity_score(d),
                feature_contributions=contributions,
            )
        )
    results.sort(key=lambda r: r.distance)
    return results[:k]


@dataclass(frozen=True)
class ConcentrationStats:
    """Indice de Herfindahl sur pays et décennies des analogues retenus (§9.4)."""

    hhi_country: float
    hhi_decade: float
    n_countries: int
    n_decades: int


def _herfindahl(labels: list[str]) -> float:
    if not labels:
        return 0.0
    counts: dict[str, int] = {}
    for label in labels:
        counts[label] = counts.get(label, 0) + 1
    n = len(labels)
    return sum((c / n) ** 2 for c in counts.values())


def concentration(analogs: list[AnalogResult]) -> ConcentrationStats:
    countries = [a.country for a in analogs]
    decades = [f"{(a.year // 10) * 10}s" for a in analogs]
    return ConcentrationStats(
        hhi_country=_herfindahl(countries),
        hhi_decade=_herfindahl(decades),
        n_countries=len(set(countries)),
        n_decades=len(set(decades)),
    )
