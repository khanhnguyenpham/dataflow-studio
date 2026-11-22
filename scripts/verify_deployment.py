"""Bounded HTTPS acceptance check using only newly created synthetic guest workspaces."""
import argparse
from datetime import datetime, timezone
from io import BytesIO
import json
from pathlib import Path
import re
from urllib.parse import urlsplit
from uuid import uuid4

import httpx
from openpyxl import load_workbook


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    origin = args.base_url.rstrip("/")
    parsed = urlsplit(origin)
    if (parsed.scheme != "https" or parsed.netloc != "dataflow-studio.onrender.com"
            or parsed.path or parsed.query or parsed.fragment or not re.fullmatch(r"[0-9a-f]{40}", args.commit)):
        raise SystemExit("Use the verified DataFlow HTTPS origin and a verified full commit SHA.")
    checks, created, report_id, workflow_id = {}, [], None, None

    def check(name, condition):
        if not condition:
            raise RuntimeError(f"Acceptance check failed: {name}")
        checks[name] = True

    def request(client, method, path, expected=200, **kwargs):
        response = client.request(method, "/api" + path, **kwargs)
        check(f"{method} {path.split('/')[1]} status {expected}", response.status_code == expected)
        return response

    with httpx.Client(base_url=origin, timeout=60, headers={"Origin": origin}) as owner, httpx.Client(
        base_url=origin, timeout=60, headers={"Origin": origin}
    ) as other:
        health = request(owner, "GET", "/health")
        check("healthy PostgreSQL service", health.json()["status"] == "ok")
        check("security response headers", all(name in health.headers for name in [
            "content-security-policy", "x-content-type-options", "referrer-policy"
        ]))
        request(owner, "GET", "/datasets", expected=401)
        for client in [owner, other]:
            response = request(client, "POST", "/auth/guest")
            cookie = response.headers.get("set-cookie", "").lower()
            check("secure HttpOnly SameSite guest cookie", all(flag in cookie for flag in ["secure", "httponly", "samesite=lax"]))
            client.headers["X-CSRF-Token"] = response.json()["csrf"]
        try:
            invalid = request(owner, "POST", "/datasets/import", files={"file": ("deploy-check-empty.csv", b"")}, expected=422)
            check("empty upload rejected", invalid.json()["code"] == "empty_file")

            def upload(name, content):
                result = request(owner, "POST", "/datasets/import",
                                 files={"file": ("deploy-check-" + name, content.encode())}).json()
                created.append(result["id"])
                return result["id"]

            october = upload("october.csv", "order_id,sku,qty,date\n001,P1,2,2026-10-01\n001,P1,2,2026-10-01\n002,P2,3,2026-10-02\n")
            products = upload("products.csv", "sku,name\nP1,Pen\nP2,Book\n")
            november = upload("november.csv", "OrderID,product_code,quantity,day\n003,P1,5,2026-11-01\n004,P2,7,2026-11-02\n004,P2,7,2026-11-02\n")
            profile = request(owner, "GET", f"/datasets/{october}/profile").json()
            check("profile counts synthetic duplicate", profile["rows"] == 3 and profile["duplicate_rows"] == 1)
            request(other, "GET", f"/datasets/{october}", expected=404)
            request(other, "GET", f"/datasets/{october}/profile", expected=404)
            request(owner, "GET", "/admin/status", expected=403)
            request(owner, "POST", f"/datasets/{october}/preview",
                    json={"expected_version": 1, "steps": [{"op": "dedupe", "columns": ["order_id"]}]},
                    headers={"X-CSRF-Token": ""}, expected=403)
            wrong_date = request(owner, "POST", f"/datasets/{october}/preview",
                                 json={"expected_version": 1, "steps": [{"op": "date", "column": "date", "formats": ["%d/%m/%Y"]}]},
                                 expected=422)
            check("explicit date mismatch rejected", wrong_date.json()["code"] == "invalid_values")

            workflow = request(owner, "POST", "/workflows", expected=201, json={
                "name": "Deployment verification — synthetic", "description": "New guest fixtures only",
                "dataset_id": october, "expected_version": 1,
                "steps": [{"op": "dedupe", "columns": ["order_id"]}, {"op": "validate", "column": "qty", "rule": "number"}],
                "integration": {"mode": "left", "left_key": "sku", "right_key": "sku"},
                "right_dataset_id": products,
            }).json()
            workflow_id = workflow["id"]
            request(other, "GET", f"/workflows/{workflow_id}", expected=404)

            def run(source, version):
                body = {"idempotency_key": str(uuid4()), "workflow_version": 1, "dataset_id": source,
                        "expected_version": version, "right_dataset_id": products, "expected_right_version": 1}
                queued = request(owner, "POST", f"/workflows/{workflow_id}/runs", expected=201, json=body).json()
                repeated = request(owner, "POST", f"/workflows/{workflow_id}/runs", expected=201, json=body).json()
                check("execution submission idempotency", queued["id"] == repeated["id"])
                done = request(owner, "POST", f"/workflows/{workflow_id}/runs/{queued['id']}/execute").json()
                return done

            def apply(source, preview_id):
                return request(owner, "POST", f"/datasets/{source}/preview/{preview_id}/apply").json()

            first = run(october, 1)
            check("October workflow completed", first["status"] == "completed")
            preview = request(owner, "GET", f"/workflows/{workflow_id}/runs/{first['id']}/result").json()
            check("join result has expected labels and leading-zero IDs", preview["after"]["records"] == [
                ["001", "P1", "2", "2026-10-01", "Pen"], ["002", "P2", "3", "2026-10-02", "Book"]
            ])
            check("preview preserves source until confirmation", request(owner, "GET", f"/datasets/{october}").json()["version"] == 1)
            check("explicit workflow apply", apply(october, first["preview_id"])["version"] == 2)
            drift = run(november, 1)
            check("new-month schema drift is visible", drift["status"] == "failed" and drift["error_code"] == "schema_drift")
            suggestions = request(owner, "POST", f"/datasets/{november}/column-suggestions", json={
                "expected_version": 1, "targets": ["order_id", "sku", "qty", "date"],
            }).json()
            check("mapping remains review-only", suggestions["requires_confirmation"] is True)
            mapped = request(owner, "POST", f"/datasets/{november}/preview", json={
                "expected_version": 1, "steps": [{"op": "map_columns", "keep_extras": False, "mapping": [
                    {"source": source, "target": target} for source, target in [
                        ("OrderID", "order_id"), ("product_code", "sku"), ("quantity", "qty"), ("day", "date")
                    ]
                ]}],
            }).json()
            apply(november, mapped["id"])
            second = run(november, 2)
            check("saved definition reused on aligned November", second["status"] == "completed")
            apply(november, second["preview_id"])
            report_request = {"dataset_id": november, "expected_version": 3, "name": "Synthetic November total",
                              "confirmed": True, "specification": {"group_by": "sku", "operation": "sum",
                                                                  "measure": "qty", "chart_type": "bar"}}
            totals = request(owner, "POST", "/reports/preview", json=report_request).json()
            check("November exact reference total 12", totals["metrics"]["overall"] == "12" and totals["metrics"]["groups"] == 2)
            saved = request(owner, "POST", "/reports", expected=201, json=report_request).json()
            report_id = saved["id"]
            for format in ["csv", "xlsx", "json", "quality"]:
                response = request(owner, "POST", f"/datasets/{november}/export", json={
                    "expected_version": 3, "confirmed": True, "format": format,
                })
                check(f"{format} download not empty", bool(response.content))
                if format == "xlsx":
                    book = load_workbook(BytesIO(response.content))
                    check("XLSX retains leading-zero ID", book.active["A2"].value == "003")
                    book.close()
                elif format == "quality":
                    check("quality export preserves original source", response.json()["source_unchanged"] is True)
            exported = request(owner, "POST", f"/reports/{report_id}/export", json={"format": "json", "confirmed": True}).json()
            check("downloaded report matches server total", exported["result"]["metrics"]["overall"] == "12")
            request(other, "GET", f"/reports/{report_id}", expected=404)
            request(owner, "POST", f"/datasets/{november}/restore", json={"expected_version": 3, "version": 1})
            pinned = request(owner, "GET", f"/reports/{report_id}").json()
            check("saved report survives source restore", pinned["dataset_version"] == 3 and pinned["result"]["metrics"]["overall"] == "12")
            request(owner, "POST", "/auth/guest", headers={"Origin": "https://unrelated.invalid"}, expected=403)
        finally:
            # Only IDs returned by creates in this invocation are eligible for cleanup.
            removed = []
            if report_id:
                removed.append(owner.delete("/api/reports/" + report_id).status_code == 204)
            if workflow_id:
                removed.append(owner.delete("/api/workflows/" + workflow_id).status_code == 204)
            for key in reversed(created):
                removed.append(owner.delete("/api/datasets/" + key).status_code == 204)
            for client in [owner, other]:
                removed.append(client.post("/api/auth/logout").status_code == 204)
            check("created synthetic data removed and sessions closed", all(removed))

    result = {"recorded_at": datetime.now(timezone.utc).isoformat(), "base_url": origin,
              "deployed_commit_observed_in_console": args.commit, "checks": checks,
              "scope": "Bounded public HTTPS functional acceptance with synthetic guest data; not a load test, private admin audit or recovery drill.",
              "credentials_or_user_data_recorded": False}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"passed_checks": len(checks), "base_url": origin, "synthetic_reference_total": 12}))


if __name__ == "__main__":
    main()
