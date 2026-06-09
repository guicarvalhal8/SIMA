"""
Módulo de conexão com o banco de dados.
Configura o engine SQLAlchemy e a fábrica de sessões.
"""

from typing import Generator
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session

from app.config import settings


def _resolve_database_url(database_url: str) -> str:
    if not database_url.startswith("sqlite:///./"):
        return database_url

    project_root = Path(__file__).resolve().parent.parent
    relative_name = database_url.removeprefix("sqlite:///./")
    absolute_path = project_root / relative_name
    return f"sqlite:///{absolute_path.as_posix()}"


RESOLVED_DATABASE_URL = _resolve_database_url(settings.DATABASE_URL)

is_sqlite = RESOLVED_DATABASE_URL.startswith("sqlite")

if is_sqlite:
    engine = create_engine(
        RESOLVED_DATABASE_URL,
        connect_args={"check_same_thread": False},
        echo=settings.DEBUG,
    )

    # Habilita foreign keys no SQLite
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_conn: object, connection_record: object) -> None:
        cursor = dbapi_conn.cursor()  # type: ignore[union-attr]
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
else:
    engine = create_engine(
        RESOLVED_DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_recycle=3600,
        echo=settings.DEBUG,
    )


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Dependency para injeção de sessão do banco nos endpoints FastAPI."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
