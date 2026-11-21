from datetime import timedelta
from io import BytesIO
import json

import pytest
from fastapi.testclient import TestClient
from openpyxl import load_workbook
from pydantic import TypeAdapter
from app.config import Settings
from app.db import Dataset, Preview, now
from app.errors import Problem
from app.transforms import Step, apply_steps

adapter = TypeAdapter(list[Step])


def run(columns, rows, steps):
    return apply_steps(columns, rows, adapter.validate_python(steps), Settings(database_url="sqlite://"))


def test_explicit_types_ambiguity_and_original_values():
    original = [["001", "  A  ", "1.234,50", "02/03/2026"]]
    columns, rows, impacts = run(
        ["id", "label", "amount", "date"],
        original,
        [
            {"op": "trim", "columns": ["label"]},
            {"op": "number", "column": "amount", "decimal": ",", "thousands": "."},
            {"op": "date", "column": "date", "formats": ["%d/%m/%Y"]},
        ],
    )
    assert rows == [["001", "A", "1234.50", "2026-03-02"]]
    assert original == [["001", "  A  ", "1.234,50", "02/03/2026"]]
    assert sum(x["cell_updates"] for x in impacts) == 3
    with pytest.raises(Problem) as caught:
        run(["date"], [["02/03/2026"]], [{"op": "date", "column": "date", "formats": ["%d/%m/%Y", "%m/%d/%Y"]}])
    assert caught.value.code == "invalid_values"
    for value in ["1,23.00", "NaN", "1e100000", "Infinity"]:
        with pytest.raises(Problem):
            run(["n"], [[value]], [{"op": "number", "column": "n", "thousands": ","}])


def test_sequential_schema_changes_and_exact_duplicate_keys():
    columns, rows, _ = run(
        ["id", "name"],
        [["001", "A|B"], ["001", "A|B"], ["002", None]],
        [
            {"op": "dedupe", "columns": ["id"]},
            {"op": "split", "column": "name", "separator": "|", "names": ["first", "last"]},
            {"op": "fill_null", "column": "last", "value": "Unknown"},
            {"op": "combine", "columns": ["first", "last"], "name": "full", "separator": " "},
            {"op": "filter", "column": "id", "operator": "eq", "value": "001"},
            {"op": "rename", "column": "full", "name": " Full name "},
        ],
    )
    assert columns == ["id", "first", "last", "Full name"]
    assert rows == [["001", "A", "B", "A B"]]
    with pytest.raises(Problem):
        run(["id", "name"], [["1", "a"]], [{"op": "rename", "column": "name", "name": " id "}])


def preview(guest, key, version=1, steps=None):
    return guest.post(
        f"/api/datasets/{key}/preview",
        json={"expected_version": version, "steps": steps or [{"op": "dedupe", "columns": ["Order ID"]}]},
    )


def test_preview_apply_restore_branch_history_and_quality_export(guest, app):
    key = guest.post("/api/datasets/sample").json()["id"]
    with app.state.sessions() as db:
        source = db.get(Dataset, key).original_bytes
    first = preview(guest, key).json()
    assert first["before"]["rows"] == 6 and first["after"]["rows"] == 5
    assert guest.get(f"/api/datasets/{key}").json()["rows"] == 6
    applied = guest.post(f"/api/datasets/{key}/preview/{first['id']}/apply")
    assert applied.status_code == 200, applied.text
    assert applied.json()["version"] == 2
    assert guest.post(f"/api/datasets/{key}/preview/{first['id']}/apply").json()["applied_version"] == 2
    assert guest.get(f"/api/datasets/{key}/profile").json()["duplicate_rows"] == 0
    assert guest.post(f"/api/datasets/{key}/restore", json={"expected_version": 2, "version": 1}).status_code == 200
    second = preview(guest, key, steps=[{"op": "fill_null", "column": "Quantity", "value": "0"}]).json()
    assert guest.post(f"/api/datasets/{key}/preview/{second['id']}/apply").json()["version"] == 3
    versions = guest.get(f"/api/datasets/{key}/versions").json()
    assert [(v["number"], v["parent"]) for v in versions["items"]] == [(1, None), (2, 1), (3, 1)]
    report = guest.post(
        f"/api/datasets/{key}/export", json={"expected_version": 3, "format": "quality", "confirmed": True}
    ).json()
    assert report["source_unchanged"] and len(report["lineage"]) == 1
    assert report["quality"]["missing_cells"] == 0
    with app.state.sessions() as db:
        assert db.get(Dataset, key).original_bytes == source
        assert len(db.get(Dataset, key).records) == 6


def test_stale_expired_and_cross_owner_previews_are_rejected(guest, app):
    key = guest.post("/api/datasets/sample").json()["id"]
    first = preview(guest, key).json()
    with TestClient(app) as other:
        auth = other.post("/api/auth/guest").json()
        other.headers["X-CSRF-Token"] = auth["csrf"]
        assert other.post(f"/api/datasets/{key}/preview/{first['id']}/apply").status_code == 404
        assert other.get(f"/api/datasets/{key}/versions").status_code == 404
    guest.post(f"/api/datasets/{key}/preview/{first['id']}/apply")
    assert preview(guest, key).status_code == 409
    second = preview(guest, key, version=2, steps=[{"op": "fill_null", "column": "Quantity", "value": "0"}]).json()
    guest.post(f"/api/datasets/{key}/restore", json={"expected_version": 2, "version": 1})
    assert guest.post(f"/api/datasets/{key}/preview/{second['id']}/apply").json()["code"] == "stale_version"
    with app.state.sessions() as db:
        db.get(Preview, second["id"]).expires_at = now() - timedelta(seconds=1)
        db.commit()
    assert guest.post(f"/api/datasets/{key}/preview/{second['id']}/apply").json()["code"] == "preview_expired"
    bad = preview(guest, key, steps=[{"op": "date", "column": "Order Date", "formats": ["%Y-%m-%d", "%d/%m/%Y"]}])
    assert bad.json()["code"] == "invalid_values"
    assert guest.get(f"/api/datasets/{key}").json()["version"] == 1


def test_export_confirmation_and_spreadsheet_formulas(guest):
    content = b'id,value\n001,=1+1\n002,"  @SUM(A1:A2)"\n003,-42\n'
    key = guest.post("/api/datasets/import", files={"file": ("formula.csv", content)}).json()["id"]
    body = {"expected_version": 1, "format": "csv", "confirmed": False}
    assert guest.post(f"/api/datasets/{key}/export", json=body).json()["code"] == "confirmation_required"
    body["confirmed"] = True
    csv = guest.post(f"/api/datasets/{key}/export", json=body)
    assert csv.headers["X-Dataflow-Escaped-Cells"] == "3"
    assert "'=1+1" in csv.text and "'-42" in csv.text
    body["format"] = "xlsx"
    book = load_workbook(BytesIO(guest.post(f"/api/datasets/{key}/export", json=body).content))
    assert book.active["B2"].data_type == "s" and book.active["B2"].value == "=1+1"
    assert book.active["A2"].value == "001"
    body["format"] = "json"
    result = json.loads(guest.post(f"/api/datasets/{key}/export", json=body).content)
    assert result["records"][0] == ["001", "=1+1"]


def test_replaced_preview_and_excel_representation_limits(guest):
    key = guest.post("/api/datasets/sample").json()["id"]
    first, second = preview(guest, key).json(), preview(guest, key).json()
    assert guest.post(f"/api/datasets/{key}/preview/{first['id']}/apply").json()["code"] == "preview_not_found"
    assert guest.post(f"/api/datasets/{key}/preview/{second['id']}/apply").status_code == 200
    content = b"id,value\n001," + b"x" * 32768 + b"\n"
    other = guest.post("/api/datasets/import", files={"file": ("long.csv", content)}).json()["id"]
    response = guest.post(
        f"/api/datasets/{other}/export", json={"expected_version": 1, "format": "xlsx", "confirmed": True}
    )
    assert response.status_code == 422 and response.json()["code"] == "xlsx_values"
    assert len(guest.get(f"/api/datasets/{other}").json()["records"][0][1]) == 32768
