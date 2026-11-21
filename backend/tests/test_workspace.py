from io import BytesIO
from datetime import timedelta
import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook
from sqlalchemy import select
from app.db import Dataset, User, now


def workbook():
    b = Workbook()
    b.active.title = "Bán hàng"
    b.active.append(["Mã hàng", "Số lượng"])
    b.active.append(["001", 3])
    b.create_sheet("Kho").append(["SKU", "Stock"])
    b["Kho"].append(["P01", 20])
    f = BytesIO()
    b.save(f)
    return f.getvalue()


def test_guest_import_profile_unicode_and_source_unchanged(guest, app):
    original = "Mã KH,Order Date,Quantity\n001,31/02/2026,one\n001,31/02/2026,one\n002,2026-10-01,\n".encode()
    response = guest.post("/api/datasets/import", files={"file": ("Bán hàng.csv", original)})
    assert response.status_code == 200, response.text
    key = response.json()["id"]
    detail = guest.get(f"/api/datasets/{key}").json()
    assert detail["records"][0][0] == "001"
    profile = guest.get(f"/api/datasets/{key}/profile").json()
    assert profile["rows"] == 3 and profile["duplicate_rows"] == 1 and profile["missing_cells"] == 1
    assert profile["fields"][1]["invalid"] == 2
    assert profile["fields"][2]["invalid"] == 2
    assert profile["outliers_are_errors"] is False
    with app.state.sessions() as db:
        assert db.get(Dataset, key).original_bytes == original


def test_xlsx_requires_sheet_and_preserves_ids(guest):
    content = workbook()
    first = guest.post("/api/datasets/import", files={"file": ("Báo cáo.xlsx", content)})
    assert first.json() == {"requires_sheet": True, "sheets": ["Bán hàng", "Kho"]}
    assert guest.get("/api/datasets").json()["items"] == []
    second = guest.post("/api/datasets/import", files={"file": ("Báo cáo.xlsx", content)}, data={"sheet": "Bán hàng"})
    key = second.json()["id"]
    assert guest.get(f"/api/datasets/{key}").json()["records"] == [["001", "3"]]


@pytest.mark.parametrize(
    "name,content,code",
    [
        ("empty.csv", b"", "empty_file"),
        ("wrong.exe", b"abc", "unsupported_file"),
        ("wrong.xlsx", b"not-an-xlsx", "invalid_file"),
        ("duplicate.csv", b"a,a\n1,2\n", "duplicate_headers"),
        ("spaces.csv", b"a, a\n1,2\n", "duplicate_headers"),
        ("empty.csv", b"a,b\n", "empty_dataset"),
        ("ragged.csv", b"a,b\n1,2,3\n", "ragged_rows"),
        ("encoding.csv", b"a,b\n1,\xff\n", "encoding"),
        ("null.csv", b"a,b\n1,\x00\n", "invalid_file"),
    ],
)
def test_invalid_imports_are_atomic(guest, name, content, code):
    r = guest.post("/api/datasets/import", files={"file": (name, content)})
    assert r.status_code == 422, r.text
    assert r.json()["code"] == code
    assert guest.get("/api/datasets").json()["items"] == []


def test_upload_and_workspace_limits(guest):
    response = guest.post("/api/datasets/import", files={"file": ("big.csv", b"x" * (1024 * 1024 + 1))})
    assert response.status_code == 413
    for _ in range(3):
        assert guest.post("/api/datasets/sample").status_code == 201
    assert guest.post("/api/datasets/sample").status_code == 413


def test_chunked_request_cannot_bypass_body_limit(guest):
    chunks = (b"x" * 65536 for _ in range(18))
    response = guest.post("/api/datasets/import", content=chunks, headers={"Content-Type": "application/octet-stream"})
    assert response.status_code == 413
    assert response.json()["code"] == "file_too_large"


def test_real_owner_authorization_for_detail_profile_and_delete(guest, app):
    key = guest.post("/api/datasets/sample").json()["id"]
    with TestClient(app) as other:
        result = other.post("/api/auth/guest").json()
        other.headers["X-CSRF-Token"] = result["csrf"]
        assert other.get("/api/datasets").json()["items"] == []
        for path in [f"/api/datasets/{key}", f"/api/datasets/{key}/profile"]:
            assert other.get(path).status_code == 404
        assert other.delete(f"/api/datasets/{key}").status_code == 404
    assert guest.get(f"/api/datasets/{key}").status_code == 200


def test_login_csrf_logout_and_rate_limit(client):
    assert client.get("/api/datasets").status_code == 401
    assert client.post("/api/auth/login", json={"username": "tester", "password": "bad"}).status_code == 401
    response = client.post("/api/auth/login", json={"username": "tester", "password": "testing-password-123"})
    assert response.json()["user"]["role"] == "user"
    assert "httponly" in response.headers["set-cookie"].lower()
    assert client.post("/api/datasets/sample").status_code == 403
    client.headers["X-CSRF-Token"] = response.json()["csrf"]
    assert client.post("/api/datasets/sample").status_code == 201
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/datasets").status_code == 401
    for _ in range(3):
        assert client.post("/api/auth/login", json={"username": "tester", "password": "bad"}).status_code == 401
    assert client.post("/api/auth/login", json={"username": "tester", "password": "bad"}).status_code == 429


def test_password_change_revokes_all_sessions(client):
    result = client.post("/api/auth/login", json={"username": "tester", "password": "testing-password-123"}).json()
    client.headers["X-CSRF-Token"] = result["csrf"]
    assert (
        client.post(
            "/api/auth/password", json={"current_password": "bad", "new_password": "new-password-1234"}
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/auth/password", json={"current_password": "testing-password-123", "new_password": "new-password-1234"}
        ).status_code
        == 204
    )
    assert client.get("/api/auth/session").status_code == 401
    assert (
        client.post("/api/auth/login", json={"username": "tester", "password": "new-password-1234"}).status_code == 200
    )


def test_guest_expiration_and_origin(guest, app):
    assert guest.post("/api/datasets/sample", headers={"Origin": "https://untrusted.test"}).status_code == 403
    with app.state.sessions() as db:
        user = db.scalar(select(User).where(User.role == "guest"))
        user.expires_at = now() - timedelta(minutes=1)
        db.commit()
    assert guest.get("/api/datasets").status_code == 401


def test_dataset_removal_and_pagination(guest, app):
    key = guest.post("/api/datasets/sample").json()["id"]
    page = guest.get(f"/api/datasets/{key}?page=2&page_size=2").json()
    assert len(page["records"]) == 2 and page["page"] == 2
    assert guest.get(f"/api/datasets/{key}?page_size=1000").status_code == 422
    assert guest.delete(f"/api/datasets/{key}").status_code == 204
    with app.state.sessions() as db:
        assert db.get(Dataset, key) is None
