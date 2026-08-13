from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from macrolens.api.deps import get_db
from macrolens.api.provenance_service import build_receipt_row, checksum_of, sources_summary
from macrolens.api.schemas.provenance import (
    ObservationKey,
    RawFileOut,
    ReceiptRequest,
    ReceiptResponse,
    ReceiptRowOut,
)
from macrolens.db.models import RawFile, SourcePage
from macrolens.paths import DATA_DIR

router = APIRouter(prefix="/provenance", tags=["provenance"])


@router.post("/receipt", response_model=ReceiptResponse)
def post_receipt(request: ReceiptRequest, session: Session = Depends(get_db)) -> ReceiptResponse:
    rows: list[ReceiptRowOut] = []
    for key in request.keys:
        row = build_receipt_row(session, key)
        if row is not None:
            rows.append(row)
    checksum = checksum_of(rows)
    return ReceiptResponse(
        build_id=request.build_id,
        generated_at=dt.datetime.now(dt.UTC).isoformat(),
        rows=rows,
        sources_summary=sources_summary(rows, session),
        checksum=checksum,
    )


@router.get("/observation", response_model=ReceiptRowOut)
def get_observation_provenance(
    country: str = Query(..., min_length=3, max_length=3),
    indicator: str = Query(...),
    period: dt.date = Query(...),
    freq: str = Query("A"),
    session: Session = Depends(get_db),
) -> ReceiptRowOut:
    key = ObservationKey(country=country, indicator=indicator, period=period, freq=freq)
    row = build_receipt_row(session, key)
    if row is None:
        raise HTTPException(
            status_code=404,
            detail=f"Aucune observation pour {country.upper()}/{indicator}/{period}/{freq}",
        )
    return row


@router.get("/raw-files", response_model=list[RawFileOut])
def list_raw_files(session: Session = Depends(get_db)) -> list[RawFileOut]:
    rows = session.scalars(select(RawFile).order_by(RawFile.id)).all()
    return [
        RawFileOut(
            id=r.id,
            source_id=r.source_id,
            vintage=r.vintage,
            filename=r.filename,
            media_type=r.media_type,
            sha256=r.sha256,
            size_bytes=r.size_bytes,
            origin_url=r.origin_url,
            downloaded_at=r.downloaded_at.isoformat(),
            archive_url=r.archive_url,
        )
        for r in rows
    ]


@router.get("/page/{raw_file_id}/{page}")
def get_source_page(
    raw_file_id: int, page: int, session: Session = Depends(get_db)
) -> FileResponse:
    # §18.5 : sert l'image WebP déjà rendue (pdftoppm) si elle existe. Le
    # pipeline de rendu n'est pas encore branché (docs/limitations.md) donc
    # source_pages est vide aujourd'hui — cette route échoue honnêtement en
    # 404 plutôt que d'inventer un rendu, mais reste correcte dès qu'un
    # rendu existe.
    row = session.scalar(
        select(SourcePage).where(
            SourcePage.raw_file_id == raw_file_id, SourcePage.page_number == page
        )
    )
    if row is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Rendu de page source non disponible pour cette source "
                "(voir docs/limitations.md § vue source)."
            ),
        )
    image_path = DATA_DIR / row.image_path
    if not image_path.is_file():
        raise HTTPException(
            status_code=404, detail=f"Fichier image manquant sur disque : {row.image_path}"
        )
    return FileResponse(image_path, media_type="image/webp")
