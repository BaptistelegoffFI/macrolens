from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from macrolens.api.deps import get_db, get_pool
from macrolens.api.episodes_service import build_episode
from macrolens.api.schemas.episodes import CompareRequest, CompareResponse, EpisodeOut

router = APIRouter(tags=["episodes"])


@router.get("/episodes/{country}/{year}", response_model=EpisodeOut)
def get_episode(
    country: str,
    year: int,
    reference_frame: str = Query("rolling30"),
    session: Session = Depends(get_db),
) -> EpisodeOut:
    try:
        built = get_pool(reference_frame)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return build_episode(session, built, country, year, reference_frame)


@router.post("/compare", response_model=CompareResponse)
def post_compare(
    request: CompareRequest, session: Session = Depends(get_db)
) -> CompareResponse:
    try:
        built = get_pool(request.reference_frame)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    episodes = [
        build_episode(session, built, pair.country, pair.year, request.reference_frame)
        for pair in request.pairs
    ]
    return CompareResponse(episodes=episodes)
