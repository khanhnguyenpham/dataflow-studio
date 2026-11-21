# Changelog

## Unreleased

- Added typed cleaning recipes, expiring previews, explicit apply, retained versions and restore without overwriting source bytes.
- Added confirmed CSV/XLSX/JSON and quality/lineage exports with spreadsheet formula protection and no silent Excel truncation.
- Included preview/version payloads in conservative owner storage budgets.

- Started the isolated DataFlow Studio workspace.
- Added session authentication, owner-scoped datasets, bounded CSV/XLSX import and quality profiling.
- Added English/Vietnamese React UI and local synthetic checks.
- Corrected expiry comparison when PostgreSQL returns timestamps outside UTC.
- Serialized each owner's import quota so simultaneous uploads cannot exceed the guest limit.

This checkpoint is not a v1.0 release.
