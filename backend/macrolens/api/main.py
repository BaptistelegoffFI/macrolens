from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI

from macrolens.api.deps import get_pool
from macrolens.api.routers import analogs, episodes, events, meta, provenance, series


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # §3 : le panel de features est chargé en mémoire au démarrage. Best-effort :
    # une base absente/vide (premier déploiement, tests) ne doit pas empêcher
    # l'API de démarrer — la première requête réelle reconstruira le cache.
    with suppress(Exception):
        get_pool("rolling30")
    yield


app = FastAPI(title="MacroLens API", version="0.1.0", lifespan=lifespan)

app.include_router(meta.router, prefix="/api/v1")
app.include_router(series.router, prefix="/api/v1")
app.include_router(events.router, prefix="/api/v1")
app.include_router(analogs.router, prefix="/api/v1")
app.include_router(episodes.router, prefix="/api/v1")
app.include_router(provenance.router, prefix="/api/v1")


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
