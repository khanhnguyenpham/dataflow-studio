"""Exact-decimal aggregation on a selected immutable dataset version."""

from collections import defaultdict
from datetime import date
from decimal import Decimal, InvalidOperation, localcontext
from typing import Literal

from pydantic import Field, model_validator
from .errors import Problem
from .transforms import Filter, Strict, apply_steps, column_index, decimal_value, new_headers


class AggregateSpec(Strict):
    group_by: str = Field(min_length=1, max_length=255)
    operation: Literal["count", "sum", "average"]
    measure: str | None = Field(default=None, max_length=255)
    chart_type: Literal["bar", "line", "pie"] = "bar"
    filters: list[Filter] = Field(default_factory=list, max_length=5)

    @model_validator(mode="after")
    def measure_required(self):
        if self.operation != "count" and not self.measure:
            raise ValueError("A measure is required")
        if self.operation == "count" and self.measure:
            raise ValueError("Row counts do not use a numeric measure")
        return self


def result_columns(spec):
    columns = [spec.group_by, f"{spec.operation}({spec.measure or 'rows'})", "source_rows"]
    new_headers(columns)
    return columns


def aggregate(columns, records, spec, limits):
    _, rows, _ = apply_steps(columns, records, spec.filters, limits)
    gi = column_index(columns, spec.group_by)
    mi = column_index(columns, spec.measure) if spec.measure else None
    grouped: dict[str | None, list[Decimal | None]] = defaultdict(list)
    missing, bad = 0, []
    for number, row in enumerate(rows, 1):
        group = row[gi]
        if group not in grouped and len(grouped) >= 1000:
            raise Problem("group_limit", 413)
        value: Decimal | None = Decimal(1)
        if mi is not None:
            if row[mi] in (None, ""):
                value = None
                missing += 1
            else:
                try:
                    value = decimal_value(row[mi])
                except (InvalidOperation, ValueError):
                    bad.append(number)
                    value = None
        grouped[group].append(value)
    if bad:
        raise Problem("invalid_measure", details={"column": spec.measure, "filtered_rows": bad[:10], "count": len(bad)})
    with localcontext() as context:
        context.prec = 50

        def reduce_values(values):
            valid = [v for v in values if v is not None]
            if not valid:
                return None
            total = sum(valid, Decimal(0))
            return format(total / len(valid) if spec.operation == "average" else total, "f")

        keys = sorted(grouped, key=lambda value: (value is None, value or ""))
        if spec.chart_type == "line":
            try:
                keys = sorted(keys, key=lambda value: date.fromisoformat(value or ""))
            except (ValueError, TypeError):
                try:
                    keys = sorted(keys, key=lambda value: decimal_value(value))
                except (InvalidOperation, ValueError, TypeError, AttributeError):
                    raise Problem("line_axis") from None
        items = [{"group": key, "value": reduce_values(grouped[key]), "rows": len(grouped[key])} for key in keys]
        overall = (
            "0"
            if spec.operation == "count" and not rows
            else reduce_values([value for values in grouped.values() for value in values])
        )
    if spec.chart_type == "pie" and (
        spec.operation == "average"
        or len(items) > 8
        or not overall
        or Decimal(overall) <= 0
        or any(item["value"] is None or Decimal(item["value"]) < 0 for item in items)
    ):
        raise Problem("pie_values")
    return {
        "items": items,
        "metrics": {
            "input_rows": len(records),
            "filtered_rows": len(rows),
            "groups": len(items),
            "missing_values": missing,
            "valid_values": len(rows) - missing,
            "overall": overall,
        },
        "value_semantics": "Decimal text; empty numeric values excluded, invalid numeric values rejected",
    }
