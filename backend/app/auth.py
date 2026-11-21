import hashlib
import hmac
import secrets
import time
from collections import deque
from datetime import timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import delete, func, select

from .db import LoginSession, User, as_utc, now
from .errors import Problem
from .audit import record
from .limits import config_row, current_limits

router = APIRouter(prefix="/auth")
hasher = PasswordHasher()
# A fixed dummy hash avoids disclosing whether a username exists through verification cost.
dummy = hasher.hash(secrets.token_urlsafe(24))


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def csrf(value):
    return digest("csrf:" + value)


def session_db(request: Request):
    with request.app.state.sessions() as db:
        yield db


def identity(request: Request, db=Depends(session_db)):
    token = request.cookies.get("dataflow_session", "")
    row = db.get(LoginSession, digest(token)) if token else None
    if not row or as_utc(row.expires_at) <= now():
        raise Problem("unauthorized", 401)
    user = db.get(User, row.user_id)
    if not user or not user.active:
        raise Problem("unauthorized", 401)
    if user.expires_at and as_utc(user.expires_at) <= now():
        raise Problem("session_expired", 401)
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        if not hmac.compare_digest(request.headers.get("x-csrf-token", ""), csrf(token)):
            raise Problem("csrf", 403)
    return user


class Credentials(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=128)


class PasswordChange(BaseModel):
    model_config = ConfigDict(extra="forbid")
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=12, max_length=128)


def user_view(user):
    return {"id": user.id, "username": user.username, "role": user.role, "expires_at": user.expires_at}


def issue(request, response, db, user):
    from .workspace import lock_owner

    lock_owner(db, user)
    token = secrets.token_urlsafe(32)
    old = request.cookies.get("dataflow_session")
    if old:
        db.execute(delete(LoginSession).where(LoginSession.digest == digest(old)))
    expiry = now() + timedelta(hours=2 if user.role == "guest" else 8)
    db.add(LoginSession(digest=digest(token), user_id=user.id, expires_at=expiry))
    old_sessions = (
        select(LoginSession.digest)
        .where(LoginSession.user_id == user.id)
        .order_by(LoginSession.expires_at.desc())
        .offset(8)
    )
    db.execute(
        delete(LoginSession).where(LoginSession.digest.in_(old_sessions)).execution_options(synchronize_session=False)
    )
    record(db, user, "session.started")
    db.commit()
    response.set_cookie(
        "dataflow_session",
        token,
        httponly=True,
        secure=request.app.state.settings.secure_cookie,
        samesite="lax",
        path="/api",
        max_age=int((expiry - now()).total_seconds()),
    )
    return {"user": user_view(user), "csrf": csrf(token)}


def limited(request, kind, limit, seconds):
    buckets = request.app.state.rate_buckets
    current = time.monotonic()
    if len(buckets) > 5000:
        for key in list(buckets):
            if not buckets[key] or current - buckets[key][-1] > 3600:
                del buckets[key]
        if len(buckets) > 5000:
            raise Problem("rate_limit", 429)
    key = (request.client.host if request.client else "unknown", kind)
    bucket = buckets.setdefault(key, deque())
    while bucket and current - bucket[0] > seconds:
        bucket.popleft()
    if len(bucket) >= limit:
        raise Problem("rate_limit", 429)
    bucket.append(current)


@router.post("/guest")
def guest(request: Request, response: Response, db=Depends(session_db)):
    limited(request, "guest", 10, 300)
    config_row(db, lock=True)
    # Guest data is deliberately ephemeral and is cascade-deleted by the pruning command.
    db.execute(delete(User).where(User.role == "guest", User.expires_at < now()))
    if (
        db.scalar(select(func.count()).select_from(User).where(User.role == "guest", User.expires_at > now()))
        >= current_limits(db).active_guest_limit
    ):
        raise Problem("guest_capacity", 429)
    user = User(username="guest-" + secrets.token_hex(8), role="guest", expires_at=now() + timedelta(hours=2))
    db.add(user)
    db.flush()
    return issue(request, response, db, user)


@router.post("/login")
def login(body: Credentials, request: Request, response: Response, db=Depends(session_db)):
    limited(request, "login", 5, 900)
    user = db.scalar(select(User).where(User.username == body.username.strip().casefold()))
    stored = user.password_hash if user and user.password_hash else dummy
    try:
        valid = hasher.verify(stored, body.password)
    except (VerificationError, InvalidHashError):
        valid = False
    if not valid or not user or not user.active or user.role == "guest":
        raise Problem("invalid_login", 401)
    from .workspace import lock_owner

    lock_owner(db, user)
    if user.password_hash != stored:
        raise Problem("invalid_login", 401)
    return issue(request, response, db, user)


@router.get("/session")
def session(request: Request, user=Depends(identity)):
    return {"user": user_view(user), "csrf": csrf(request.cookies["dataflow_session"])}


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, user=Depends(identity), db=Depends(session_db)):
    from .workspace import lock_owner

    lock_owner(db, user)
    record(db, user, "session.ended")
    db.execute(delete(LoginSession).where(LoginSession.digest == digest(request.cookies["dataflow_session"])))
    db.commit()
    response.delete_cookie(
        "dataflow_session", path="/api", secure=request.app.state.settings.secure_cookie, samesite="lax"
    )


@router.post("/password", status_code=204)
def password(body: PasswordChange, response: Response, user=Depends(identity), db=Depends(session_db)):
    from .workspace import lock_owner

    lock_owner(db, user)
    if user.role == "guest":
        raise Problem("forbidden", 403)
    try:
        hasher.verify(user.password_hash, body.current_password)
    except (VerificationError, InvalidHashError):
        raise Problem("invalid_login", 401) from None
    user.password_hash = hasher.hash(body.new_password)
    db.execute(delete(LoginSession).where(LoginSession.user_id == user.id))
    record(db, user, "account.password_changed", user.id)
    db.commit()
    response.delete_cookie("dataflow_session", path="/api")
