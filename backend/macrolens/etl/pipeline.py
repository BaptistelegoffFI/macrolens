"""Orchestration du pipeline d'ingestion (§7.1) : download → parse → validate
→ load, source par source. Une seule source en Phase 2 (JST) ; les suivantes
(Phase 3) s'ajouteront ici sans changer la forme.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from sqlalchemy.orm import Session

from macrolens.etl import coverage, load, validate
from macrolens.etl.sources import jst
from macrolens.paths import DATA_DIR, REPORTS_DIR

DEFAULT_DATA_DIR = DATA_DIR
DEFAULT_REPORTS_DIR = REPORTS_DIR


@dataclass(frozen=True)
class PipelineReport:
    n_observations: int
    n_events: int
    coverage_report_path: Path


def run_jst(
    session: Session,
    *,
    data_dir: Path = DEFAULT_DATA_DIR,
    reports_dir: Path = DEFAULT_REPORTS_DIR,
    force_download: bool = False,
) -> PipelineReport:
    raw_dir = data_dir / "raw" / "jst" / jst.VINTAGE

    downloaded = jst.download(raw_dir, force=force_download)
    raw_file_ids = load.register_raw_files(
        session, downloaded, source_id=jst.SOURCE_ID, vintage=jst.VINTAGE
    )
    dta_file = next(f for f in downloaded if f.media_type == "dta")

    df = jst.parse(dta_file.path)
    report = validate.validate_canonical(
        df,
        bounds_path=data_dir / "reference" / "indicator_bounds.yaml",
        countries_path=data_dir / "reference" / "countries.yaml",
        indicators_path=data_dir / "reference" / "indicators.yaml",
    )
    if not report.ok:
        raise ValueError("Validation JST échouée :\n" + "\n".join(report.errors))

    n_obs = load.load_observations(session, df, raw_file_id=raw_file_ids[dta_file.filename])

    events = jst.extract_banking_crises(dta_file.path)
    n_events = load.load_source_events(session, events, source_id=jst.SOURCE_ID)

    session.flush()
    coverage_md = coverage.render_report(session)
    reports_dir.mkdir(parents=True, exist_ok=True)
    coverage_path = reports_dir / "coverage.md"
    coverage_path.write_text(coverage_md)

    return PipelineReport(
        n_observations=n_obs, n_events=n_events, coverage_report_path=coverage_path
    )


def run_all(session: Session, *, data_dir: Path = DEFAULT_DATA_DIR) -> PipelineReport:
    return run_jst(session, data_dir=data_dir)
