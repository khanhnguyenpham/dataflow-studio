from datetime import timedelta
import hashlib
import json
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import Field, TypeAdapter
from sqlalchemy import func, select

from .auth import identity, limited, session_db
from .audit import record
from .limits import cap, current_limits
from .aggregation import AggregateSpec, aggregate, result_columns
from .db import Preview, as_utc, now
from .errors import Problem
from .integration import IntegrationSpec, combine_tables
from .transforms import Step, Strict, apply_steps
from .workflow_models import Workflow, WorkflowRun, WorkflowVersion
from .workspace import check_storage, lock_owner, materialize, owned, payload_budget, preview_view, save_preview

router = APIRouter(prefix="/workflows")
step_adapter = TypeAdapter(list[Step])


class DefinitionRequest(Strict):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=1000)
    dataset_id: str = Field(max_length=36)
    expected_version: int = Field(ge=1)
    steps: list[Step] = Field(default_factory=list, max_length=20)
    integration: IntegrationSpec | None = None
    aggregation: AggregateSpec | None = None
    right_dataset_id: str | None = Field(default=None, max_length=36)
    expected_workflow_version: int | None = Field(default=None, ge=1)


class RunRequest(Strict):
    idempotency_key: UUID
    workflow_version: int = Field(ge=1)
    dataset_id: str = Field(max_length=36)
    expected_version: int = Field(ge=1)
    right_dataset_id: str | None = Field(default=None, max_length=36)
    expected_right_version: int | None = Field(default=None, ge=1)


def owned_workflow(db, user, key):
    row = db.scalar(select(Workflow).where(Workflow.id == key, Workflow.owner_id == user.id))
    if row is None:
        raise Problem("workflow_not_found", 404)
    return row


def definition(db, key, version):
    value = db.scalar(
        select(WorkflowVersion).where(WorkflowVersion.workflow_id == key, WorkflowVersion.number == version)
    )
    if value is None:
        raise Problem("version_not_found", 404)
    return value.definition


def view(row):
    return {
        "id": row.id,
        "name": row.name,
        "description": row.description,
        "version": row.current_version,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def run_view(row):
    return {
        "id": row.id,
        "workflow_id": row.workflow_id,
        "workflow_version": row.workflow_version,
        "dataset_id": row.source_dataset_id,
        "source_version": row.source_version,
        "right_dataset_id": row.right_dataset_id,
        "right_version": row.right_version,
        "status": row.status,
        "preview_id": row.result_preview,
        "summary": row.result_summary if row.status != "failed" else None,
        "error_details": row.result_summary if row.status == "failed" else None,
        "error_code": row.error_code,
        "created_at": row.created_at,
        "started_at": row.started_at,
        "finished_at": row.finished_at,
    }


@router.get("")
def listing(user=Depends(identity), db=Depends(session_db)):
    return {
        "items": [
            view(row)
            for row in db.scalars(
                select(Workflow).where(Workflow.owner_id == user.id).order_by(Workflow.updated_at.desc())
            )
        ]
    }


def save_definition(db, user, body, settings, row=None):
    lock_owner(db, user)
    source = owned(db, user, body.dataset_id)
    if source.current_version != body.expected_version:
        raise Problem("stale_version", 409)
    columns, records = materialize(db, source)
    cleaned_columns, cleaned_records, _ = apply_steps(columns, records, body.steps, settings)
    result = {
        "input_schema": columns,
        "steps": [s.model_dump() for s in body.steps],
        "integration": None,
        "aggregation": body.aggregation.model_dump() if body.aggregation else None,
    }
    if body.integration:
        if not body.right_dataset_id or body.right_dataset_id == source.id:
            raise Problem("right_dataset_required")
        right = owned(db, user, body.right_dataset_id)
        right_columns, right_records = materialize(db, right)
        cleaned_columns, cleaned_records, _ = combine_tables(
            cleaned_columns, cleaned_records, right_columns, right_records, body.integration, settings
        )
        result["integration"] = {**body.integration.model_dump(), "right_schema": right_columns}
    elif body.right_dataset_id:
        raise Problem("invalid_request")
    if body.aggregation:
        aggregate(cleaned_columns, cleaned_records, body.aggregation, settings)
        result_columns(body.aggregation)
    if not body.steps and not body.integration and not body.aggregation:
        raise Problem("empty_workflow")
    if len(json.dumps(result).encode()) > 65536:
        raise Problem("dataset_limit", 413)
    check_storage(db, user, payload_budget(result))
    if row is None:
        count = db.scalar(select(func.count()).select_from(Workflow).where(Workflow.owner_id == user.id))
        if count >= cap(current_limits(db), user, "workflows"):
            raise Problem("workflow_limit", 413)
        row = Workflow(owner_id=user.id, name=body.name.strip(), description=body.description, current_version=1)
        db.add(row)
        db.flush()
    else:
        # Refresh after the owner lock: two edits must not overwrite one another.
        db.refresh(row)
        if body.expected_workflow_version != row.current_version:
            raise Problem("stale_version", 409)
        if row.current_version >= 10:
            raise Problem("version_limit", 413)
        row.current_version += 1
    if not body.name.strip():
        raise Problem("invalid_request")
    row.name, row.description, row.updated_at = body.name.strip(), body.description, now()
    db.add(
        WorkflowVersion(
            workflow_id=row.id, number=row.current_version, definition=result, storage_bytes=payload_budget(result)
        )
    )
    record(db, user, "workflow.saved", row.id, {"version": row.current_version})
    db.commit()
    return {**view(row), "definition": result}


@router.post("", status_code=201)
def create(body: DefinitionRequest, request: Request, user=Depends(identity), db=Depends(session_db)):
    limited(request, "workflow-save", 20, 60)
    return save_definition(db, user, body, request.app.state.settings)


@router.get("/{key}")
def detail(key: str, user=Depends(identity), db=Depends(session_db)):
    row = owned_workflow(db, user, key)
    history = db.scalars(
        select(WorkflowVersion.number).where(WorkflowVersion.workflow_id == key).order_by(WorkflowVersion.number)
    )
    return {**view(row), "definition": definition(db, key, row.current_version), "versions": list(history)}


@router.post("/{key}")
def update(key: str, body: DefinitionRequest, request: Request, user=Depends(identity), db=Depends(session_db)):
    limited(request, "workflow-save", 20, 60)
    return save_definition(db, user, body, request.app.state.settings, owned_workflow(db, user, key))


@router.delete("/{key}", status_code=204)
def remove(key: str, user=Depends(identity), db=Depends(session_db)):
    lock_owner(db, user)
    db.delete(owned_workflow(db, user, key))
    record(db, user, "workflow.deleted", key)
    db.commit()


@router.post("/{key}/runs", status_code=201)
def enqueue(key: str, body: RunRequest, request: Request, user=Depends(identity), db=Depends(session_db)):
    limited(request, "workflow-run", 20, 60)
    lock_owner(db, user)
    owned_workflow(db, user, key)
    fingerprint = hashlib.sha256(body.model_dump_json().encode()).hexdigest()
    existing = db.scalar(
        select(WorkflowRun).where(
            WorkflowRun.workflow_id == key, WorkflowRun.idempotency_key == str(body.idempotency_key)
        )
    )
    if existing:
        if existing.request_hash != fingerprint:
            raise Problem("idempotency_conflict", 409)
        return run_view(existing)
    spec = definition(db, key, body.workflow_version)
    source = owned(db, user, body.dataset_id)
    if source.current_version != body.expected_version:
        raise Problem("stale_version", 409)
    right_version = None
    if spec["integration"]:
        if not body.right_dataset_id or body.right_dataset_id == source.id:
            raise Problem("right_dataset_required")
        right = owned(db, user, body.right_dataset_id)
        if right.current_version != body.expected_right_version:
            raise Problem("stale_version", 409)
        right_version = right.current_version
    elif body.right_dataset_id:
        raise Problem("invalid_request")
    count = db.scalar(select(func.count()).select_from(WorkflowRun).join(Workflow).where(Workflow.owner_id == user.id))
    if count >= cap(current_limits(db), user, "runs"):
        raise Problem("run_limit", 413)
    row = WorkflowRun(
        workflow_id=key,
        workflow_version=body.workflow_version,
        source_dataset_id=source.id,
        source_version=source.current_version,
        right_dataset_id=body.right_dataset_id,
        right_version=right_version,
        idempotency_key=str(body.idempotency_key),
        request_hash=fingerprint,
        status="pending",
    )
    db.add(row)
    db.commit()
    return run_view(row)


def owned_run(db, user, key, run_id):
    owned_workflow(db, user, key)
    row = db.scalar(select(WorkflowRun).where(WorkflowRun.id == run_id, WorkflowRun.workflow_id == key))
    if row is None:
        raise Problem("run_not_found", 404)
    return row


@router.get("/{key}/runs")
def history(key: str, user=Depends(identity), db=Depends(session_db)):
    owned_workflow(db, user, key)
    return {
        "items": [
            run_view(row)
            for row in db.scalars(
                select(WorkflowRun).where(WorkflowRun.workflow_id == key).order_by(WorkflowRun.created_at.desc())
            )
        ]
    }


@router.post("/{key}/runs/{run_id}/execute")
def execute(key: str, run_id: str, request: Request, user=Depends(identity), db=Depends(session_db)):
    limited(request, "workflow-execute", 20, 60)
    lock_owner(db, user)
    row = owned_run(db, user, key, run_id)
    if row.status == "running" and as_utc(row.started_at) < now() - timedelta(minutes=2):
        row.status, row.error_code, row.finished_at = "failed", "execution_interrupted", now()
        db.commit()
    if row.status != "pending":
        return run_view(row)
    row.status, row.started_at = "running", now()
    db.commit()  # The running state is real and survives a failed processing request.
    try:
        lock_owner(db, user)
        source = owned(db, user, row.source_dataset_id, lock=True)
        if source.current_version != row.source_version:
            raise Problem("stale_version", 409)
        spec = definition(db, key, row.workflow_version)
        columns, records = materialize(db, source, row.source_version)
        if columns != spec["input_schema"]:
            raise Problem(
                "schema_drift",
                details={
                    "missing_columns": [c for c in spec["input_schema"] if c not in columns],
                    "unexpected_columns": [c for c in columns if c not in spec["input_schema"]],
                    "order_changed": set(columns) == set(spec["input_schema"]),
                },
            )
        columns, records, impacts = apply_steps(
            columns, records, step_adapter.validate_python(spec["steps"]), request.app.state.settings
        )
        stats, steps = {}, list(spec["steps"])
        if spec["integration"]:
            right = owned(db, user, row.right_dataset_id)
            right_columns, right_records = materialize(db, right, row.right_version)
            integration = dict(spec["integration"])
            if right_columns != integration.pop("right_schema"):
                raise Problem("schema_drift")
            before = len(records)
            columns, records, stats = combine_tables(
                columns,
                records,
                right_columns,
                right_records,
                IntegrationSpec.model_validate(integration),
                request.app.state.settings,
            )
            impacts.append(
                {"op": integration["mode"], "rows_before": before, "rows_after": len(records), "cell_updates": 0}
            )
            steps.append(
                {
                    "op": integration["mode"],
                    "right_dataset_id": right.id,
                    "right_version": row.right_version,
                    **integration,
                }
            )
        if spec.get("aggregation"):
            config = AggregateSpec.model_validate(spec["aggregation"])
            before = len(records)
            totals = aggregate(columns, records, config, request.app.state.settings)
            columns = result_columns(config)
            records = [[item["group"], item["value"], str(item["rows"])] for item in totals["items"]]
            impacts.append({"op": "aggregate", "rows_before": before, "rows_after": len(records), "cell_updates": 0})
            steps.append({"op": "aggregate", **config.model_dump()})
        saved = save_preview(
            db,
            user,
            source,
            columns,
            records,
            steps,
            impacts,
            request.app.state.settings,
            {"workflow_id": key, "workflow_version": row.workflow_version, "integration": stats},
        )
        row.result_preview, row.result_summary = saved.id, {"rows": len(records), "columns": len(columns), **stats}
        row.status, row.finished_at = "completed", now()
        db.commit()
    except Exception as error:
        db.rollback()
        # No uploaded values or SQL details in logs or error history.
        logging.getLogger("dataflow").error("Workflow execution failed: %s", type(error).__name__)
        lock_owner(db, user)
        row = owned_run(db, user, key, run_id)
        row.status, row.finished_at = "failed", now()
        row.error_code = error.code if isinstance(error, Problem) else "execution_failed"
        row.result_summary = error.details if isinstance(error, Problem) else None
        db.commit()
    return run_view(row)


@router.get("/{key}/runs/{run_id}/result")
def result(key: str, run_id: str, user=Depends(identity), db=Depends(session_db)):
    row = owned_run(db, user, key, run_id)
    saved = db.get(Preview, row.result_preview) if row.result_preview else None
    if saved is None or as_utc(saved.expires_at) <= now():
        raise Problem("preview_expired", 409)
    source = owned(db, user, row.source_dataset_id)
    return preview_view(saved, *materialize(db, source, row.source_version))
