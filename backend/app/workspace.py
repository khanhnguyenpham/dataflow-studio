import json
from sqlalchemy import Text, cast, func, select
from .db import Dataset, DatasetVersion, Preview
from .errors import Problem


def owned(db, user, key, lock=False):
    query = select(Dataset).where(Dataset.id == key, Dataset.owner_id == user.id)
    row = db.scalar(query.with_for_update() if lock else query)
    if row is None:
        raise Problem("dataset_not_found", 404)
    return row


def materialize(db, row, number=None):
    number = number or row.current_version
    if number == 1:
        return row.columns, row.records
    version = db.scalar(
        select(DatasetVersion).where(DatasetVersion.dataset_id == row.id, DatasetVersion.number == number)
    )
    if version is None:
        raise Problem("version_not_found", 404)
    return version.columns, version.records


def summary(db, row):
    count, columns = row.row_count, row.columns
    if row.current_version != 1:
        derived = db.execute(
            select(DatasetVersion.row_count, DatasetVersion.columns).where(
                DatasetVersion.dataset_id == row.id, DatasetVersion.number == row.current_version
            )
        ).one()
        count, columns = derived
    return {
        "id": row.id,
        "name": row.name,
        "rows": count,
        "columns": len(columns),
        "version": row.current_version,
        "sheet": row.source_sheet,
        "created_at": row.created_at,
    }


def check_storage(db, user, extra=0):
    """Conservative UTF-8 budget, including pending previews and retained versions.

    Four bytes per database JSON character is an upper bound, rather than assuming
    a character is one byte. Caller must hold the owner row lock before writing.
    """
    source = db.scalar(
        select(
            func.coalesce(
                func.sum(
                    func.length(Dataset.original_bytes)
                    + 4 * (func.length(cast(Dataset.columns, Text)) + func.length(cast(Dataset.records, Text)))
                ),
                0,
            )
        ).where(Dataset.owner_id == user.id)
    )
    derived = db.scalar(
        select(
            func.coalesce(
                func.sum(
                    4
                    * (
                        func.length(cast(DatasetVersion.columns, Text))
                        + func.length(cast(DatasetVersion.records, Text))
                        + func.length(cast(DatasetVersion.steps, Text))
                    )
                ),
                0,
            )
        )
        .join(Dataset, Dataset.id == DatasetVersion.dataset_id)
        .where(Dataset.owner_id == user.id)
    )
    pending = db.scalar(
        select(
            func.coalesce(
                func.sum(4 * (func.length(cast(Preview.result, Text)) + func.length(cast(Preview.steps, Text)))), 0
            )
        ).where(Preview.owner_id == user.id)
    )
    if source + derived + pending + extra > (64 if user.role == "guest" else 256) * 1024 * 1024:
        raise Problem("workspace_limit", 413)


def payload_budget(value):
    return len(json.dumps(value, ensure_ascii=True).encode()) * 4
