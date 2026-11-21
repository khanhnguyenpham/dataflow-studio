import re
from typing import Literal
from fastapi import APIRouter, Depends, Request
from pydantic import Field
from sqlalchemy import delete, func, select
from .admin_models import AuditLog
from .audit import record
from .auth import hasher, identity, limited, session_db
from .db import Dataset, LoginSession, User, now
from .errors import Problem
from .limits import Limits, config_row, current_limits, storage_usage
from .maintenance import prune
from .transforms import Strict
from .workflow_models import Workflow, WorkflowRun
from .workspace import lock_owner

router = APIRouter(prefix="/admin")


def require_admin(user=Depends(identity)):
    if user.role != "admin":
        raise Problem("forbidden", 403)
    return user


def admin_lock(db, user):
    lock_owner(db, user)
    if user.role != "admin":
        raise Problem("forbidden", 403)


def user_view(row):
    return {
        "id": row.id,
        "username": row.username,
        "role": row.role,
        "active": row.active,
        "created_at": row.created_at,
    }


class CreateUser(Strict):
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=12, max_length=128)
    role: Literal["user", "admin"] = "user"


class UpdateUser(Strict):
    active: bool
    role: Literal["user", "admin"]


class ResetPassword(Strict):
    password: str = Field(min_length=12, max_length=128)


class UpdateLimits(Strict):
    expected_revision: int = Field(ge=1)
    limits: Limits


@router.get("/status")
def status(user=Depends(require_admin), db=Depends(session_db)):
    def count(model, condition=None):
        query = select(func.count()).select_from(model)
        return db.scalar(query.where(condition) if condition is not None else query)

    return {
        "users": count(User, User.role != "guest"),
        "active_guests": count(User, (User.role == "guest") & (User.expires_at > now())),
        "datasets": count(Dataset),
        "workflows": count(Workflow),
        "runs": count(WorkflowRun),
        "failed_runs": count(WorkflowRun, WorkflowRun.status == "failed"),
        "payload_bytes": storage_usage(db),
        "global_storage_mb": current_limits(db).global_storage_mb,
        "retention_interval_seconds": 60,
    }


@router.get("/users")
def users(page: int = 1, page_size: int = 25, user=Depends(require_admin), db=Depends(session_db)):
    if page < 1 or not 1 <= page_size <= 50:
        raise Problem("invalid_page")
    total = db.scalar(select(func.count()).select_from(User).where(User.role != "guest"))
    rows = db.execute(
        select(User.id, User.username, User.role, User.active, User.created_at)
        .where(User.role != "guest")
        .order_by(User.created_at, User.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return {"items": [user_view(row) for row in rows], "total": total, "page": page}


@router.post("/users", status_code=201)
def create_user(body: CreateUser, request: Request, user=Depends(require_admin), db=Depends(session_db)):
    limited(request, "admin-account", 10, 60)
    admin_lock(db, user)
    username = body.username.strip().casefold()
    if not re.fullmatch(r"[a-z0-9._-]{3,100}", username):
        raise Problem("invalid_username")
    if db.scalar(select(User.id).where(User.username == username)):
        raise Problem("username_exists", 409)
    if db.scalar(select(func.count()).select_from(User).where(User.role != "guest")) >= 100:
        raise Problem("account_limit", 413)
    row = User(username=username, role=body.role, password_hash=hasher.hash(body.password), active=True)
    db.add(row)
    db.flush()
    record(db, user, "account.created", row.id, {"role": row.role})
    db.commit()
    return user_view(row)


@router.post("/users/{key}")
def update_user(key: str, body: UpdateUser, request: Request, user=Depends(require_admin), db=Depends(session_db)):
    limited(request, "admin-account", 10, 60)
    admin_lock(db, user)
    row = db.get(User, key)
    if row is None or row.role == "guest":
        raise Problem("account_not_found", 404)
    if row.active and row.role == "admin" and (not body.active or body.role != "admin"):
        active = db.scalar(select(func.count()).select_from(User).where(User.active.is_(True), User.role == "admin"))
        if active <= 1:
            raise Problem("last_admin", 409)
    if row.active != body.active or row.role != body.role:
        row.active, row.role = body.active, body.role
        db.execute(delete(LoginSession).where(LoginSession.user_id == key))
        record(db, user, "account.updated", key, {"active": body.active, "role": body.role})
    db.commit()
    return user_view(row)


@router.post("/users/{key}/password", status_code=204)
def reset_password(
    key: str, body: ResetPassword, request: Request, user=Depends(require_admin), db=Depends(session_db)
):
    limited(request, "admin-account", 10, 60)
    admin_lock(db, user)
    row = db.get(User, key)
    if row is None or row.role == "guest":
        raise Problem("account_not_found", 404)
    row.password_hash = hasher.hash(body.password)
    db.execute(delete(LoginSession).where(LoginSession.user_id == key))
    record(db, user, "account.password_reset", key)
    db.commit()


@router.get("/limits")
def limits(user=Depends(require_admin), db=Depends(session_db)):
    row = config_row(db)
    return {"revision": row.revision, "limits": row.limits, "fields": Limits.model_json_schema()["properties"]}


@router.post("/limits")
def update_limits(body: UpdateLimits, user=Depends(require_admin), db=Depends(session_db)):
    admin_lock(db, user)
    row = config_row(db)
    if row.revision != body.expected_revision:
        raise Problem("stale_version", 409)
    changed = [key for key, value in body.limits.model_dump().items() if value != row.limits.get(key)]
    row.limits, row.revision = body.limits.model_dump(), row.revision + 1
    record(db, user, "limits.updated", details={"fields": changed, "revision": row.revision})
    db.commit()
    return {"revision": row.revision, "limits": row.limits, "fields": Limits.model_json_schema()["properties"]}


@router.get("/audit")
def audit(page: int = 1, page_size: int = 25, user=Depends(require_admin), db=Depends(session_db)):
    if page < 1 or not 1 <= page_size <= 100:
        raise Problem("invalid_page")
    total = db.scalar(select(func.count()).select_from(AuditLog))
    rows = db.scalars(
        select(AuditLog)
        .order_by(AuditLog.created_at.desc(), AuditLog.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return {
        "items": [
            {
                "id": row.id,
                "actor_id": row.actor_id,
                "action": row.action,
                "target_id": row.target_id,
                "details": row.details,
                "created_at": row.created_at,
            }
            for row in rows
        ],
        "total": total,
        "page": page,
    }


@router.post("/maintenance")
def cleanup(user=Depends(require_admin), db=Depends(session_db)):
    admin_lock(db, user)
    return prune(db)


@router.get("/runs")
def runs(
    page: int = 1,
    state: Literal["pending", "running", "completed", "failed"] | None = None,
    user=Depends(require_admin),
    db=Depends(session_db),
):
    if page < 1:
        raise Problem("invalid_page")
    condition = WorkflowRun.status == state if state else True
    total = db.scalar(select(func.count()).select_from(WorkflowRun).where(condition))
    rows = db.execute(
        select(
            WorkflowRun.id,
            WorkflowRun.workflow_version,
            WorkflowRun.status,
            WorkflowRun.error_code,
            WorkflowRun.created_at,
            WorkflowRun.finished_at,
            User.username,
        )
        .select_from(WorkflowRun)
        .join(Workflow, Workflow.id == WorkflowRun.workflow_id)
        .join(User, User.id == Workflow.owner_id)
        .where(condition)
        .order_by(WorkflowRun.created_at.desc(), WorkflowRun.id)
        .offset((page - 1) * 25)
        .limit(25)
    )
    return {
        "items": [
            {
                "id": row.id,
                "workflow_version": row.workflow_version,
                "status": row.status,
                "error_code": row.error_code,
                "created_at": row.created_at,
                "finished_at": row.finished_at,
                "username": row.username,
            }
            for row in rows
        ],
        "page": page,
        "total": total,
    }
