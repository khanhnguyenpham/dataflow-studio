from fastapi.testclient import TestClient


def test_saved_reports_pin_actual_version_and_formula_safe_exports(guest, app):
    key = guest.post(
        "/api/datasets/import", files={"file": ("sales.csv", b"group,amount\n=1+1,0.1\n=1+1,0.2\nB,0.9\n")}
    ).json()["id"]
    body = {
        "dataset_id": key,
        "expected_version": 1,
        "name": "Monthly sum",
        "confirmed": True,
        "specification": {"group_by": "group", "operation": "sum", "measure": "amount", "chart_type": "bar"},
    }
    preview = guest.post("/api/reports/preview", json=body)
    assert preview.json()["metrics"]["overall"] == "1.2"
    saved = guest.post("/api/reports", json=body)
    assert saved.status_code == 201, saved.text
    report = saved.json()["id"]
    draft = guest.post(
        f"/api/datasets/{key}/preview", json={"expected_version": 1, "steps": [{"op": "dedupe", "columns": ["group"]}]}
    ).json()
    assert guest.post(f"/api/datasets/{key}/preview/{draft['id']}/apply").status_code == 200
    body["expected_version"] = 2
    assert guest.post("/api/reports/preview", json=body).json()["metrics"]["overall"] == "1.0"
    historical = guest.get(f"/api/reports/{report}").json()
    assert historical["dataset_version"] == 1 and historical["result"]["metrics"]["overall"] == "1.2"
    csv = guest.post(f"/api/reports/{report}/export", json={"format": "csv", "confirmed": True})
    assert csv.headers["X-Dataflow-Escaped-Cells"] == "1" and "'=1+1" in csv.text
    exact = guest.post(f"/api/reports/{report}/export", json={"format": "json", "confirmed": True}).json()
    assert exact["result"]["items"][0]["value"] == "0.3"
    with TestClient(app) as other:
        auth = other.post("/api/auth/guest").json()
        other.headers["X-CSRF-Token"] = auth["csrf"]
        assert other.get(f"/api/reports/{report}").status_code == 404
        assert other.post(f"/api/reports/{report}/export", json={"format": "csv", "confirmed": True}).status_code == 404
    assert guest.delete(f"/api/reports/{report}").status_code == 204
    assert guest.get(f"/api/datasets/{key}").status_code == 200


def test_analytics_requires_confirmation_and_rejects_bad_measure(guest):
    key = guest.post("/api/datasets/sample").json()["id"]
    body = {
        "dataset_id": key,
        "expected_version": 1,
        "confirmed": False,
        "specification": {"group_by": "Product Code", "operation": "sum", "measure": "Quantity"},
    }
    assert guest.post("/api/reports/preview", json=body).json()["code"] == "confirmation_required"
    body["confirmed"] = True
    result = guest.post("/api/reports/preview", json=body)
    assert result.json()["code"] == "invalid_measure" and result.json()["details"]["count"] == 1
    assert guest.get(f"/api/datasets/{key}").json()["version"] == 1
    body["specification"] = {"group_by": "Product Code", "operation": "count"}
    assert guest.post("/api/reports/preview", json=body).json()["metrics"]["overall"] == "6"
