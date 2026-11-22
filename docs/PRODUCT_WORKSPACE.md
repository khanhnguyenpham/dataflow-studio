# Product workspace

The default entry is Overview. It answers three practical questions: which file
to inspect, which preparation to continue and which saved report to reopen.
The landing page explains the monthly-report use case with a labelled example
workflow. It does not display invented execution statistics or business results.

## Metadata and ownership

`GET /api/overview` is authenticated and owner-scoped, including administrators.
It returns four real counts and limited recent metadata: five datasets, five
workflow executions and four saved reports. It selects no original bytes,
records, preview samples or workflow result payloads. Dataset row counts refer
to the current version, including after restore. The root workspace does not
fetch selected cell/profile data until a preparation page is opened.

The overview is a live navigation view, not an atomic reporting snapshot.
Counts can change with concurrent activity. Failed requests show an error/retry;
they are not rendered as successful zero counts. The initial sample import
refreshes home when the dataset list arrives.

## Handoffs that retain context

- A recent dataset opens its quality page with that input selected. The dataset
  preparation path links inspection, cleaning and analytics.
- Creating a workflow from the empty workflow screen opens preparation and its
  workflow form; a workspace without data starts at file import.
- After saving a workflow, opening it retains the definition, source and lookup.
  It does not execute or apply automatically. Version/idempotency checks remain.
- Analytics starts with the selected dataset. A recent saved report fetches that
  report's pinned version, rather than assuming the current dataset version.
- Workflow completion means execution completed. Review and explicit apply are
  still separate; the activity view states this distinction.

UI modules: `frontend/src/Welcome.tsx`, `WorkspaceOverview.tsx`, `product.css`
and the existing workspace hooks. Metadata API: `backend/app/overview.py`.
No new dependency, database migration or authentication permission is introduced.

## Verification

Local preflight on 22 November 2026: **62 PostgreSQL backend tests**, Ruff,
four-module mypy, **4 React tests**, ESLint and TypeScript/Vite build passed.
All **9 Edge browser flows** passed together after changes, including saved
workflow source/lookup handoff and reopening a pinned report from Overview.
Welcome passed a scoped automated axe check at desktop size; Overview passed
overflow and scoped axe checks at six widths (360/390/430/768/1366/1920).
Existing quality/analytics accessibility and functional checks still passed.
These checks do not certify all screens or full WCAG conformance.

Screenshots in `docs/images/product-*` are from actual local browser flows with
synthetic data. Exact-head/merged-main CI and a real public rollout must be
verified separately; local checks are not evidence of a public deployment.
