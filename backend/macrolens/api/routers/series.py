from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from macrolens.api.deps import get_db, get_pool
from macrolens.api.schemas.series import ObservationOut, StateVectorFeatureOut, StateVectorOut
from macrolens.api.sources_utils import sources_for_country_years
from macrolens.api.utils import none_if_nan
from macrolens.db.models import Observation
from macrolens.panel import RAW_INDICATORS, BuiltPool

router = APIRouter(tags=["series"])


def state_vector_out(
    session: Session, built: BuiltPool, country: str, year: int, reference_frame: str
) -> StateVectorOut | None:
    match = next(
        (
            (sv, raw)
            for sv, raw in zip(built.state_vectors, built.raw_values, strict=True)
            if sv.country == country.upper() and sv.year == year
        ),
        None,
    )
    if match is None:
        return None
    sv, raw = match
    features = [
        StateVectorFeatureOut(
            feature_code=f,
            raw_value=none_if_nan(raw.get(f)),
            pct_rank=none_if_nan(sv.ranks.get(f)),
        )
        for f in sv.ranks
    ]
    sources = sources_for_country_years(session, [(sv.country, sv.year)], RAW_INDICATORS)
    return StateVectorOut(
        country_iso3=sv.country,
        year=sv.year,
        reference_frame=reference_frame,
        is_complete=sv.is_complete,
        is_break=sv.is_break,
        coverage_partial=sv.coverage_partial,
        features=features,
        sources=sources,
    )


@router.get("/series", response_model=list[ObservationOut])
def get_series(
    country: str = Query(..., min_length=3, max_length=3),
    indicator: str = Query(...),
    freq: str = Query("A"),
    from_: int | None = Query(None, alias="from"),
    to: int | None = Query(None),
    session: Session = Depends(get_db),
) -> list[Observation]:
    stmt = select(Observation).where(
        Observation.country_iso3 == country.upper(),
        Observation.indicator_code == indicator,
        Observation.freq == freq,
    )
    if from_ is not None:
        stmt = stmt.where(Observation.period_start >= dt.date(from_, 1, 1))
    if to is not None:
        stmt = stmt.where(Observation.period_start <= dt.date(to, 12, 31))
    stmt = stmt.order_by(Observation.period_start)
    return list(session.scalars(stmt).all())


@router.get("/state/{country}/{year}", response_model=StateVectorOut)
def get_state_vector(
    country: str,
    year: int,
    reference_frame: str = Query("rolling30"),
    session: Session = Depends(get_db),
) -> StateVectorOut:
    try:
        built = get_pool(reference_frame)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    out = state_vector_out(session, built, country, year, reference_frame)
    if out is None:
        raise HTTPException(status_code=404, detail=f"Aucun vecteur d'état pour {country} {year}")
    return out
