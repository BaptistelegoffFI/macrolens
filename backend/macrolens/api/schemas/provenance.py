from __future__ import annotations

import datetime as dt

from pydantic import BaseModel, ConfigDict, Field


class ObservationKey(BaseModel):
    country: str
    indicator: str
    period: dt.date
    freq: str = "A"


class ReceiptRequest(BaseModel):
    build_id: str
    keys: list[ObservationKey]
    context: dict[str, object] | None = None


class FlagsOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    interpolated: bool
    spliced: bool
    break_: bool = Field(serialization_alias="break")
    conflict: bool


class SourceRefOut(BaseModel):
    id: str
    citation: str
    url: str
    licence: str


class RawFileRefOut(BaseModel):
    filename: str
    sha256: str
    downloaded_at: str
    origin_url: str


class ReceiptRowOut(BaseModel):
    country: str
    indicator: str
    period: str
    value: float | None
    raw_value_text: str | None
    unit: str
    transform_chain: list[str]
    flags: FlagsOut
    source: SourceRefOut
    raw_file: RawFileRefOut | None
    locator: dict[str, object]
    source_page: int | None


class SourceSummaryOut(BaseModel):
    id: str
    n_rows: int
    citation: str


class ReceiptResponse(BaseModel):
    build_id: str
    generated_at: str
    rows: list[ReceiptRowOut]
    sources_summary: list[SourceSummaryOut]
    checksum: str


class RawFileOut(BaseModel):
    id: int
    source_id: str
    vintage: str
    filename: str
    media_type: str
    sha256: str
    size_bytes: int
    origin_url: str
    downloaded_at: str
    archive_url: str | None
