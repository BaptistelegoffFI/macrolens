"""Modèle de données PostgreSQL — PLAN.md §6 (+ §18.2 traçabilité).

Écart assumé par rapport au DDL littéral du plan : `observations_alt` n'hérite
pas de la clé primaire de `observations` (country, indicator, period, freq).
Une même observation peut être écartée au profit d'une source retenue tout en
ayant plusieurs sources concurrentes rejetées pour la même clé (§5.3) — la clé
primaire de `observations_alt` inclut donc `source_id`. Voir
docs/decisions/0001-ambiguites-plan-phase-1.md.
"""

from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Double,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from macrolens.db.base import Base


class Country(Base):
    __tablename__ = "countries"

    iso3: Mapped[str] = mapped_column(String(3), primary_key=True)
    name_en: Mapped[str] = mapped_column(Text, nullable=False)
    name_fr: Mapped[str] = mapped_column(Text, nullable=False)
    is_core: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    in_analog_pool: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    currency_hist: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True)


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    citation: Mapped[str] = mapped_column(Text, nullable=False)
    licence: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    retrieved_at: Mapped[date] = mapped_column(Date, nullable=False)
    file_sha256: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class Indicator(Base):
    __tablename__ = "indicators"

    code: Mapped[str] = mapped_column(Text, primary_key=True)
    label_fr: Mapped[str] = mapped_column(Text, nullable=False)
    label_en: Mapped[str] = mapped_column(Text, nullable=False)
    family: Mapped[str] = mapped_column(Text, nullable=False)
    unit: Mapped[str] = mapped_column(Text, nullable=False)
    is_derived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    derivation: Mapped[str | None] = mapped_column(Text, nullable=True)
    higher_is_worse: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    definition_fr: Mapped[str] = mapped_column(Text, nullable=False)


class RawFile(Base):
    __tablename__ = "raw_files"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    source_id: Mapped[str] = mapped_column(ForeignKey("sources.id"), nullable=False)
    vintage: Mapped[str] = mapped_column(Text, nullable=False)
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    relpath: Mapped[str] = mapped_column(Text, nullable=False)
    media_type: Mapped[str] = mapped_column(Text, nullable=False)
    sha256: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    origin_url: Mapped[str] = mapped_column(Text, nullable=False)
    downloaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    archive_url: Mapped[str | None] = mapped_column(Text, nullable=True)


class SourcePage(Base):
    __tablename__ = "source_pages"
    __table_args__ = (UniqueConstraint("raw_file_id", "page_number"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    raw_file_id: Mapped[int] = mapped_column(ForeignKey("raw_files.id"), nullable=False)
    page_number: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    image_path: Mapped[str] = mapped_column(Text, nullable=False)
    image_sha256: Mapped[str] = mapped_column(Text, nullable=False)
    width_px: Mapped[int] = mapped_column(nullable=False)
    height_px: Mapped[int] = mapped_column(nullable=False)
    rendered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class Observation(Base):
    __tablename__ = "observations"
    __table_args__ = (
        Index("ix_observations_indicator_period", "indicator_code", "period_start"),
        Index("ix_observations_country_period", "country_iso3", "period_start"),
    )

    country_iso3: Mapped[str] = mapped_column(
        ForeignKey("countries.iso3"), primary_key=True
    )
    indicator_code: Mapped[str] = mapped_column(
        ForeignKey("indicators.code"), primary_key=True
    )
    period_start: Mapped[date] = mapped_column(Date, primary_key=True)
    freq: Mapped[str] = mapped_column(String(1), primary_key=True)

    value: Mapped[float | None] = mapped_column(Double, nullable=True)
    source_id: Mapped[str] = mapped_column(ForeignKey("sources.id"), nullable=False)
    is_interpolated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_spliced: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_break: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    conflict: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    coverage_partial: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    raw_file_id: Mapped[int | None] = mapped_column(ForeignKey("raw_files.id"), nullable=True)
    locator: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    raw_value_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    transform_chain: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)


class ObservationAlt(Base):
    """Valeurs écartées lors de la réconciliation (§5.3), conservées pour audit.

    PK étendue à `source_id` par rapport au DDL littéral — voir docstring de module.
    """

    __tablename__ = "observations_alt"

    country_iso3: Mapped[str] = mapped_column(
        ForeignKey("countries.iso3"), primary_key=True
    )
    indicator_code: Mapped[str] = mapped_column(
        ForeignKey("indicators.code"), primary_key=True
    )
    period_start: Mapped[date] = mapped_column(Date, primary_key=True)
    freq: Mapped[str] = mapped_column(String(1), primary_key=True)
    source_id: Mapped[str] = mapped_column(ForeignKey("sources.id"), primary_key=True)

    value: Mapped[float | None] = mapped_column(Double, nullable=True)
    is_interpolated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_spliced: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_break: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    conflict: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    coverage_partial: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    raw_file_id: Mapped[int | None] = mapped_column(ForeignKey("raw_files.id"), nullable=True)
    locator: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    raw_value_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    transform_chain: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)

    rejected_reason: Mapped[str] = mapped_column(Text, nullable=False)


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (Index("ix_events_country_date", "country_iso3", "date_start"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    country_iso3: Mapped[str | None] = mapped_column(
        ForeignKey("countries.iso3"), nullable=True
    )
    date_start: Mapped[date] = mapped_column(Date, nullable=False)
    date_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    label_fr: Mapped[str] = mapped_column(Text, nullable=False)
    label_en: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    source_id: Mapped[str] = mapped_column(ForeignKey("sources.id"), nullable=False)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    notes_fr: Mapped[str | None] = mapped_column(Text, nullable=True)


class StateVector(Base):
    __tablename__ = "state_vectors"

    country_iso3: Mapped[str] = mapped_column(String(3), primary_key=True)
    year: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    feature_code: Mapped[str] = mapped_column(Text, primary_key=True)
    build_id: Mapped[str] = mapped_column(Text, primary_key=True)

    raw_value: Mapped[float | None] = mapped_column(Double, nullable=True)
    pct_rank: Mapped[float | None] = mapped_column(Double, nullable=True)
    is_complete: Mapped[bool] = mapped_column(Boolean, nullable=False)
