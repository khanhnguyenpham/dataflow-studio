# DataFlow Studio

DataFlow Studio is a web workspace for inspecting spreadsheets and building repeatable data preparation workflows. Its central use case is a monthly report: import messy sales and product files, inspect changes before applying them, join the sources, and reuse the process next month.

[Tiếng Việt](README.vi.md)

## Current checkpoint

Import, profiling, versioned cleaning/export, reusable workflows and saved analytics work end to end. This is **not the finished platform** and there is no verified public deployment yet.

Available in this working slice: isolated, two-hour guest sessions; sign-in and password changes; bounded CSV/XLSX imports; explicit selection of Excel sheets; dataset preview; missing values, duplicate rows, suggested types and review warnings; English/Vietnamese UI. Source bytes and values are retained without automatic correction. Accounts are created by an operator.

Clean & export adds typed recipes, before/after previews, explicit apply, retained version history/restore and CSV/XLSX/JSON/quality downloads. [Workflows](docs/WORKFLOWS.md) save recipes and column contracts, append/join tables with key checks, aggregate, and run against new files with persisted history and idempotent retries. [Analytics](docs/ANALYTICS.md) provides real Decimal totals/counts/averages, filtered charts and saved reports pinned to dataset versions. See the [cleaning guide](docs/CLEANING.md). Admin screens and public hosting remain next milestones. See [implementation status](docs/IMPLEMENTATION_STATUS.md) and the [plan](docs/PLAN.md).

![DataFlow workspace with the synthetic sales sample](docs/images/workspace-desktop.png)

## Local setup

Python 3.12+, Node 24, pnpm 11 and PostgreSQL 18. Use a **new database** for this project.

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r backend/requirements.lock
$env:DATABASE_URL = 'postgresql+psycopg://USER:PASSWORD@localhost:5432/dataflow'
$env:COOKIE_SECURE = 'false' # local HTTP only
$env:APP_ORIGINS = 'http://127.0.0.1:9001,http://127.0.0.1:5173'
.venv\Scripts\python -m alembic -c backend/alembic.ini upgrade head
$env:PYTHONPATH = 'backend'
.venv\Scripts\python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 9001
```

In another terminal, run `pnpm install --frozen-lockfile` and `pnpm dev` in `frontend/`. After `pnpm build`, the API also serves `frontend/dist` at its own address. Production HTTPS needs `COOKIE_SECURE=true` and an explicit allowlisted `APP_ORIGINS`.

Create a permanent account with `python -m app.cli create-user` (add `--admin` only for an operator). The command prompts for a password; there is no shared/default password. Run `python -m app.cli prune-guests` periodically to delete expired guest users and cascade-delete their data. A guest-creation request also prunes expired workspaces. Physical deletion is therefore conditional on a cleanup trigger, not instantaneous at expiry.

## Checks

```powershell
.venv\Scripts\python -m pytest
.venv\Scripts\python -m ruff check backend
cd frontend
pnpm test
pnpm build
```

For real PostgreSQL integration tests set `TEST_DATABASE_URL` to a dedicated database named **dataflow_test**. Tests create/drop their own tables; the guard rejects other PostgreSQL database names. Never point tests at an application database.

## Design and limits

FastAPI + SQLAlchemy/Alembic + PostgreSQL, React/TypeScript/Vite/Tailwind and i18next. A modular monolith keeps processing independent from HTTP. Initial imports are limited to 5 MB, 10,000 rows and 100 columns. XLSX macros, external links and unsafe archive sizes are rejected. CSV encodings are explicit rather than silently guessed. IDs and source values remain text. A column's suggested type is a heuristic, not a declared business rule; outliers are warnings.

Passwords use Argon2id. Sessions use HttpOnly cookies, CSRF checks and expiry. Data ownership is checked at the backend for list, preview, profiling and deletion. Rate limiting is currently per-process and intended for a single bounded instance; shared quotas and independent security review are needed before a public multi-instance service.

There are no patient records, paid AI APIs or invented business metrics. The [sample](sample_data/README.md) is synthetic with documented expected defects.
