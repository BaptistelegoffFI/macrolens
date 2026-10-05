"""Rendements d'actifs (ADR 0021 à 0024). Endpoints strictement additifs : aucun
endpoint existant n'est modifié, aucun contrat de réponse déjà déployé ne change.

Écart assumé par rapport au brief : `POST /scenario/asset-returns` plutôt que
`GET /scenario/{id}/asset-returns`. MacroLens ne stocke aucun scénario côté
serveur (la recherche d'analogues est sans état, le permalien encode la requête) ;
créer une table de scénarios aurait ajouté une écriture et du risque de migration
pour rien. L'appelant transmet les analogues qu'il vient de recevoir.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from macrolens.api.asset_returns_service import (
    AssetDataUnavailable,
    asset_detail_for_analogs,
    asset_returns_for_analogs,
    country_asset_classes,
)
from macrolens.api.deps import get_db
from macrolens.api.routers.admin import deny_if_maintenance
from macrolens.api.schemas.asset_returns import (
    AssetDetailResponse,
    AssetReturnsRequest,
    AssetReturnsResponse,
    CountryAssetClassesResponse,
)

router = APIRouter(tags=["asset-returns"])

_UNAVAILABLE = "Données de rendements d'actifs indisponibles."


@router.post(
    "/scenario/asset-returns",
    response_model=AssetReturnsResponse,
    dependencies=[Depends(deny_if_maintenance)],
)
def post_asset_returns(
    request: AssetReturnsRequest, session: Session = Depends(get_db)
) -> AssetReturnsResponse:
    try:
        return asset_returns_for_analogs(session, request)
    except (AssetDataUnavailable, ProgrammingError) as exc:
        raise HTTPException(status_code=503, detail=_UNAVAILABLE) from exc


@router.post(
    "/scenario/asset-returns/detail",
    response_model=AssetDetailResponse,
    dependencies=[Depends(deny_if_maintenance)],
)
def post_asset_returns_detail(request: AssetReturnsRequest) -> AssetDetailResponse:
    return asset_detail_for_analogs(request)


@router.get("/series/{country}/asset-classes", response_model=CountryAssetClassesResponse)
def get_country_asset_classes(
    country: str,
    from_: int | None = Query(None, alias="from", ge=1800, le=2100),
    to: int | None = Query(None, ge=1800, le=2100),
    session: Session = Depends(get_db),
) -> CountryAssetClassesResponse:
    try:
        return country_asset_classes(session, country, from_, to)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (AssetDataUnavailable, ProgrammingError) as exc:
        raise HTTPException(status_code=503, detail=_UNAVAILABLE) from exc
