"""§8.3-§8.5 : distance pondérée, exclusions, k-NN. Inclut les propriétés de
métrique exigées par §12.3 (identité, symétrie, inégalité triangulaire)."""

import math
import random

import pytest

from macrolens.core.similarity import (
    AnalogResult,
    PoolEntry,
    StateVector,
    concentration,
    filter_pool,
    find_analogs,
    normalize_weights,
    similarity_score,
    weighted_distance,
)

UNIFORM_WEIGHTS = {
    "infl_level": 1.0,
    "growth_level": 1.0,
    "rate_short_real": 1.0,
    "debt_level": 1.0,
    "credit_gap5": 1.0,
}


def _sv(country: str, year: int, **ranks: float) -> StateVector:
    return StateVector(country=country, year=year, ranks=ranks)


def _entry(
    country: str,
    year: int,
    *,
    complete: bool = True,
    is_break: bool = False,
    coverage_partial: bool = False,
    last_year_available: int = 2025,
) -> PoolEntry:
    return PoolEntry(
        country=country,
        year=year,
        is_complete=complete,
        is_break=is_break,
        coverage_partial=coverage_partial,
        last_year_available=last_year_available,
    )


def test_normalize_weights_sums_to_one() -> None:
    w = normalize_weights({"a": 2.0, "b": 2.0})
    assert sum(w.values()) == pytest.approx(1.0)
    assert w["a"] == pytest.approx(0.5)


def test_normalize_weights_rejects_non_positive_total() -> None:
    with pytest.raises(ValueError, match="strictement positive"):
        normalize_weights({"a": 0.0, "b": 0.0})


def test_zero_weight_ignores_that_dimension() -> None:
    a = _sv("FRA", 2000, x=0.1, y=0.9)
    b = _sv("FRA", 2001, x=0.9, y=0.9)
    d, contrib = weighted_distance(a, b, {"x": 0.0, "y": 1.0})
    assert d == pytest.approx(0.0)
    assert "x" not in contrib


def test_identity_distance_zero_to_self() -> None:
    """§12.3 test n°2 : d(a,a) = 0."""
    a = _sv("SWE", 1990, infl_level=0.7, growth_level=0.3, rate_short_real=0.5)
    weights = normalize_weights({"infl_level": 1.0, "growth_level": 1.0, "rate_short_real": 1.0})
    d, _ = weighted_distance(a, a, weights)
    assert d == pytest.approx(0.0)


def test_symmetry() -> None:
    """§12.3 test n°3 : d(a,b) = d(b,a)."""
    rng = random.Random(1)
    weights = normalize_weights(UNIFORM_WEIGHTS)
    for _ in range(50):
        a = _sv("FRA", 2000, **{f: rng.random() for f in UNIFORM_WEIGHTS})
        b = _sv("DEU", 2001, **{f: rng.random() for f in UNIFORM_WEIGHTS})
        d_ab, _ = weighted_distance(a, b, weights)
        d_ba, _ = weighted_distance(b, a, weights)
        assert d_ab == pytest.approx(d_ba)


def test_triangle_inequality() -> None:
    """§12.3 test n°4 : d(a,c) <= d(a,b) + d(b,c) sur 1000 triplets aléatoires."""
    rng = random.Random(2)
    weights = normalize_weights(UNIFORM_WEIGHTS)
    for _ in range(1000):
        a = _sv("A", 0, **{f: rng.random() for f in UNIFORM_WEIGHTS})
        b = _sv("B", 0, **{f: rng.random() for f in UNIFORM_WEIGHTS})
        c = _sv("C", 0, **{f: rng.random() for f in UNIFORM_WEIGHTS})
        d_ab, _ = weighted_distance(a, b, weights)
        d_bc, _ = weighted_distance(b, c, weights)
        d_ac, _ = weighted_distance(a, c, weights)
        assert d_ac <= d_ab + d_bc + 1e-9


def test_missing_feature_is_skipped_not_fatal() -> None:
    a = _sv("FRA", 2000, x=0.5)  # 'y' absente
    b = _sv("DEU", 2001, x=0.6, y=0.9)
    d, contrib = weighted_distance(a, b, {"x": 0.5, "y": 0.5})
    assert "y" not in contrib
    assert d == pytest.approx(math.sqrt(0.5 * (0.5 - 0.6) ** 2))


def test_similarity_score_is_100_minus_distance_pct() -> None:
    assert similarity_score(0.0) == pytest.approx(100.0)
    assert similarity_score(1.0) == pytest.approx(0.0)
    assert similarity_score(0.25) == pytest.approx(75.0)


def test_find_analogs_sorted_and_truncated_to_k() -> None:
    query = _sv("FRA", 2020, x=0.5)
    pool = [_sv("C", 1900 + i, x=v) for i, v in enumerate([0.5, 0.9, 0.4, 0.6, 0.1])]
    results = find_analogs(query, pool, weights={"x": 1.0}, k=2)
    assert len(results) == 2
    assert results[0].year == 1900  # x=0.5, distance nulle -> le plus proche
    assert results[0].distance <= results[1].distance


def test_filter_pool_excludes_incomplete() -> None:
    entries = [_entry("DEU", 2000, complete=False, last_year_available=2020)]
    eligible, counts = filter_pool(entries, query_country="FRA", query_year=2020, horizon_max=5)
    assert eligible == []
    assert counts.incomplete == 1


def test_filter_pool_excludes_self_adjacent_years() -> None:
    entries = [
        _entry("FRA", 2019),  # |2019-2020|=1 <= 3
        _entry("FRA", 2016),  # |2016-2020|=4 > 3
    ]
    eligible, counts = filter_pool(entries, query_country="FRA", query_year=2020, horizon_max=1)
    assert eligible == [1]
    assert counts.self_adjacent == 1


def test_filter_pool_excludes_too_recent_for_horizon() -> None:
    # last_year_available=2022, horizon_max=5 : il faut year <= 2017 pour avoir 5 ans d'avenir.
    entries = [_entry("DEU", 2019, last_year_available=2022)]
    eligible, counts = filter_pool(
        entries, query_country="FRA", query_year=1900, horizon_max=5
    )
    assert eligible == []
    assert counts.too_recent == 1


def test_filter_pool_excludes_breaks_and_partial_coverage_by_default() -> None:
    entries = [
        _entry("DEU", 1920, is_break=True),
        _entry("FIN", 1860, coverage_partial=True),
    ]
    eligible, counts = filter_pool(entries, query_country="FRA", query_year=2020, horizon_max=1)
    assert eligible == []
    assert counts.breaks == 1
    assert counts.partial_coverage == 1


def test_filter_pool_toggles_can_reinclude_breaks_and_partial() -> None:
    entries = [
        _entry("DEU", 1920, is_break=True),
        _entry("FIN", 1860, coverage_partial=True),
    ]
    eligible, counts = filter_pool(
        entries,
        query_country="FRA",
        query_year=2020,
        horizon_max=1,
        include_breaks=True,
        include_partial_coverage=True,
    )
    assert eligible == [0, 1]
    assert counts.total == 0


def test_filter_pool_user_exclusions() -> None:
    entries = [_entry("USA", 2000)]
    eligible, counts = filter_pool(
        entries,
        query_country="FRA",
        query_year=2020,
        horizon_max=1,
        excluded_countries=frozenset({"USA"}),
    )
    assert eligible == []
    assert counts.user_excluded == 1


def test_concentration_all_same_country_gives_hhi_one() -> None:
    analogs = [AnalogResult("SWE", 1990 + i, 0.1, 90.0, {}) for i in range(5)]
    stats = concentration(analogs)
    assert stats.hhi_country == pytest.approx(1.0)
    assert stats.n_countries == 1


def test_concentration_evenly_spread_gives_low_hhi() -> None:
    countries = ["FRA", "DEU", "ITA", "SWE", "NOR"]
    analogs = [AnalogResult(c, 1990, 0.1, 90.0, {}) for c in countries]
    stats = concentration(analogs)
    assert stats.hhi_country == pytest.approx(1.0 / 5)
    assert stats.n_countries == 5
