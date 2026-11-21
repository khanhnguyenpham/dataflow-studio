import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str
    secure_cookie: bool = True
    max_bytes: int = 5 * 1024 * 1024
    max_rows: int = 10000
    max_columns: int = 100
    origins: tuple[str, ...] = ("http://127.0.0.1:5173", "http://localhost:5173")

    @classmethod
    def from_env(cls):
        url = os.environ.get("DATABASE_URL", "")
        if not url:
            raise RuntimeError("Set DATABASE_URL before starting the application.")
        return cls(
            database_url=url,
            secure_cookie=os.environ.get("COOKIE_SECURE", "true").lower() == "true",
            max_bytes=int(os.environ.get("UPLOAD_MAX_BYTES", 5 * 1024 * 1024)),
            max_rows=int(os.environ.get("DATASET_MAX_ROWS", 10000)),
            origins=tuple(os.environ.get("APP_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173").split(",")),
        )
