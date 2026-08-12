from fastapi import FastAPI

app = FastAPI(title="MacroLens API", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/version")
def version() -> dict[str, str | None]:
    # build_id sera renseigné par le pipeline de build des features (§8, PLAN.md).
    # Aucune donnée n'est encore ingérée en phase 0.
    return {"build_id": None}
