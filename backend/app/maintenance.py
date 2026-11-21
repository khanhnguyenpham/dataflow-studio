import asyncio
from datetime import timedelta
import logging
from sqlalchemy import delete, select
from .admin_models import AuditLog
from .audit import record
from .db import LoginSession, Preview, User, now
from .limits import config_row


def prune(db):
    config_row(db, lock=True)
    users = db.execute(delete(User).where(User.role == "guest", User.expires_at < now())).rowcount
    previews = db.execute(delete(Preview).where(Preview.expires_at < now())).rowcount
    sessions = db.execute(delete(LoginSession).where(LoginSession.expires_at < now())).rowcount
    db.execute(delete(AuditLog).where(AuditLog.created_at < now() - timedelta(days=30)))
    old = select(AuditLog.id).order_by(AuditLog.created_at.desc(), AuditLog.id).offset(5000)
    db.execute(delete(AuditLog).where(AuditLog.id.in_(old)).execution_options(synchronize_session=False))
    counts = {"guests": users, "previews": previews, "sessions": sessions}
    if any(counts.values()):
        record(db, None, "retention.pruned", details=counts)
    db.commit()
    return counts


async def retention_loop(sessions):
    def tick():
        with sessions() as db:
            prune(db)

    while True:
        try:
            await asyncio.to_thread(tick)
        except Exception as error:
            logging.getLogger("dataflow").error("Retention check failed: %s", type(error).__name__)
        await asyncio.sleep(60)
