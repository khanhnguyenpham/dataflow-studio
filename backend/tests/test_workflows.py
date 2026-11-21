from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
import pytest
from datetime import timedelta
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from app.db import DatasetVersion, Preview, now
from app.workflow_models import WorkflowRun


def upload(client, name, text):
    response = client.post("/api/datasets/import", files={"file": (name, text.encode())})
    assert response.status_code == 200, response.text
    return response.json()["id"]


def recipe(source, right=None):
    return {
        "name": "Monthly Sales Report",
        "description": "Retain the first order and look up product labels.",
        "dataset_id": source,
        "expected_version": 1,
        "steps": [{"op": "dedupe", "columns": ["order_id"]}],
        "integration": {"mode": "left", "left_key": "sku", "right_key": "sku"} if right else None,
        "right_dataset_id": right,
    }


def run_body(source, right=None):
    return {
        "idempotency_key": str(uuid4()),
        "workflow_version": 1,
        "dataset_id": source,
        "expected_version": 1,
        "right_dataset_id": right,
        "expected_right_version": 1 if right else None,
    }


def test_monthly_workflow_reuses_definition_and_requires_result_confirmation(guest, app):
    october = upload(guest, "oct.csv", "order_id,sku,qty\n001,P1,2\n002,P2,3\n002,P2,3\n")
    products = upload(guest, "products.csv", "sku,name\nP1,Pen\nP2,Book\n")
    november = upload(guest, "nov.csv", "order_id,sku,qty\n003,P2,8\n004,P1,5\n")
    response = guest.post("/api/workflows", json=recipe(october, products))
    assert response.status_code == 201, response.text
    workflow = response.json()["id"]
    body = run_body(october, products)
    queued = guest.post(f"/api/workflows/{workflow}/runs", json=body).json()
    assert queued["status"] == "pending"
    assert guest.post(f"/api/workflows/{workflow}/runs", json=body).json()["id"] == queued["id"]
    done = guest.post(f"/api/workflows/{workflow}/runs/{queued['id']}/execute").json()
    assert done["status"] == "completed" and done["summary"]["result_rows"] == 2
    assert (
        guest.post(f"/api/workflows/{workflow}/runs/{queued['id']}/execute").json()["preview_id"] == done["preview_id"]
    )
    result = guest.get(f"/api/workflows/{workflow}/runs/{queued['id']}/result").json()
    assert result["after"]["records"] == [["001", "P1", "2", "Pen"], ["002", "P2", "3", "Book"]]
    assert guest.get(f"/api/datasets/{october}").json()["rows"] == 3
    applied = guest.post(f"/api/datasets/{october}/preview/{done['preview_id']}/apply")
    assert applied.json()["version"] == 2
    body["dataset_id"] = november
    assert guest.post(f"/api/workflows/{workflow}/runs", json=body).json()["code"] == "idempotency_conflict"
    new_run = guest.post(f"/api/workflows/{workflow}/runs", json=run_body(november, products)).json()
    assert guest.post(f"/api/workflows/{workflow}/runs/{new_run['id']}/execute").json()["status"] == "completed"
    result = guest.get(f"/api/workflows/{workflow}/runs/{new_run['id']}/result").json()
    assert result["after"]["records"][0] == ["003", "P2", "8", "Book"]
    with app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(WorkflowRun)) == 2
    assert guest.delete(f"/api/workflows/{workflow}").status_code == 204
    assert guest.get(f"/api/datasets/{october}").json()["version"] == 2


def test_schema_drift_is_a_failed_run_with_immutable_definition(guest):
    source = upload(guest, "old.csv", "order_id,qty\n001,2\n001,2\n")
    new = upload(guest, "new.csv", "order_id,quantity\n002,8\n")
    workflow = guest.post("/api/workflows", json=recipe(source)).json()["id"]
    run = guest.post(f"/api/workflows/{workflow}/runs", json=run_body(new)).json()
    failed = guest.post(f"/api/workflows/{workflow}/runs/{run['id']}/execute").json()
    assert failed["status"] == "failed" and failed["error_code"] == "schema_drift"
    assert failed["started_at"] and failed["finished_at"]
    assert guest.get(f"/api/datasets/{new}").json()["version"] == 1
    updated = recipe(new)
    updated["expected_workflow_version"] = 1
    assert guest.post(f"/api/workflows/{workflow}", json=updated).json()["version"] == 2
    assert guest.post(f"/api/workflows/{workflow}", json=updated).status_code == 409
    assert guest.get(f"/api/workflows/{workflow}").json()["versions"] == [1, 2]
    # A previously failed run is never silently re-executed against the newer definition.
    assert guest.post(f"/api/workflows/{workflow}/runs/{run['id']}/execute").json()["status"] == "failed"


def test_workflow_ownership_interrupted_execution_and_preview_expiry(guest, app):
    source = upload(guest, "sales.csv", "order_id,qty\n001,2\n001,2\n")
    workflow = guest.post("/api/workflows", json=recipe(source)).json()["id"]
    run = guest.post(f"/api/workflows/{workflow}/runs", json=run_body(source)).json()
    with TestClient(app) as other:
        auth = other.post("/api/auth/guest").json()
        other.headers["X-CSRF-Token"] = auth["csrf"]
        assert other.get(f"/api/workflows/{workflow}").status_code == 404
        assert other.get(f"/api/workflows/{workflow}/runs").status_code == 404
        assert other.post(f"/api/workflows/{workflow}/runs/{run['id']}/execute").status_code == 404
    with app.state.sessions() as db:
        row = db.get(WorkflowRun, run["id"])
        row.status, row.started_at = "running", now() - timedelta(minutes=3)
        db.commit()
    assert (
        guest.post(f"/api/workflows/{workflow}/runs/{run['id']}/execute").json()["error_code"]
        == "execution_interrupted"
    )
    new = guest.post(f"/api/workflows/{workflow}/runs", json=run_body(source)).json()
    completed = guest.post(f"/api/workflows/{workflow}/runs/{new['id']}/execute").json()
    with app.state.sessions() as db:
        db.get(Preview, completed["preview_id"]).expires_at = now() - timedelta(minutes=1)
        db.commit()
    assert guest.get(f"/api/workflows/{workflow}/runs/{new['id']}/result").status_code == 409


def test_concurrent_execute_and_apply_do_not_duplicate_results(guest, app):
    if app.state.engine.dialect.name != "postgresql":
        pytest.skip("Row-lock concurrency contract is PostgreSQL-specific")
    source = upload(guest, "sales.csv", "order_id,qty\n001,2\n001,2\n")
    workflow = guest.post("/api/workflows", json=recipe(source)).json()["id"]
    run = guest.post(f"/api/workflows/{workflow}/runs", json=run_body(source)).json()
    cookies, csrf = dict(guest.cookies), guest.headers["X-CSRF-Token"]

    def post(path):
        with TestClient(app) as other:
            other.cookies.update(cookies)
            response = other.post(path, headers={"X-CSRF-Token": csrf})
            assert response.status_code == 200, response.text
            return response.json()

    with ThreadPoolExecutor(max_workers=2) as pool:
        executions = list(pool.map(post, [f"/api/workflows/{workflow}/runs/{run['id']}/execute"] * 2))
    assert all(row["status"] in {"running", "completed"} for row in executions)
    history = guest.get(f"/api/workflows/{workflow}/runs").json()["items"]
    assert len(history) == 1 and history[0]["status"] == "completed"
    preview_id = history[0]["preview_id"]
    with ThreadPoolExecutor(max_workers=2) as pool:
        applied = list(pool.map(post, [f"/api/datasets/{source}/preview/{preview_id}/apply"] * 2))
    assert [r["applied_version"] for r in applied] == [2, 2]
    with app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(Preview)) == 1
        assert db.scalar(select(func.count()).select_from(DatasetVersion)) == 1
