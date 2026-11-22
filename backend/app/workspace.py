import json
from datetime import timedelta
from sqlalchemy import delete, func, select
from sqlalchemy.orm import defer, load_only
from .db import Dataset, DatasetVersion, Preview, User, as_utc, now
from .errors import Problem
from .limits import cap, config_row, current_limits, storage_usage


def owned(db, user, key, lock=False, metadata_only=False):
    query = select(Dataset).where(Dataset.id == key, Dataset.owner_id == user.id)
    if metadata_only:
        query = query.options(
            load_only(
                Dataset.id,
                Dataset.owner_id,
                Dataset.name,
                Dataset.columns,
                Dataset.row_count,
                Dataset.current_version,
                Dataset.source_sheet,
                Dataset.created_at,
            )
        )
    else:
        query = query.options(defer(Dataset.original_bytes))
    row = db.scalar(query.with_for_update() if lock else query)
    if row is None:
        raise Problem("dataset_not_found", 404)
    return row


def columns_of(db, row):
    if row.current_version == 1:
        return row.columns
    columns = db.scalar(
        select(DatasetVersion.columns).where(
            DatasetVersion.dataset_id == row.id, DatasetVersion.number == row.current_version
        )
    )
    if columns is None:
        raise Problem("version_not_found", 404)
    return columns


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
    """Cached conservative payload budgets; caller holds global then owner lock."""
    limits = current_limits(db)
    if storage_usage(db, user.id) + extra > cap(limits, user, "storage_mb") * 1024 * 1024:
        raise Problem("workspace_limit", 413)
    if storage_usage(db) + extra > limits.global_storage_mb * 1024 * 1024:
        raise Problem("service_storage_limit", 413)


def payload_budget(value):
    return len(json.dumps(value, ensure_ascii=True).encode()) * 4


def lock_owner(db, user):
    # One small configuration row serializes global storage checks across writers.
    config_row(db, lock=True)
    current = db.scalar(
        select(User).where(User.id == user.id).with_for_update().execution_options(populate_existing=True)
    )
    if current is None or not current.active:
        raise Problem("unauthorized", 401)
    if current.expires_at and as_utc(current.expires_at) <= now():
        raise Problem("session_expired", 401)


def save_preview(db, user, row, columns, records, steps, impacts, settings, metadata=None):
    old_columns, old_records = materialize(db, row)
    db.execute(delete(Preview).where(Preview.owner_id == user.id, Preview.expires_at < now()))
    db.execute(
        delete(Preview).where(
            Preview.owner_id == user.id, Preview.dataset_id == row.id, Preview.applied_version.is_(None)
        )
    )
    pending = db.scalar(
        select(func.count()).select_from(Preview).where(Preview.owner_id == user.id, Preview.applied_version.is_(None))
    )
    if pending >= 3:
        raise Problem("preview_limit", 429)
    if len(json.dumps([columns, records], ensure_ascii=False).encode()) > settings.max_bytes * 2:
        raise Problem("dataset_limit", 413)
    result = {
        "columns": columns,
        "records": records,
        "impacts": impacts,
        "changed": columns != old_columns or records != old_records,
        "metadata": metadata or {},
    }
    budget = payload_budget([result, steps])
    check_storage(db, user, budget)
    saved = Preview(
        dataset_id=row.id,
        owner_id=user.id,
        input_version=row.current_version,
        result=result,
        storage_bytes=budget,
        steps=steps,
        expires_at=now() + timedelta(minutes=15),
    )
    db.add(saved)
    db.flush()
    return saved


def preview_view(saved, old_columns, old_records):
    result = saved.result
    return {
        "id": saved.id,
        "input_version": saved.input_version,
        "expires_at": saved.expires_at,
        "before": {"columns": old_columns, "records": old_records[:10], "rows": len(old_records)},
        "after": {"columns": result["columns"], "records": result["records"][:10], "rows": len(result["records"])},
        "impacts": result["impacts"],
        "changed": result["changed"],
        "metadata": result.get("metadata", {}),
    }
