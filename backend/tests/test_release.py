from concurrent.futures import ThreadPoolExecutor
from threading import Event
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from app import auth, datasets
from app.bootstrap import bootstrap_admin
from app.db import User
from app.errors import Problem
from app.limits import config_row
from test_cleaning import run
from test_workflows import recipe, run_body, upload


def test_rules_reject_rows_without_mutating_source_and_report_step_positions():
    source = [["001", "2"], ["001", "bad"], [None, None]]
    with pytest.raises(Problem) as caught:
        run(["id", "qty"], source, [{"op": "validate", "column": "id", "rule": "unique"}])
    assert caught.value.code == "validation_failed"
    assert caught.value.details == {"column": "id", "rule": "unique", "rows": [3, 4], "count": 2}
    assert source == [["001", "2"], ["001", "bad"], [None, None]]
    columns, rows, impacts = run(
        ["id"], [["001"], [None]],
        [{"op": "validate", "column": "id", "rule": "unique", "allow_empty": True}],
    )
    assert rows == [["001"], [None]] and impacts[0]["cell_updates"] == 0
    for rule, value, extra in [
        ("not_null", " ", {"allow_empty": True}),
        ("number", "NaN", {}),
        ("date", "02/03/2026", {"formats": ["%d/%m/%Y", "%m/%d/%Y"]}),
    ]:
        with pytest.raises(Problem):
            run(["v"], [[value]], [{"op": "validate", "column": "v", "rule": rule, **extra}])


def test_saved_workflow_applies_validation_rules_to_new_inputs(guest):
    good = upload(guest, "good.csv", "order_id,sku,qty\n001,P01,2\n")
    bad = upload(guest, "bad.csv", "order_id,sku,qty\n002,P01,invalid\n")
    body = recipe(good)
    body["steps"] = [{"op": "validate", "column": "qty", "rule": "number"}]
    created = guest.post("/api/workflows", json=body)
    assert created.status_code == 201
    key = created.json()["id"]
    queued = guest.post(f"/api/workflows/{key}/runs", json=run_body(bad)).json()
    result = guest.post(f"/api/workflows/{key}/runs/{queued['id']}/execute").json()
    assert result["status"] == "failed" and result["error_code"] == "validation_failed"
    assert result["error_details"] == {"column": "qty", "rule": "number", "rows": [2], "count": 1}
    assert guest.get(f"/api/datasets/{bad}").json()["version"] == 1


def test_inventory_and_missing_key_fixtures_have_documented_ground_truth(guest):
    inventory = guest.post("/api/datasets/sample?kind=inventory").json()["id"]
    response = guest.post(f"/api/datasets/{inventory}/preview", json={
        "expected_version": 1, "steps": [{"op": "dedupe", "columns": ["SKU", "Warehouse"]}],
    }).json()
    assert response["after"]["rows"] == 4
    assert sum(int(row[2]) for row in response["after"]["records"]) == 19
    assert response["after"]["records"][0][0] == "001"
    products = guest.post("/api/datasets/sample?kind=products").json()["id"]
    sales = guest.post("/api/datasets/sample?kind=missing-key").json()["id"]
    definition = {
        "name": "Review product lookup", "description": "", "dataset_id": sales, "expected_version": 1, "steps": [],
        "right_dataset_id": products,
        "integration": {"mode": "left", "left_key": "Product Code", "right_key": "Product Code", "allow_unmatched": False},
    }
    assert guest.post("/api/workflows", json=definition).json()["code"] == "unmatched_keys"
    definition["integration"]["allow_unmatched"] = True
    assert guest.post("/api/workflows", json=definition).status_code == 201


def test_bootstrap_is_one_time_and_never_resets_or_promotes_existing_accounts(app, monkeypatch):
    monkeypatch.setenv("BOOTSTRAP_ADMIN_USER", "first.admin")
    monkeypatch.setenv("BOOTSTRAP_ADMIN_PASSWORD", "ephemeral-test-only-password")
    bootstrap_admin(app.state.sessions)
    with app.state.sessions() as db:
        admin = db.scalar(select(User).where(User.username == "first.admin"))
        saved = admin.password_hash
        assert admin.role == "admin" and config_row(db).bootstrap_completed
        admin.role = "user"  # A subsequent startup must not silently re-promote this account.
        db.commit()
    monkeypatch.setenv("BOOTSTRAP_ADMIN_PASSWORD", "another-test-only-password")
    bootstrap_admin(app.state.sessions)
    with app.state.sessions() as db:
        row = db.scalar(select(User).where(User.username == "first.admin"))
        assert row.role == "user" and row.password_hash == saved


def test_bootstrap_username_collision_fails_closed(app, monkeypatch):
    monkeypatch.setenv("BOOTSTRAP_ADMIN_USER", "tester")
    monkeypatch.setenv("BOOTSTRAP_ADMIN_PASSWORD", "ephemeral-test-only-password")
    with pytest.raises(RuntimeError, match="no account was changed"):
        bootstrap_admin(app.state.sessions)
    with app.state.sessions() as db:
        assert db.scalar(select(User).where(User.username == "tester")).role == "user"
        assert not config_row(db).bootstrap_completed


def test_database_outage_returns_generic_503_without_connection_or_sql_details(client, app, monkeypatch, caplog):
    private = "SECRET-sql-credential-marker"
    def failure(*args, **kwargs):
        raise OperationalError("SELECT private_payload", {"password": private}, RuntimeError(private))
    monkeypatch.setattr(app.state.engine, "connect", failure)
    response = client.get("/api/health")
    assert response.status_code == 503
    assert response.json() == {"code": "database_unavailable"}
    assert private not in response.text + caplog.text
    assert "private_payload" not in response.text + caplog.text


def test_processing_admission_is_bounded_but_health_remains_available(guest, app, monkeypatch):
    key = guest.post("/api/datasets/sample").json()["id"]
    release, entered = Event(), Event()
    original = datasets.profile
    counter = 0
    def slow(*args):
        nonlocal counter
        counter += 1
        if counter == 2:
            entered.set()
        assert release.wait(10)
        return original(*args)
    monkeypatch.setattr(datasets, "profile", slow)
    def query():
        with TestClient(app) as other:
            other.cookies.update(guest.cookies)
            return other.get(f"/api/datasets/{key}/profile")
    with ThreadPoolExecutor(2) as pool:
        futures = [pool.submit(query), pool.submit(query)]
        try:
            assert entered.wait(10)
            assert guest.get(f"/api/datasets/{key}/profile").status_code == 429
            assert guest.get("/api/health").status_code == 200
        finally:
            release.set()
        assert [f.result().status_code for f in futures] == [200, 200]
    assert guest.get(f"/api/datasets/{key}/profile").status_code == 200


def test_password_memory_admission_releases_slot_after_completion(monkeypatch):
    hasher = auth.BoundedHasher()
    release, entered = Event(), Event()
    count = 0
    def fake_hash(value):
        nonlocal count
        count += 1
        if count == 2:
            entered.set()
        assert release.wait(10)
        return "not-a-real-hash"
    monkeypatch.setattr(hasher, "_hasher", SimpleNamespace(hash=fake_hash))
    with ThreadPoolExecutor(2) as pool:
        futures = [pool.submit(hasher.hash, "a"), pool.submit(hasher.hash, "b")]
        try:
            assert entered.wait(10)
            with pytest.raises(Problem) as caught:
                hasher.hash("c")
            assert caught.value.code == "server_busy"
        finally:
            release.set()
        assert all(f.result() == "not-a-real-hash" for f in futures)
    assert hasher.hash("d") == "not-a-real-hash"
