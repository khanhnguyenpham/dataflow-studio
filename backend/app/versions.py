import csv
from datetime import timedelta
from io import BytesIO, StringIO
import json

from fastapi import APIRouter, Depends, Request, Response
from openpyxl import Workbook
from openpyxl.cell import WriteOnlyCell
from openpyxl.cell.cell import ILLEGAL_CHARACTERS_RE
from pydantic import Field
from sqlalchemy import delete, func, select

from .auth import identity, limited, session_db
from .db import DatasetVersion, Preview, User, as_utc, now
from .errors import Problem
from .processing import profile
from .transforms import Step, Strict, apply_steps
from .workspace import check_storage, materialize, owned, payload_budget, summary

router = APIRouter(prefix="/datasets")


class PreviewRequest(Strict):
    expected_version: int = Field(ge=1)
    steps: list[Step] = Field(min_length=1, max_length=20)


class RestoreRequest(Strict):
    expected_version: int = Field(ge=1)
    version: int = Field(ge=1)


class ExportRequest(Strict):
    expected_version: int = Field(ge=1)
    format: str = Field(pattern="^(csv|xlsx|json|quality)$")
    confirmed: bool


def lock_owner(db, user):
    if db.scalar(select(User).where(User.id == user.id).with_for_update()) is None:
        raise Problem("unauthorized", 401)


@router.post("/{key}/preview")
def preview(key: str, body: PreviewRequest, request: Request, user=Depends(identity), db=Depends(session_db)):
    limited(request, "preview", 30, 60)
    lock_owner(db, user)
    row = owned(db, user, key, lock=True)
    if row.current_version != body.expected_version:
        raise Problem("stale_version", 409)
    db.execute(delete(Preview).where(Preview.owner_id == user.id, Preview.expires_at < now()))
    # A newly previewed recipe supersedes this dataset's previous pending draft.
    db.execute(
        delete(Preview).where(Preview.owner_id == user.id, Preview.dataset_id == key, Preview.applied_version.is_(None))
    )
    pending = db.scalar(
        select(func.count()).select_from(Preview).where(Preview.owner_id == user.id, Preview.applied_version.is_(None))
    )
    if pending >= 3:
        raise Problem("preview_limit", 429)
    old_columns, old_records = materialize(db, row)
    columns, records, impacts = apply_steps(old_columns, old_records, body.steps, request.app.state.settings)
    if len(json.dumps([columns, records], ensure_ascii=False).encode()) > request.app.state.settings.max_bytes * 2:
        raise Problem("dataset_limit", 413)
    result = {
        "columns": columns,
        "records": records,
        "impacts": impacts,
        "changed": columns != old_columns or records != old_records,
    }
    check_storage(db, user, payload_budget(result))
    saved = Preview(
        dataset_id=row.id,
        owner_id=user.id,
        input_version=row.current_version,
        result=result,
        steps=[s.model_dump() for s in body.steps],
        expires_at=now() + timedelta(minutes=15),
    )
    db.add(saved)
    db.commit()
    return {
        "id": saved.id,
        "input_version": saved.input_version,
        "expires_at": saved.expires_at,
        "before": {"columns": old_columns, "records": old_records[:10], "rows": len(old_records)},
        "after": {"columns": columns, "records": records[:10], "rows": len(records)},
        "impacts": impacts,
        "changed": result["changed"],
    }


@router.post("/{key}/preview/{preview_id}/apply")
def apply(key: str, preview_id: str, user=Depends(identity), db=Depends(session_db)):
    lock_owner(db, user)
    row = owned(db, user, key, lock=True)
    saved = db.scalar(
        select(Preview).where(Preview.id == preview_id, Preview.dataset_id == key, Preview.owner_id == user.id)
    )
    if saved is None:
        raise Problem("preview_not_found", 404)
    if saved.applied_version is not None:
        return {**summary(db, row), "applied_version": saved.applied_version}
    if as_utc(saved.expires_at) <= now():
        raise Problem("preview_expired", 409)
    if saved.input_version != row.current_version:
        raise Problem("stale_version", 409)
    if not saved.result["changed"]:
        raise Problem("no_changes", 409)
    count = db.scalar(select(func.count()).select_from(DatasetVersion).where(DatasetVersion.dataset_id == row.id))
    if count >= (5 if user.role == "guest" else 20):
        raise Problem("version_limit", 413)
    highest = db.scalar(select(func.max(DatasetVersion.number)).where(DatasetVersion.dataset_id == row.id)) or 1
    version = DatasetVersion(
        dataset_id=row.id,
        number=highest + 1,
        parent_number=row.current_version,
        columns=saved.result["columns"],
        records=saved.result["records"],
        row_count=len(saved.result["records"]),
        steps=saved.steps,
    )
    check_storage(db, user, payload_budget([version.columns, version.records, version.steps]))
    db.add(version)
    row.current_version, saved.applied_version = version.number, version.number
    db.commit()
    return {**summary(db, row), "applied_version": version.number}


@router.get("/{key}/versions")
def versions(key: str, user=Depends(identity), db=Depends(session_db)):
    row = owned(db, user, key)
    derived = db.execute(
        select(
            DatasetVersion.number,
            DatasetVersion.parent_number,
            DatasetVersion.row_count,
            DatasetVersion.created_at,
            DatasetVersion.steps,
        )
        .where(DatasetVersion.dataset_id == key)
        .order_by(DatasetVersion.number)
    )
    return {
        "current": row.current_version,
        "items": [{"number": 1, "parent": None, "rows": row.row_count, "created_at": row.created_at, "steps": []}]
        + [
            {
                "number": v.number,
                "parent": v.parent_number,
                "rows": v.row_count,
                "created_at": v.created_at,
                "steps": v.steps,
            }
            for v in derived
        ],
    }


@router.post("/{key}/restore")
def restore(key: str, body: RestoreRequest, user=Depends(identity), db=Depends(session_db)):
    lock_owner(db, user)
    row = owned(db, user, key, lock=True)
    if row.current_version != body.expected_version:
        raise Problem("stale_version", 409)
    materialize(db, row, body.version)
    row.current_version = body.version
    db.commit()
    return summary(db, row)


def escaped(value):
    if value is not None and (value.startswith(("\t", "\r", "\n")) or value.lstrip().startswith(("=", "+", "-", "@"))):
        return "'" + value
    return value or ""


@router.post("/{key}/export")
def export(key: str, body: ExportRequest, request: Request, user=Depends(identity), db=Depends(session_db)):
    limited(request, "export", 15, 60)
    row = owned(db, user, key)
    if not body.confirmed:
        raise Problem("confirmation_required")
    if row.current_version != body.expected_version:
        raise Problem("stale_version", 409)
    columns, records = materialize(db, row)
    headers = {
        "Content-Disposition": f'attachment; filename="dataflow-v{row.current_version}.{body.format if body.format != "quality" else "json"}"'
    }
    if body.format == "csv":
        buffer = StringIO(newline="")
        writer = csv.writer(buffer)
        writer.writerows([[escaped(c) for c in columns]] + [[escaped(v) for v in r] for r in records])
        headers["X-Dataflow-Escaped-Cells"] = str(sum(escaped(v) != (v or "") for r in [columns] + records for v in r))
        return Response(buffer.getvalue().encode("utf-8-sig"), media_type="text/csv", headers=headers)
    if body.format == "xlsx":
        if any(
            value is not None and (len(value) > 32767 or ILLEGAL_CHARACTERS_RE.search(value))
            for values in [columns] + records
            for value in values
        ):
            raise Problem("xlsx_values", 422)
        book = Workbook(write_only=True)
        sheet = book.create_sheet("Data")
        for values in [columns] + records:
            cells = []
            for value in values:
                cell = WriteOnlyCell(sheet, value=value)
                if value is not None:
                    cell.data_type = "s"
                cells.append(cell)
            sheet.append(cells)
        buffer = BytesIO()
        book.save(buffer)
        return Response(
            buffer.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers=headers,
        )
    result = {"columns": columns, "records": records, "version": row.current_version}
    if body.format == "quality":
        lineage, number = [], row.current_version
        while number != 1:
            version = db.execute(
                select(DatasetVersion.number, DatasetVersion.parent_number, DatasetVersion.steps).where(
                    DatasetVersion.dataset_id == key, DatasetVersion.number == number
                )
            ).one()
            lineage.append({"version": version.number, "parent": version.parent_number, "steps": version.steps})
            number = version.parent_number
        result = {
            "dataset": row.name,
            "version": row.current_version,
            "quality": profile(columns, records),
            "source_checksum": row.source_sha256,
            "source_unchanged": True,
            "lineage": lineage[::-1],
        }
    return Response(json.dumps(result, ensure_ascii=False).encode(), media_type="application/json", headers=headers)
