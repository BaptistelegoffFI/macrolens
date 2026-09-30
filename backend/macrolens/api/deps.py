"""Dépendances FastAPI : session DB par requête, panel de features en cache
process (§3 : chargé au démarrage, recherche k-NN sans aller-retour base)."""

from __future__ import annotations

import threading
from collections.abc import Iterator

from sqlalchemy.orm import Session

from macrolens.db.session import get_engine
from macrolens.panel import BuiltPool, build_pool


def get_db() -> Iterator[Session]:
    session = Session(get_engine())
    try:
        yield session
    finally:
        session.close()


_pool_cache: dict[str, BuiltPool] = {}
_pool_cache_lock = threading.Lock()


def get_pool(reference_frame: str = "rolling30") -> BuiltPool:
    """§4 : cache en process, une entrée par reference_frame (4 valeurs
    possibles, §8.2.2) — le panel entier tient largement en mémoire.

    Verrouillé (et non un simple `lru_cache`) : FastAPI exécute cette
    dépendance synchrone dans un pool de threads, donc plusieurs requêtes
    concurrentes arrivant sur un reference_frame pas encore construit
    passaient toutes le test de cache en même temps et lançaient chacune
    leur propre `build_pool()`, chacune gardant une connexion DB ouverte
    pendant toute la construction (pas seulement le temps de la requête
    SQL) — un pic de trafic juste après un redémarrage à froid suffisait à
    épuiser le pool de connexions (`QueuePool limit ... reached`). Le
    verrou garantit qu'un seul thread construit un reference_frame donné ;
    les autres attendent puis lisent le résultat déjà en cache.
    """
    cached = _pool_cache.get(reference_frame)
    if cached is not None:
        return cached
    with _pool_cache_lock:
        cached = _pool_cache.get(reference_frame)
        if cached is not None:
            return cached
        session = Session(get_engine())
        try:
            built = build_pool(session, reference_frame=reference_frame)
        finally:
            session.close()
        _pool_cache[reference_frame] = built
        return built


def clear_pool_cache() -> None:
    with _pool_cache_lock:
        _pool_cache.clear()
