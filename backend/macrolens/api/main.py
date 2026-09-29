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

# Front local (Vite dev + preview) (§10 : origines explicites plutôt qu'un
# joker, l'API ne sert aucun cookie/credential). CORS_EXTRA_ORIGINS (liste
# séparée par des virgules) ajoute l'origine du frontend déployé — évite de
# coder en dur une URL de déploiement dans le dépôt (voir ADR 0010).
_extra_origins = [
    o.strip() for o in os.environ.get("CORS_EXTRA_ORIGINS", "").split(",") if o.strip()
]
_default_origins = [
    "http://localhost:5173",
    "http://localhost:4173",
    "http://localhost:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[*_default_origins, *_extra_origins],
    # PUT : /admin/status (§ADR 0008). Authorization : jeton porteur du
    # panneau d'administration — sans ça, le navigateur bloque la requête
    # dès le preflight ("It does not have HTTP ok status"), avant même que
    # l'API ne voie l'en-tête. Repéré en testant le déploiement Render, où
    # web et api sont deux origines distinctes (ADR 0010) — invisible en
    # local derrière le proxy same-origin (ADR 0007).
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Content-Type", "Authorization"],
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
