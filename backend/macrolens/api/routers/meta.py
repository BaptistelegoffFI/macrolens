from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from macrolens.api.deps import get_db
from macrolens.api.schemas.meta import CountryOut, CoverageCellOut, IndicatorOut, SourceOut
from macrolens.db.models import Country, Indicator, Observation, Source

router = APIRouter(prefix="/meta", tags=["meta"])


@router.get("/countries", response_model=list[CountryOut])
def list_countries(session: Session = Depends(get_db)) -> list[CountryOut]:
    countries = session.scalars(select(Country).order_by(Country.iso3)).all()
    stats = session.execute(
        select(
            Observation.country_iso3,
            func.min(Observation.period_start),
            func.max(Observation.period_start),
            func.count(),
        ).group_by(Observation.country_iso3)
    ).all()
    stats_by_country = {row[0]: row for row in stats}

    out: list[CountryOut] = []
    for c in countries:
        row = stats_by_country.get(c.iso3)
        out.append(
            CountryOut(
                iso3=c.iso3,
                name_fr=c.name_fr,
                name_en=c.name_en,
                is_core=c.is_core,
                in_analog_pool=c.in_analog_pool,
                year_min=row[1].year if row else None,
                year_max=row[2].year if row else None,
                n_observations=row[3] if row else 0,
            )
        )
    return out


@router.get("/indicators", response_model=list[IndicatorOut])
def list_indicators(session: Session = Depends(get_db)) -> list[Indicator]:
    return list(session.scalars(select(Indicator).order_by(Indicator.family, Indicator.code)).all())


@router.get("/sources", response_model=list[SourceOut])
def list_sources(session: Session = Depends(get_db)) -> list[Source]:
    return list(session.scalars(select(Source).order_by(Source.priority.desc())).all())


@router.get("/coverage", response_model=list[CoverageCellOut])
def coverage_matrix(session: Session = Depends(get_db)) -> list[CoverageCellOut]:
    """Matrice pays x indicateur x décennie (§10). Complétude = part des
    années de la décennie ayant une observation, sur les décennies où le
    pays a au moins une donnée (pas de dénominateur avant sa propre entrée
    dans le panel)."""
    rows = session.execute(
        select(
            Observation.country_iso3, Observation.indicator_code, Observation.period_start
        )
    ).all()

    by_key: dict[tuple[str, str, int], set[int]] = defaultdict(set)
    for country, indicator, period_start in rows:
        decade = (period_start.year // 10) * 10
        by_key[(country, indicator, decade)].add(period_start.year)

    out: list[CoverageCellOut] = []
    for (country, indicator, decade), years in by_key.items():
        decade_years = {y for y in range(decade, decade + 10)}
        observed = years & decade_years
        out.append(
            CoverageCellOut(
                country_iso3=country,
                indicator_code=indicator,
                decade=decade,
                n_observed=len(observed),
                n_possible=10,
                pct=round(100.0 * len(observed) / 10.0, 1),
            )
        )
    out.sort(key=lambda c: (c.country_iso3, c.indicator_code, c.decade))
    return out
