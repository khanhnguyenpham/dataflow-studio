# Implementation status

Checkpoint: 21 November 2026. Product incomplete.

Discovery and foundation/import-profiling are implemented and merged through PR #1. The exact merged main commit `29734b9615937e137c1faa46124de8f236e32206` passed GitHub Actions, including container build/startup. PostgreSQL 18 runs in an isolated local cluster. The timezone-expiry bug found by PostgreSQL tests was corrected using timezone conversion rather than replacing timezone metadata.

The cleaning/export slice adds immutable versions, typed recipes, expiring preview/explicit apply, restore, safe downloads and total storage budgets. Local migration matches SQLAlchemy metadata (`alembic check`). Current checks: 25 PostgreSQL tests, Ruff, TypeScript/Vite, ESLint and 2 frontend tests passed. Desktop/mobile Edge walkthroughs passed; an additional browser flow previewed a six-to-five-row deduplication, saved version 2, downloaded Excel and restored version 1. Real screenshots are in docs/images. Excel representation-limit coverage passed. Remote CI for this slice is pending. Starlette emits a deprecation warning for the test client's httpx compatibility path; it does not fail tests.

Not implemented: joins, workflows, analytics, admin screens, intelligent matching and public deployment. No verified live URL exists. No background continuation is implied by this file.

Resume from `docs/PLAN.md`; rerun only checks affected by further changes. Never use the SIGMA database or modify its repository. Local ephemeral files, database and virtual environment belong under `.runtime/` and `.venv/`, which are ignored.
