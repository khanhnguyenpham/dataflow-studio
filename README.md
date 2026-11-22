# DataFlow Studio

DataFlow Studio is a web workspace for inspecting spreadsheets and building repeatable data preparation workflows. Its central use case is a monthly report: import messy sales and product files, inspect changes before applying them, join the sources, and reuse the process next month.

[Tiếng Việt](README.vi.md)

## Current checkpoint

Import, profiling, versioned cleaning/export, reusable workflows and saved analytics work end to end. This is **not the finished platform** and there is no verified public deployment yet.

Available in this working slice: isolated, two-hour guest sessions; sign-in and password changes; bounded CSV/XLSX imports; explicit selection of Excel sheets; dataset preview; missing values, duplicate rows, suggested types and review warnings; English/Vietnamese UI. Source bytes and values are retained without automatic correction. Accounts are created by an operator.

Clean & export adds typed recipes and validation rules, before/after previews,
explicit apply, retained versions/restore and CSV/XLSX/JSON/quality downloads.
Workflows reuse cleaning, checked joins and optional aggregation on new files.
Analytics uses Decimal totals/counts/averages, Recharts and version-pinned reports.
Administration manages accounts, quotas, retention and metadata-only audit.
Reviewed bilingual column suggestions help align renamed monthly files.

Start with the [user guide](docs/USER_GUIDE.en.md), or read the
[operator guide](docs/ADMIN.md), [architecture](docs/ARCHITECTURE.md),
[roadmap](docs/ROADMAP.md) and [release checks](docs/RELEASE_CHECKLIST.md).
The [deployment configuration](docs/DEPLOYMENT.md) targets Render Free with
external Neon PostgreSQL; account sign-in and real public verification are still open.
See [implementation status](docs/IMPLEMENTATION_STATUS.md).

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

Create a permanent account with `python -m app.cli create-user` (add `--admin` only for an operator). The command prompts for a password; there is no shared/default password. Run `python -m app.cli prune-guests` periodically to delete expired guest users and cascade-delete their data. Cleanup also runs at startup, every sixty seconds while the app is awake, and on guest creation. An offline/sleeping host cleans up when it resumes; access expiry is still enforced.

## Checks

```powershell
.venv\Scripts\python -m pytest
.venv\Scripts\python -m ruff check backend
.venv\Scripts\python -m mypy
cd frontend
pnpm test
pnpm build
```

Browser checks use an independently migrated database named **dataflow_e2e**, ephemeral accounts and a redacting test runner; see the [operator guide](docs/ADMIN.md#browser-checks). Never reuse an application database for these checks.

For real PostgreSQL integration tests set `TEST_DATABASE_URL` to a dedicated database named **dataflow_test**. Tests create/drop their own tables; the guard rejects other PostgreSQL database names. Never point tests at an application database.

## Design and limits

FastAPI + SQLAlchemy/Alembic + PostgreSQL, React/TypeScript/Vite/Tailwind and i18next. A modular monolith keeps processing independent from HTTP. Initial imports are limited to 5 MB, 10,000 rows and 100 columns. XLSX macros, external links and unsafe archive sizes are rejected. CSV encodings are explicit rather than silently guessed. IDs and source values remain text. A column's suggested type is a heuristic, not a declared business rule; outliers are warnings.

Mypy currently checks four core configuration/processing modules, not every
endpoint. CI also runs PostgreSQL API checks, browser flows, known-advisory audits
and a real Docker startup. Read the recorded evidence for each check's limits.

Passwords use Argon2id. Sessions use HttpOnly cookies, CSRF checks and expiry. Data ownership is checked at the backend for list, preview, profiling and deletion. Rate limiting is currently per-process and intended for a single bounded instance; distributed request admission and independent security review are needed before a public multi-instance service.

There are no patient records, paid AI APIs or invented business metrics. The [sample](sample_data/README.md) is synthetic with documented expected defects.

For code walkthroughs and interview preparation, see [what to understand](docs/INTERVIEW_GUIDE.md).
