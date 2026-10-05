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


# ---- indice chaîné avec année manquante (ADR 0019) --------------------------------------


def _panel_with_equity_gap(missing: list[int]) -> RawPanel:
    base = _panel()
    equity = base.equity_index_nominal.copy()
    equity[missing] = np.nan
    return RawPanel(
        years=base.years,
        gdp_real_pc=base.gdp_real_pc,
        cpi=base.cpi,
        rate_short=base.rate_short,
        rate_long=base.rate_long,
        debt_public_gdp=base.debt_public_gdp,
        credit_private_gdp=base.credit_private_gdp,
        equity_index_nominal=equity,
        house_price_index=base.house_price_index,
        unemployment_rate=base.unemployment_rate,
        current_account_gdp=base.current_account_gdp,
    )


def test_equity_real_3y_is_missing_when_the_chained_index_skips_a_year_in_the_window() -> None:
    """Un indice chaîné saute une année sans rendement comme un rendement nul : le rapport des
    deux extrémités serait faux. Années 5 et 6 manquantes : les fenêtres de 3 ans qui les
    enjambent (extrémités en 3 à 9, intérieur contenant 5 ou 6) deviennent manquantes."""
    clean = compute_features(_panel()).features["equity_real_3y"]
    gapped = compute_features(_panel_with_equity_gap([5, 6])).features["equity_real_3y"]
    # t=8 : fenêtre 5..8, extrémités 5 et 8, extrémité 5 manquante -> déjà manquant.
    # t=7 : fenêtre 4..7, intérieur 5 et 6 manquants, extrémités présentes : le cas du Japon 1948.
    assert np.isnan(gapped[7])
    assert not np.isnan(clean[7])
    # Fenêtre sans année manquante : strictement inchangée.
    assert gapped[3] == pytest.approx(clean[3])
    assert gapped[4] == pytest.approx(clean[4])
    assert gapped[10] == pytest.approx(clean[10])
    assert gapped[14] == pytest.approx(clean[14])


def test_house_real_3y_is_not_affected_by_a_gap_in_a_level_index() -> None:
    """Un indice de niveau observé (prix immobiliers) n'a pas besoin des années intermédiaires."""
    base = _panel()
    house = base.house_price_index.copy()
    house[[5, 6]] = np.nan
    gapped = RawPanel(
        years=base.years, gdp_real_pc=base.gdp_real_pc, cpi=base.cpi, rate_short=base.rate_short,
        rate_long=base.rate_long, debt_public_gdp=base.debt_public_gdp,
        credit_private_gdp=base.credit_private_gdp, equity_index_nominal=base.equity_index_nominal,
        house_price_index=house, unemployment_rate=base.unemployment_rate,
        current_account_gdp=base.current_account_gdp,
    )  # fmt: skip
    clean = compute_features(base).features["house_real_3y"]
    got = compute_features(gapped).features["house_real_3y"]
    assert got[7] == pytest.approx(clean[7])


def test_equity_gap_guard_keeps_the_anti_lookahead_property() -> None:
    """La garde n'utilise que le passé de la fenêtre : tronquer le panel ne change rien avant t."""
    full = compute_features(_panel_with_equity_gap([5, 6])).features["equity_real_3y"]
    base = _panel_with_equity_gap([5, 6])
    n = 9
    truncated = RawPanel(
        years=base.years[:n], gdp_real_pc=base.gdp_real_pc[:n], cpi=base.cpi[:n],
        rate_short=base.rate_short[:n], rate_long=base.rate_long[:n],
        debt_public_gdp=base.debt_public_gdp[:n], credit_private_gdp=base.credit_private_gdp[:n],
        equity_index_nominal=base.equity_index_nominal[:n],
        house_price_index=base.house_price_index[:n], unemployment_rate=base.unemployment_rate[:n],
        current_account_gdp=base.current_account_gdp[:n],
    )  # fmt: skip
    cut = compute_features(truncated).features["equity_real_3y"]
    np.testing.assert_array_equal(np.isnan(cut), np.isnan(full[:n]))
    np.testing.assert_allclose(cut[~np.isnan(cut)], full[:n][~np.isnan(full[:n])])
