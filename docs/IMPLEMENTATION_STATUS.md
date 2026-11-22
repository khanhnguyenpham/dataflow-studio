# Implementation status

Checkpoint: 22 November 2026. Product remains pre-release; no verified public URL.

## Implemented

- English/Vietnamese React workspace, session/CSRF authentication, isolated expiring guests and password changes.
- Bounded CSV/XLSX imports, multiple-sheet selection, profile and source preservation.
- Typed cleaning, before/after preview, explicit apply, retained versions/restore and safe CSV/XLSX/JSON/quality exports.
- Versioned reusable workflows, schema drift, append/left/inner joins, optional aggregation, persisted execution history and idempotent retries.
- Decimal analytics, source filters, suitable bar/line/pie charts and version-pinned saved reports with exports.
- Administration locally: account access/password resets, last-active-admin guard, operational run view, revisioned limits, cached quota accounting, automatic retention and metadata-only audit.

## Evidence

| Slice | PR | Merged main SHA | Exact feature-head and merged-main CI |
| --- | --- | --- | --- |
| Foundation/import | #1 | 29734b9615937e137c1faa46124de8f236e32206 | Passed |
| Cleaning/export | #2 | 7fb817fba5caba4f0b206ce4c2f22ac725bea6eb | Passed |
| Workflows/integration | #3 | 7b5fc7027a19fa9a4c7a6458e5b1efb8079cede7 | Passed |
| Analytics | #4 | 6c713bbeaae80ded441e52b068164b1e1926c62f | Passed |
| Administration | #5 | 429f1e6fd04866d749d437c9a81ab33ad2a63bd0 | Passed after the migration-path fix |
| Schema assistance | Pending | Pending | Local checks passed; remote CI pending |

Current local checks: **52 backend tests with PostgreSQL integration**, Ruff and dependency consistency passed. **3 frontend tests**, ESLint and TypeScript/Vite build passed. **7 Edge browser flows** passed on a dedicated `dataflow_e2e` database, including admin account/limit/audit operations, English/VI, desktop/mobile, two-month join reuse, preview/apply/restore, all chart types and real downloaded JSON comparison. Ephemeral browser credentials were deleted after testing and are never committed. Real screenshots are in `docs/images`.

Migration 0005 matched model metadata and backfilled existing payload budgets. The local application has no unaccounted zero-size source/version/preview/definition/report rows. The isolated local application was restarted to this slice; SQL source bytes were not changed by quota backfill. Container startup passed for earlier merged slices; it must pass again for this slice in remote CI. The remaining Starlette/httpx test-client deprecation warning is non-failing and unsuppressed.

## Remaining

Reviewed column mapping now works for source and lookup inputs. A changed-November browser flow rejects schema drift, previews ordered/renamed columns, explicitly approves removal of an extra column, applies a derived version and reruns the saved workflow. The curated 16-field test split emitted ten correct suggestions and six matching abstentions; this is regression evidence, not broad ML accuracy. The exact-name baseline emitted five suggestions. See `docs/SCHEMA_ASSISTANCE.md`.

Remaining: release documentation, requested chart-library integration, benchmarks/accessibility review, verified public backend deployment and operational handoff. Do not call this v1.0 or claim hosting before those checks are complete. Resume from `docs/PLAN.md`. The SIGMA repository/database stays outside this project's mutation scope; local credentials, DB, environment and builds remain ignored.
