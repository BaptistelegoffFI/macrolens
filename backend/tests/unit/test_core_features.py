"""Valeurs attendues écrites à la main pour chaque feature de §8.1 (règle 6).
Panel synthétique simple pour pouvoir vérifier chaque calcul de tête."""

import numpy as np
import pytest

from macrolens.core.features import RawPanel, compute_features


def _panel(n: int = 15) -> RawPanel:
    years = np.arange(2000, 2000 + n)
    return RawPanel(
        years=years,
        gdp_real_pc=100.0 * 1.02 ** np.arange(n),  # +2%/an composé
        cpi=100.0 * 1.03 ** np.arange(n),  # +3%/an composé
        rate_short=np.full(n, 2.0) + 0.1 * np.arange(n),
        rate_long=np.full(n, 4.0) + 0.05 * np.arange(n),
        debt_public_gdp=60.0 + 1.0 * np.arange(n),
        credit_private_gdp=80.0 + 2.0 * np.arange(n),
        equity_index_nominal=100.0 * 1.05 ** np.arange(n),
        house_price_index=100.0 * 1.01 ** np.arange(n),
        unemployment_rate=8.0 - 0.1 * np.arange(n),
        current_account_gdp=np.full(n, -1.5),
    )


def test_raw_panel_rejects_mismatched_lengths() -> None:
    with pytest.raises(ValueError, match="même longueur"):
        RawPanel(
            years=np.arange(2000, 2005),
            gdp_real_pc=np.ones(3),  # longueur différente : doit échouer
            cpi=np.ones(5),
            rate_short=np.ones(5),
            rate_long=np.ones(5),
            debt_public_gdp=np.ones(5),
            credit_private_gdp=np.ones(5),
            equity_index_nominal=np.ones(5),
            house_price_index=np.ones(5),
            unemployment_rate=np.ones(5),
            current_account_gdp=np.ones(5),
        )


def test_raw_panel_rejects_year_gaps() -> None:
    years = np.array([2000, 2001, 2003])  # 2002 manquant : rupture de suite
    with pytest.raises(ValueError, match="consécutives"):
        RawPanel(
            years=years,
            gdp_real_pc=np.ones(3),
            cpi=np.ones(3),
            rate_short=np.ones(3),
            rate_long=np.ones(3),
            debt_public_gdp=np.ones(3),
            credit_private_gdp=np.ones(3),
            equity_index_nominal=np.ones(3),
            house_price_index=np.ones(3),
            unemployment_rate=np.ones(3),
            current_account_gdp=np.ones(3),
        )


def test_infl_level_is_yoy_cpi_change() -> None:
    fp = compute_features(_panel())
    # cpi croît de 3%/an composé -> infl_level constant à 3% après le 1er point.
    assert np.isnan(fp.features["infl_level"][0])
    assert fp.features["infl_level"][1] == pytest.approx(3.0, abs=1e-6)
    assert fp.features["infl_level"][10] == pytest.approx(3.0, abs=1e-6)


def test_growth_level_is_yoy_gdp_change() -> None:
    fp = compute_features(_panel())
    assert np.isnan(fp.features["growth_level"][0])
    assert fp.features["growth_level"][1] == pytest.approx(2.0, abs=1e-6)


def test_rate_short_real_subtracts_inflation() -> None:
    fp = compute_features(_panel())
    # rate_short[1] = 2.1, infl_level[1] = 3.0 -> rate_short_real = -0.9
    assert fp.features["rate_short_real"][1] == pytest.approx(2.1 - 3.0, abs=1e-6)


def test_curve_slope_is_long_minus_short() -> None:
    fp = compute_features(_panel())
    # rate_long[0]=4.0, rate_short[0]=2.0 -> slope=2.0
    assert fp.features["curve_slope"][0] == pytest.approx(4.0 - 2.0, abs=1e-9)
    assert fp.features["curve_slope"][5] == pytest.approx((4.0 + 0.25) - (2.0 + 0.5), abs=1e-9)


def test_debt_delta5_is_five_year_change() -> None:
    fp = compute_features(_panel())
    assert np.all(np.isnan(fp.features["debt_delta5"][:5]))
    # debt = 60 + 1*t -> delta5 = 5.0 partout où défini
    assert fp.features["debt_delta5"][5] == pytest.approx(5.0, abs=1e-9)
    assert fp.features["debt_delta5"][10] == pytest.approx(5.0, abs=1e-9)


def test_credit_gap5_is_five_year_change() -> None:
    fp = compute_features(_panel())
    # credit = 80 + 2*t -> delta5 = 10.0
    assert fp.features["credit_gap5"][5] == pytest.approx(10.0, abs=1e-9)


def test_equity_real_3y_deflates_by_cpi() -> None:
    fp = compute_features(_panel())
    # nominal x1.05^3, cpi x1.03^3 -> réel cumulé = (1.05/1.03)^3 - 1, en %
    expected = 100.0 * ((1.05 / 1.03) ** 3 - 1.0)
    assert fp.features["equity_real_3y"][3] == pytest.approx(expected, abs=1e-6)


def test_ca_level_is_passthrough() -> None:
    fp = compute_features(_panel())
    assert np.all(fp.features["ca_level"] == -1.5)


def test_growth_gap_and_unemp_gap_need_min_periods_before_producing_a_value() -> None:
    fp = compute_features(_panel())
    # Fenêtre de 10 ans, min_periods=7 : rien avant l'indice 10 (t-10..t-1 dispo).
    assert np.all(np.isnan(fp.features["growth_gap"][:10]))
    assert not np.isnan(fp.features["growth_gap"][10])
    assert np.all(np.isnan(fp.features["unemp_gap"][:10]))


def test_anti_lookahead_truncation_does_not_change_past_values() -> None:
    """§12.3 test n°1, appliqué à features.py : tronquer le panel à l'année
    t ne doit rien changer aux features déjà calculées jusqu'à t."""
    full = compute_features(_panel(15))
    truncated = compute_features(_panel(12))
    for name in full.features:
        np.testing.assert_allclose(
            full.features[name][:12], truncated.features[name][:12], equal_nan=True
        )
