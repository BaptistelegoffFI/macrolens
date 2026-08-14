from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from macrolens.api.analogs_service import SearchError, search_analogs
from macrolens.api.deps import get_db, get_pool
from macrolens.api.routers.admin import deny_if_maintenance
from macrolens.api.schemas.analogs import AnalogsSearchRequest, AnalogsSearchResponse

router = APIRouter(tags=["analogs"])


@router.post(
    "/analogs/search",
    response_model=AnalogsSearchResponse,
    dependencies=[Depends(deny_if_maintenance)],
)
def post_analogs_search(
    request: AnalogsSearchRequest, session: Session = Depends(get_db)
) -> AnalogsSearchResponse:
    try:
        frame_pool = get_pool(request.reference_frame)
        global_pool = frame_pool if request.reference_frame == "pool" else get_pool("pool")
        return search_analogs(session, request, frame_pool, global_pool)
    except SearchError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
