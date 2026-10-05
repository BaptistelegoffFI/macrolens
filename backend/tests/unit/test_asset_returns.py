"""ADR 0015 à 0020 : calcul des rendements d'actifs. Valeurs attendues écrites à
la main (règle 6, CLAUDE.md), jamais recalculées avec le code testé."""

import math

import pytest

from macrolens.core.asset_returns import (
    HYPERINFLATION_ANNUAL,
    cumulative_and_annualised,
    cumulative_path,
    forward_window,
    fx_return_vs_usd,
    inflation_from_cpi,
    is_extreme_window,
    max_drawdown,
    real_return,
)

# ---- inflation ---------------------------------------------------------------


def test_inflation_from_cpi_basic() -> None:
    out = inflation_from_cpi({2000: 100.0, 2001: 110.0, 2002: 121.0})
    assert out == {2001: pytest.approx(0.10), 2002: pytest.approx(0.10)}


def test_inflation_gap_in_cpi_leaves_gap_not_filled() -> None:
    """ADR 0019 : un trou de CPI supprime l'inflation des deux années voisines."""
    assert inflation_from_cpi({2000: 100.0, 2002: 121.0}) == {}


def test_inflation_ignores_non_positive_and_nan_cpi() -> None:
    assert inflation_from_cpi({2000: 0.0, 2001: 10.0}) == {}
    assert inflation_from_cpi({2000: 100.0, 2001: float("nan")}) == {}


def test_inflation_can_be_negative() -> None:
    assert inflation_from_cpi({1930: 100.0, 1931: 90.0}) == {1931: pytest.approx(-0.10)}


# ---- rendement réel (ADR 0015) ------------------------------------------------


def test_real_return_uses_fisher_not_subtraction() -> None:
    # 1,30 / 1,20 - 1 = 0,08333... ; la soustraction naïve donnerait 0,10.
    out = real_return({2001: 0.30}, {2001: 0.20})
    assert out[2001] == pytest.approx(1.0 / 12.0)
    assert abs(out[2001] - 0.10) > 0.01


def test_real_return_high_inflation_diverges_from_naive_subtraction() -> None:
    # Nominal +300 %, inflation +200 % : 4 / 3 - 1 = 1/3 ; naïf = 1,0.
    assert real_return({2001: 3.0}, {2001: 2.0})[2001] == pytest.approx(1.0 / 3.0)


def test_real_return_deflation_raises_real_return() -> None:
    # Rendement nominal nul, prix -10 % : 1 / 0,9 - 1 = 0,1111...
    assert real_return({1931: 0.0}, {1931: -0.10})[1931] == pytest.approx(1.0 / 9.0)


def test_real_return_missing_inflation_year_is_absent_not_zero() -> None:
    out = real_return({2000: 0.05, 2001: 0.05}, {2001: 0.02})
    assert 2000 not in out
    assert out[2001] == pytest.approx(1.05 / 1.02 - 1.0)


def test_real_return_skips_impossible_inflation() -> None:
    assert real_return({2001: 0.05}, {2001: -1.0}) == {}


def test_real_return_germany_1923_matches_jst_raw_values() -> None:
    """JST R6, DEU 1923 : eq_tr = 2 639 074 816, CPI 1922 = 2,259269e-9 et
    1923 = 2,388266. Inflation 1,057097e9 ; rendement réel 1,49653 (Fisher),
    alors que la soustraction naïve donnerait 1,58e9."""
    cpi = {1922: 2.259269310196312e-9, 1923: 2.388266141806678}
    infl = inflation_from_cpi(cpi)
    assert infl[1923] == pytest.approx(1.0570967e9, rel=1e-6)
    real = real_return({1923: 2639074816.0}, infl)
    assert real[1923] == pytest.approx(1.49653, abs=1e-4)
    assert is_extreme_window([real[1923]], [infl[1923]])


# ---- change (ADR 0017) --------------------------------------------------------


def test_fx_return_local_currency_appreciation_is_positive() -> None:
    # 2,0 puis 1,6 unités locales par USD : la monnaie locale vaut 25 % de plus.
    out = fx_return_vs_usd({2000: 2.0, 2001: 1.6, 2002: 2.0})
    assert out[2001] == pytest.approx(0.25)
    assert out[2002] == pytest.approx(-0.20)


def test_fx_return_base_currency_is_zero() -> None:
    assert fx_return_vs_usd({2000: 1.0, 2001: 1.0}) == {2001: 0.0}


def test_fx_return_gap_is_not_filled() -> None:
    assert fx_return_vs_usd({2000: 2.0, 2002: 1.6}) == {}


# ---- fenêtre prospective (ADR 0019) ------------------------------------------


def test_forward_window_covers_years_after_the_anchor() -> None:
    series = {2000: 9.0, 2001: 0.1, 2002: 0.2, 2003: 0.3}
    assert forward_window(series, 2000, 3) == (0.1, 0.2, 0.3)


def test_forward_window_excludes_the_anchor_year_itself() -> None:
    assert forward_window({2000: 9.0, 2001: 0.1}, 2000, 1) == (0.1,)


def test_forward_window_truncated_at_series_end_is_none() -> None:
    """Un analogue de 2018 n'a pas de fenêtre à 3 ans si la série s'arrête en 2020."""
    series = {2019: 0.1, 2020: 0.2}
    assert forward_window(series, 2018, 3) is None
    assert forward_window(series, 2018, 2) == (0.1, 0.2)


def test_forward_window_with_internal_gap_is_none() -> None:
    assert forward_window({2001: 0.1, 2003: 0.3}, 2000, 3) is None


def test_forward_window_ignores_nan() -> None:
    assert forward_window({2001: float("nan")}, 2000, 1) is None


def test_forward_window_rejects_non_positive_horizon() -> None:
    with pytest.raises(ValueError):
        forward_window({}, 2000, 0)


# ---- cumulé et annualisé (ADR 0018) ------------------------------------------


def test_cumulative_and_annualised_compounding() -> None:
    cum, ann = cumulative_and_annualised((0.1, 0.1))
    assert cum == pytest.approx(0.21)
    assert ann == pytest.approx(0.10)


def test_cumulative_and_annualised_gain_then_loss() -> None:
    # 1,5 x 0,5 = 0,75 : -25 % cumulé, racine carrée de 0,75 moins 1 = -13,397 % par an.
    cum, ann = cumulative_and_annualised((0.5, -0.5))
    assert cum == pytest.approx(-0.25)
    assert ann == pytest.approx(-0.13397459621556135)


def test_cumulative_and_annualised_total_loss() -> None:
    cum, ann = cumulative_and_annualised((-1.0, 0.5))
    assert cum == pytest.approx(-1.0)
    assert ann == pytest.approx(-1.0)


def test_cumulative_and_annualised_single_year_equal() -> None:
    cum, ann = cumulative_and_annualised((0.07,))
    assert cum == pytest.approx(0.07)
    assert ann == pytest.approx(0.07)


def test_cumulative_and_annualised_keeps_extreme_values() -> None:
    """ADR 0020 : aucun écrêtage. Un rendement de +2,6 milliards reste tel quel."""
    cum, _ann = cumulative_and_annualised((2639074816.0,))
    assert cum == pytest.approx(2639074816.0)


def test_cumulative_and_annualised_rejects_impossible_return() -> None:
    with pytest.raises(ValueError):
        cumulative_and_annualised((-1.2,))
    with pytest.raises(ValueError):
        cumulative_and_annualised(())


# ---- trajectoire et repli maximal --------------------------------------------


def test_cumulative_path_starts_at_one() -> None:
    assert cumulative_path((0.2, -0.5, 0.1)) == pytest.approx((1.0, 1.2, 0.6, 0.66))


def test_max_drawdown_known_path() -> None:
    # 1,0 -> 1,2 -> 0,6 -> 0,66 : pire repli 0,6 / 1,2 - 1 = -50 %.
    assert max_drawdown((0.2, -0.5, 0.1)) == pytest.approx(-0.5)


def test_max_drawdown_monotonic_gain_is_zero() -> None:
    assert max_drawdown((0.1, 0.2, 0.3)) == 0.0


def test_max_drawdown_starting_point_counts_as_a_peak() -> None:
    assert max_drawdown((-0.3, 0.1)) == pytest.approx(-0.3)


def test_max_drawdown_takes_the_deepest_of_several_declines() -> None:
    # 1,1 / 0,88 / 1,144 / 0,6864 : replis -20 % puis -40 %.
    assert max_drawdown((0.1, -0.2, 0.3, -0.4)) == pytest.approx(-0.4)


def test_max_drawdown_empty_window_is_zero() -> None:
    assert max_drawdown(()) == 0.0


# ---- épisode extrême (ADR 0020) ----------------------------------------------


def test_extreme_window_thresholds() -> None:
    assert is_extreme_window([-0.5])
    assert not is_extreme_window([-0.49])
    assert is_extreme_window([1.0])
    assert not is_extreme_window([0.99])


def test_extreme_window_flags_hyperinflation_even_with_normal_returns() -> None:
    assert is_extreme_window([0.02], [HYPERINFLATION_ANNUAL])
    assert not is_extreme_window([0.02], [0.99])
    assert not is_extreme_window([0.02], None)


# ---- épisodes de référence, arithmétique faite à la main sur les lignes JST R6 -


US_EQ = {1930: -0.22943925857543945, 1931: -0.40296581387519836, 1932: -0.13270142674446106}
US_CPI = {
    1929: 13.84656476993929,
    1930: 13.522668518010883,
    1931: 12.308057573279367,
    1932: 11.09344662854785,
}


def test_us_1929_equities_three_year_real_window() -> None:
    """JST R6, USA. Rendements réels annuels -21,10 %, -34,40 %, -3,77 % ;
    cumul réel -50,20 % ; annualisé -20,73 %."""
    real = real_return(US_EQ, inflation_from_cpi(US_CPI))
    window = forward_window(real, 1929, 3)
    assert window is not None
    assert window == pytest.approx((-0.210983, -0.344048, -0.037742), abs=1e-6)
    cum, ann = cumulative_and_annualised(window)
    assert cum == pytest.approx(-0.501976, abs=1e-6)
    assert ann == pytest.approx(-0.207346, abs=1e-6)


def test_us_1929_nominal_cumulative_agrees_with_published_sp500_record() -> None:
    """Enregistrement publié (Damodaran, S&P 500 dividendes inclus) : -25,12 %,
    -43,84 %, -8,64 % pour 1930-1932, soit -61,58 % cumulé. JST donne -60,10 %.
    Même histoire : écart inférieur à 3 points (indices construits différemment)."""
    growth = 1.0
    for r in US_EQ.values():
        growth *= 1.0 + r
    published = -0.615807
    assert growth - 1.0 == pytest.approx(-0.600998, abs=1e-6)
    assert abs((growth - 1.0) - published) < 0.03


def test_japan_1989_equities_real_window() -> None:
    """JST R6, JPN, ancre 1989, 3 ans : cumul réel -49,93 %, annualisé -20,59 %."""
    nominal = {1990: -0.13175, 1991: -0.155095, 1992: -0.2612}
    cpi = {1989: 97.0, 1990: 100.0, 1991: 103.300002, 1992: 105.0}
    real = real_return(nominal, inflation_from_cpi(cpi))
    window = forward_window(real, 1989, 3)
    assert window is not None
    cum, ann = cumulative_and_annualised(window)
    assert cum == pytest.approx(-0.499318, abs=1e-5)
    assert ann == pytest.approx(-0.205939, abs=1e-5)


def test_extreme_episode_is_kept_not_trimmed_in_aggregate_inputs() -> None:
    """ADR 0020 : Allemagne 1923 reste une valeur, marquée extrême."""
    real = real_return({1923: 2639074816.0}, {1923: 1057096703.2433543})
    window = forward_window(real, 1922, 1)
    assert window is not None
    assert math.isfinite(window[0]) and window[0] > 1.0
