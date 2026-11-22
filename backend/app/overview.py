"""Owner-scoped workspace metadata; never materialize uploaded cells for a home page."""
from fastapi import APIRouter, Depends
from sqlalchemy import and_, case, func, select

from .auth import identity, session_db
from .db import Dataset, DatasetVersion
from .report_models import Report
from .workflow_models import Workflow, WorkflowRun

router = APIRouter(prefix="/overview")


@router.get("")
def overview(user=Depends(identity), db=Depends(session_db)):
    def count(model):
        return db.scalar(select(func.count()).select_from(model).where(model.owner_id == user.id))

    run_scope = select(WorkflowRun.id).join(Workflow).where(Workflow.owner_id == user.id)
    runs = db.execute(
        select(WorkflowRun.id, WorkflowRun.workflow_id, Workflow.name.label("workflow_name"),
               WorkflowRun.source_dataset_id.label("dataset_id"), WorkflowRun.right_dataset_id, WorkflowRun.status,
               WorkflowRun.error_code, WorkflowRun.created_at)
        .join(Workflow).where(Workflow.owner_id == user.id)
        .order_by(WorkflowRun.created_at.desc(), WorkflowRun.id).limit(5)
    ).mappings().all()
    datasets = db.execute(
        select(Dataset.id, Dataset.name, Dataset.current_version.label("version"), Dataset.created_at,
               case((Dataset.current_version == 1, Dataset.row_count),
                    else_=DatasetVersion.row_count).label("rows"))
        .outerjoin(DatasetVersion, and_(DatasetVersion.dataset_id == Dataset.id,
                                      DatasetVersion.number == Dataset.current_version))
        .where(Dataset.owner_id == user.id)
        .order_by(Dataset.created_at.desc(), Dataset.id).limit(5)
    ).mappings().all()
    reports = db.execute(
        select(Report.id, Report.name, Report.dataset_version, Report.created_at)
        .where(Report.owner_id == user.id)
        .order_by(Report.created_at.desc(), Report.id).limit(4)
    ).mappings().all()
    return {
        "counts": {"datasets": count(Dataset), "workflows": count(Workflow), "reports": count(Report),
                   "runs": db.scalar(select(func.count()).select_from(run_scope.subquery()))},
        "datasets": [dict(row) for row in datasets],
        "runs": [dict(row) for row in runs],
        "reports": [dict(row) for row in reports],
    }
