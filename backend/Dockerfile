# Contexte de build = racine du dépôt (pas backend/), pour pouvoir copier
# data/ (référentiels §2.1/§2.4, requis par `macrolens seed`) sans en sortir
# — Docker interdit un COPY qui remonte au-dessus du contexte de build.
# Nécessaire pour Render (pas de bind-mount façon docker-compose possible) ;
# docker-compose.yml pointe désormais aussi cette image avec context: .
# pour qu'il n'existe qu'une seule définition de build, jamais deux qui
# pourraient diverger entre local et déploiement (voir ADR 0009).
FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /app

COPY backend/pyproject.toml backend/uv.lock* ./
RUN uv sync --frozen --no-install-project --no-dev || uv sync --no-install-project --no-dev

COPY backend/ .
COPY data/ /app/data
RUN mkdir -p /app/reports
RUN uv sync --no-dev
RUN chmod +x docker-entrypoint.sh

EXPOSE 8000
CMD ["./docker-entrypoint.sh"]
