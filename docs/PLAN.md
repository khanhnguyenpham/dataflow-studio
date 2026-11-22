# Implementation plan

## Discovery

On 21 November 2026, the authenticated GitHub account was verified as `khanhnguyenpham`; the target repository returned 404 before creation. Public profile and READMEs for `inventory-order-management`, `hospital-appointment-risk-system` and `outpatient-operations-analysis` were read. This is a product-scope review, not an independent audit of those entire codebases or individual authorship.

Those projects address inventory, appointment prioritization and outpatient analysis. DataFlow instead accepts user-provided tables and makes preparation repeatable across domains. Existing repositories, their data and their Git histories are outside this project's mutation scope.

## Decisions

- Modular monolith; no orchestration framework or queue without measured need.
- React/TypeScript/Vite, Tailwind, Lucide and i18next; one consistent workspace rather than decorative dashboards.
- FastAPI and SQLAlchemy; Alembic migrations and PostgreSQL in real integration checks. SQLite is only a fast test adapter.
- Bounded source bytes and parsed records initially live in PostgreSQL. This makes import and ownership atomic, at the cost of duplication and a deliberately small dataset limit. Reconsider object storage before raising limits.
- No automatic correction of dates, finance or IDs. Explicit encodings and worksheet selection. Type inference is labelled as a suggestion.
- Cookie sessions, CSRF, owner-scoped queries and two-hour guest expiry. Public exposure waits for quota, retention and deployment verification.
- High/Extra High settings cannot be changed by this task's tools. Keep routine work concise and reserve deeper review for authorization, bounded parsing and transaction correctness; do not create agents solely to simulate an effort switch.

## Milestones and acceptance

| Milestone | Acceptance |
| --- | --- |
| 0 Discovery | Account/target verified; separate repository; scoped architecture and this plan. |
| 1 Foundation | API and React integrate with PostgreSQL; migration works; English/VI, session/CSRF and isolation tested; Docker setup checked before calling it complete. |
| 2 Import and profiling | CSV and XLSX/multi-sheet; invalid/empty/encoding/size cases; original values retained; missing/duplicates/type suggestions; browser walkthrough on desktop/mobile. |
| 3 Cleaning and export | Whitelisted typed steps; immutable versions; before/after impact; explicit apply/undo; safe CSV/XLSX export; invalid conversions fail with reviewable errors. |
| 4 Reusable workflows | Versioned definitions and input contracts; repeat on next month's data; schema drift and bad join keys fail visibly; real run states and idempotency. |
| 5 Analytics | Aggregate actual confirmed data; persistent chart/filter configuration; export; no hardcoded KPIs. |
| 6 Admin and demo | User management, real backend permissions, retention, guest limits and audit; no production admin in demo. |
| 7 Targeted intelligence | Rule/string matching with labelled evaluation; add embeddings only if measured improvement; no paid API requirement. |
| 8 Release | Full tests/CI, responsive and accessibility checks, real screenshots, guides, benchmarks, verified HTTPS demo, backup/restore; only then tag v1.0.0. |

Each slice goes through a feature branch and PR. Merge only after the exact commit's CI is successful. Do not claim unavailable features or deployment as complete. No paid hosting resources without explicit approval.

## Next slice

Milestones 0–7 and release-quality source are implemented. PRs #1–#8 passed
exact feature-head and merged-main CI. Dedicated Free Render/Neon resources are
live: public HTTPS acceptance passed 42 named checks on commit
`41b117c2761d7041295a23ec8501409726ef61c8`, with synthetic-only data and fixture
cleanup. Public browser import/analytics, language switching and six-width root
layout checks were observed; existing operator login reached Administration.

Version 1.0.0 preparation merged through PR #9 after exact feature-head CI.
Merged-main CI passed at `31425b50aeb1952c6c64db6572b339ac6076d221`; Render Live,
HTTPS health/React entry and same-session SQL persistence across replacement
were verified. Processing behavior was retained. Before tagging: finish private
owner password rotation/bootstrap-secret removal and record the final handoff.
No automatic CD claim: the current public-Git deployment is manual after green CI. See
[verification](PUBLIC_VERIFICATION.md) and [release gates](RELEASE_CHECKLIST.md).

## Product usability refinement — 22 November 2026

Implemented and locally verified following the owner's feedback that the public
product feels too basic. Scope: a useful workspace home, a clearer monthly-report entry point and
retained context between preparation, workflows and analytics. The owner also
requested DataFlow first on their GitHub profile; profile presentation is now
explicitly within scope, while the other project code remains untouched.

Acceptance:

- Home counts/recent datasets/runs/reports come from owner-scoped metadata, with
  current-version row counts and no uploaded cell materialization or invented KPIs.
- Failed reads show an actionable error rather than zero counts. Existing role,
  source preservation, explicit apply and pinned-report contracts stay intact.
- Landing illustrations are labelled examples; preparation steps, failed jobs and
  empty states explain the next useful action.
- Opening a saved workflow retains its source/lookup; opening a recent report
  retains the saved version; dataset-to-analytics keeps the selected input.
- Real PostgreSQL integration, React tests, lint/build, browser flows and scoped
  six-width accessibility checks pass. Capture real UI screenshots. Merge only
  after exact-head CI and verify the merged-main CI and public deployment.
- Add the verified live app/source first to the GitHub profile project section,
  preserving the existing entries; verify pin order through the actual profile UI.

Preflight passed: 62 real-PostgreSQL backend tests, 4 React tests, lint/build,
scoped mypy and all 9 Edge browser flows. The new Welcome/Overview checks include
scoped axe and six-width Overview overflow checks. Owner metadata, current-version
counts, workflow source/lookup and pinned-report handoffs were exercised.
Profile README update `2a5ca6396285da890aab3ab9ef38333fd3274967` is on its remote
main; its repo has no CI workflows. The DataFlow About link is the verified live URL.
This application slice still requires exact-head/merged-main CI and public rollout.
