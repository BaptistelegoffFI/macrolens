.PHONY: check lint types test build dev etl

check: lint types test

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

etl:
	cd backend && uv run macrolens etl run-all
