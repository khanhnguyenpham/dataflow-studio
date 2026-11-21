"""Bounded append and many-to-one joins; never expand duplicate lookup keys."""

from collections import Counter
from typing import Literal

from pydantic import Field, model_validator
from .errors import Problem
from .transforms import Strict, column_index, new_headers


class IntegrationSpec(Strict):
    mode: Literal["append", "left", "inner"]
    left_key: str | None = Field(default=None, max_length=255)
    right_key: str | None = Field(default=None, max_length=255)
    allow_unmatched: bool = False

    @model_validator(mode="after")
    def keys_required(self):
        if self.mode != "append" and (not self.left_key or not self.right_key):
            raise ValueError("Both join keys are required")
        if self.mode == "append" and (self.left_key or self.right_key):
            raise ValueError("Append does not use keys")
        return self


def combine_tables(left_columns, left, right_columns, right, spec, limits):
    stats = {"left_rows": len(left), "right_rows": len(right)}
    if spec.mode == "append":
        if set(left_columns) != set(right_columns):
            raise Problem("append_schema")
        indices = [right_columns.index(name) for name in left_columns]
        columns = list(left_columns)
        rows = [list(row) for row in left] + [[row[i] for i in indices] for row in right]
    else:
        li, ri = column_index(left_columns, spec.left_key), column_index(right_columns, spec.right_key)

        def usable(value):
            return value is not None and value.strip() != ""

        right_keys = Counter(row[ri] for row in right if usable(row[ri]))
        duplicate_right = sum(n - 1 for n in right_keys.values() if n > 1)
        missing_right = sum(not usable(row[ri]) for row in right)
        if duplicate_right or missing_right:
            raise Problem(
                "duplicate_join_keys" if duplicate_right else "missing_join_keys",
                details={"duplicates": duplicate_right, "missing": missing_right},
            )
        lookup = {row[ri]: row for row in right}
        unmatched = sum(not usable(row[li]) or row[li] not in lookup for row in left)
        if unmatched and not spec.allow_unmatched:
            raise Problem("unmatched_keys", details={"count": unmatched})
        selected = [i for i, name in enumerate(right_columns) if not (i == ri and spec.left_key == spec.right_key)]
        columns = list(left_columns) + [
            ("right." + right_columns[i]) if right_columns[i] in left_columns else right_columns[i] for i in selected
        ]
        new_headers(columns)
        rows, used = [], set()
        for row in left:
            matched = lookup.get(row[li]) if usable(row[li]) else None
            if matched is not None:
                used.add(row[li])
                rows.append(list(row) + [matched[i] for i in selected])
            elif spec.mode == "left":
                rows.append(list(row) + [None] * len(selected))
        left_keys = Counter(row[li] for row in left if usable(row[li]))
        stats.update(
            {
                "unmatched_left_rows": unmatched,
                "matched_left_rows": len(left) - unmatched,
                "unused_right_rows": len(right) - len(used),
                "duplicate_right_keys": duplicate_right,
                "duplicate_left_keys": sum(n - 1 for n in left_keys.values() if n > 1),
                "missing_left_keys": sum(not usable(row[li]) for row in left),
                "missing_right_keys": missing_right,
            }
        )
    if len(rows) > limits.max_rows or len(columns) > limits.max_columns:
        raise Problem("dataset_limit", 413)
    stats["result_rows"] = len(rows)
    return columns, rows, stats
