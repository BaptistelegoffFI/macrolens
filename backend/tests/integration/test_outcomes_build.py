"""§9.1 : réalisations calculées depuis des observations réellement
ingérées — pas une prédiction (règle 4)."""

import pytest
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from macrolens.db.session import make_engine
from macrolens.outcomes_build import outcomes_for_analogs


@pytest.fixture(scope="module")
def db_session():  # type: ignore[no-untyped-def]
    engine = make_engine()
    try:
        connection = engine.connect()
    except OperationalError:
        pytest.skip("aucune base joignable au DATABASE_URL courant")
    connection.close()
    with Session(engine) as session:
        yield session


def test_sweden_1990_shows_a_banking_crisis_within_3_years(db_session: Session) -> None:
    """La crise bancaire nordique a débuté en 1991 — dans la fenêtre (1990,1993]."""
    result = outcomes_for_analogs(db_session, [("SWE", 1990)], horizons=(3,))
    outcomes = result[("SWE", 1990)][3]
    assert outcomes.out_banking_crisis is True


def test_france_1990_no_banking_crisis_within_3_years(db_session: Session) -> None:
    result = outcomes_for_analogs(db_session, [("FRA", 1990)], horizons=(3,))
    outcomes = result[("FRA", 1990)][3]
    assert outcomes.out_banking_crisis is False


def test_outcomes_are_none_not_fabricated_beyond_available_data(db_session: Session) -> None:
    """§7.5 : un horizon qui dépasse les données disponibles ne doit pas
    produire une valeur inventée — None, pas 0 ni une extrapolation."""
    result = outcomes_for_analogs(db_session, [("FRA", 2019)], horizons=(10,))
    outcomes = result[("FRA", 2019)][10]  # 2029 n'existe pas dans les données
    assert outcomes.out_growth_cum is None


def test_growth_and_inflation_are_plausible_for_a_known_stable_period(db_session: Session) -> None:
    result = outcomes_for_analogs(db_session, [("FRA", 2000)], horizons=(5,))
    outcomes = result[("FRA", 2000)][5]
    assert outcomes.out_growth_cum is not None
    # Croissance cumulée sur 5 ans plausible pour une économie développée (pas -90% ni +900%).
    assert -50.0 < outcomes.out_growth_cum < 100.0
    assert outcomes.out_inflation_ann is not None
    assert -5.0 < outcomes.out_inflation_ann < 15.0
