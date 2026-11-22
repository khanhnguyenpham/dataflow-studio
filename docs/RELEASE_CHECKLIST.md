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
[mapping regression](evaluation/schema-mapping.json),
[public HTTPS checks](evaluation/public-api.json).

The benchmark runs five deterministic steps, profile and grouped sum on 10,000
synthetic rows (9,000 output), twenty measured repetitions after warmup. Local
median 500.897 ms, nearest-rank p95 526.947 ms, traced Python allocation peak
4,363,591 bytes. This is engine timing, not HTTP/DB/hosting latency or RSS; tracing
runs separately from timings. Reproduce with
`PYTHONPATH=backend python -m app.benchmark --output PATH`.

## Before a v1.0 tag

- Review final source diff, ignored runtime and credential scan.
- Completed in PR #7: exact feature-head CI passed.
- Completed: merged main 09436ae99ec267454a2cee6e5a97b90ddfe91cd9 passed [CI](https://github.com/khanhnguyenpham/dataflow-studio/actions/runs/44974305512).
- Completed: dedicated Render Free/Neon Free resources; secrets in hosting settings.
- Completed: first deployed SHA 41b117c2761d7041295a23ec8501409726ef61c8 and
  real HTTPS URL verified with a fresh browser.
- Completed: public guest, import, cleaning/apply, workflow reuse, analytics/export,
  invalid-input and owner-isolation API checks; browser language/layout/import/analytics.
- Completed: existing operator login reaches Administration; operator owns private
  backups, quota monitoring and retention. Local backup drill is not cloud recovery.
- Completed: real URL and reproducible checks added to both READMEs.
- Pending: controlled restart with the same guest session and synthetic dataset.
- Pending: owner password rotation and removal of first-admin bootstrap secrets.
- Pending: final source diff/credential review, exact feature-head CI, merged-main
  CI and final deployed SHA/health verification for release preparation.
- Create v1.0.0 only after the remaining gates pass. A version string is not a tag.

See [public verification](PUBLIC_VERIFICATION.md) for direct observations and
their limits. Public deployment currently uses a manually selected green commit;
automatic delivery has not been verified.
