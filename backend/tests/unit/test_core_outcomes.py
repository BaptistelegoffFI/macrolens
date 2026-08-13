"""§9.2, §9.3 : agrégation des réalisations. Valeurs attendues écrites à la
main (règle 6, CLAUDE.md)."""

import math

import pytest

from macrolens.core.outcomes import aggregate_boolean, aggregate_continuous, similarity_weights


def test_aggregate_continuous_basic_quantiles() -> None:
    # [1,2,3,4,5,6,7,8,9,10] non pondéré : médiane=5.5, Q1=3.25, Q3=7.75 (interpolation linéaire).
    agg = aggregate_continuous([float(i) for i in range(1, 11)])
    assert agg.n == 10
    assert agg.median == pytest.approx(5.5)
    assert agg.min == pytest.approx(1.0)
    assert agg.max == pytest.approx(10.0)


def test_aggregate_continuous_share_negative() -> None:
    agg = aggregate_continuous([-2.0, -1.0, 1.0, 2.0])
    assert agg.share_negative == pytest.approx(0.5)


def test_aggregate_continuous_ignores_nan_not_fill() -> None:
    """§7.5 : un trou reste un trou, jamais comblé."""
    agg = aggregate_continuous([1.0, float("nan"), 3.0, float("nan"), 5.0])
    assert agg.n == 3
    assert agg.median == pytest.approx(3.0)


def test_aggregate_continuous_empty_returns_none_fields() -> None:
    agg = aggregate_continuous([])
    assert agg.n == 0
    assert agg.median is None
    assert agg.share_negative is None


def test_aggregate_continuous_weighted_median_shifts_toward_heavy_weight() -> None:
    # Deux points opposés, poids très déséquilibré -> médiane pondérée proche du point lourd.
    agg_equal = aggregate_continuous([0.0, 10.0])
    agg_weighted = aggregate_continuous([0.0, 10.0], weights=[0.01, 0.99])
    assert agg_equal.median is not None
    assert agg_weighted.median is not None
    assert agg_equal.median == pytest.approx(5.0)
    assert agg_weighted.median > agg_equal.median


def test_aggregate_boolean_counts_true_among_known() -> None:
    agg = aggregate_boolean([True, True, False, False, False])
    assert agg.n == 5
    assert agg.count_true == 2


def test_aggregate_boolean_excludes_unknown_from_n() -> None:
    """Un analogue sans réalisation connue (None) ne doit pas être compté
    comme "pas de crise" par défaut — il est exclu de n."""
    agg = aggregate_boolean([True, None, False])
    assert agg.n == 2
    assert agg.count_true == 1


def test_similarity_weights_sum_to_one() -> None:
    weights = similarity_weights([0.0, 0.5, 0.9])
    assert sum(weights) == pytest.approx(1.0)
    # d=0 (le plus proche) doit recevoir le plus grand poids.
    assert weights[0] > weights[1] > weights[2]


def test_similarity_weights_empty_list() -> None:
    assert similarity_weights([]) == []


def test_similarity_weights_all_at_max_distance_falls_back_to_uniform() -> None:
    weights = similarity_weights([1.0, 1.0, 1.0])
    assert weights == pytest.approx([1 / 3, 1 / 3, 1 / 3])


def test_no_nan_or_inf_leaks_into_aggregate() -> None:
    agg = aggregate_continuous([1.0, 2.0, 3.0])
    for value in (agg.median, agg.q1, agg.q3, agg.min, agg.max, agg.share_negative):
        assert value is not None
        assert not math.isnan(value)
        assert not math.isinf(value)
