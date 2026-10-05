"""Orchestration du pipeline d'ingestion (§7.1) : download → parse → validate
→ réconciliation, source par source (§5.3). Le rapport de couverture et le
rapport de conflits sont régénérés une fois, après le chargement de toutes
les sources, pour refléter l'état complet de la base.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from macrolens.db.models import Observation, RawFile
from macrolens.etl import asset_returns, conflicts, coverage, load, reconcile, validate
from macrolens.etl.reconcile import ReconcileReport
from macrolens.etl.sources import bis_cbpol, jst, maddison
from macrolens.paths import DATA_DIR, REPORTS_DIR

DEFAULT_DATA_DIR = DATA_DIR
DEFAULT_REPORTS_DIR = REPORTS_DIR

logger = logging.getLogger("macrolens.etl.pipeline")


@dataclass(frozen=True)
class SourceRunReport:
    source_id: str
    # None quand la source a été ignorée parce qu'elle est déjà chargée (ADR 0026).
    reconcile: ReconcileReport | None
    skipped: bool = False


@dataclass(frozen=True)
class PipelineReport:
    sources: list[SourceRunReport] = field(default_factory=list)
    n_observations: int = 0  # total réel en base (requête directe), pas un delta de ce run
    coverage_report_path: Path | None = None
    conflicts_report_path: Path | None = None
    # None = ingestion des rendements d'actifs échouée (non bloquante, ADR 0024).
    asset_observations: int | None = None
    asset_skipped: bool = False


def _validate_or_raise(df: pd.DataFrame, data_dir: Path, source_label: str) -> None:
    report = validate.validate_canonical(
        df,
        bounds_path=data_dir / "reference" / "indicator_bounds.yaml",
        countries_path=data_dir / "reference" / "countries.yaml",
        indicators_path=data_dir / "reference" / "indicators.yaml",
    )
    if not report.ok:
        raise ValueError(f"Validation {source_label} échouée :\n" + "\n".join(report.errors))


def run_jst(
    session: Session, *, data_dir: Path = DEFAULT_DATA_DIR, force_download: bool = False
) -> SourceRunReport:
    raw_dir = data_dir / "raw" / "jst" / jst.VINTAGE
    downloaded = jst.download(raw_dir, force=force_download)
    raw_file_ids = load.register_raw_files(
        session, downloaded, source_id=jst.SOURCE_ID, vintage=jst.VINTAGE
    )
    dta_file = next(f for f in downloaded if f.media_type == "dta")

    df = jst.parse(dta_file.path)
    _validate_or_raise(df, data_dir, "JST")
    recon = reconcile.reconcile_and_load(session, df, raw_file_id=raw_file_ids[dta_file.filename])

    events = jst.extract_banking_crises(dta_file.path)
    load.load_source_events(session, events, source_id=jst.SOURCE_ID)

    return SourceRunReport(source_id=jst.SOURCE_ID, reconcile=recon)


def run_bis_cbpol(
    session: Session, *, data_dir: Path = DEFAULT_DATA_DIR, force_download: bool = False
) -> SourceRunReport:
    raw_dir = data_dir / "raw" / "bis_cbpol" / bis_cbpol.VINTAGE
    downloaded = bis_cbpol.download(raw_dir, force=force_download)
    raw_file_ids = load.register_raw_files(
        session, downloaded, source_id=bis_cbpol.SOURCE_ID, vintage=bis_cbpol.VINTAGE
    )
    csv_file = downloaded[0]

    df = bis_cbpol.parse(csv_file.path)
    _validate_or_raise(df, data_dir, "BIS policy rates")
    recon = reconcile.reconcile_and_load(session, df, raw_file_id=raw_file_ids[csv_file.filename])

    return SourceRunReport(source_id=bis_cbpol.SOURCE_ID, reconcile=recon)


def run_maddison(
    session: Session, *, data_dir: Path = DEFAULT_DATA_DIR, force_download: bool = False
) -> SourceRunReport:
    """Nécessite le .dta JST déjà présent sur disque (ratio de raccord §7.3
    calculé contre l'année d'ancrage 1870) — toujours exécuté après run_jst
    dans run_all()."""
    raw_dir = data_dir / "raw" / "maddison" / maddison.VINTAGE
    downloaded = maddison.download(raw_dir, force=force_download)
    raw_file_ids = load.register_raw_files(
        session, downloaded, source_id=maddison.SOURCE_ID, vintage=maddison.VINTAGE
    )
    xlsx_file = downloaded[0]

    df = maddison.parse(xlsx_file.path)
    _validate_or_raise(df, data_dir, "Maddison")
    recon = reconcile.reconcile_and_load(session, df, raw_file_id=raw_file_ids[xlsx_file.filename])

    return SourceRunReport(source_id=maddison.SOURCE_ID, reconcile=recon)


def source_is_loaded(session: Session, source_id: str, vintage: str) -> bool:
    """Une source est « chargée » si son fichier est enregistré ET qu'elle a des observations :
    un enregistrement sans observations (ingestion interrompue après le téléchargement) ne
    compte pas, il doit être rejoué."""
    has_file = session.scalar(
        select(func.count())
        .select_from(RawFile)
        .where(RawFile.source_id == source_id, RawFile.vintage == vintage)
    )
    has_rows = session.scalar(
        select(func.count()).select_from(Observation).where(Observation.source_id == source_id)
    )
    return bool(has_file) and bool(has_rows)


def _run_asset_returns_non_blocking(session: Session, data_dir: Path) -> int | None:
    """ADR 0024 : en production, chaque démarrage de l'API enchaîne
    `alembic upgrade head && seed && etl run-all && uvicorn`. Un échec de
    l'ingestion des rendements d'actifs, fonctionnalité additive, ne doit
    jamais empêcher l'application principale de démarrer. Le savepoint isole
    l'échec : l'ingestion principale déjà écrite reste intacte."""
    try:
        with session.begin_nested():
            return asset_returns.run_jst_assets(session, data_dir=data_dir)
    except Exception:
        logger.exception("ingestion des rendements d'actifs échouée (non bloquant)")
        return None


def _write_reports(
    session: Session, sources: list[SourceRunReport]
) -> tuple[Path | None, Path | None]:
    """Rapports annexes (couverture, conflits). Jamais bloquants : un dossier non inscriptible ou
    une erreur de rendu ne doit pas empêcher le démarrage. Le rapport de conflits n'est réécrit
    que si toutes les sources ont été rejouées ; sinon il décrirait « aucun conflit » à tort."""
    coverage_path: Path | None = None
    conflicts_path: Path | None = None
    try:
        reports_dir = REPORTS_DIR
        reports_dir.mkdir(parents=True, exist_ok=True)
        coverage_path = reports_dir / "coverage.md"
        coverage_path.write_text(coverage.render_report(session))
        if all(not s.skipped for s in sources):
            all_conflicts = [c for s in sources if s.reconcile for c in s.reconcile.conflicts]
            conflicts_path = reports_dir / "conflicts.md"
            conflicts_path.write_text(conflicts.render_report(all_conflicts))
    except Exception:
        logger.exception("génération des rapports annexes échouée (non bloquant)")
    return coverage_path, conflicts_path


def run_all(
    session: Session, *, data_dir: Path = DEFAULT_DATA_DIR, refresh: bool = False
) -> PipelineReport:
    """ADR 0026. Par défaut, une source déjà chargée en base n'est ni retéléchargée ni rejouée :
    la production redémarre souvent (réveil d'une instance gratuite) et ne doit pas dépendre de
    la disponibilité de sources externes pour démarrer. Une source absente est traitée
    strictement : un échec lève une erreur (installation à neuf). `refresh=True` rejoue tout
    (rafraîchissement délibéré, voir docs/data-refresh.md)."""
    steps = (
        (jst.SOURCE_ID, jst.VINTAGE, run_jst),
        (bis_cbpol.SOURCE_ID, bis_cbpol.VINTAGE, run_bis_cbpol),
        (maddison.SOURCE_ID, maddison.VINTAGE, run_maddison),
    )
    sources: list[SourceRunReport] = []
    for source_id, vintage, runner in steps:
        if not refresh and source_is_loaded(session, source_id, vintage):
            logger.info("source %s déjà chargée : ingestion ignorée", source_id)
            sources.append(SourceRunReport(source_id=source_id, reconcile=None, skipped=True))
        else:
            sources.append(runner(session, data_dir=data_dir))

    session.flush()

    asset_skipped = False
    if not refresh and asset_returns.is_loaded(session, data_dir):
        asset_skipped = True
        asset_rows: int | None = asset_returns.count_loaded(session)
    else:
        asset_rows = _run_asset_returns_non_blocking(session, data_dir)

    coverage_path, conflicts_path = _write_reports(session, sources)

    return PipelineReport(
        sources=sources,
        n_observations=coverage.total_observations(session),
        coverage_report_path=coverage_path,
        conflicts_report_path=conflicts_path,
        asset_observations=asset_rows,
        asset_skipped=asset_skipped,
    )
