"""DB 엔진/세션. 기본 SQLite(로컬 실행 용이), DATABASE_URL로 PostgreSQL 전환 가능."""
import os
from collections.abc import Iterator

from sqlalchemy import inspect, text
from sqlmodel import Session, SQLModel, create_engine

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./ctck.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)


def _column_default_sql(column) -> str | None:
    """스칼라 기본값을 ADD COLUMN용 DEFAULT 리터럴로. 콜러블/표현식 기본값은 건너뜀."""
    default = column.default
    if default is None or getattr(default, "is_callable", False):
        return None
    val = getattr(default, "arg", None)
    if val is None or callable(val):
        return None
    if isinstance(val, bool):
        return "1" if val else "0"
    if isinstance(val, (int, float)):
        return str(val)
    return "'" + str(val).replace("'", "''") + "'"


def _ensure_columns() -> None:
    """경량 마이그레이션: 모델에 추가됐지만 기존 테이블에 없는 컬럼을 ALTER ADD COLUMN으로 보강.

    SQLite의 한계(ALTER는 컬럼 추가만 지원)에 맞춘 안전한 범위만 처리한다.
    타입 변경·컬럼 삭제·제약(NOT NULL/UNIQUE) 추가는 다루지 못하므로, 그런 변경이
    필요해지면 Alembic 등 정식 마이그레이션 도구로 이전할 것. 백필 시 실패를 피하려
    추가 컬럼은 NULL 허용으로 붙이고(앱 레벨 기본값에 의존), 스칼라 기본값만 DEFAULT로 반영.
    """
    insp = inspect(engine)
    existing_tables = set(insp.get_table_names())
    with engine.begin() as conn:
        for table in SQLModel.metadata.sorted_tables:
            if table.name not in existing_tables:
                continue  # create_all이 새로 만든 테이블은 이미 최신
            have = {c["name"] for c in insp.get_columns(table.name)}
            for column in table.columns:
                if column.name in have:
                    continue
                col_type = column.type.compile(dialect=engine.dialect)
                ddl = f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {col_type}'
                default_sql = _column_default_sql(column)
                if default_sql is not None:
                    ddl += f" DEFAULT {default_sql}"
                conn.execute(text(ddl))


def init_db() -> None:
    # 모델 등록을 위해 import
    from app import models  # noqa: F401

    SQLModel.metadata.create_all(engine)
    _ensure_columns()


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
