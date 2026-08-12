"""Critères d'acceptation Phase 2 (§13) : `macrolens etl run-all` rejouable
de zéro, observations en base, chronologie des crises bancaires extraite,
rapport de couverture généré. Se saute proprement sans base joignable — voir
tests/integration/test_seed.py pour la même convention.

Le seuil « ≥ 250 000 observations » du plan décrit la table `observations`
en fin de projet, toutes sources confondues (§3 — 250 000 lignes est le
total visé pour l'architecture complète, JST + Maddison + BIS + IMF + OCDE +
etc., Phase 3+). JST seul (2 718 lignes pays-année × ~21 codes mappés) ne
peut mathématiquement pas atteindre ce chiffre : voir
docs/decisions/0002-ambiguites-plan-phase-2.md. Ce test vérifie un seuil
JST-only réaliste, mesuré, pas le chiffre de fin de projet.
"""

import datetime as dt

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from macrolens.db.models import Event, Observation
from macrolens.db.session import make_engine

MIN_JST_ONLY_OBSERVATIONS = 50_000  # mesuré : 54 737 au 2026-08-12


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


def test_jst_only_observation_count_is_realistic(db_session: Session) -> None:
    count = db_session.scalar(select(func.count()).select_from(Observation))
    assert count is not None
    assert count >= MIN_JST_ONLY_OBSERVATIONS


def test_known_banking_crises_are_present(db_session: Session) -> None:
    # Cas connus, vérifiés directement dans le fichier .dta (crisisJST=1).
    known = [("FRA", 1882), ("DEU", 1931), ("SWE", 1991), ("ITA", 2008)]
    for country, year in known:
        found = db_session.scalar(
            select(func.count())
            .select_from(Event)
            .where(
                Event.kind == "banking_crisis",
                Event.source_id == "jst",
                Event.country_iso3 == country,
            )
            .where(Event.date_start.between(dt.date(year, 1, 1), dt.date(year, 12, 31)))
        )
        assert found == 1, f"crise bancaire {country} {year} absente ou dupliquée"


def test_coverage_report_was_generated() -> None:
    from macrolens.etl.pipeline import DEFAULT_REPORTS_DIR

    report = DEFAULT_REPORTS_DIR / "coverage.md"
    assert report.exists()
    content = report.read_text()
    assert "observations en base" in content
    assert "PIB" in content
