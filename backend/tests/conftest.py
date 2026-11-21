import os
import pytest
from fastapi.testclient import TestClient
from app.config import Settings
from app.db import Base, User
from app.admin_models import SiteConfig
from app.limits import Limits
from app.auth import hasher
from app.main import create_app
from sqlalchemy.engine import make_url


@pytest.fixture
def app(tmp_path):
    url = os.environ.get("TEST_DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    if not url.startswith("sqlite") and make_url(url).database != "dataflow_test":
        raise RuntimeError("Integration tests require the dedicated dataflow_test database.")
    app = create_app(Settings(database_url=url, secure_cookie=False, max_bytes=1024 * 1024, retention_enabled=False))
    Base.metadata.create_all(app.state.engine)
    with app.state.sessions() as db:
        db.add(SiteConfig(id=1, revision=1, limits=Limits().model_dump()))
        db.add(User(username="tester", password_hash=hasher.hash("testing-password-123"), role="user"))
        db.commit()
    yield app
    Base.metadata.drop_all(app.state.engine)
    app.state.engine.dispose()


@pytest.fixture
def client(app):
    with TestClient(app) as client:
        yield client


@pytest.fixture
def guest(client):
    response = client.post("/api/auth/guest")
    assert response.status_code == 200
    client.headers["X-CSRF-Token"] = response.json()["csrf"]
    return client
