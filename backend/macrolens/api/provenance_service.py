"""Bordereau de traçabilité (§18) : reconstitue, pour une observation
réellement en base, sa source, son fichier brut et son `locator` —
jamais recalculé ni deviné, uniquement relu depuis les colonnes remplies
par les loaders à l'ingestion (règle 7, CLAUDE.md). Hors core/ —
orchestration + accès DB."""

from __future__ import annotations

import datetime as dt
import hashlib
import json

from sqlalchemy.orm import Session

from macrolens.api.schemas.provenance import (
    FlagsOut,
    ObservationKey,
    RawFileRefOut,
    ReceiptRowOut,
    SourceRefOut,
    SourceSummaryOut,
)
from macrolens.db.models import Indicator, Observation, RawFile, Source


def _period_str(period: dt.date, freq: str) -> str:
    return str(period.year) if freq == "A" else period.isoformat()


def build_receipt_row(session: Session, key: ObservationKey) -> ReceiptRowOut | None:
    obs = session.get(
        Observation, (key.country.upper(), key.indicator, key.period, key.freq)
    )
    if obs is None:
        return None

    source = session.get(Source, obs.source_id)
    assert source is not None  # FK NOT NULL : une observation a toujours sa source

    indicator = session.get(Indicator, obs.indicator_code)
    unit = indicator.unit if indicator is not None else ""

    raw_file = session.get(RawFile, obs.raw_file_id) if obs.raw_file_id is not None else None

    return ReceiptRowOut(
        country=obs.country_iso3,
        indicator=obs.indicator_code,
        period=_period_str(obs.period_start, obs.freq),
        value=obs.value,
        raw_value_text=obs.raw_value_text,
        unit=unit,
        transform_chain=list(obs.transform_chain or []),
        flags=FlagsOut(
            interpolated=obs.is_interpolated,
            spliced=obs.is_spliced,
            break_=obs.is_break,
            conflict=obs.conflict,
        ),
        source=SourceRefOut(
            id=source.id, citation=source.citation, url=source.url, licence=source.licence
        ),
        raw_file=(
            RawFileRefOut(
                filename=raw_file.filename,
                sha256=raw_file.sha256,
                downloaded_at=raw_file.downloaded_at.isoformat(),
                origin_url=raw_file.origin_url,
            )
            if raw_file is not None
            else None
        ),
        locator=obs.locator,
        source_page=None,  # §18.5 : rendu de page PDF non disponible (docs/limitations.md)
    )


def sources_summary(rows: list[ReceiptRowOut], session: Session) -> list[SourceSummaryOut]:
    counts: dict[str, int] = {}
    for row in rows:
        counts[row.source.id] = counts.get(row.source.id, 0) + 1
    out: list[SourceSummaryOut] = []
    for source_id, n in sorted(counts.items()):
        source = session.get(Source, source_id)
        citation = source.citation if source is not None else ""
        out.append(SourceSummaryOut(id=source_id, n_rows=n, citation=citation))
    return out


def checksum_of(rows: list[ReceiptRowOut]) -> str:
    canonical = json.dumps(
        [row.model_dump(mode="json") for row in rows], sort_keys=True, separators=(",", ":")
    )
    return hashlib.sha256(canonical.encode()).hexdigest()
