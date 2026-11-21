import argparse
import getpass
import re

from sqlalchemy import select

from .auth import hasher
from .config import Settings
from .db import User, database
from .audit import record
from .limits import config_row
from .maintenance import prune


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["create-user", "prune-guests"])
    parser.add_argument("--admin", action="store_true")
    args = parser.parse_args()
    engine, sessions = database(Settings.from_env().database_url)
    try:
        with sessions() as db:
            if args.command == "prune-guests":
                counts = prune(db)
                print(f"Expired guest workspaces removed: {counts['guests']}")
                return
            username = input("Username: ").strip().casefold()
            if not re.fullmatch(r"[a-z0-9._-]{3,100}", username):
                raise SystemExit("Use 3-100 lowercase letters, digits, dot, dash or underscore.")
            password = getpass.getpass("Password (12-128 characters): ")
            if not 12 <= len(password) <= 128 or password != getpass.getpass("Confirm password: "):
                raise SystemExit("Password length or confirmation is invalid.")
            config_row(db, lock=True)
            if db.scalar(select(User).where(User.username == username)):
                raise SystemExit("Username already exists; no account was changed.")
            row = User(username=username, password_hash=hasher.hash(password), role="admin" if args.admin else "user")
            db.add(row)
            db.flush()
            record(db, None, "account.created_by_operator", row.id, {"role": row.role})
            db.commit()
            print("Account created. Password was not stored in command history.")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
