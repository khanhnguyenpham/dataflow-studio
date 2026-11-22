# Implementation status

Checkpoint: 22 November 2026. Public HTTPS is verified at
https://dataflow-studio.onrender.com/. Final release gates remain below;
no v1.0 tag is claimed at this checkpoint.

## Implemented

- English/Vietnamese React workspace, session/CSRF authentication, isolated expiring guests and password changes.
- Bounded CSV/XLSX imports, multiple-sheet selection, profile and source preservation.
- Typed cleaning, before/after preview, explicit apply, retained versions/restore and safe CSV/XLSX/JSON/quality exports.
- Versioned reusable workflows, schema drift, append/left/inner joins, optional aggregation, persisted execution history and idempotent retries.
- Decimal analytics, source filters, suitable bar/line/pie charts and version-pinned saved reports with exports.
- Administration: account access/password resets, last-active-admin guard, operational run view, revisioned limits, cached quota accounting, automatic retention and metadata-only audit.

## Evidence

| Slice | PR | Merged main SHA | Exact feature-head and merged-main CI |
| --- | --- | --- | --- |
| Foundation/import | #1 | 29734b9615937e137c1faa46124de8f236e32206 | Passed |
| Cleaning/export | #2 | 7fb817fba5caba4f0b206ce4c2f22ac725bea6eb | Passed |
| Workflows/integration | #3 | 7b5fc7027a19fa9a4c7a6458e5b1efb8079cede7 | Passed |
| Analytics | #4 | 6c713bbeaae80ded441e52b068164b1e1926c62f | Passed |
| Administration | #5 | 429f1e6fd04866d749d437c9a81ab33ad2a63bd0 | Passed after the migration-path fix |
| Schema assistance | #6 | 119f1a37a915e64cf63be682e0f0f80366f3d5b3 | Passed |
| Release quality | #7 | 09436ae99ec267454a2cee6e5a97b90ddfe91cd9 | Feature-head and merged-main CI passed |
| Handoff documentation | #8 | 41b117c2761d7041295a23ec8501409726ef61c8 | Feature-head and merged-main CI passed |
| Public release preparation | #9 | 31425b50aeb1952c6c64db6572b339ac6076d221 | Feature-head and merged-main CI passed; deployed Live |
| Product workspace | #11 | 9cf543f0d25ba1d4ef295880ccfb452fabb6340f | Feature-head and merged-main CI passed; deployed Live; 13 further public API checks |

Historical local release-quality checks before this preparation slice: **60 backend tests with PostgreSQL integration**, Ruff and dependency consistency passed. **3 frontend tests**, ESLint and TypeScript/Vite build passed. **8 Edge browser flows** passed on a dedicated `dataflow_e2e` database, including admin account/limit/audit operations, English/VI, desktop/mobile, two-month join reuse, preview/apply/restore, all chart types and real downloaded JSON comparison. Ephemeral browser credentials were deleted after testing and are never committed. Real screenshots are in `docs/images`.

Migrations 0005/0006 matched model metadata and backfilled existing payload budgets. The local application has no unaccounted zero-size source/version/preview/definition/report rows. The isolated local application was restarted to this slice; SQL source bytes were not changed by quota backfill. This slice also passed scoped mypy for four core modules, six-width overflow/quality-screen axe checks and an analytics-screen axe check, known-advisory audits, a local engine benchmark and an eleven-table synthetic backup/restore drill. Container startup must pass again for this slice in remote CI. The remaining Starlette/httpx test-client deprecation warning is non-failing and unsuppressed.

## Verification scope

Reviewed column mapping now works for source and lookup inputs. A changed-November browser flow rejects schema drift, previews ordered/renamed columns, explicitly approves removal of an extra column, applies a derived version and reruns the saved workflow. The curated 16-field test split emitted ten correct suggestions and six matching abstentions; this is regression evidence, not broad ML accuracy. The exact-name baseline emitted five suggestions. See `docs/SCHEMA_ASSISTANCE.md`.

Release-quality source and handoff documentation merged through PR #8. Its
merged-main CI passed: https://github.com/khanhnguyenpham/dataflow-studio/actions/runs/44974947320.
The public version passed 42 named API acceptance checks with synthetic guest
data, including workflow reuse, schema drift, exact totals, export and isolation.
Public Edge import/analytics and private operator login were observed; see
[public verification](PUBLIC_VERIFICATION.md). Public checks do not replace the
source CI integration/browser suite, capacity testing or an independent security review.

## Release handoff

Render Free serves React/FastAPI; a dedicated Neon Free PostgreSQL 18 project
holds persistent data. The public application uses version 1.0.0 at PR #11's main
SHA above. In the earlier PR #9 deployment probe, the same guest session could read the same synthetic
dataset/version, including ID `001` and quantity `12`; its fixture was then removed.
See [deployment](evaluation/public-deployment.json) and
[persistence evidence](evaluation/public-persistence.json).
Private operator password rotation and bootstrap-secret removal remain open
before a v1.0 tag. Version metadata alone is not a completed release.

This slice's local checks: Ruff, 12 selected configuration/release tests with real
PostgreSQL integration, CLI parser checks and TypeScript/Vite build passed.
Its exact-head and merged-main CI passed, including the full backend/frontend,
browser, advisory and container checks. Final documentation checks separately
validate local Markdown targets and publish only aggregate/synthetic evidence.

The SIGMA repository/database stays outside this project's mutation scope;
local credentials, DB, environment and builds remain ignored. The local application
at http://127.0.0.1:9001 remains a separate development instance.
Use .runtime/connection.json for the current local PID; Windows venv launches a child
Python process, so inspect parent and app/port arguments before any future restart.

## Product usability refinement

Implemented on `feat/workspace-overview`: owner-scoped metadata home, a monthly
preparation landing page, useful empty states, dataset-to-analytics context,
saved workflow source/lookup handoff and pinned-report reopening. Data and
authentication contracts are retained. [Details and preflight evidence](PRODUCT_WORKSPACE.md).

This slice passed 62 backend tests with real PostgreSQL, 4 React tests,
Ruff/scoped mypy, ESLint/build and all 9 Edge browser flows. Scoped Welcome and
six-width Overview accessibility/overflow checks passed after correcting small
text contrast. Exact-head and merged-main CI subsequently passed for PR #11, and
its main SHA was observed Live with 13 additional public API checks and native
Edge navigation. This is separate from the initial 42-check public acceptance.

The next continuity change retains cleaning recipe steps during navigation in
the same signed-in tab, requires fresh previews on return, handles expired/revoked
sessions centrally and rejects stale responses after an identity change. Its
local checks passed: 14 React tests, lint/build and all 10 Edge flows. No backend
or database contract changed. New exact-commit CI and public rollout remain
separate gates; see [workspace behavior](PRODUCT_WORKSPACE.md).
