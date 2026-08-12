"""Chargement idempotent des référentiels (§13 Phase 1) depuis data/reference/
et data/events/ vers PostgreSQL. Aucune valeur numérique n'est fabriquée ici :
ce module ne fait que rejouer fidèlement le contenu des fichiers YAML.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from macrolens.db.models import Country, Event, Indicator, Source
from macrolens.paths import DATA_DIR as DEFAULT_DATA_DIR


@dataclass(frozen=True)
class SeedReport:
    countries: int
    indicators: int
    sources: int
    events: int


def _load_yaml(path: Path) -> list[dict[str, Any]]:
    data = yaml.safe_load(path.read_text())
    return data or []


def _upsert(session: Session, model: type, rows: list[dict[str, Any]], pk_cols: list[str]) -> int:
    if not rows:
        return 0
    stmt = insert(model).values(rows)
    update_cols = {c.name: c for c in stmt.excluded if c.name not in pk_cols}
    stmt = stmt.on_conflict_do_update(index_elements=pk_cols, set_=update_cols)
    session.execute(stmt)
    return len(rows)


def load_countries(session: Session, data_dir: Path = DEFAULT_DATA_DIR) -> int:
    raw = _load_yaml(data_dir / "reference" / "countries.yaml")
    rows = [
        {
            "iso3": c["iso3"],
            "name_en": c["name_en"],
            "name_fr": c["name_fr"],
            "is_core": c["is_core"],
            "in_analog_pool": c["in_analog_pool"],
            "currency_hist": {"history": c["currency_hist"]},
        }
        for c in raw
    ]
    return _upsert(session, Country, rows, ["iso3"])


def load_indicators(session: Session, data_dir: Path = DEFAULT_DATA_DIR) -> int:
    raw = _load_yaml(data_dir / "reference" / "indicators.yaml")
    rows = [
        {
            "code": i["code"],
            "label_fr": i["label_fr"],
            "label_en": i["label_en"],
            "family": i["family"],
            "unit": i["unit"],
            "is_derived": i.get("is_derived", False),
            "derivation": i.get("derivation"),
            "higher_is_worse": i.get("higher_is_worse"),
            "definition_fr": i["definition_fr"],
        }
        for i in raw
    ]
    return _upsert(session, Indicator, rows, ["code"])


def load_sources(session: Session, data_dir: Path = DEFAULT_DATA_DIR) -> int:
    raw = _load_yaml(data_dir / "reference" / "sources.yaml")
    rows = [
        {
            "id": s["id"],
            "full_name": s["full_name"],
            "url": s["url"],
            "citation": s["citation"],
            "licence": s["licence"],
            "priority": s["priority"],
            "retrieved_at": s["retrieved_at"],
            "file_sha256": s.get("file_sha256"),
            "notes": s.get("notes"),
        }
        for s in raw
    ]
    return _upsert(session, Source, rows, ["id"])


def load_events(session: Session, data_dir: Path = DEFAULT_DATA_DIR) -> int:
    """Recharge les événements curés à la main (source_id="events_manual").

    Les événements extraits programmatiquement d'autres sources (ex. crises
    bancaires JST, Phase 2) portent un `source_id` distinct et ne sont jamais
    touchés par ce rechargement — voir data/events/banking_crises.yaml.
    """
    events_dir = data_dir / "events"
    rows: list[dict[str, Any]] = []
    for path in sorted(events_dir.glob("*.yaml")):
        rows.extend(_load_yaml(path))

    session.execute(delete(Event).where(Event.source_id == "events_manual"))
    if not rows:
        return 0

    to_insert = [
        {
            "country_iso3": e.get("country"),
            "date_start": e["date_start"],
            "date_end": e.get("date_end"),
            "kind": e["kind"],
            "label_fr": e["label_fr"],
            "label_en": e["label_en"],
            "severity": e.get("severity"),
            "source_id": e["source_id"],
            "source_url": e["source_url"],
            "notes_fr": e.get("notes_fr"),
        }
        for e in rows
    ]
    session.execute(insert(Event), to_insert)
    return len(to_insert)


def run_seed(session: Session, data_dir: Path = DEFAULT_DATA_DIR) -> SeedReport:
    return SeedReport(
        countries=load_countries(session, data_dir),
        indicators=load_indicators(session, data_dir),
        sources=load_sources(session, data_dir),
        events=load_events(session, data_dir),
    )
