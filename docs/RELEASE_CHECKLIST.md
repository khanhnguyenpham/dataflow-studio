# Release verification

## Verified locally on 22 November 2026

- Real PostgreSQL API/integration checks, Ruff, scoped engine mypy, frontend lint/tests/build.
- All eight browser flows passed with Recharts; the added release flow
  checks rule failures and six widths (360/390/430/768/1366/1920).
- Automated axe checks passed for quality at those widths and the desktop analytics report. They do not
  certify the whole application, screen-reader experience or WCAG conformance.
- Original source/version preservation, owner isolation, exact totals, safe export,
  saved workflows, schema alignment and admin access have executable tests.
- Fresh local backup/restore compared eleven table contents by digest.
- Known-advisory scans found zero issues for the pinned Python requirements and
  frontend dependency tree at the time recorded.

Evidence: [benchmark](evaluation/engine-benchmark.json),
[backup drill](evaluation/backup-restore.json),
[dependency audit](evaluation/dependency-audit.json),
[mapping regression](evaluation/schema-mapping.json).

The benchmark runs five deterministic steps, profile and grouped sum on 10,000
synthetic rows (9,000 output), twenty measured repetitions after warmup. Local
median 500.897 ms, nearest-rank p95 526.947 ms, traced Python allocation peak
4,363,591 bytes. This is engine timing, not HTTP/DB/hosting latency or RSS; tracing
runs separately from timings. Reproduce with
`PYTHONPATH=backend python -m app.benchmark --output PATH`.

## Before a v1.0 tag

- Review final source diff, ignored runtime and credential scan.
- Push a real feature branch and obtain green CI for its exact HEAD.
- Merge through a PR and verify the resulting main SHA/CI.
- Provision only approved Free hosting/database; store secrets privately.
- Verify the actual deployed SHA and HTTPS URL with a fresh browser.
- Run public guest, import, cleaning, workflow, analytics/export, language,
  invalid-input and isolation checks; confirm persistence across a restart.
- Verify operator access privately, remove first-admin bootstrap secrets and
  record backup/retention ownership.
- Add the real URL to README and create v1.0.0 only after these items are met.

Public provisioning and verification remain open. A successful local test or
design document is not evidence that a public service is running.
