import os
from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

DEFAULT_DATABASE_URL = "postgresql+psycopg://macrolens:macrolens@localhost:5432/macrolens"


def database_url() -> str:
    return os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)


def make_engine() -> Engine:
    # prepare_threshold=None désactive les prepared statements nommés côté
    # psycopg — indispensable derrière un pooler PgBouncer/Supavisor (ex.
    # Supabase) : une requête peut être routée vers une connexion serveur
    # différente à chaque transaction, donc un nom de prepared statement mis
    # en cache par psycopg peut déjà exister côté serveur au moment du
    # replay (psycopg.errors.DuplicatePreparedStatement). Sans effet
    # notable sur une connexion directe (non poolée).
    #
    # pool_pre_ping : teste chaque connexion avant de la réutiliser et en
    # rouvre une silencieusement si elle a été fermée côté pooler pendant
    # qu'elle était inactive — un pooler géré (Supabase Supavisor) coupe les
    # connexions inactives sans prévenir SQLAlchemy.
    # pool_recycle : recycle toute connexion de plus de 280s, avant que le
    # pooler n'ait l'occasion de la couper lui-même.
    # pool_size/max_overflow relevés : la construction du panel de features
    # (deps.get_pool) garde une connexion ouverte pendant toute la
    # construction, pas seulement le temps de la requête SQL — un pic de
    # requêtes concurrentes juste après un redémarrage à froid épuisait le
    # pool par défaut (5 + 10) avant que le verrou de deps.py n'existe.
    return create_engine(
        database_url(),
        future=True,
        connect_args={"prepare_threshold": None},
        pool_pre_ping=True,
        pool_recycle=280,
        pool_size=8,
        max_overflow=15,
    )


_engine: Engine | None = None
_SessionFactory: sessionmaker[Session] | None = None


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        _engine = make_engine()
    return _engine


@contextmanager
def session_scope() -> Iterator[Session]:
    global _SessionFactory
    if _SessionFactory is None:
        _SessionFactory = sessionmaker(bind=get_engine(), expire_on_commit=False)
    session = _SessionFactory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
