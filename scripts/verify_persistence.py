"""Hold one synthetic guest session across an operator-triggered application restart."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sys
import httpx


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    origin = args.base_url.rstrip("/")
    if origin != "https://dataflow-studio.onrender.com":
        raise SystemExit("Use only the verified DataFlow deployment origin.")
    key = None
    with httpx.Client(base_url=origin, timeout=60, headers={"Origin": origin}) as client:
        before = client.get("/api/health")
        before.raise_for_status()
        auth = client.post("/api/auth/guest")
        auth.raise_for_status()
        client.headers["X-CSRF-Token"] = auth.json()["csrf"]
        try:
            uploaded = client.post("/api/datasets/import", files={
                "file": ("deploy-persistence-synthetic.csv", b"item,quantity\n001,12\n")
            })
            uploaded.raise_for_status()
            key = uploaded.json()["id"]
            if not re.fullmatch(r"[0-9a-f-]{36}", key):
                raise RuntimeError("Unexpected created resource ID.")
            print("READY_FOR_SERVICE_RESTART (session stays in memory; no credentials printed)", flush=True)
            if sys.stdin.readline().strip() != "verify":
                raise SystemExit("Restart verification cancelled; no success evidence written.")
            after = client.get("/api/health")
            after.raise_for_status()
            saved = client.get("/api/datasets/" + key)
            saved.raise_for_status()
            value = saved.json()
            if value["version"] != 1 or value["records"] != [["001", "12"]] or value["rows"] != 1:
                raise RuntimeError("Persisted data did not match the synthetic source.")
            result = {
                "recorded_at": datetime.now(timezone.utc).isoformat(), "base_url": origin,
                "health_version_before": before.json()["version"], "health_version_after": after.json()["version"],
                "guest_session_persisted": True, "dataset_id_persisted": True, "leading_zero_id_preserved": True,
                "source_quantity": "12",
                "scope": "One newly created synthetic guest dataset across the separately observed service replacement/restart.",
                "credentials_or_resource_ids_recorded": False,
            }
        finally:
            if key:
                removed = client.delete("/api/datasets/" + key)
                if removed.status_code != 204:
                    raise RuntimeError("Synthetic persistence fixture cleanup failed.")
            client.post("/api/auth/logout")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
