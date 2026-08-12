"""Valeurs attendues écrites à la main pour chaque fonction de derive.py
(règle 6, CLAUDE.md)."""

import pytest

from macrolens.etl.derive import (
    chain_link_returns,
    fraction_to_percent,
    gdp_real_from_percapita_and_pop,
    multiply_1000,
    parse_dta_float,
    ratio_to_gdp_pct,
)


def test_parse_dta_float() -> None:
    assert parse_dta_float(4.5) == 4.5
    assert parse_dta_float(None) is None


def test_multiply_1000() -> None:
    assert multiply_1000(1675.0) == 1_675_000.0
    assert multiply_1000(None) is None


def test_fraction_to_percent() -> None:
    assert fraction_to_percent(0.974591) == pytest.approx(97.4591)
    assert fraction_to_percent(None) is None


def test_ratio_to_gdp_pct() -> None:
    # Valeurs FRA 2019 réelles (ca, gdp) — résultat attendu calculé indépendamment.
    assert ratio_to_gdp_pct(-46.530427, 15989.837417) == pytest.approx(-0.2910000, abs=1e-6)
    assert ratio_to_gdp_pct(100.0, 0.0) is None  # dénominateur nul : pas de division par zéro
    assert ratio_to_gdp_pct(None, 100.0) is None
    assert ratio_to_gdp_pct(100.0, None) is None


def test_gdp_real_from_percapita_and_pop() -> None:
    # 20000 Int$/hab. x 5000 milliers d'habitants x 1000 = 1e11
    assert gdp_real_from_percapita_and_pop(20000.0, 5000.0) == 1e11
    assert gdp_real_from_percapita_and_pop(None, 5000.0) is None


def test_chain_link_returns_base_100_first_observation() -> None:
    # Premier rendement ignoré (ancrage à la base), puis composition standard.
    result = chain_link_returns([0.10, 0.10, -0.05])
    assert result[0] == 100.0
    assert result[1] == pytest.approx(110.0)
    assert result[2] == pytest.approx(110.0 * 0.95)


def test_chain_link_returns_preserves_gaps() -> None:
    # Un trou (None) ne doit pas casser la chaîne ni être comblé (§7.5).
    result = chain_link_returns([0.0, None, 0.10])
    assert result[0] == 100.0
    assert result[1] is None
    assert result[2] == pytest.approx(110.0)


def test_chain_link_returns_is_retrospective_only() -> None:
    # Tronquer la série ne doit rien changer aux valeurs déjà calculées
    # (pas de dépendance au futur — cf. l'esprit du test anti-look-ahead §12.3).
    full = chain_link_returns([0.10, 0.05, -0.02, 0.20])
    truncated = chain_link_returns([0.10, 0.05, -0.02])
    assert full[:3] == truncated
