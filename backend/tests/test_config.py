import pytest
from app.config import Settings


def test_production_refuses_insecure_or_nonpersistent_configuration(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://example:example@db.invalid/dataflow")
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("APP_ORIGINS", "https://dataflow.example")
    monkeypatch.setenv("COOKIE_SECURE", "true")
    settings = Settings.from_env()
    assert settings.database_url.startswith("postgresql+psycopg://")
    for name, value in [
        ("COOKIE_SECURE", "false"),
        ("APP_ORIGINS", "http://dataflow.example"),
        ("RETENTION_ENABLED", "false"),
    ]:
        with monkeypatch.context() as change:
            change.setenv(name, value)
            with pytest.raises(RuntimeError):
                Settings.from_env()
    monkeypatch.setenv("COOKIE_SECURE", "typo")
    with pytest.raises(RuntimeError):
        Settings.from_env()


@pytest.mark.parametrize("origins", [("*",), ("https://example.com/path",), ("https://user:password@example.com",)])
def test_origins_cannot_be_wildcards_paths_or_embedded_credentials(origins):
    with pytest.raises(ValueError):
        Settings(database_url="sqlite://", origins=origins)
