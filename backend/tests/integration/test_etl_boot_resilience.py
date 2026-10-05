"""ADR 0026 : le démarrage de la production ne doit dépendre d'aucune source externe quand les
données sont déjà en base, et ne doit pas être bloqué par des rapports annexes."""

from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from macrolens import cli
from macrolens.db.models import AssetObservation, Observation, RawFile, Source
from macrolens.db.session import make_engine
from macrolens.etl import asset_returns, common, pipeline
from macrolens.paths import DATA_DIR


@pytest.fixture()
def session():  # type: ignore[no-untyped-def]
    engine = make_engine()
    try:
        connection = engine.connect()
    except OperationalError:
        pytest.skip("aucune base joignable au DATABASE_URL courant")
    connection.close()
    with Session(engine) as s:
        if not s.scalar(select(func.count()).select_from(Observation)):
            pytest.skip("base non ingérée : lancer `macrolens etl run-all`")
        if not s.scalar(select(func.count()).select_from(AssetObservation)):
            pytest.skip("rendements d'actifs non ingérés")
        yield s
        s.rollback()


@pytest.fixture()
def no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    def forbidden(*_a: Any, **_k: Any) -> None:
        raise AssertionError("accès réseau interdit pendant un démarrage à données déjà chargées")

    monkeypatch.setattr(common.httpx, "stream", forbidden)
    for name in ("run_jst", "run_bis_cbpol", "run_maddison"):
        monkeypatch.setattr(pipeline, name, forbidden)
    monkeypatch.setattr(asset_returns, "run_jst_assets", forbidden)


def test_sources_of_the_ingested_database_are_reported_as_loaded(session: Session) -> None:
    for source_id, vintage in (("jst", "R6"), ("bis_cbpol", "current"), ("maddison", "2023")):
        assert pipeline.source_is_loaded(session, source_id, vintage)


def test_a_registered_file_without_observations_is_not_loaded(session: Session) -> None:
    """Une ingestion interrompue après le téléchargement doit être rejouée, pas ignorée."""
    now = datetime.now(UTC)
    session.add(
        Source(
            id="ghost_src",
            full_name="g",
            url="u",
            citation="c",
            licence="l",
            priority=9,
            retrieved_at=now.date(),
        )
    )
    session.flush()
    session.add(
        RawFile(
            source_id="ghost_src",
            vintage="v1",
            filename="x.dta",
            relpath="x",
            media_type="dta",
            sha256="0" * 64,
            size_bytes=1,
            origin_url="u",
            downloaded_at=now,
        )
    )
    session.flush()
    assert not pipeline.source_is_loaded(session, "ghost_src", "v1")
    assert not pipeline.source_is_loaded(session, "jst", "unregistered-vintage")
    assert not pipeline.source_is_loaded(session, "unknown_source", "R6")


def test_default_run_all_with_loaded_data_never_touches_the_network(
    session: Session, no_network: None, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(pipeline, "REPORTS_DIR", tmp_path)
    n_before = session.scalar(select(func.count()).select_from(Observation))
    report = pipeline.run_all(session)
    assert [s.skipped for s in report.sources] == [True, True, True]
    assert all(s.reconcile is None for s in report.sources)
    assert report.asset_skipped is True
    assert report.asset_observations and report.asset_observations > 8000
    assert report.n_observations == n_before


def test_conflicts_report_is_not_overwritten_when_sources_were_skipped(
    session: Session, no_network: None, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Réécrire « aucun conflit » après un démarrage qui n'a rien rejoué serait faux."""
    monkeypatch.setattr(pipeline, "REPORTS_DIR", tmp_path)
    (tmp_path / "conflicts.md").write_text("rapport existant")
    pipeline.run_all(session)
    assert (tmp_path / "conflicts.md").read_text() == "rapport existant"
    assert (tmp_path / "coverage.md").exists()


def test_refresh_replays_every_source_and_the_asset_returns(
    session: Session, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[str] = []

    def fake(name: str):  # type: ignore[no-untyped-def]
        def run(_session: Session, **_k: Any) -> pipeline.SourceRunReport:
            calls.append(name)
            return pipeline.SourceRunReport(
                source_id=name,
                reconcile=SimpleNamespace(conflicts=[]),  # type: ignore[arg-type]
            )

        return run

    monkeypatch.setattr(pipeline, "REPORTS_DIR", tmp_path)
    monkeypatch.setattr(pipeline, "run_jst", fake("jst"))
    monkeypatch.setattr(pipeline, "run_bis_cbpol", fake("bis_cbpol"))
    monkeypatch.setattr(pipeline, "run_maddison", fake("maddison"))
    monkeypatch.setattr(
        asset_returns, "run_jst_assets", lambda *_a, **_k: calls.append("assets") or 1
    )
    report = pipeline.run_all(session, refresh=True)
    assert calls == ["jst", "bis_cbpol", "maddison", "assets"]
    assert not any(s.skipped for s in report.sources)
    assert report.asset_skipped is False


def test_a_source_missing_from_the_database_fails_loudly(
    session: Session, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Installation à neuf : ne rien charger en silence."""
    monkeypatch.setattr(pipeline, "REPORTS_DIR", tmp_path)
    monkeypatch.setattr(pipeline, "source_is_loaded", lambda *_a, **_k: False)

    def boom(*_a: Any, **_k: Any) -> None:
        raise RuntimeError("source injoignable")

    monkeypatch.setattr(pipeline, "run_jst", boom)
    with pytest.raises(RuntimeError, match="source injoignable"):
        pipeline.run_all(session)


def test_unwritable_reports_directory_does_not_block_startup(
    session: Session, no_network: None, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    blocker = tmp_path / "file"
    blocker.write_text("x")
    monkeypatch.setattr(pipeline, "REPORTS_DIR", blocker / "reports")  # mkdir impossible
    report = pipeline.run_all(session)
    assert report.coverage_report_path is None
    assert report.conflicts_report_path is None
    assert [s.skipped for s in report.sources] == [True, True, True]


def test_asset_loaded_check_is_false_instead_of_raising_on_any_error(session: Session) -> None:
    assert asset_returns.is_loaded(session, DATA_DIR) is True
    assert asset_returns.is_loaded(session, Path("/nonexistent")) is False


def test_cli_run_all_reports_skipped_sources(
    no_network: None,
    capsys: pytest.CaptureFixture[str],
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(pipeline, "REPORTS_DIR", tmp_path)
    assert cli.main(["etl", "run-all"]) == 0
    out = capsys.readouterr().out
    assert out.count("déjà chargée, ingestion ignorée") == 3
    assert "asset_returns: déjà chargé" in out
    assert "total observations=" in out


def test_cli_refresh_flag_is_parsed() -> None:
    args = cli.build_parser().parse_args(["etl", "run-all", "--refresh"])
    assert args.refresh is True
    assert cli.build_parser().parse_args(["etl", "run-all"]).refresh is False
