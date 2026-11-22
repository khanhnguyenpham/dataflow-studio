"""Ephemeral browser users, restricted to the separate local dataflow_e2e DB."""

import argparse
import json
import os
from pathlib import Path
import secrets
import uuid
from sqlalchemy import delete
from sqlalchemy.engine import make_url
from app.auth import hasher
from app.admin_models import SiteConfig
from app.config import Settings
from app.db import User, database
from app.limits import Limits


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["create", "cleanup"])
    args = parser.parse_args()
    settings = Settings.from_env()
    url = make_url(settings.database_url)
    if (
        url.database != "dataflow_e2e"
        or url.host not in {"localhost", "127.0.0.1"}
        or os.environ.get("APP_ENV") == "production"
    ):
        raise SystemExit("Browser fixtures require the separate local dataflow_e2e database.")
    root = Path(__file__).resolve().parents[2]
    manifest = root / ".runtime" / "browser-admin.json"
    engine, sessions = database(settings.database_url)
    with sessions() as db:
        if args.action == "cleanup":
            if manifest.exists():
                data = json.loads(manifest.read_text(encoding="utf-8"))
                db.execute(delete(User).where(User.id == data["id"], User.username == data["username"]))
                db.execute(delete(User).where(User.username == data["target_username"]))
                db.get(SiteConfig, 1).limits = Limits().model_dump()
                db.commit()
                manifest.unlink()
            print("Ephemeral browser accounts removed.")
        else:
            if manifest.exists():
                raise SystemExit("Clean up the previous browser fixture before creating another.")
            # All guest data in this dedicated test database is disposable browser input.
            db.execute(delete(User).where(User.role == "guest"))
            suffix = uuid.uuid4().hex[:12]
            data = {
                "username": "browser-" + suffix,
                "password": secrets.token_urlsafe(24),
                "target_username": "review-" + suffix,
                "target_password": secrets.token_urlsafe(24),
            }
            row = User(username=data["username"], password_hash=hasher.hash(data["password"]), role="admin")
            db.add(row)
            db.get(SiteConfig, 1).limits = Limits().model_dump()
            db.flush()
            data["id"] = row.id
            db.commit()
            manifest.parent.mkdir(exist_ok=True)
            manifest.write_text(json.dumps(data), encoding="utf-8")
            print("Ephemeral browser accounts prepared. Credentials are local and not printed.")
    engine.dispose()


if __name__ == "__main__":
    main()
