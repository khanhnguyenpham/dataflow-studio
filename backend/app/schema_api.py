from typing import Annotated
from fastapi import APIRouter, Depends, Request
from pydantic import Field
from .auth import identity, limited, session_db
from .errors import Problem
from .schema_match import suggest
from .transforms import Strict, new_headers
from .workspace import columns_of, owned

router = APIRouter(prefix="/datasets")


class MatchRequest(Strict):
    expected_version: int = Field(ge=1)
    targets: list[Annotated[str, Field(min_length=1, max_length=255)]] = Field(min_length=1, max_length=100)


@router.post("/{key}/column-suggestions")
def suggestions(key: str, body: MatchRequest, request: Request, user=Depends(identity), db=Depends(session_db)):
    limited(request, "column-suggestions", 10, 60)
    row = owned(db, user, key, metadata_only=True)
    if row.current_version != body.expected_version:
        raise Problem("stale_version", 409)
    targets = list(body.targets)
    new_headers(targets)
    columns = columns_of(db, row)
    return {**suggest(columns, targets), "source_columns": columns, "version": row.current_version}
