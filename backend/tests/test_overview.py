from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db import User


def test_overview_requires_session_and_empty_guest_is_not_seeded(client):
    assert client.get("/api/overview").status_code == 401
    client.post("/api/auth/guest")
    result = client.get("/api/overview").json()
    assert result == {"counts": {"datasets": 0, "workflows": 0, "reports": 0, "runs": 0},
                      "datasets": [], "runs": [], "reports": []}


def test_overview_tracks_current_version_and_isolates_admin_metadata(guest, app):
    source = guest.post("/api/datasets/sample").json()["id"]
    body = {"dataset_id": source, "expected_version": 1,
            "steps": [{"op": "dedupe", "columns": ["Order ID"]}]}
    workflow = guest.post("/api/workflows", json={**body, "name": "Monthly preparation"}).json()["id"]
    pending = guest.post(f"/api/workflows/{workflow}/runs", json={
        "dataset_id": source, "expected_version": 1, "workflow_version": 1, "idempotency_key": str(uuid4()),
    }).json()
    before = guest.get("/api/overview").json()
    assert before["counts"] == {"datasets": 1, "workflows": 1, "reports": 0, "runs": 1}
    assert before["datasets"][0]["rows"] == 6 and before["runs"][0]["status"] == "pending"
    done = guest.post(f"/api/workflows/{workflow}/runs/{pending['id']}/execute").json()
    guest.post(f"/api/datasets/{source}/preview/{done['preview_id']}/apply")
    saved = guest.post("/api/reports", json={
        "dataset_id": source, "expected_version": 2, "confirmed": True, "name": "Reviewed count",
        "specification": {"group_by": "Product Code", "operation": "count", "chart_type": "bar"},
    })
    assert saved.status_code == 201
    result = guest.get("/api/overview").json()
    assert result["counts"] == {"datasets": 1, "workflows": 1, "reports": 1, "runs": 1}
    assert result["datasets"][0]["rows"] == 5 and result["datasets"][0]["version"] == 2
    assert result["runs"][0]["status"] == "completed"
    assert result["reports"][0]["dataset_version"] == 2
    assert set(result["datasets"][0]) == {"id", "name", "rows", "version", "created_at"}
    assert "summary" not in result["runs"][0]  # No samples or uploaded cell values in the home endpoint.
    guest.post(f"/api/datasets/{source}/restore", json={"expected_version": 2, "version": 1})
    assert guest.get("/api/overview").json()["datasets"][0]["rows"] == 6
    with TestClient(app) as other:
        auth = other.post("/api/auth/guest").json()
        with app.state.sessions() as db:
            row = db.scalar(select(User).where(User.id == auth["user"]["id"]))
            row.role = "admin"
            db.commit()
        own = other.get("/api/overview").json()
        assert own["counts"] == {"datasets": 0, "workflows": 0, "reports": 0, "runs": 0}
        assert own["datasets"] == own["runs"] == own["reports"] == []
