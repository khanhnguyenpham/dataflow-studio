from datetime import datetime, timezone
import uuid

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    LargeBinary,
    String,
    UniqueConstraint,
    create_engine,
    event,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker


def now():
    return datetime.now(timezone.utc)


def as_utc(value):
    # SQLite returns naive UTC; PostgreSQL can return the server/session timezone.
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def key():
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=key)
    username: Mapped[str] = mapped_column(String(100), unique=True)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(10), default="user")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)


class LoginSession(Base):
    __tablename__ = "login_sessions"
    digest: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class Dataset(Base):
    __tablename__ = "datasets"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=key)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    original_name: Mapped[str] = mapped_column(String(255))
    original_bytes: Mapped[bytes] = mapped_column(LargeBinary)
    source_sha256: Mapped[str] = mapped_column(String(64))
    source_sheet: Mapped[str | None] = mapped_column(String(255))
    columns: Mapped[list] = mapped_column(JSON().with_variant(JSONB(), "postgresql"))
    records: Mapped[list] = mapped_column(JSON().with_variant(JSONB(), "postgresql"))
    row_count: Mapped[int] = mapped_column(Integer)
    current_version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class DatasetVersion(Base):
    __tablename__ = "dataset_versions"
    __table_args__ = (UniqueConstraint("dataset_id", "number"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=key)
    dataset_id: Mapped[str] = mapped_column(ForeignKey("datasets.id", ondelete="CASCADE"), index=True)
    number: Mapped[int] = mapped_column(Integer)
    parent_number: Mapped[int] = mapped_column(Integer)
    columns: Mapped[list] = mapped_column(JSON().with_variant(JSONB(), "postgresql"))
    records: Mapped[list] = mapped_column(JSON().with_variant(JSONB(), "postgresql"))
    row_count: Mapped[int] = mapped_column(Integer)
    steps: Mapped[list] = mapped_column(JSON().with_variant(JSONB(), "postgresql"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Preview(Base):
    __tablename__ = "previews"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=key)
    dataset_id: Mapped[str] = mapped_column(ForeignKey("datasets.id", ondelete="CASCADE"), index=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    input_version: Mapped[int] = mapped_column(Integer)
    result: Mapped[dict] = mapped_column(JSON().with_variant(JSONB(), "postgresql"))
    steps: Mapped[list] = mapped_column(JSON().with_variant(JSONB(), "postgresql"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    applied_version: Mapped[int | None] = mapped_column(Integer)


def database(url):
    kwargs = {"connect_args": {"check_same_thread": False}} if url.startswith("sqlite") else {"pool_pre_ping": True}
    engine = create_engine(url, **kwargs)
    if url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def sqlite_foreign_keys(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")

    return engine, sessionmaker(engine, expire_on_commit=False)
