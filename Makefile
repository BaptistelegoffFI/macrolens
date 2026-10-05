.PHONY: check lint types test build dev migrate seed etl build-features setup refresh

check: lint types test

# Chaîne complète, base vide → panel prêt à interroger (voir README).
setup: migrate seed etl build-features

lint:
	cd backend && uv run ruff check .
	cd frontend && npm run lint

types:
	cd backend && uv run mypy macrolens
	cd frontend && npm run typecheck

test:
	cd backend && uv run pytest
	cd frontend && npm run test

build:
	cd backend && uv build
	cd frontend && npm run build

dev:
	docker compose up

migrate:
	cd backend && uv run alembic upgrade head

seed:
	cd backend && uv run macrolens seed

etl:
	cd backend && uv run macrolens etl run-all --refresh

build-features:
	cd backend && uv run macrolens build-features

# Rafraîchissement annuel des données — voir docs/data-refresh.md.
refresh:
	./scripts/refresh_annual.sh
