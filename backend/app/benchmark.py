"""Repeatable synthetic engine benchmark; deliberately excludes network/database time."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import platform
import statistics
from time import perf_counter
import tracemalloc
from pydantic import TypeAdapter
from .aggregation import AggregateSpec, aggregate
from .config import Settings
from .processing import profile
from .transforms import Step, apply_steps


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    columns = ["id", "sku", "qty", "date", "label"]
    unique = [[f"{i:06}", f"P{i % 50:03}", str(i % 20 + 1), "01/11/2026", "  item  "] for i in range(9000)]
    source = unique + unique[:1000]
    steps = TypeAdapter(list[Step]).validate_python([
        {"op": "trim", "columns": ["label"]},
        {"op": "dedupe", "columns": ["id"]},
        {"op": "date", "column": "date", "formats": ["%d/%m/%Y"]},
        {"op": "validate", "column": "id", "rule": "unique"},
        {"op": "validate", "column": "qty", "rule": "number"},
    ])
    settings = Settings(database_url="sqlite://")
    spec = AggregateSpec(group_by="sku", operation="sum", measure="qty")
    def task():
        names, rows, _ = apply_steps(columns, source, steps, settings)
        quality = profile(names, rows)
        totals = aggregate(names, rows, spec, settings)
        assert len(rows) == 9000 and quality["duplicate_rows"] == 0
        assert totals["metrics"]["overall"] == "94500"
        return names, rows, totals["metrics"]
    task()  # warmup, excluded
    timings = []
    for _ in range(20):
        start = perf_counter()
        output = task()
        timings.append((perf_counter() - start) * 1000)
    tracemalloc.start()
    task()  # separate from timing, so tracing does not bias the latency samples
    _, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    def checksum(value):
        return hashlib.sha256(json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
    result = {
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "scope": "local Python engine only; no HTTP, PostgreSQL, concurrency or hosting latency",
        "python": platform.python_version(), "platform": platform.system(), "machine": platform.machine(),
        "input_rows": len(source), "input_columns": len(columns), "output_rows": len(output[1]),
        "recipe": [step.model_dump() for step in steps], "repetitions": 20,
        "milliseconds": {"median": round(statistics.median(timings), 3), "p95_nearest_rank": round(sorted(timings)[18], 3),
                         "min": round(min(timings), 3), "max": round(max(timings), 3)},
        "peak_traced_python_bytes": peak,
        "input_sha256": checksum([columns, source]), "output_sha256": checksum(output),
        "expected_quantity_total": "94500",
        "limits": "One small deterministic fixture; not a production capacity claim or a comparison against another tool.",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: result[key] for key in ["input_rows", "output_rows", "milliseconds", "peak_traced_python_bytes"]}))


if __name__ == "__main__":
    main()
