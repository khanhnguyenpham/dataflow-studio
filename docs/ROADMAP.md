# Roadmap

This separates shipped code from work that still needs verification.

| Stage / item | State | Problem and value | Effort / prerequisite | Acceptance |
| --- | --- | --- | --- | --- |
| NOW: imports, profiling, cleaning, integration | Implemented | Inspect inconsistent CSV/XLSX without overwriting source | Bounded local engine | Owner-scoped preview/apply/restore/export and malformed-input tests pass |
| NOW: reusable workflows and analytics | Implemented | Avoid rebuilding monthly reports | Validated input contracts | New-month rerun, drift/key failures and exact exported totals verified |
| NOW: accounts, guests and admin | Implemented | Isolate data and bound public use | PostgreSQL, secret operator setup | Role/owner checks, expiry, last-admin and quota concurrency tests pass |
| NOW: reviewed header matching | Implemented | Align renamed bilingual fields | Explicit confirmation | Curated baseline evaluation recorded; ambiguity abstains |
| NOW: release quality and public hosting | In Progress | Give reviewers a runnable system | Owner sign-in, Free service/database | Exact-SHA CI, real HTTPS workflows, persistence and private admin handoff verified before v1.0 |
| NEXT: wider matching evaluation | Planned | Avoid narrow dictionary assumptions | Independently labelled unfamiliar schemas | Report wrong matches and abstentions on a new held-out set before adding embeddings |
| NEXT: domain validation / anomaly rules | Planned | Separate unusual values from business errors | Labelled domain cases | Explain thresholds and evaluate false positives; no automatic corrections |
| NEXT: scheduling and shared execution | Planned | Run unattended reports reliably | Measured request-runner limits, durable queue | Recovery, retry, ownership and duplicate-delivery tests before enabling schedules |
| NEXT: enhanced analytics | Planned | Support more report questions | Real user examples and expected results | Each new metric has exact reference results and useful accessible UI |
| NEXT: database connectors | Planned | Avoid repeated manual files | Read-only credentials and network allowlists | Queries bounded; secrets isolated; revoked connections fail safely |
| NEXT: monitoring | Planned | Distinguish cold starts from failures | A deployed instance and usage evidence | Alert on health/storage/errors without logging sensitive values |
| LATER: natural-language operations | Idea | Reduce manual recipe configuration | Reliable labelled evaluation and whitelist compiler | Suggestions only; preview/confirmation; no arbitrary code or SQL |
| LATER: cloud storage imports | Idea | Reuse files from trusted sources | Scoped OAuth and retention design | Revocation, size and ownership enforced |
| LATER: teams and workflow sharing | Idea | Review work across owners | Tenant model and invitation policy | Explicit permissions with cross-tenant isolation tests |
| LATER: larger datasets / orchestration | Idea | Exceed current small-table limits | Measured demand, object storage and worker isolation | Real benchmarks, bounded streaming and recovery evidence |
| LATER: model monitoring | Idea | Detect degradation of future ML features | A justified deployed model | Drift/failure evaluation and rollback; not a decorative dashboard |
