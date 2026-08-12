"""Moteur de réconciliation multi-sources (§5.3).

Règle : priorité de source fixe (jst=100 > banque centrale=90 > BRI=80 >
FMI=70 > OCDE=60 > Maddison=50 > OWID=30), jamais de moyenne entre sources.
La valeur retenue va dans `observations` ; l'autre est conservée dans
`observations_alt` avec le motif d'écartement. Un écart relatif > 5% marque
les DEUX valeurs `conflict=true` et alimente reports/conflicts.md.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, cast

import pandas as pd
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from macrolens.db.models import Observation, ObservationAlt, Source
from macrolens.etl.load import bulk_upsert_observations

CONFLICT_THRESHOLD = 0.05  # §5.3 : écart relatif > 5%

_ALT_PK = ["country_iso3", "indicator_code", "period_start", "freq", "source_id"]
_OBS_PK = ["country_iso3", "indicator_code", "period_start", "freq"]
# Colonnes communes à Observation et ObservationAlt (§6 : ObservationAlt
# reprend toutes les colonnes d'Observation, plus rejected_reason).
_SHARED_COLUMNS = [c.name for c in Observation.__table__.columns]


def _observation_to_dict(obs: Observation) -> dict[str, Any]:
    return {name: getattr(obs, name) for name in _SHARED_COLUMNS}


@dataclass(frozen=True)
class ConflictEntry:
    country_iso3: str
    indicator_code: str
    period_start: Any
    freq: str
    winning_source: str
    winning_value: float | None
    losing_source: str
    losing_value: float | None
    relative_gap: float


@dataclass
class ReconcileReport:
    inserted_new: int = 0
    replaced_by_higher_priority: int = 0
    rejected_lower_priority: int = 0
    conflicts: list[ConflictEntry] = field(default_factory=list)


def _source_priorities(session: Session) -> dict[str, int]:
    rows = session.execute(select(Source.id, Source.priority)).all()
    return {row.id: row.priority for row in rows}


def _relative_gap(a: float | None, b: float | None) -> float | None:
    if a is None or b is None or a == 0:
        return None
    return abs(b - a) / abs(a)


def reconcile_and_load(
    session: Session, df: pd.DataFrame, *, raw_file_id: int | None
) -> ReconcileReport:
    """`df` : lignes canoniques d'une seule source (même `source_id`), au même
    format que celles écrites par etl/sources/<source_id>.py::parse()."""
    report = ReconcileReport()
    if df.empty:
        return report

    df = df.copy()
    df["raw_file_id"] = raw_file_id
    df["ingested_at"] = datetime.now(UTC)
    df["period_start"] = df["period_start"].dt.date
    # Toutes les lignes d'un même lot doivent porter exactement les mêmes
    # colonnes (INSERT multi-valeurs SQLAlchemy) — "conflict" est décidé au
    # cas par cas plus bas, jamais absent.
    for missing_col in ("is_spliced", "coverage_partial", "conflict"):
        if missing_col not in df.columns:
            df[missing_col] = False

    source_id = str(df["source_id"].iloc[0])
    priorities = _source_priorities(session)
    candidate_priority = priorities[source_id]

    indicator_codes = df["indicator_code"].unique().tolist()
    country_codes = df["country_iso3"].unique().tolist()
    existing_rows = session.scalars(
        select(Observation).where(
            Observation.indicator_code.in_(indicator_codes),
            Observation.country_iso3.in_(country_codes),
        )
    ).all()
    existing_by_key = {
        (o.country_iso3, o.indicator_code, o.period_start, o.freq): o for o in existing_rows
    }

    winners: list[dict[str, Any]] = []
    losers: list[dict[str, Any]] = []
    conflict_keys: set[tuple[str, str, Any, str]] = set()

    records = cast("list[dict[str, Any]]", df.to_dict("records"))
    for record in records:
        key = (
            record["country_iso3"],
            record["indicator_code"],
            record["period_start"],
            record["freq"],
        )
        existing = existing_by_key.get(key)

        if existing is None or existing.source_id == source_id:
            winners.append(record)
            if existing is None:
                report.inserted_new += 1
            continue

        existing_priority = priorities[existing.source_id]
        gap = _relative_gap(existing.value, record["value"])
        is_conflict = gap is not None and gap > CONFLICT_THRESHOLD

        if candidate_priority > existing_priority:
            losers.append(
                {
                    **_observation_to_dict(existing),
                    "conflict": is_conflict,
                    "rejected_reason": (
                        f"priorité inférieure à {source_id} (nouvelle valeur retenue)"
                    ),
                }
            )
            winners.append({**record, "conflict": is_conflict})
            report.replaced_by_higher_priority += 1
            winner_source, winner_val = source_id, record["value"]
            loser_source, loser_val = existing.source_id, existing.value
        else:
            losers.append(
                {
                    **record,
                    "conflict": is_conflict,
                    "rejected_reason": (
                        f"priorité inférieure à {existing.source_id} (valeur existante retenue)"
                    ),
                }
            )
            report.rejected_lower_priority += 1
            winner_source, winner_val = existing.source_id, existing.value
            loser_source, loser_val = source_id, record["value"]
            if is_conflict:
                session.execute(
                    update(Observation)
                    .where(
                        Observation.country_iso3 == key[0],
                        Observation.indicator_code == key[1],
                        Observation.period_start == key[2],
                        Observation.freq == key[3],
                    )
                    .values(conflict=True)
                )

        if is_conflict and key not in conflict_keys:
            conflict_keys.add(key)
            report.conflicts.append(
                ConflictEntry(
                    country_iso3=key[0],
                    indicator_code=key[1],
                    period_start=key[2],
                    freq=key[3],
                    winning_source=winner_source,
                    winning_value=winner_val,
                    losing_source=loser_source,
                    losing_value=loser_val,
                    relative_gap=gap if gap is not None else float("nan"),
                )
            )

    bulk_upsert_observations(session, winners)
    _bulk_upsert_alt(session, losers)
    return report


def _bulk_upsert_alt(session: Session, records: list[dict[str, Any]]) -> int:
    if not records:
        return 0
    from macrolens.etl.load import BATCH_SIZE

    for start in range(0, len(records), BATCH_SIZE):
        batch = records[start : start + BATCH_SIZE]
        stmt = insert(ObservationAlt).values(batch)
        update_cols = {c.name: c for c in stmt.excluded if c.name not in _ALT_PK}
        stmt = stmt.on_conflict_do_update(index_elements=_ALT_PK, set_=update_cols)
        session.execute(stmt)
    return len(records)
