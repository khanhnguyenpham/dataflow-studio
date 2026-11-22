from pydantic import Field
from sqlalchemy import func, select
from .admin_models import SiteConfig
from .db import Dataset, DatasetVersion, Preview
from .errors import Problem
from .report_models import Report
from .transforms import Strict
from .workflow_models import Workflow, WorkflowVersion


class Limits(Strict):
    guest_datasets: int = Field(default=3, ge=1, le=10)
    user_datasets: int = Field(default=30, ge=1, le=100)
    guest_source_mb: int = Field(default=10, ge=1, le=20)
    user_source_mb: int = Field(default=50, ge=5, le=200)
    guest_storage_mb: int = Field(default=64, ge=8, le=128)
    user_storage_mb: int = Field(default=256, ge=16, le=512)
    guest_versions: int = Field(default=5, ge=1, le=10)
    user_versions: int = Field(default=20, ge=1, le=30)
    guest_workflows: int = Field(default=5, ge=1, le=10)
    user_workflows: int = Field(default=20, ge=1, le=50)
    guest_runs: int = Field(default=30, ge=1, le=50)
    user_runs: int = Field(default=200, ge=1, le=500)
    guest_reports: int = Field(default=10, ge=1, le=20)
    user_reports: int = Field(default=30, ge=1, le=100)
    active_guest_limit: int = Field(default=20, ge=1, le=50)
    global_storage_mb: int = Field(default=256, ge=64, le=4096)


def config_row(db, lock=False):
    query = select(SiteConfig).where(SiteConfig.id == 1).execution_options(populate_existing=True)
    row = db.scalar(query.with_for_update() if lock else query)
    if row is None:
        raise Problem("database_unavailable", 503)
    return row


def current_limits(db):
    return Limits.model_validate(config_row(db).limits)


def cap(limits, user, name):
    return getattr(limits, ("guest_" if user.role == "guest" else "user_") + name)


def storage_usage(db, owner_id=None):
    total = 0
    for model in [Dataset, DatasetVersion, Preview, WorkflowVersion, Report]:
        query = select(func.coalesce(func.sum(model.storage_bytes), 0))
        if owner_id:
            if model == DatasetVersion:
                query = query.join(Dataset).where(Dataset.owner_id == owner_id)
            elif model == WorkflowVersion:
                query = query.join(Workflow).where(Workflow.owner_id == owner_id)
            else:
                query = query.where(model.owner_id == owner_id)
        total += db.scalar(query)
    return total
