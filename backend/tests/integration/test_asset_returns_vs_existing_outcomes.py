"""Recoupement du nouveau calcul de rendement réel des actions avec la réalisation
déjà déployée `out_equity_real_cum` (§9.1), sur toutes les fenêtres (pays, année, horizon).

Résultat attendu et documenté (ADR 0019) :
- partout où les deux existent, les valeurs sont identiques ;
- 48 fenêtres n'existent que dans le nouveau calcul : l'ancien indice chaîné démarre à 100
  la première année de rendement et perd ce premier rendement ;
- avant correction, 12 fenêtres japonaises n'existaient que dans l'ancien calcul : JST n'a aucun
  rendement actions en 1946 et 1947 (bourse fermée) et l'indice chaîné sautait ces années, ce qui
  revient à leur attribuer 0 %. Corrigé : l'ancien calcul exclut maintenant ces fenêtres aussi.
"""

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from macrolens.api.asset_returns_service import load_country_data
from macrolens.core.asset_returns import (
    cumulative_and_annualised,
    forward_window,
    inflation_from_cpi,
    real_return,
)
from macrolens.db.models import AssetObservation
from macrolens.db.session import make_engine
from macrolens.outcomes_build import compute_outcomes, load_series_bulk

COUNTRIES = [
    "AUS", "BEL", "CHE", "DEU", "DNK", "ESP", "FIN", "FRA", "GBR",
    "ITA", "JPN", "NLD", "NOR", "PRT", "SWE", "USA",
]  # fmt: skip
HORIZONS = (1, 3, 5, 10)


@pytest.fixture(scope="module")
def comparison():  # type: ignore[no-untyped-def]
    engine = make_engine()
    try:
        with Session(engine) as session:
            if not session.scalar(select(func.count()).select_from(AssetObservation)):
                pytest.skip("asset_observations vide : lancer `macrolens etl run-all`")
            old = load_series_bulk(session, COUNTRIES)
            new = load_country_data(session, COUNTRIES)
    except OperationalError:
        pytest.skip("aucune base joignable au DATABASE_URL courant")

    both: list[tuple[str, int, int, float, float]] = []
    only_new: list[tuple[str, int, int]] = []
    only_old: list[tuple[str, int, int]] = []
    first_return_year = {c: min(new[c].nominal["jst.equity_tr"]) for c in COUNTRIES}
    for country in COUNTRIES:
        inflation = inflation_from_cpi(new[country].cpi)
        real = real_return(new[country].nominal["jst.equity_tr"], inflation)
        for year in range(1870, 2021):
            for horizon in HORIZONS:
                window = forward_window(real, year, horizon)
                existing = compute_outcomes(old.get(country, {}), set(), year, horizon)
                legacy = existing.out_equity_real_cum
                if window is not None and legacy is not None:
                    cumulative = 100.0 * cumulative_and_annualised(window)[0]
                    both.append((country, year, horizon, cumulative, legacy))
                elif window is not None:
                    only_new.append((country, year, horizon))
                elif legacy is not None:
                    only_old.append((country, year, horizon))
    return both, only_new, only_old, first_return_year


def test_values_are_identical_wherever_both_calculations_exist(comparison) -> None:  # type: ignore[no-untyped-def]
    both, _, _, _ = comparison
    assert len(both) > 8000
    worst = max(abs(new - old) / max(1.0, abs(old)) for _, _, _, new, old in both)
    assert worst < 1e-6


def test_windows_only_in_the_new_calculation_are_anchored_just_before_a_return(  # type: ignore[no-untyped-def]
    comparison,
) -> None:
    """Ancrage = année précédant le premier rendement publié (le niveau de l'indice
    chaîné existant n'existe pas encore), ou 1947 pour le Japon (niveau absent après la
    fermeture de la bourse alors que les rendements 1948 et suivants existent)."""
    _, only_new, _, first_return_year = comparison
    assert len(only_new) == 48
    expected = {(c, first - 1) for c, first in first_return_year.items()} | {("JPN", 1947)}
    assert {(c, y) for c, y, _ in only_new} <= expected


def test_no_window_exists_only_in_the_legacy_calculation_any_more(  # type: ignore[no-untyped-def]
    comparison,
) -> None:
    """Avant correction, 12 fenêtres japonaises (ancrages 1938 à 1945) n'existaient que dans
    l'ancien calcul : l'indice chaîné sautait 1946-1947 (aucun rendement dans JST). La garde
    `_chain_has_gap` de outcomes_build.py les supprime : l'ancien calcul est maintenant aligné
    sur le nouveau, qui n'a jamais comblé ce trou."""
    _, _, only_old, _ = comparison
    assert only_old == []
