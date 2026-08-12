"""Rapport de couverture (§13 Phase 2, critère d'acceptation)."""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from macrolens.db.models import Country, Event, Observation

KEY_INDICATORS = {
    "gdp_real_pc": "PIB (réel/hab.)",
    "cpi": "IPC",
    "rate_short": "Taux court",
    "rate_long": "Taux long",
    "debt_public_gdp": "Dette/PIB",
    "credit_private_gdp": "Crédit/PIB",
}

YEAR_MIN = 1870
YEAR_MAX = 2020


@dataclass(frozen=True)
class CoverageCell:
    country: str
    indicator: str
    present: int
    total: int

    @property
    def pct(self) -> float:
        return 100.0 * self.present / self.total if self.total else 0.0


def _core_countries(session: Session) -> list[str]:
    return sorted(session.scalars(select(Country.iso3).where(Country.is_core)).all())


def _wartime_years(session: Session, country: str, year_min: int, year_max: int) -> set[int]:
    events = session.scalars(
        select(Event).where(
            Event.kind == "war",
            (Event.country_iso3 == country) | (Event.country_iso3.is_(None)),
        )
    ).all()
    years: set[int] = set()
    for e in events:
        start = e.date_start.year
        end = (e.date_end or e.date_start).year
        years.update(range(max(start, year_min), min(end, year_max) + 1))
    return years


def _completeness(
    session: Session,
    country: str,
    indicator: str,
    year_min: int,
    year_max: int,
    excluded_years: set[int],
) -> CoverageCell:
    total_years = {y for y in range(year_min, year_max + 1) if y not in excluded_years}
    rows = session.scalars(
        select(Observation.period_start).where(
            Observation.country_iso3 == country,
            Observation.indicator_code == indicator,
            Observation.period_start >= dt.date(year_min, 1, 1),
            Observation.period_start <= dt.date(year_max, 1, 1),
        )
    ).all()
    present_years = {d.year for d in rows} & total_years
    return CoverageCell(country, indicator, len(present_years), len(total_years))


def build_coverage_table(
    session: Session, year_min: int = YEAR_MIN, year_max: int = YEAR_MAX
) -> list[CoverageCell]:
    cells: list[CoverageCell] = []
    for country in _core_countries(session):
        excluded = _wartime_years(session, country, year_min, year_max)
        for indicator in KEY_INDICATORS:
            cells.append(
                _completeness(session, country, indicator, year_min, year_max, excluded)
            )
    return cells


def total_observations(session: Session) -> int:
    return session.scalar(select(func.count()).select_from(Observation)) or 0


def render_report(session: Session) -> str:
    cells = build_coverage_table(session)
    total = total_observations(session)
    generated = dt.datetime.now(dt.UTC).isoformat(timespec="seconds")

    lines = [
        "# Rapport de couverture",
        "",
        f"Généré le {generated}. {total:,} observations en base.".replace(",", " "),
        "",
        "Complétude (%) des 6 pays cœur sur les 6 indicateurs clés du critère",
        f"d'acceptation Phase 2 (§13), {YEAR_MIN}-{YEAR_MAX}, années de guerre",
        "exclues du dénominateur (§7.4).",
        "",
        "| Pays | " + " | ".join(KEY_INDICATORS.values()) + " |",
        "|---" * (len(KEY_INDICATORS) + 1) + "|",
    ]

    by_country: dict[str, dict[str, CoverageCell]] = {}
    for cell in cells:
        by_country.setdefault(cell.country, {})[cell.indicator] = cell

    min_pct = 100.0
    for country, row in sorted(by_country.items()):
        cells_fmt = []
        for code in KEY_INDICATORS:
            pct = row[code].pct
            min_pct = min(min_pct, pct)
            cells_fmt.append(f"{pct:.1f}%")
        lines.append(f"| {country} | " + " | ".join(cells_fmt) + " |")

    lines += [
        "",
        f"Complétude minimale observée : {min_pct:.1f}% "
        f"(critère d'acceptation : ≥ 90%).",
    ]
    return "\n".join(lines) + "\n"
