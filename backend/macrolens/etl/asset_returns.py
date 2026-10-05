"""Ingestion des rendements d'actifs Tier 1 depuis le fichier JST R6 déjà
téléchargé (ADR 0021, 0022). Valeurs recopiées telles que publiées : fractions
nominales en monnaie locale, jamais déflatées, jamais comblées (ADR 0019). Les
drapeaux d'interpolation de JST sont conservés.

Écrit uniquement dans `asset_series` et `asset_observations` (tables additives) :
aucune ligne de `observations` ni de `indicators` n'est touchée.
"""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

import pandas as pd
import pyreadstat
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from macrolens.asset_catalogue import STORAGE_ASSET_OBSERVATIONS, Catalogue, load_catalogue
from macrolens.db.models import AssetObservation, AssetSeries
from macrolens.etl import load
from macrolens.etl.sources import jst

BATCH_SIZE = 2000
_PK = ["series_id", "country_iso3", "period_start", "freq"]
_FRACTION_FLOOR = -1.0


def build_asset_rows(
    raw_df: pd.DataFrame,
    catalogue: Catalogue,
    *,
    known_countries: set[str],
    breaks: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Format long, une ligne par (série, pays, année) non manquante. Un NaN
    produit une absence de ligne, jamais un zéro ni une valeur reportée."""
    df = raw_df.reset_index(names="orig_index")
    df = df[df["iso"].isin(known_countries)]
    records = cast("list[dict[str, Any]]", df.to_dict("records"))

    rows: list[dict[str, Any]] = []
    bad: list[str] = []
    for series in catalogue.series.values():
        if series.storage != STORAGE_ASSET_OBSERVATIONS:
            continue
        column = cast("str", series.column)
        for record in records:
            raw_value = record[column]
            if pd.isna(raw_value):
                continue
            value = float(raw_value)
            country = str(record["iso"])
            year = int(record["year"])
            if value < _FRACTION_FLOOR:
                bad.append(f"{series.id} {country} {year}: {value}")
                continue
            interpolated = any(
                not pd.isna(record.get(flag)) and float(record[flag]) == 1.0
                for flag in series.interp_columns
            )
            rows.append(
                {
                    "series_id": series.id,
                    "country_iso3": country,
                    "period_start": datetime(year, 1, 1).date(),
                    "freq": "A",
                    "value": value,
                    "is_interpolated": interpolated,
                    "is_break": jst._is_break(country, year, breaks),
                    "locator": {
                        "kind": "dta",
                        "obs_index": int(record["orig_index"]),
                        "variables": [column, *series.interp_columns],
                    },
                    "raw_value_text": f"{column}={raw_value!r}",
                    "transform_chain": ["parse_dta_float"],
                }
            )
    if bad:
        raise ValueError(
            "rendement inférieur à -100 % (impossible) :\n" + "\n".join(bad[:20])
        )
    return rows


def _upsert_series_meta(session: Session, catalogue: Catalogue) -> int:
    rows = [
        {
            "id": s.id,
            "asset_class": s.asset_class,
            "tier": s.tier,
            "measure": s.measure,
            "source_id": s.source_id,
            "citation": s.citation,
            "label_fr": s.label_fr,
            "label_en": s.label_en,
            "caveat_fr": s.caveat_fr,
            "caveat_en": s.caveat_en,
        }
        for s in catalogue.series.values()
    ]
    stmt = insert(AssetSeries).values(rows)
    update_cols = {c.name: c for c in stmt.excluded if c.name != "id"}
    session.execute(stmt.on_conflict_do_update(index_elements=["id"], set_=update_cols))
    return len(rows)


def _upsert_observations(session: Session, rows: list[dict[str, Any]], raw_file_id: int) -> int:
    now = datetime.now(UTC)
    for start in range(0, len(rows), BATCH_SIZE):
        batch = [
            {**r, "raw_file_id": raw_file_id, "ingested_at": now}
            for r in rows[start : start + BATCH_SIZE]
        ]
        stmt = insert(AssetObservation).values(batch)
        # ingested_at n'est pas réécrit : il garde la date de première ingestion.
        update_cols = {
            c.name: c for c in stmt.excluded if c.name not in _PK and c.name != "ingested_at"
        }
        session.execute(stmt.on_conflict_do_update(index_elements=_PK, set_=update_cols))
    return len(rows)


def run_jst_assets(session: Session, *, data_dir: Path) -> int:
    """Retourne le nombre de lignes de rendements écrites."""
    catalogue = load_catalogue(data_dir / "reference" / "asset_catalogue.yaml")
    raw_dir = data_dir / "raw" / "jst" / jst.VINTAGE
    downloaded = jst.download(raw_dir)
    raw_file_ids = load.register_raw_files(
        session, downloaded, source_id=jst.SOURCE_ID, vintage=jst.VINTAGE
    )
    dta_file = next(f for f in downloaded if f.media_type == "dta")

    raw_df, _meta = pyreadstat.read_dta(str(dta_file.path))
    rows = build_asset_rows(
        raw_df,
        catalogue,
        known_countries=jst._load_known_countries(),
        breaks=jst._load_country_breaks(),
    )
    _upsert_series_meta(session, catalogue)
    return _upsert_observations(session, rows, raw_file_ids[dta_file.filename])


def count_loaded(session: Session) -> int:
    return int(session.scalar(select(func.count()).select_from(AssetObservation)) or 0)


def is_loaded(session: Session, data_dir: Path) -> bool:
    """Vrai si toutes les séries du catalogue sont enregistrées et que les rendements existent :
    le démarrage de la production n'a alors rien à retélécharger (ADR 0026). Toute erreur
    (tables absentes, base indisponible) vaut « pas chargé » : l'ingestion non bloquante prend
    le relais et consigne l'échec."""
    try:
        catalogue = load_catalogue(data_dir / "reference" / "asset_catalogue.yaml")
        registered = int(session.scalar(select(func.count()).select_from(AssetSeries)) or 0)
        return registered >= len(catalogue.series) and count_loaded(session) > 0
    except Exception:
        return False
