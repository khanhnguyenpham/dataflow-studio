# Implementation status

Checkpoint: 21 November 2026. Product incomplete.

Discovery and foundation/import-profiling are implemented and merged through PR #1. The exact merged main commit `29734b9615937e137c1faa46124de8f236e32206` passed GitHub Actions, including container build/startup. PostgreSQL 18 runs in an isolated local cluster. The timezone-expiry bug found by PostgreSQL tests was corrected using timezone conversion rather than replacing timezone metadata.

The cleaning/export slice adds immutable versions, typed recipes, expiring preview/explicit apply, restore, safe downloads and total storage budgets. Local migration matches SQLAlchemy metadata (`alembic check`). Current checks: 25 PostgreSQL tests, Ruff, TypeScript/Vite, ESLint and 2 frontend tests passed. Desktop/mobile Edge walkthroughs passed; an additional browser flow previewed a six-to-five-row deduplication, saved version 2, downloaded Excel and restored version 1. Real screenshots are in docs/images. Excel representation-limit coverage passed. Remote CI for this slice is pending. Starlette emits a deprecation warning for the test client's httpx compatibility path; it does not fail tests.

The cleaning slice was merged through PR #2 after both exact-head workflows passed (`d0f5b3ad0155de47580639048aaf7e39c4dc7580`); the merged main SHA is `7fb817fba5caba4f0b206ce4c2f22ac725bea6eb`.

Workflow/integration now works locally: versioned typed definitions, ordered input contracts, key checks, append/left/inner joins, captured input versions, persisted states/history and idempotent retries. Preview/apply is shared with cleaning. The UI supports draft step ordering/enabling and saving a new version. Check results: 31 PostgreSQL tests (including concurrent execute/apply), Ruff, 3 frontend tests, ESLint and build passed. Four Edge browser flows passed, including loading three real synthetic CSVs, saving a lookup join, applying October, reusing November, Vietnamese and mobile overflow. Migration metadata comparison passed before the final error-message-only changes. Remote CI for the workflow slice is pending.

Not implemented: analytics, admin screens, intelligent matching and public deployment. No verified live URL exists. No background continuation is implied by this file.

Resume from `docs/PLAN.md`; rerun only checks affected by further changes. Never use the SIGMA database or modify its repository. Local ephemeral files, database and virtual environment belong under `.runtime/` and `.venv/`, which are ignored.
