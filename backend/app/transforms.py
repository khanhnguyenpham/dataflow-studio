"""Typed, deterministic transformations; no user code, SQL or regular expressions."""

from datetime import datetime
from collections.abc import Sequence
from decimal import Decimal, InvalidOperation
import re
from typing import Annotated, Literal
import unicodedata

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .errors import Problem


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Trim(Strict):
    op: Literal["trim", "unicode"]
    columns: list[str] = Field(min_length=1, max_length=100)


class Rename(Strict):
    op: Literal["rename"]
    column: str = Field(min_length=1, max_length=255)
    name: str = Field(min_length=1, max_length=255)


class Fill(Strict):
    op: Literal["fill_null"]
    column: str
    value: str = Field(max_length=500)


class Replace(Strict):
    op: Literal["replace"]
    column: str
    old: str = Field(max_length=500)
    value: str = Field(max_length=500)


class Dedupe(Strict):
    op: Literal["dedupe"]
    columns: list[str] = Field(min_length=1, max_length=100)


class Dates(Strict):
    op: Literal["date"]
    column: str
    formats: list[Literal["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"]] = Field(min_length=1, max_length=3)


class Numbers(Strict):
    op: Literal["number"]
    column: str
    decimal: Literal[".", ","] = "."
    thousands: Literal["", ".", ",", " "] = ""

    @model_validator(mode="after")
    def distinct_separators(self):
        if self.decimal == self.thousands:
            raise ValueError("Separators must differ")
        return self


class Filter(Strict):
    op: Literal["filter"]
    column: str
    operator: Literal["eq", "ne", "contains", "gt", "lt"]
    value: str = Field(max_length=500)


class Split(Strict):
    op: Literal["split"]
    column: str
    separator: str = Field(min_length=1, max_length=10)
    names: list[str] = Field(min_length=2, max_length=5)


class Combine(Strict):
    op: Literal["combine"]
    columns: list[str] = Field(min_length=2, max_length=10)
    name: str = Field(min_length=1, max_length=255)
    separator: str = Field(max_length=10)


class ColumnMapping(Strict):
    source: str = Field(min_length=1, max_length=255)
    target: str = Field(min_length=1, max_length=255)


class MapColumns(Strict):
    op: Literal["map_columns"]
    mapping: list[ColumnMapping] = Field(min_length=1, max_length=100)
    keep_extras: bool = True


class Validate(Strict):
    op: Literal["validate"]
    column: str = Field(min_length=1, max_length=255)
    rule: Literal["not_null", "unique", "number", "date"]
    formats: list[Literal["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"]] = Field(
        default=["%Y-%m-%d"], min_length=1, max_length=3
    )
    allow_empty: bool = False


Step = Annotated[
    Trim | Rename | Fill | Replace | Dedupe | Dates | Numbers | Filter | Split | Combine | MapColumns | Validate,
    Field(discriminator="op"),
]


def column_index(columns, name):
    if name not in columns:
        raise Problem("invalid_column", details={"column": name})
    return columns.index(name)


def new_headers(columns):
    canonical = [unicodedata.normalize("NFC", c.strip()) for c in columns]
    if any(not c or len(c) > 255 for c in canonical) or len(set(canonical)) != len(canonical):
        raise Problem("duplicate_headers")
    columns[:] = canonical


def decimal_value(text, decimal=".", thousands=""):
    if len(text) > 128:
        raise ValueError("Numeric text exceeds supported precision")
    value = text.strip()
    if thousands and thousands in value:
        integer, _, fraction = value.partition(decimal)
        if thousands in fraction or not re.fullmatch(r"[+-]?\d{1,3}(?:" + re.escape(thousands) + r"\d{3})+", integer):
            raise ValueError("Invalid grouping")
        value = value.replace(thousands, "")
    if decimal == ",":
        if "." in value:
            raise ValueError("Unexpected decimal separator")
        value = value.replace(",", ".")
    n = Decimal(value)
    if not n.is_finite() or abs(n.adjusted()) > 18 or len(n.as_tuple().digits) > 30:
        raise ValueError("Unsupported number")
    return n


def converted_rows(columns, records, column, convert):
    index = column_index(columns, column)
    failures, changed = [], 0
    for number, row in enumerate(records, start=2):
        old = row[index]
        if old is None or old == "":
            continue
        try:
            new = convert(old)
        except (ValueError, InvalidOperation):
            failures.append(number)
            continue
        if new != old:
            changed += 1
            row[index] = new
    if failures:
        raise Problem("invalid_values", details={"column": column, "rows": failures[:10], "count": len(failures)})
    return changed


def parse_date(value: str, formats: Sequence[str]) -> str:
    if len(value) > 64:
        raise ValueError("Invalid date length")
    parsed = set()
    for fmt in formats:
        try:
            parsed.add(datetime.strptime(value.strip(), fmt).date().isoformat())
        except ValueError:
            continue
    if len(parsed) != 1:
        raise ValueError("Invalid or ambiguous date")
    return parsed.pop()


def validate_rows(columns, records, step):
    index = column_index(columns, step.column)
    failures, seen = [], set()
    for number, row in enumerate(records, start=2):
        value, valid = row[index], True
        empty = value is None or not value.strip()
        if empty:
            valid = step.allow_empty and step.rule != "not_null"
        elif step.rule == "unique":
            valid = value not in seen
            seen.add(value)
        elif step.rule in {"number", "date"}:
            try:
                decimal_value(value) if step.rule == "number" else parse_date(value, step.formats)
            except (ValueError, InvalidOperation):
                valid = False
        if not valid:
            failures.append(number)
    if failures:
        raise Problem(
            "validation_failed",
            details={"column": step.column, "rule": step.rule, "rows": failures[:10], "count": len(failures)},
        )


def apply_steps(source_columns, source_records, steps, limits):
    columns, records = list(source_columns), [list(row) for row in source_records]
    impacts = []
    for step in steps:
        before, changed = len(records), 0
        if isinstance(step, Validate):
            validate_rows(columns, records, step)
        elif isinstance(step, Trim):
            for name in step.columns:
                idx = column_index(columns, name)
                for row in records:
                    old = row[idx]
                    new = (
                        old.strip()
                        if step.op == "trim" and old is not None
                        else unicodedata.normalize("NFC", old)
                        if old is not None
                        else None
                    )
                    if new != old:
                        row[idx] = new
                        changed += 1
        elif isinstance(step, Rename):
            columns[column_index(columns, step.column)] = step.name
            new_headers(columns)
        elif isinstance(step, (Fill, Replace)):
            idx = column_index(columns, step.column)
            for row in records:
                matches = row[idx] in (None, "") if isinstance(step, Fill) else row[idx] == step.old
                if matches and row[idx] != step.value:
                    row[idx], changed = step.value, changed + 1
        elif isinstance(step, Dedupe):
            indices = [column_index(columns, name) for name in step.columns]
            seen, kept = set(), []
            for row in records:
                key = tuple(row[i] for i in indices)
                if key not in seen:
                    seen.add(key)
                    kept.append(row)
            records = kept
        elif isinstance(step, Dates):
            changed = converted_rows(columns, records, step.column, lambda value: parse_date(value, step.formats))
        elif isinstance(step, Numbers):
            changed = converted_rows(
                columns, records, step.column, lambda v: format(decimal_value(v, step.decimal, step.thousands), "f")
            )
        elif isinstance(step, Filter):
            idx = column_index(columns, step.column)

            def keep(value):
                if step.operator == "eq":
                    return value == step.value
                if step.operator == "ne":
                    return value != step.value
                if step.operator == "contains":
                    return value is not None and step.value in value
                if value in (None, ""):
                    return False
                try:
                    a, b = decimal_value(value), decimal_value(step.value)
                except (InvalidOperation, ValueError):
                    raise Problem("invalid_values", details={"column": step.column}) from None
                return a > b if step.operator == "gt" else a < b

            records = [row for row in records if keep(row[idx])]
        elif isinstance(step, Split):
            idx = column_index(columns, step.column)
            replacement = columns[:idx] + step.names + columns[idx + 1 :]
            new_headers(replacement)
            output = []
            for row in records:
                parts = row[idx].split(step.separator) if row[idx] is not None else [None] * len(step.names)
                if len(parts) != len(step.names):
                    raise Problem("invalid_values", details={"column": step.column})
                output.append(row[:idx] + parts + row[idx + 1 :])
            columns, records = replacement, output
        elif isinstance(step, Combine):
            indices = [column_index(columns, name) for name in step.columns]
            new_headers(columns + [step.name])
            columns.append(step.name)
            for row in records:
                row.append(step.separator.join(row[i] or "" for i in indices))
        elif isinstance(step, MapColumns):
            sources = [pair.source for pair in step.mapping]
            if len(set(sources)) != len(sources):
                raise Problem("mapping_conflict")
            indices = [column_index(columns, source) for source in sources]
            extra = [i for i, name in enumerate(columns) if name not in sources] if step.keep_extras else []
            names = [pair.target for pair in step.mapping] + [columns[i] for i in extra]
            new_headers(names)
            records = [[row[i] for i in indices + extra] for row in records]
            columns = names
        if len(records) > limits.max_rows or len(columns) > limits.max_columns:
            raise Problem("dataset_limit")
        impacts.append({"op": step.op, "rows_before": before, "rows_after": len(records), "cell_updates": changed})
    return columns, records, impacts
