"""Keep ephemeral authentication values out of browser test output."""

import json
import os
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[2]
path = root / ".runtime" / "browser-admin.json"
credentials = json.loads(path.read_text(encoding="utf-8"))
result = subprocess.run(
    [os.environ.get("DATAFLOW_PNPM", "pnpm"), "exec", "playwright", "test", *sys.argv[1:]],
    cwd=root / "frontend",
    capture_output=True,
    text=True,
    encoding="utf-8",
    errors="replace",
)
output = result.stdout + result.stderr
for name in ["password", "target_password"]:
    output = output.replace(credentials[name], "[REDACTED]")
print(output)
raise SystemExit(result.returncode)
