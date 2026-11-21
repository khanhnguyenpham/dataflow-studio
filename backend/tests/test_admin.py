from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from types import SimpleNamespace
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from app import auth
from app.admin_models import AuditLog, SiteConfig
from app.db import Dataset, DatasetVersion, LoginSession, Preview, User, now
from app.processing import parse_file
from app.workspace import payload_budget


@pytest.fixture
def admin(client, app):
    with app.state.sessions() as db:
        db.scalar(select(User).where(User.username == "tester")).role = "admin"
        db.commit()
    response = client.post("/api/auth/login", json={"username": "tester", "password": "testing-password-123"})
    assert response.status_code == 200
    client.headers["X-CSRF-Token"] = response.json()["csrf"]
    return client


def test_admin_permissions_are_enforced_by_backend(guest):
    for path in ["status", "users", "limits", "audit", "runs"]:
        assert guest.get(f"/api/admin/{path}").status_code == 403
    response = guest.post(
        "/api/admin/users", json={"username": "intruder", "password": "long-password-123", "role": "admin"}
    )
    assert response.status_code == 403


def test_account_lifecycle_revokes_sessions_and_preserves_last_admin(admin, app):
    new = admin.post("/api/admin/users", json={"username": "operator", "password": "temporary-password-123"})
    assert new.status_code == 201 and "password" not in new.text
    key = new.json()["id"]
    with TestClient(app) as other:
        login = other.post("/api/auth/login", json={"username": "operator", "password": "temporary-password-123"})
        assert login.status_code == 200
        other.headers["X-CSRF-Token"] = login.json()["csrf"]
        assert other.get("/api/admin/users").status_code == 403
        assert admin.post(f"/api/admin/users/{key}", json={"active": False, "role": "user"}).status_code == 200
        assert other.get("/api/auth/session").status_code == 401
        assert admin.post(f"/api/admin/users/{key}", json={"active": True, "role": "user"}).status_code == 200
        assert (
            admin.post(f"/api/admin/users/{key}/password", json={"password": "replacement-password-123"}).status_code
            == 204
        )
        assert (
            other.post(
                "/api/auth/login", json={"username": "operator", "password": "temporary-password-123"}
            ).status_code
            == 401
        )
        assert (
            other.post(
                "/api/auth/login", json={"username": "operator", "password": "replacement-password-123"}
            ).status_code
            == 200
        )
    own = admin.get("/api/auth/session").json()["user"]["id"]
    for change in [{"active": False, "role": "admin"}, {"active": True, "role": "user"}]:
        response = admin.post(f"/api/admin/users/{own}", json=change)
        assert response.status_code == 409 and response.json()["code"] == "last_admin"
    assert (
        admin.post(
            "/api/admin/users", json={"username": "backup", "password": "backup-password-123", "role": "admin"}
        ).status_code
        == 201
    )
    assert admin.post(f"/api/admin/users/{own}", json={"active": True, "role": "user"}).status_code == 200
    assert admin.get("/api/admin/status").status_code == 401


def test_revised_limits_apply_to_new_writes_and_guest_capacity(admin, app):
    config = admin.get("/api/admin/limits").json()
    config["limits"].update({"guest_datasets": 1, "active_guest_limit": 1})
    body = {"expected_revision": config["revision"], "limits": config["limits"]}
    assert admin.post("/api/admin/limits", json=body).json()["revision"] == 2
    assert admin.post("/api/admin/limits", json=body).status_code == 409
    with TestClient(app) as other:
        response = other.post("/api/auth/guest")
        other.headers["X-CSRF-Token"] = response.json()["csrf"]
        assert other.post("/api/datasets/sample").status_code == 201
        assert other.post("/api/datasets/sample").status_code == 413
        with TestClient(app) as third:
            denied = third.post("/api/auth/guest")
            assert denied.status_code == 429 and denied.json()["code"] == "guest_capacity"


def test_global_storage_is_serialized_without_scanning_json_payloads(admin, app):
    if app.state.engine.dialect.name != "postgresql":
        pytest.skip("Row-lock concurrency contract is PostgreSQL-specific")
    key = admin.post("/api/datasets/sample").json()["id"]
    content = b"id,value\n001,2\n"
    parsed = parse_file(content, "small.csv", app.state.settings)
    budget = len(content) + payload_budget([parsed["columns"], parsed["records"]])
    with app.state.sessions() as db:
        config = db.get(SiteConfig, 1)
        config.limits = {**config.limits, "global_storage_mb": 64}
        # Simulate a workspace just below its cap without a 64-MiB test upload.
        db.get(Dataset, key).storage_bytes = 64 * 1024 * 1024 - budget - budget // 2
        db.commit()
    cookies, csrf = dict(admin.cookies), admin.headers["X-CSRF-Token"]

    def upload(_):
        with TestClient(app) as other:
            other.cookies.update(cookies)
            return other.post(
                "/api/datasets/import", files={"file": ("small.csv", content)}, headers={"X-CSRF-Token": csrf}
            )

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(upload, range(2)))
    assert sorted(r.status_code for r in results) == [200, 413]
    assert next(r for r in results if r.status_code == 413).json()["code"] == "service_storage_limit"


def test_retention_removes_expired_guests_and_retains_permanent_data(admin, app):
    with TestClient(app) as other:
        response = other.post("/api/auth/guest").json()
        guest_id = response["user"]["id"]
        other.headers["X-CSRF-Token"] = response["csrf"]
        key = other.post("/api/datasets/sample").json()["id"]
        preview = other.post(
            f"/api/datasets/{key}/preview",
            json={"expected_version": 1, "steps": [{"op": "dedupe", "columns": ["Order ID"]}]},
        ).json()
        other.post(f"/api/datasets/{key}/preview/{preview['id']}/apply")
    permanent = admin.post("/api/datasets/sample").json()["id"]
    with app.state.sessions() as db:
        db.get(User, guest_id).expires_at = now() - timedelta(seconds=1)
        db.commit()
    response = admin.post("/api/admin/maintenance")
    assert response.status_code == 200 and response.json()["guests"] == 1
    with app.state.sessions() as db:
        assert db.get(Dataset, key) is None and db.get(Dataset, permanent) is not None
        assert db.scalar(select(func.count()).select_from(DatasetVersion)) == 0
        assert db.scalar(select(func.count()).select_from(Preview)) == 0
        assert db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.actor_id == guest_id)) == 0
    assert admin.get("/api/admin/status").json()["active_guests"] == 0


def test_audit_never_contains_passwords_or_uploaded_values(admin):
    secret = "not-in-audit-password-123"
    assert admin.post("/api/admin/users", json={"username": "example", "password": secret}).status_code == 201
    admin.post("/api/datasets/import", files={"file": ("example.csv", b"id,note\n001,PRIVATE-EXAMPLE-CELL\n")})
    response = admin.get("/api/admin/audit")
    assert "account.created" in response.text and "dataset.imported" in response.text
    assert secret not in response.text and "PRIVATE-EXAMPLE-CELL" not in response.text
    assert "password_hash" not in response.text


def test_password_reset_during_verification_cannot_create_a_new_session(client, app, monkeypatch):
    real = auth.hasher
    replacement = real.hash("changed-during-login-123")

    def verify(stored, value):
        valid = real.verify(stored, value)
        with app.state.sessions() as db:
            db.scalar(select(User).where(User.username == "tester")).password_hash = replacement
            db.commit()
        return valid

    monkeypatch.setattr(auth, "hasher", SimpleNamespace(verify=verify))
    response = client.post("/api/auth/login", json={"username": "tester", "password": "testing-password-123"})
    assert response.status_code == 401
    with app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(LoginSession)) == 0
