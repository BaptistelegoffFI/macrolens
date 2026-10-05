"""ADR 0019 : un indice chaîné qui saute une année ne doit produire ni rendement réel
cumulé ni repli maximal par-dessus le saut. Valeurs attendues écrites à la main."""

import pytest

from macrolens.outcomes_build import _chain_has_gap, compute_outcomes


def _series(equity_years: list[int]) -> dict[str, dict[int, float]]:
    years = range(1940, 1956)
    return {
        "cpi": {y: 100.0 for y in years},  # prix constants : réel = nominal
        "equity_index_nominal": {y: 100.0 * 1.1 ** (y - 1940) for y in equity_years},
    }


FULL = list(range(1940, 1956))
JAPAN_LIKE = [y for y in FULL if y not in (1946, 1947)]


def test_chain_gap_detects_an_interior_hole_only() -> None:
    s = _series(JAPAN_LIKE)
    assert _chain_has_gap(s, "equity_index_nominal", 1944, 1949)
    assert not _chain_has_gap(s, "equity_index_nominal", 1948, 1953)
    assert not _chain_has_gap(_series(FULL), "equity_index_nominal", 1944, 1949)


def test_series_not_started_yet_is_not_a_gap() -> None:
    s = _series(list(range(1944, 1956)))
    assert not _chain_has_gap(s, "equity_index_nominal", 1940, 1948)


def test_window_across_the_gap_has_no_equity_outcome() -> None:
    out = compute_outcomes(_series(JAPAN_LIKE), set(), 1944, 5)
    assert out.out_equity_real_cum is None
    assert out.out_max_drawdown_equity is None


def test_window_without_gap_is_unchanged() -> None:
    out = compute_outcomes(_series(JAPAN_LIKE), set(), 1948, 5)
    assert out.out_equity_real_cum == pytest.approx(100.0 * (1.1**5 - 1.0))
    assert out.out_max_drawdown_equity == pytest.approx(0.0)


def test_complete_series_gives_the_same_value_as_before() -> None:
    out = compute_outcomes(_series(FULL), set(), 1944, 5)
    assert out.out_equity_real_cum == pytest.approx(100.0 * (1.1**5 - 1.0))


def test_other_outcomes_are_not_affected_by_the_equity_gap() -> None:
    series = _series(JAPAN_LIKE)
    series["gdp_real_pc"] = {y: 100.0 + y for y in range(1940, 1956)}
    out = compute_outcomes(series, set(), 1944, 5)
    assert out.out_growth_cum == pytest.approx(100.0 * (1949 + 100.0) / (1944 + 100.0) * 1 - 100.0)
