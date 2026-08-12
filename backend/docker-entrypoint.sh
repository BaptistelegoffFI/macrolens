#!/bin/sh
set -e

uv run --no-dev alembic upgrade head
uv run --no-dev macrolens seed
exec uv run --no-dev uvicorn macrolens.api.main:app --host 0.0.0.0 --port 8000
