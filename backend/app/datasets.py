import hashlib
from pathlib import PurePath

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from sqlalchemy import func, select

from .auth import identity, limited, session_db
from .db import Dataset
from .errors import Problem
from .processing import parse_file, profile

router = APIRouter(prefix="/datasets")
SAMPLE = (
    "Order ID,Order Date,Product Code,Quantity,Unit Price\n"
    "001,2026-10-01,P01,2,120000\n002,02/10/2026,P02,1,75000\n"
    "002,02/10/2026,P02,1,75000\n003,31/02/2026,P03,,90000\n"
    "004,2026-10-05,P04,three,100000\n005,2026-10-06,P01,250,120000\n"
).encode()


def summary(row):
    return {
        "id": row.id,
        "name": row.name,
        "rows": row.row_count,
        "columns": len(row.columns),
        "sheet": row.source_sheet,
        "created_at": row.created_at,
    }


def owned(db, user, key):
    row = db.scalar(select(Dataset).where(Dataset.id == key, Dataset.owner_id == user.id))
    if row is None:
        raise Problem("dataset_not_found", 404)
    return row


def save(db, user, parsed, content, filename):
    count, size = db.execute(
        select(func.count(Dataset.id), func.coalesce(func.sum(func.length(Dataset.original_bytes)), 0)).where(
            Dataset.owner_id == user.id
        )
    ).one()
    if (
        count >= (3 if user.role == "guest" else 30)
        or size + len(content) > (10 if user.role == "guest" else 50) * 1024 * 1024
    ):
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
    )
    db.add(row)
    db.commit()
    return summary(row)


@router.get("")
def datasets(user=Depends(identity), db=Depends(session_db)):
    rows = db.scalars(select(Dataset).where(Dataset.owner_id == user.id).order_by(Dataset.created_at.desc()))
    return {"items": [summary(row) for row in rows]}


@router.post("/sample", status_code=201)
def sample(request: Request, user=Depends(identity), db=Depends(session_db)):
    limited(request, "import", 30, 60)
    parsed = parse_file(SAMPLE, "monthly-sales-sample.csv", request.app.state.settings)
    return save(db, user, parsed, SAMPLE, "monthly-sales-sample.csv")


@router.post("/import")
async def import_file(
    request: Request,
    file: UploadFile = File(),
    sheet: str | None = Form(None),
    encoding: str = Form("utf-8-sig"),
    user=Depends(identity),
    db=Depends(session_db),
):
    limited(request, "import", 30, 60)
    settings = request.app.state.settings
    content = await file.read(settings.max_bytes + 1)
    await file.close()
    parsed = parse_file(content, file.filename or "upload", settings, sheet, encoding)
    if parsed.get("requires_sheet"):
        return parsed
    return save(db, user, parsed, content, file.filename or "upload")


@router.get("/{key}")
def detail(key: str, page: int = 1, page_size: int = 25, user=Depends(identity), db=Depends(session_db)):
    if page < 1 or not 1 <= page_size <= 100:
        raise Problem("invalid_page")
    row = owned(db, user, key)
    start = (page - 1) * page_size
    return {
        **summary(row),
        "column_names": row.columns,
        "records": row.records[start : start + page_size],
        "page": page,
        "page_size": page_size,
    }


@router.get("/{key}/profile")
def quality(key: str, user=Depends(identity), db=Depends(session_db)):
    row = owned(db, user, key)
    return profile(row.columns, row.records)


@router.delete("/{key}", status_code=204)
def remove(key: str, user=Depends(identity), db=Depends(session_db)):
    row = owned(db, user, key)
    db.delete(row)
    db.commit()
