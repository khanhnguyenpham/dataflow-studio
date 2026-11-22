from app.schema_match import suggest
from sqlalchemy import event
from fastapi.testclient import TestClient
from app.db import Dataset


def test_bilingual_aliases_and_exact_name_priority():
    result = suggest(["Mã hàng", "qty", "orderDate"], ["Product Code", "Quantity", "Order Date"])
    assert [r["suggested_source"] for r in result["items"]] == ["Mã hàng", "qty", "orderDate"]
    assert result["requires_confirmation"] and not result["scores_are_probabilities"]
    exact = suggest(["Email", "Email Address"], ["Email"])
    assert exact["items"][0]["suggested_source"] == "Email"


def test_ambiguous_or_competing_fields_require_review():
    ambiguous = suggest(["Quantity", "qty"], ["Số lượng"])
    assert ambiguous["items"][0]["suggested_source"] is None
    competing = suggest(["sku"], ["Product Code", "SKU"])
    assert [r["suggested_source"] for r in competing["items"]] == [None, "sku"]
    assert suggest(["Customer ID"], ["Order ID"])["items"][0]["suggested_source"] is None


def test_suggestions_map_preview_and_apply_preserve_source_and_owner_boundary(guest, app):
    content = b"qty,ma_kh,Note\n2,001,keep\n3,002,keep\n"
    key = guest.post("/api/datasets/import", files={"file": ("month.csv", content)}).json()["id"]
    body = {"expected_version": 1, "targets": ["Customer ID", "Quantity"]}
    proposal = guest.post(f"/api/datasets/{key}/column-suggestions", json=body)
    assert proposal.status_code == 200, proposal.text
    assert [item["suggested_source"] for item in proposal.json()["items"]] == ["ma_kh", "qty"]
    assert proposal.json()["unused_sources"] == ["Note"]
    with TestClient(app) as other:
        auth = other.post("/api/auth/guest").json()
        other.headers["X-CSRF-Token"] = auth["csrf"]
        assert other.post(f"/api/datasets/{key}/column-suggestions", json=body).status_code == 404
    step = {
        "op": "map_columns",
        "mapping": [{"source": "ma_kh", "target": "Customer ID"}, {"source": "qty", "target": "Quantity"}],
        "keep_extras": False,
    }
    preview = guest.post(f"/api/datasets/{key}/preview", json={"expected_version": 1, "steps": [step]}).json()
    assert preview["after"]["records"] == [["001", "2"], ["002", "3"]]
    assert guest.get(f"/api/datasets/{key}").json()["column_names"] == ["qty", "ma_kh", "Note"]
    assert guest.post(f"/api/datasets/{key}/preview/{preview['id']}/apply").json()["version"] == 2
    with app.state.sessions() as db:
        assert db.get(Dataset, key).original_bytes == content
    assert guest.post(f"/api/datasets/{key}/column-suggestions", json=body).status_code == 409


def test_dataset_listing_reads_metadata_without_binary_or_record_payloads(guest, app):
    guest.post("/api/datasets/sample")
    statements = []

    def capture(connection, cursor, statement, parameters, context, many):
        statements.append(statement.lower())

    event.listen(app.state.engine, "before_cursor_execute", capture)
    try:
        response = guest.get("/api/datasets")
        assert response.status_code == 200 and response.json()["items"][0]["rows"] == 6
    finally:
        event.remove(app.state.engine, "before_cursor_execute", capture)
    assert not any("datasets.records" in s or "datasets.original_bytes" in s for s in statements)
