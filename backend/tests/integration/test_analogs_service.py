"""Phase 5 : `_war_years` et `_filter_by_request` (§8.4, ADR 0004 §1) —
les événements globaux (country_iso3 IS NULL, ex. les deux guerres
mondiales) doivent s'appliquer à tous les pays, et l'exclusion des années
de guerre ne doit s'appliquer que si `exclude_wartime=True` (par défaut
`False` dans le plan, §10.1)."""

import pytest
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from macrolens.api.analogs_service import _filter_by_request, _war_years
from macrolens.api.schemas.analogs import AnalogsSearchRequest, AnchorSpec, FiltersSpec
from macrolens.core.similarity import PoolEntry, StateVector
from macrolens.db.session import make_engine


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


def test_global_war_events_apply_to_every_requested_country(db_session: Session) -> None:
    """WWI/WWII sont enregistrées avec country_iso3=NULL (événement global,
    data/events/wars.yaml) — elles doivent apparaître dans les années de
    guerre de CHAQUE pays demandé, pas seulement des pays qui ont leur
    propre entrée pays-spécifique (ex. FIN, NOR)."""
    war_years = _war_years(db_session, ["FRA", "DEU", "SWE"])
    assert 1916 in war_years["FRA"]  # WWI (1914-1918)
    assert 1943 in war_years["DEU"]  # WWII (1939-1945)
    assert 1943 in war_years["SWE"]  # neutre, mais l'exclusion reste globale (ADR 0004)


def _fake_pool() -> tuple[list[StateVector], list[PoolEntry]]:
    ranks = {"infl_level": 0.5}
    years = [1938, 1939, 1943, 1944, 2019]
    sv = [StateVector(country="FRA", year=y, ranks=ranks) for y in years]
    entries = [
        PoolEntry(
            country="FRA", year=y, is_complete=True, is_break=False,
            coverage_partial=False, last_year_available=2019,
        )
        for y in years
    ]
    return sv, entries


class _FakeFramePool:
    def __init__(self) -> None:
        self.state_vectors, self.pool_entries = _fake_pool()


def test_wartime_years_kept_by_default(db_session: Session) -> None:
    request = AnalogsSearchRequest(
        mode="anchor",
        anchor=AnchorSpec(country="FRA", year=2019),
        k=20,
        filters=FiltersSpec(countries=["FRA"], year_min=1900, year_max=2020),
    )
    assert request.filters.exclude_wartime is False
    war_years = _war_years(db_session, ["FRA"])
    kept_sv, _ = _filter_by_request(_FakeFramePool(), request, war_years)  # type: ignore[arg-type]
    assert {sv.year for sv in kept_sv} == {1938, 1939, 1943, 1944, 2019}


def test_wartime_years_excluded_when_requested(db_session: Session) -> None:
    request = AnalogsSearchRequest(
        mode="anchor",
        anchor=AnchorSpec(country="FRA", year=2019),
        k=20,
        filters=FiltersSpec(
            countries=["FRA"], year_min=1900, year_max=2020, exclude_wartime=True
        ),
    )
    war_years = _war_years(db_session, ["FRA"])
    kept_sv, _ = _filter_by_request(_FakeFramePool(), request, war_years)  # type: ignore[arg-type]
    # 1938 précède la déclaration de guerre (1er sept. 1939) : pas une année de
    # guerre. 1939/1943/1944 sont couvertes par la Seconde Guerre mondiale.
    assert {sv.year for sv in kept_sv} == {1938, 2019}
