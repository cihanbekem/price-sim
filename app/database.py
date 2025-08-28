from __future__ import annotations
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import event

DATABASE_URL = "sqlite+aiosqlite:///./esl.db"

engine = create_async_engine(DATABASE_URL, echo=False, future=True)
SessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)

class Base(DeclarativeBase):
    pass

async def init_db() -> None:
    from . import models  # ensure models are imported
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
        # lightweight migrations for SQLite
        try:
            cols = await conn.exec_driver_sql("PRAGMA table_info('user')")
            names = {row[1] for row in cols}
            if 'employee_no' not in names:
                await conn.exec_driver_sql("ALTER TABLE user ADD COLUMN employee_no TEXT")
        except Exception:
            pass

async def get_session() -> AsyncSession:
    async with SessionLocal() as session:
        yield session

# (İsteğe bağlı) SQLite PRAGMA'ları
@event.listens_for(engine.sync_engine, "connect")
def _set_sqlite_pragma(dbapi_connection, _):
    try:
        cur = dbapi_connection.cursor()
        cur.execute("PRAGMA journal_mode=WAL;")
        cur.execute("PRAGMA synchronous=NORMAL;")
        cur.execute("PRAGMA foreign_keys=ON;")
        cur.close()
    except Exception:
        pass
