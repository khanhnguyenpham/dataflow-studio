import json
from fastapi import APIRouter, Depends, Request, Response
from pydantic import Field
from sqlalchemy import func, select
from .aggregation import AggregateSpec, aggregate
from .auth import identity, limited, session_db
from .audit import record
from .limits import cap, current_limits
from .errors import Problem
from .exports import csv_bytes
from .report_models import Report
from .transforms import Strict
from .workspace import check_storage, lock_owner, materialize, owned, payload_budget

router = APIRouter(prefix="/reports")


class ReportRequest(Strict):
    dataset_id: str = Field(max_length=36)
    expected_version: int = Field(ge=1)
    name: str = Field(default="", max_length=100)
    specification: AggregateSpec
    confirmed: bool


class ReportExport(Strict):
    format: str = Field(pattern="^(csv|json)$")
    confirmed: bool


def report_view(row):
    return {
        "id": row.id,
        "dataset_id": row.dataset_id,
        "dataset_version": row.dataset_version,
        "name": row.name,
        "specification": row.specification,
        "created_at": row.created_at,
    }


def owned_report(db, user, key):
    row = db.scalar(select(Report).where(Report.id == key, Report.owner_id == user.id))
    if row is None:
        raise Problem("report_not_found", 404)
    return row


def compute(db, source, version, spec, settings):
    return aggregate(*materialize(db, source, version), spec, settings)


def preview_result(db, user, body, settings):
    if not body.confirmed:
        raise Problem("confirmation_required")
    source = owned(db, user, body.dataset_id)
    if body.expected_version != source.current_version:
        raise Problem("stale_version", 409)
    return source, compute(db, source, body.expected_version, body.specification, settings)


@router.post("/preview")
def preview(body: ReportRequest, request: Request, user=Depends(identity), db=Depends(session_db)):
    limited(request, "analytics", 30, 60)
    _, result = preview_result(db, user, body, request.app.state.settings)
    return result


@router.post("", status_code=201)
def save(body: ReportRequest, request: Request, user=Depends(identity), db=Depends(session_db)):
    limited(request, "report-save", 20, 60)
    lock_owner(db, user)
    source, result = preview_result(db, user, body, request.app.state.settings)
    if not body.name.strip():
        raise Problem("invalid_request")
    count = db.scalar(select(func.count()).select_from(Report).where(Report.owner_id == user.id))
    if count >= cap(current_limits(db), user, "reports"):
        raise Problem("report_limit", 413)
    specification = body.specification.model_dump()
    check_storage(db, user, payload_budget(specification))
    row = Report(
        owner_id=user.id,
        dataset_id=source.id,
        dataset_version=source.current_version,
        name=body.name.strip(),
        storage_bytes=payload_budget(specification),
        specification=specification,
    )
    db.add(row)
    db.flush()
    record(db, user, "report.saved", row.id, {"dataset_version": row.dataset_version})
    db.commit()
    return {**report_view(row), "result": result}


@router.get("")
def listing(user=Depends(identity), db=Depends(session_db)):
    return {
        "items": [
            report_view(row)
            for row in db.scalars(select(Report).where(Report.owner_id == user.id).order_by(Report.created_at.desc()))
        ]
    }


@router.get("/{key}")
def detail(key: str, request: Request, user=Depends(identity), db=Depends(session_db)):
    row = owned_report(db, user, key)
    source = owned(db, user, row.dataset_id)
    return {
        **report_view(row),
        "result": compute(
            db, source, row.dataset_version, AggregateSpec.model_validate(row.specification), request.app.state.settings
        ),
    }


@router.delete("/{key}", status_code=204)
def remove(key: str, user=Depends(identity), db=Depends(session_db)):
    lock_owner(db, user)
    db.delete(owned_report(db, user, key))
    record(db, user, "report.deleted", key)
    db.commit()


@router.post("/{key}/export")
def export(key: str, body: ReportExport, request: Request, user=Depends(identity), db=Depends(session_db)):
    limited(request, "export", 15, 60)
    if not body.confirmed:
        raise Problem("confirmation_required")
    row = owned_report(db, user, key)
    source = owned(db, user, row.dataset_id)
    spec = AggregateSpec.model_validate(row.specification)
    result = compute(db, source, row.dataset_version, spec, request.app.state.settings)
    headers = {"Content-Disposition": f'attachment; filename="dataflow-report.{body.format}"'}
    if body.format == "csv":
        content, count = csv_bytes(
            [spec.group_by, f"{spec.operation}({spec.measure or 'rows'})", "source_rows"],
            [[item["group"], item["value"], str(item["rows"])] for item in result["items"]],
        )
        headers["X-Dataflow-Escaped-Cells"] = str(count)
        return Response(content, media_type="text/csv", headers=headers)
    payload = {
        "name": row.name,
        "dataset_version": row.dataset_version,
        "specification": row.specification,
        "result": result,
        "source_checksum": source.source_sha256,
    }
    return Response(json.dumps(payload, ensure_ascii=False).encode(), media_type="application/json", headers=headers)
