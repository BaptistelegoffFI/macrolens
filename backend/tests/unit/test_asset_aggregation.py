"""ADR 0019, 0020 : agrégation sur l'ensemble d'analogues. Valeurs attendues à la main."""

import random

import pytest

from macrolens.core.asset_aggregation import AssetWindow, aggregate_cell, aggregate_paths


def _w(*returns: float, extreme: bool = False) -> AssetWindow:
    return AssetWindow(real_returns=tuple(returns), extreme=extreme)


def test_aggregate_cell_single_year_quantiles_and_hit_rate() -> None:
    cell = aggregate_cell([_w(-0.2), _w(-0.1), _w(0.0), _w(0.1), _w(0.2)])
    assert cell.n == 5
    assert cell.cumulative.median == pytest.approx(0.0)
    assert cell.cumulative.min == pytest.approx(-0.2)
    assert cell.cumulative.max == pytest.approx(0.2)
    # Rendement réel nul n'est pas un succès : 2 fenêtres sur 5 strictement positives.
    assert cell.hit_rate == pytest.approx(0.4)


def test_aggregate_cell_excludes_missing_windows_and_reduces_n() -> None:
    """ADR 0019 : un analogue sans fenêtre complète sort du calcul, il n'est pas compté 0."""
    cell = aggregate_cell([_w(0.1), None, _w(0.3), None])
    assert cell.n == 2
    assert cell.hit_rate == pytest.approx(1.0)
    assert cell.cumulative.median == pytest.approx(0.2)


def test_aggregate_cell_all_missing_gives_empty_cell_not_zeros() -> None:
    cell = aggregate_cell([None, None])
    assert cell.n == 0
    assert cell.hit_rate is None
    assert cell.cumulative.median is None
    assert cell.max_drawdown.min is None


def test_aggregate_cell_no_windows_at_all() -> None:
    cell = aggregate_cell([])
    assert cell.n == 0
    assert cell.hit_rate is None


def test_aggregate_cell_cumulative_and_annualised_of_a_multi_year_window() -> None:
    cell = aggregate_cell([_w(0.1, 0.1)])
    assert cell.cumulative.median == pytest.approx(0.21)
    assert cell.annualised.median == pytest.approx(0.10)


def test_aggregate_cell_drawdown_statistics() -> None:
    cell = aggregate_cell([_w(0.2, -0.5, 0.1), _w(0.1, 0.1)])
    assert cell.max_drawdown.min == pytest.approx(-0.5)
    assert cell.max_drawdown.max == pytest.approx(0.0)


def test_aggregate_cell_extreme_count_without_trimming() -> None:
    """ADR 0020 : le marqueur compte, mais la valeur extrême reste dans min/max."""
    cell = aggregate_cell([_w(0.05), _w(1.4965, extreme=True), _w(-0.1)])
    assert cell.n == 3
    assert cell.n_extreme == 1
    assert cell.cumulative.max == pytest.approx(1.4965)
    assert cell.cumulative.median == pytest.approx(0.05)


def test_aggregate_cell_median_is_robust_to_the_extreme_value() -> None:
    base = [_w(0.01), _w(0.02), _w(0.03), _w(0.04), _w(0.05)]
    with_outlier = [*base[:-1], _w(2_639_074_816.0, extreme=True)]
    assert aggregate_cell(base).cumulative.median == aggregate_cell(with_outlier).cumulative.median


def test_aggregate_cell_is_deterministic_and_order_independent() -> None:
    windows: list[AssetWindow | None] = [
        _w(0.12, -0.3), _w(-0.4, 0.1), None, _w(0.02, 0.02), _w(0.5, 0.5), _w(-0.2, -0.1)
    ]
    reference = aggregate_cell(windows)
    shuffled = list(windows)
    random.Random(7).shuffle(shuffled)
    assert aggregate_cell(shuffled) == reference
    assert aggregate_cell(windows) == reference


def test_aggregate_paths_median_and_band() -> None:
    windows: list[AssetWindow | None] = [_w(0.1, 0.1), _w(0.2, 0.2), _w(-0.1, -0.1)]
    points = aggregate_paths(windows, 2)
    assert [p.step for p in points] == [0, 1, 2]
    assert points[0].median == pytest.approx(0.0)
    # Après 1 an : -0,10, +0,10, +0,20 -> médiane +0,10.
    assert points[1].median == pytest.approx(0.1)
    assert points[1].n == 3
    # Après 2 ans : 0,81-1, 1,21-1, 1,44-1 -> médiane 0,21.
    assert points[2].median == pytest.approx(0.21)


def test_aggregate_paths_only_counts_complete_windows() -> None:
    windows: list[AssetWindow | None] = [_w(0.1, 0.1), None, _w(0.1)]
    points = aggregate_paths(windows, 2)
    assert points[2].n == 1
