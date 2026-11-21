from .admin_models import AuditLog


def record(db, user, action, target_id=None, details=None):
    """Only application-specified metadata: never credentials or uploaded cell values."""
    db.add(AuditLog(actor_id=user.id if user else None, action=action, target_id=target_id, details=details or {}))
