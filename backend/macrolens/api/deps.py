"""Dépendances FastAPI : session DB par requête, panel de features en cache
process (§3 : chargé au démarrage, recherche k-NN sans aller-retour base)."""

from __future__ import annotations

from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy.orm import Session

from macrolens.db.session import get_engine
from macrolens.panel import BuiltPool, build_pool


def get_db() -> Iterator[Session]:
    session = Session(get_engine())
    try:
        yield session
    finally:
        session.close()


@lru_cache(maxsize=8)
def get_pool(reference_frame: str = "rolling30") -> BuiltPool:
    """§4 : cache LRU en process. Une entrée par reference_frame (4 valeurs
    possibles, §8.2.2) — le panel entier tient largement en mémoire."""
    session = Session(get_engine())
    try:
        return build_pool(session, reference_frame=reference_frame)
    finally:
        session.close()


def clear_pool_cache() -> None:
    get_pool.cache_clear()
