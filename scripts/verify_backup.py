"""Exercise pg_dump/pg_restore on freshly created local fixture databases only."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from datetime import datetime, timezone

import psycopg
from psycopg import sql
from sqlalchemy import select
from sqlalchemy.engine import make_url
from app.db import Base, Dataset, User, database
from app.workspace import payload_budget

ROOT = Path(__file__).resolve().parents[1]
NAMES = ("dataflow_backup_check_source", "dataflow_backup_check_restored")


def signature(sessions):
    result = {}
    with sessions() as db:
        for table in Base.metadata.sorted_tables:
            rows = [dict(row._mapping) for row in db.execute(select(table).order_by(*table.primary_key.columns))]
            encoded = json.dumps(rows, sort_keys=True, default=lambda v: v.hex() if isinstance(v, bytes) else v.isoformat())
            result[table.name] = {"rows": len(rows), "sha256": hashlib.sha256(encoded.encode()).hexdigest()}
    return result


def main():
    url = make_url(os.environ["BACKUP_CHECK_DATABASE_URL"])
    if url.host not in {"localhost", "127.0.0.1"} or url.database != "postgres":
        raise SystemExit("Use a local PostgreSQL maintenance connection ending in /postgres.")
    binaries = Path(os.environ["PG_BIN_DIR"])
    env = {**os.environ, "PGHOST": url.host, "PGPORT": str(url.port or 5432), "PGUSER": url.username or "",
           "PGPASSWORD": url.password or "", "PGCONNECT_TIMEOUT": "5"}
    connection = psycopg.connect(host=url.host, port=url.port or 5432, user=url.username,
                                password=url.password, dbname="postgres", autocommit=True, connect_timeout=5)
    owned, engines = [], []
    try:
        existing = connection.execute("SELECT datname FROM pg_database WHERE datname = ANY(%s)", (list(NAMES),)).fetchall()
        if existing:
            raise SystemExit("Backup-check database names already exist; refusing to overwrite or delete them.")
        for name in NAMES:
            connection.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
            owned.append(name)
        source_url = url.set(drivername="postgresql+psycopg", database=NAMES[0])
        migration_env = {**os.environ, "DATABASE_URL": source_url.render_as_string(hide_password=False)}
        subprocess.run([sys.executable, "-m", "alembic", "-c", "backend/alembic.ini", "upgrade", "head"],
                       cwd=ROOT, env=migration_env, check=True, capture_output=True)
        engine, source = database(source_url.render_as_string(hide_password=False))
        engines.append(engine)
        with source() as db:
            user = User(username="backup.fixture", role="user", active=False)
            db.add(user)
            db.flush()
            content, columns, rows = b"sku,quantity\n001,2\n", ["sku", "quantity"], [["001", "2"]]
            db.add(Dataset(owner_id=user.id, name="fixture.csv", original_name="fixture.csv",
                           original_bytes=content, source_sha256=hashlib.sha256(content).hexdigest(),
                           columns=columns, records=rows, row_count=1,
                           storage_bytes=len(content) + payload_budget([columns, rows])))
            db.commit()
        folder = ROOT / ".runtime" / "backup-check"
        folder.mkdir(parents=True, exist_ok=True)
        dump = folder / "fixture.dump"
        suffix = ".exe" if os.name == "nt" else ""
        subprocess.run([str(binaries / f"pg_dump{suffix}"), "--format=custom", "--no-owner", "--no-privileges",
                        "--file", str(dump)], env={**env, "PGDATABASE": NAMES[0]}, check=True, capture_output=True)
        subprocess.run([str(binaries / f"pg_restore{suffix}"), "--exit-on-error", "--no-owner", "--no-privileges",
                        "--dbname", NAMES[1], str(dump)], env=env, check=True, capture_output=True)
        engine, restored = database(url.set(drivername="postgresql+psycopg", database=NAMES[1]).render_as_string(hide_password=False))
        engines.append(engine)
        before, after = signature(source), signature(restored)
        if before != after:
            raise SystemExit("Restored fixture does not match; no success evidence written.")
        evidence = {"recorded_at": datetime.now(timezone.utc).isoformat(), "postgres_version": connection.info.server_version,
                    "scope": "Fresh local synthetic fixture; custom-format pg_dump/pg_restore; not a cloud recovery drill.",
                    "tables_compared": len(before), "table_row_counts": {k: v["rows"] for k, v in before.items()},
                    "all_table_hashes_equal": True, "original_id_text_preserved": True}
        (ROOT / "docs/evaluation/backup-restore.json").write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(evidence))
    finally:
        for engine in engines:
            engine.dispose()
        # Only names this invocation created may be removed; existing databases fail the guard above.
        for name in reversed(owned):
            assert name in NAMES
            connection.execute(sql.SQL("DROP DATABASE {}").format(sql.Identifier(name)))
        connection.close()


if __name__ == "__main__":
    main()
