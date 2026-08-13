from __future__ import annotations

import datetime as dt

from macrolens.api.schemas.base import APIModel


class EventOut(APIModel):
    id: int
    country_iso3: str | None
    date_start: dt.date
    date_end: dt.date | None
    kind: str
    label_fr: str
    label_en: str
    severity: int | None
    source_id: str
    source_url: str
    notes_fr: str | None
