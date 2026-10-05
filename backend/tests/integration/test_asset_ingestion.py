"""ADR 0019, 0021, 0024 : ingestion des rendements d'actifs Tier 1. Les attendus
sont recalculés depuis le fichier brut JST, indépendamment du code d'ingestion."""

import random

import pandas as pd
import pyreadstat
import pytest
import yaml
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from macrolens.asset_catalogue import STORAGE_ASSET_OBSERVATIONS, load_catalogue
from macrolens.db.models import AssetObservation, AssetSeries, Observation
from macrolens.db.session import make_engine
from macrolens.etl import pipeline
from macrolens.etl.asset_returns import run_jst_assets
from macrolens.paths import DATA_DIR

DTA = DATA_DIR / "raw" / "jst" / "R6" / "JSTdatasetR6.dta"
CATALOGUE = load_catalogue()
STORED = [s for s in CATALOGUE.series.values() if s.storage == STORAGE_ASSET_OBSERVATIONS]


@pytest.fixture(scope="module")
def raw_df() -> pd.DataFrame:
    if not DTA.exists():
        pytest.skip("fichier JST brut absent : lancer `macrolens etl run-all`")
    df, _ = pyreadstat.read_dta(str(DTA))
    countries = yaml.safe_load((DATA_DIR / "reference" / "countries.yaml").read_text())
    known = {c["iso3"] for c in countries}
    return df.reset_index(names="orig_index").loc[lambda d: d["iso"].isin(known)]


@pytest.fixture(scope="module")
def db_session():  # type: ignore[no-untyped-def]
    engine = make_engine()
    try:
        connection = engine.connect()
    except OperationalError:
        pytest.skip("aucune base joignable au DATABASE_URL courant")
    connection.close()
    with Session(engine) as session:
        n = session.scalar(select(func.count()).select_from(AssetObservation))
        if not n:
            pytest.skip("asset_observations vide : lancer `macrolens etl run-all`")
        yield session


def test_every_configured_column_exists_in_the_jst_file(raw_df: pd.DataFrame) -> None:
    for series in STORED:
        assert series.column in raw_df.columns, series.id
        for flag in series.interp_columns:
            assert flag in raw_df.columns, f"{series.id} : drapeau {flag}"


@pytest.mark.parametrize("series", STORED, ids=lambda s: s.id)
def test_row_count_and_coverage_match_the_raw_file(
    db_session: Session, raw_df: pd.DataFrame, series  # type: ignore[no-untyped-def]
) -> None:
    expected = raw_df[["iso", "year", series.column]].dropna()
    n_db = db_session.scalar(
        select(func.count())
        .select_from(AssetObservation)
        .where(AssetObservation.series_id == series.id)
    )
    assert n_db == len(expected)
    first, last = db_session.execute(
        select(func.min(AssetObservation.period_start), func.max(AssetObservation.period_start))
        .where(AssetObservation.series_id == series.id)
    ).one()
    assert (first.year, last.year) == (int(expected.year.min()), int(expected.year.max()))


def test_known_published_values_are_stored_unchanged(db_session: Session) -> None:
    def value(series_id: str, country: str, year: int) -> float:
        return db_session.execute(
            select(AssetObservation.value).where(
                AssetObservation.series_id == series_id,
                AssetObservation.country_iso3 == country,
                AssetObservation.period_start == pd.Timestamp(year=year, month=1, day=1).date(),
            )
        ).scalar_one()

    assert value("jst.equity_tr", "USA", 1931) == pytest.approx(-0.40296581387519836)
    assert value("jst.equity_tr", "DEU", 1923) == pytest.approx(2639074816.0)
    assert value("jst.bill_return", "USA", 1929) == pytest.approx(0.040736)


def test_missing_years_stay_missing_in_the_database(db_session: Session) -> None:
    """ADR 0019 : l'Italie n'a pas de rendement immobilier avant 1928."""
    n = db_session.scalar(
        select(func.count())
        .select_from(AssetObservation)
        .where(
            AssetObservation.series_id == "jst.housing_tr",
            AssetObservation.country_iso3 == "ITA",
            AssetObservation.period_start < pd.Timestamp(year=1928, month=1, day=1).date(),
        )
    )
    assert n == 0


def test_no_return_below_minus_100_percent_in_the_database(db_session: Session) -> None:
    n = db_session.scalar(
        select(func.count()).select_from(AssetObservation).where(AssetObservation.value < -1.0)
    )
    assert n == 0


def test_provenance_is_total(db_session: Session) -> None:
    total = db_session.scalar(select(func.count()).select_from(AssetObservation))
    assert db_session.scalar(
        select(func.count()).select_from(AssetObservation).where(AssetObservation.raw_file_id.is_(None))
    ) == 0
    assert db_session.scalar(
        select(func.count()).select_from(AssetObservation).where(AssetObservation.locator == {})
    ) == 0
    assert total


def test_interpolation_flags_match_the_raw_file(db_session: Session, raw_df: pd.DataFrame) -> None:
    equity_flags = int((raw_df["eq_tr_interp"] == 1).sum())
    n = db_session.scalar(
        select(func.count())
        .select_from(AssetObservation)
        .where(AssetObservation.series_id == "jst.equity_tr", AssetObservation.is_interpolated)
    )
    # Une ligne signalée par JST sans rendement publié n'est pas ingérée : n <= signalées.
    expected = int(((raw_df["eq_tr_interp"] == 1) & raw_df["eq_tr"].notna()).sum())
    assert n == expected <= equity_flags


def test_replay_from_raw_file_matches_stored_value(
    db_session: Session, raw_df: pd.DataFrame
) -> None:
    """Retour à la source (§18.8) : le locator relit la bonne ligne du .dta."""
    by_index = raw_df.set_index("orig_index")
    rows = db_session.execute(select(AssetObservation)).scalars().all()
    random.Random(0).shuffle(rows)
    for row in rows[:200]:
        variable = row.locator["variables"][0]  # type: ignore[index]
        raw = by_index.loc[row.locator["obs_index"], variable]  # type: ignore[index]
        assert float(raw) == row.value
        assert by_index.loc[row.locator["obs_index"], "iso"] == row.country_iso3  # type: ignore[index]
        assert int(by_index.loc[row.locator["obs_index"], "year"]) == row.period_start.year  # type: ignore[index]


def test_every_series_is_registered_with_tier_source_and_citation(db_session: Session) -> None:
    rows = {s.id: s for s in db_session.execute(select(AssetSeries)).scalars()}
    assert set(rows) == set(CATALOGUE.series)
    for row in rows.values():
        assert row.tier == 1
        assert row.source_id == "jst"
        assert "Rate of Return on Everything" in row.citation


def test_reingestion_is_idempotent_and_never_touches_observations(db_session: Session) -> None:
    n_obs_before = db_session.scalar(select(func.count()).select_from(Observation))
    n_assets_before = db_session.scalar(select(func.count()).select_from(AssetObservation))
    checksum_before = db_session.scalar(
        select(func.sum(AssetObservation.value)).where(AssetObservation.value < 1e6)
    )
    written = run_jst_assets(db_session, data_dir=DATA_DIR)
    assert written == n_assets_before
    assert db_session.scalar(select(func.count()).select_from(AssetObservation)) == n_assets_before
    assert db_session.scalar(select(func.count()).select_from(Observation)) == n_obs_before
    assert db_session.scalar(
        select(func.sum(AssetObservation.value)).where(AssetObservation.value < 1e6)
    ) == pytest.approx(checksum_before)
    db_session.rollback()


def test_asset_ingestion_failure_is_non_blocking_and_isolated(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """ADR 0024 : un échec ne doit pas empêcher le démarrage de l'API ni abîmer
    l'ingestion principale déjà écrite dans la même transaction."""

    def boom(*_a: object, **_k: object) -> int:
        raise RuntimeError("source indisponible")

    monkeypatch.setattr(pipeline.asset_returns, "run_jst_assets", boom)
    n_obs = db_session.scalar(select(func.count()).select_from(Observation))
    assert pipeline._run_asset_returns_non_blocking(db_session, DATA_DIR) is None
    # La session reste utilisable et les données principales intactes.
    assert db_session.scalar(select(func.count()).select_from(Observation)) == n_obs
    db_session.rollback()
