import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from macrolens.api.deps import get_pool
from macrolens.api.routers import admin, analogs, episodes, events, meta, provenance, series

logger = logging.getLogger("macrolens.admin")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # §3 : le panel de features est chargé en mémoire au démarrage. Best-effort :
    # une base absente/vide (premier déploiement, tests) ne doit pas empêcher
    # l'API de démarrer — la première requête réelle reconstruira le cache.
    with suppress(Exception):
        get_pool("rolling30")
    if not os.environ.get("ADMIN_TOKEN"):
        logger.warning(
            "ADMIN_TOKEN non défini : le panneau d'administration (/admin) refusera toute "
            "requête (503) tant qu'aucun jeton n'est configuré."
        )
    yield


app = FastAPI(title="MacroLens API", version="0.1.0", lifespan=lifespan)

# Front local (Vite dev + preview) et conteneur docker `web` (§10 : origines
# explicites plutôt qu'un joker, l'API ne sert aucun cookie/credential).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173", "http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.include_router(meta.router, prefix="/api/v1")
app.include_router(series.router, prefix="/api/v1")
app.include_router(events.router, prefix="/api/v1")
app.include_router(analogs.router, prefix="/api/v1")
app.include_router(episodes.router, prefix="/api/v1")
app.include_router(provenance.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/version")
def version() -> dict[str, str | None]:
    try:
        built = get_pool("rolling30")
        return {"build_id": built.build_id}
    except Exception:  # noqa: BLE001 — base non prête : build_id inconnu, pas une erreur 500
        return {"build_id": None}
