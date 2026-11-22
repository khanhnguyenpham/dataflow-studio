import os
from dataclasses import dataclass
from urllib.parse import urlsplit


def flag(name, default="true"):
    value = os.environ.get(name, default).lower()
    if value not in {"true", "false"}:
        raise RuntimeError(f"{name} must be true or false.")
    return value == "true"


@dataclass(frozen=True)
class Settings:
    database_url: str
    secure_cookie: bool = True
    max_bytes: int = 5 * 1024 * 1024
    max_rows: int = 10000
    max_columns: int = 100
    origins: tuple[str, ...] = ("http://127.0.0.1:5173", "http://localhost:5173")
    retention_enabled: bool = True

    def __post_init__(self):
        if (
            not 1024 <= self.max_bytes <= 20 * 1024 * 1024
            or not 1 <= self.max_rows <= 50000
            or not 1 <= self.max_columns <= 200
        ):
            raise ValueError("Dataset limits are outside the supported bounds.")
        if not self.origins:
            raise ValueError("At least one explicit origin is required.")
        for origin in self.origins:
            parsed = urlsplit(origin)
            if (
                parsed.scheme not in {"http", "https"}
                or not parsed.hostname
                or parsed.username
                or parsed.password
                or parsed.path not in {"", "/"}
                or parsed.query
                or parsed.fragment
            ):
                raise ValueError("APP_ORIGINS must contain explicit HTTP(S) origins without paths or credentials.")

    @classmethod
    def from_env(cls):
        url = os.environ.get("DATABASE_URL", "")
        if not url:
            raise RuntimeError("Set DATABASE_URL before starting the application.")
        if url.startswith("postgres://"):
            url = "postgresql+psycopg://" + url[len("postgres://") :]
        elif url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url[len("postgresql://") :]
        settings = cls(
            database_url=url,
            secure_cookie=flag("COOKIE_SECURE"),
            max_bytes=int(os.environ.get("UPLOAD_MAX_BYTES", 5 * 1024 * 1024)),
            max_rows=int(os.environ.get("DATASET_MAX_ROWS", 10000)),
            origins=tuple(
                origin.strip().rstrip("/")
                for origin in os.environ.get("APP_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173").split(",")
                if origin.strip()
            ),
            retention_enabled=flag("RETENTION_ENABLED"),
        )
        mode = os.environ.get("APP_ENV", "development")
        if mode not in {"development", "test", "production"}:
            raise RuntimeError("APP_ENV must be development, test or production.")
        if mode == "production":
            if (
                not settings.secure_cookie
                or not settings.retention_enabled
                or not url.startswith("postgresql+psycopg://")
                or any(not origin.startswith("https://") for origin in settings.origins)
            ):
                raise RuntimeError(
                    "Production requires PostgreSQL, Secure cookies, retention and explicit HTTPS origins."
                )
        return settings
