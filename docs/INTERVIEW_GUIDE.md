# Code to understand and explain

Read these paths in order, run a small example, then change a rule and predict
which tests should fail. The useful interview story is the trade-off and evidence,
not a list of frameworks.

| Area | Code | Explain / reproduce |
| --- | --- | --- |
| Entry and boundaries | backend/app/main.py, config.py | Same-origin app, body limits, generic DB failures, bounded concurrency, production settings |
| Session security | backend/app/auth.py | Argon2id memory, digest-only sessions, HttpOnly/CSRF/expiry, revocation and reset/login race |
| Storage and migrations | backend/app/db.py, migrations/ | Immutable original, derived version pointer, foreign-key cascades, why PostgreSQL JSON is bounded |
| Parsing/profile | backend/app/processing.py | Encoding/sheets, text IDs, heuristic types, IQR warnings versus business rules |
| Deterministic engine | backend/app/transforms.py | Whitelist, strict schemas, ordered steps, ambiguity failure, non-mutating validation |
| Preview transaction | backend/app/versions.py, workspace.py | Stale/expired previews, explicit apply, idempotency, restore without erasing history |
| Integration/workflows | backend/app/integration.py, workflows.py | Lookup uniqueness, row multiplication prevention, schema drift, execution versus apply |
| Exact analytics | backend/app/aggregation.py, reports.py | Decimal/null semantics, weighted average, chart suitability, version-pinned reports |
| Assistance/evaluation | backend/app/schema_match.py, evaluate_mapping.py | Aliases/similarity, abstention, small curated fixture limits, no claim of general AI accuracy |
| Admin/resources | backend/app/admin.py, limits.py, maintenance.py | Last-admin concurrency, global→owner lock order, conservative payload budget, sleeping-host cleanup |
| Frontend state | frontend/src/useWorkspace.ts, useCleaning.ts, useWorkflows.ts | Abort/stale guards, preview invalidation, deliberate confirmation, retrying the same run |
| Delivery | .github/workflows/checks.yml, Dockerfile, render.yaml | Exact-SHA checks, non-root container, persistent SQL, Free-host limitations and unreleased state |

Three practical demonstrations:

1. Attempt to access another guest's dataset ID and show the backend denial.
2. Run the saved recipe on a renamed month: fail visibly, review mapping, apply
   a derived alignment and rerun without changing source bytes.
3. Export the reviewed November report: total 12, then restore the dataset and show
   the saved report still points to its earlier immutable version.

Do not claim all code or infrastructure was built unaided. Be ready to explain
the decisions you reviewed, tests you reproduced and limitations you would address next.
