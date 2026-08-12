"""Écriture en base des données canoniques et des fichiers sources (§7.1
étapes 1 et 4, §18.2). Aucune règle métier ici — le mapping et les
transformations vivent dans etl/sources/<source_id>.py et etl/derive.py.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, cast

import pandas as pd
from sqlalchemy import delete, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from macrolens.db.models import Event, Observation, RawFile, Source
from macrolens.etl.sources.jst import DownloadedFile


def register_raw_files(
    session: Session, files: list[DownloadedFile], *, source_id: str, vintage: str
) -> dict[str, int]:
    """Upsert par sha256 (§14 : data/raw/ n'est jamais réécrit sans que le
    hash change). Retourne {filename: raw_file_id}."""
    ids: dict[str, int] = {}
    for f in files:
        stmt = (
            insert(RawFile)
            .values(
                source_id=source_id,
                vintage=vintage,
                filename=f.filename,
                relpath=str(f.path),
                media_type=f.media_type,
                sha256=f.sha256,
                size_bytes=f.size_bytes,
                origin_url=f.origin_url,
                downloaded_at=f.downloaded_at,
            )
            .on_conflict_do_update(
                index_elements=["sha256"],
                set_={
                    "relpath": str(f.path),
                    "downloaded_at": f.downloaded_at,
                },
            )
            .returning(RawFile.id)
        )
        raw_file_id = session.execute(stmt).scalar_one()
        ids[f.filename] = raw_file_id

    dataset_file = next((f for f in files if f.media_type == "dta"), files[0])
    session.execute(
        update(Source)
        .where(Source.id == source_id)
        .values(file_sha256=dataset_file.sha256, retrieved_at=dataset_file.downloaded_at.date())
    )
    return ids


# PostgreSQL limite une requête à 65535 paramètres liés. Observation a 16
# colonnes insérables (y compris celles laissées à leur défaut, qui comptent
# quand même comme paramètres dans un INSERT multi-lignes) ; 2000 lignes par
# lot laisse une marge confortable (32000 paramètres) sans complexité inutile
# à calculer un lot au plus juste.
_BATCH_SIZE = 2000


def load_observations(session: Session, df: pd.DataFrame, *, raw_file_id: int) -> int:
    if df.empty:
        return 0
    df = df.copy()
    df["raw_file_id"] = raw_file_id
    df["ingested_at"] = datetime.now(UTC)
    df["period_start"] = df["period_start"].dt.date

    records = cast("list[dict[str, Any]]", df.to_dict(orient="records"))
    pk_cols = ["country_iso3", "indicator_code", "period_start", "freq"]

    # PostgreSQL limite une requête à 65535 paramètres liés (§7 : le pipeline
    # doit tenir sur ~250 000 observations, largement au-delà de cette limite
    # en un seul INSERT multi-valeurs) — on upsert par lots.
    for start in range(0, len(records), _BATCH_SIZE):
        batch = records[start : start + _BATCH_SIZE]
        stmt = insert(Observation).values(batch)
        update_cols = {c.name: c for c in stmt.excluded if c.name not in pk_cols}
        stmt = stmt.on_conflict_do_update(index_elements=pk_cols, set_=update_cols)
        session.execute(stmt)
    return len(records)


def load_source_events(session: Session, events: list[dict[str, Any]], *, source_id: str) -> int:
    """Recharge les événements extraits programmatiquement d'une source donnée
    (par opposition aux événements curés à la main, voir db/seed.py)."""
    session.execute(delete(Event).where(Event.source_id == source_id))
    if not events:
        return 0
    session.execute(insert(Event), events)
    return len(events)
