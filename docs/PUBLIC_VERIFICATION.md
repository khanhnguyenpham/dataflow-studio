# Public deployment verification

Verified on 22 November 2026 at **https://dataflow-studio.onrender.com/**.
The first live deployment was observed in the Render console at source commit
`41b117c2761d7041295a23ec8501409726ef61c8`; its exact merged-main
[CI passed](https://github.com/khanhnguyenpham/dataflow-studio/actions/runs/44974947320).
Health returned `status=ok`, application version `0.1.0`.

## Functional acceptance over HTTPS

[Machine-readable result](evaluation/public-api.json) records 42 unique named
checks from an actual run of `scripts/verify_deployment.py`. Repeated request
status checks share a name; this is not a coverage percentage or a load test.

- Secure/HttpOnly/SameSite cookies, response security headers, unauthenticated
  denial, CSRF and unapproved-origin rejection.
- Two isolated guests: another owner cannot open datasets, profiles, workflows
  or saved reports, and guests cannot access administration.
- Empty import and incorrect explicit date format rejected; duplicate profile
  checked against a synthetic source.
- Deduplication, validation, left join, real run states, idempotency and explicit
  apply. Original source remains unchanged before approval.
- Reuse on a changed November schema: visible failure, review-only suggestions,
  explicit column alignment and successful reuse of the saved definition.
- Exact November sum **12** across two products; CSV/XLSX/JSON/quality downloads,
  leading-zero IDs and downloaded report totals checked.
- A saved report keeps its version and result after restoring the source.

The script creates its own synthetic fixtures and removes only resources created
by that invocation, then closes both sessions. No IDs, credentials, tokens,
uploaded business records or private database details are published.

Reproduce only on the explicitly authorized instance:

```powershell
.venv\Scripts\python scripts/verify_deployment.py --base-url https://dataflow-studio.onrender.com --commit VERIFIED_FULL_SHA --output .runtime/public-api.json
```

`--commit` records a SHA separately verified in the hosting console. The script
does not infer deployed provenance from an HTTP response or from a Git checkout.

## Browser observations

The real public application was opened in Edge. A derived synthetic November CSV
with three rows was imported; grouped sum by Product Code displayed **12** across
three groups, then a version-1 report was saved. This CSV was prepared by a
recorded local deduplication of `sample_data/next-month-sales.csv`; it is not
evidence of public browser apply. Public API apply is checked above, and the
full preview/apply/restore browser flow is covered by the eight source CI flows.
The public interface was switched from English to Vietnamese successfully.

Public root/workspace navigation was measured at CSS widths 360, 390, 430, 768,
1366 and 1920 without horizontal page overflow. This check does not cover every
table or screen. Separate source CI axe checks cover the quality screen at those
six widths and desktop analytics; neither check certifies full WCAG compliance.

Existing operator login reached Administration and its persisted Usage limits:
20 concurrent guests, 256-MiB global payload budget and the documented retention
routine. Public verification was read-only; it did not create accounts, change
roles, reset passwords or change quotas. Those mutations have separate local/CI
integration and browser tests.

## Persistence and operational handoff

Controlled service-restart verification and removal of first-admin bootstrap
secrets are pending. No v1.0 tag has been created at this checkpoint.

Render and Neon are dedicated Free resources in Virginia, with no paid instance
or card used. The public Git URL deployment uses manually selected, green source
commits. Automatic delivery through the Git provider has not been verified.

The operator owns service access, account administration, provider allowance
monitoring and private backups. Guest cleanup runs at startup and each minute
while awake; a sleeping host resumes cleanup when it wakes. The eleven-table
[backup/restore drill](evaluation/backup-restore.json) used fresh local synthetic
databases, not a cloud recovery or disaster-recovery exercise.
