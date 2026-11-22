"""Optional first-admin creation for hosts without an interactive shell."""
import os
import re
from sqlalchemy import select
from .auth import hasher
from .audit import record
from .db import User
from .limits import config_row


def bootstrap_admin(sessions):
    username = os.environ.get("BOOTSTRAP_ADMIN_USER", "")
    password = os.environ.get("BOOTSTRAP_ADMIN_PASSWORD", "")
    if not username and not password:
        return
    # Validate without echoing environment values, including on error.
    if not re.fullmatch(r"[a-z0-9._-]{3,100}", username) or not 12 <= len(password) <= 128:
        raise RuntimeError("First-admin bootstrap requires a valid username and a 12-128 character password.")
    with sessions() as db:
        config = config_row(db, lock=True)
        if config.bootstrap_completed:
            return
        if not db.scalar(select(User.id).where(User.role == "admin", User.active)):
            if db.scalar(select(User.id).where(User.username == username)):
                raise RuntimeError("Bootstrap username already exists; no account was changed.")
            row = User(username=username, password_hash=hasher.hash(password), role="admin", active=True)
            db.add(row)
            db.flush()
            record(db, None, "account.bootstrapped", row.id, {"role": "admin"})
        config.bootstrap_completed = True
        db.commit()
