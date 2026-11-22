import hashlib
from pathlib import Path, PurePath
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import load_only

from .auth import identity, limited, session_db
from .db import Dataset
from .audit import record
from .limits import cap, current_limits
from .errors import Problem
from .processing import parse_file, profile
from .workspace import check_storage, lock_owner, materialize, owned, payload_budget, summary

router = APIRouter(prefix="/datasets")
SAMPLE = (Path(__file__).resolve().parents[2] / "sample_data" / "monthly-sales.csv").read_bytes()
SAMPLE_DIR = Path(__file__).resolve().parents[2] / "sample_data"
SAMPLES = {
    "sales": ("monthly-sales-sample.csv", SAMPLE),
    "products": ("products.csv", (SAMPLE_DIR / "products.csv").read_bytes()),
    "next-month": ("next-month-sales.csv", (SAMPLE_DIR / "next-month-sales.csv").read_bytes()),
    "variant": ("next-month-variant.csv", (SAMPLE_DIR / "next-month-variant.csv").read_bytes()),
    "inventory": ("inventory.csv", (SAMPLE_DIR / "inventory.csv").read_bytes()),
    "missing-key": ("sales-missing-key.csv", (SAMPLE_DIR / "sales-missing-key.csv").read_bytes()),
}


def save(db, user, parsed, content, filename):
    # Serialize quota checks with inserts for one owner, including concurrent requests.
    lock_owner(db, user)
    limits = current_limits(db)
    budget = len(content) + payload_budget([parsed["columns"], parsed["records"]])
    check_storage(db, user, budget)
    count, size = db.execute(
        select(func.count(Dataset.id), func.coalesce(func.sum(func.length(Dataset.original_bytes)), 0)).where(
            Dataset.owner_id == user.id
        )
    ).one()
    if count >= cap(limits, user, "datasets") or size + len(content) > cap(limits, user, "source_mb") * 1024 * 1024:
        raise Problem("workspace_limit", 413)
    filename = PurePath(filename.replace("\\", "/")).name[:255]
    row = Dataset(
        owner_id=user.id,
        name=filename,
        original_name=filename,
        original_bytes=content,
        source_sha256=hashlib.sha256(content).hexdigest(),
        source_sheet=parsed.get("sheet"),
        columns=parsed["columns"],
        records=parsed["records"],
        row_count=len(parsed["records"]),
        storage_bytes=budget,
    )
    db.add(row)
    db.flush()
    record(db, user, "dataset.imported", row.id, {"rows": row.row_count, "source_bytes": len(content)})
    db.commit()
    return summary(db, row)


@router.get("")
def datasets(user=Depends(identity), db=Depends(session_db)):
    rows = db.scalars(
        select(Dataset)
        .options(
            load_only(
                Dataset.id,
                Dataset.name,
                Dataset.row_count,
                Dataset.columns,
                Dataset.current_version,
                Dataset.source_sheet,
                Dataset.created_at,
            )
        )
        .where(Dataset.owner_id == user.id)
        .order_by(Dataset.created_at.desc())
    )
    return {"items": [summary(db, row) for row in rows]}


@router.post("/sample", status_code=201)
def sample(
    request: Request,
    kind: Literal["sales", "products", "next-month", "variant", "inventory", "missing-key"] = "sales",
    user=Depends(identity),
    db=Depends(session_db),
):
    limited(request, "import", 30, 60)
    name, content = SAMPLES[kind]
    parsed = parse_file(content, name, request.app.state.settings)
    return save(db, user, parsed, content, name)


@router.post("/import")
def import_file(
    request: Request,
    file: UploadFile = File(),
    sheet: str | None = Form(None),
    encoding: str = Form("utf-8-sig"),
    user=Depends(identity),
    db=Depends(session_db),
):
    limited(request, "import", 30, 60)
    settings = request.app.state.settings
    try:
        content = file.file.read(settings.max_bytes + 1)
    finally:
        file.file.close()
    parsed = parse_file(content, file.filename or "upload", settings, sheet, encoding)
    if parsed.get("requires_sheet"):
        return parsed
    return save(db, user, parsed, content, file.filename or "upload")


@router.get("/{key}")
def detail(key: str, page: int = 1, page_size: int = 25, user=Depends(identity), db=Depends(session_db)):
    if page < 1 or not 1 <= page_size <= 100:
        raise Problem("invalid_page")
    row = owned(db, user, key)
    columns, records = materialize(db, row)
    start = (page - 1) * page_size
    return {
        **summary(db, row),
        "column_names": columns,
        "records": records[start : start + page_size],
        "page": page,
        "page_size": page_size,
    }


@router.get("/{key}/profile")
def quality(key: str, user=Depends(identity), db=Depends(session_db)):
    row = owned(db, user, key)
    return profile(*materialize(db, row))


@router.delete("/{key}", status_code=204)
def remove(key: str, user=Depends(identity), db=Depends(session_db)):
    lock_owner(db, user)
    row = owned(db, user, key)
    record(db, user, "dataset.deleted", key)
    db.delete(row)
    db.commit()
