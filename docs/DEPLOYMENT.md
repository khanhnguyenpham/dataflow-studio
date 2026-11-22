# Deployment

Status: source and local checks are available; **no public URL has been verified**.
Do not replace that statement with an invented URL or release badge.

## Free hosting target

Use one Docker web service on Render Free and a separate PostgreSQL 18 project
on Neon Free. The repository's `render.yaml` defines only the web service; it does
not create a paid resource or an expiring Render PostgreSQL instance.

The accounts need to be signed in by the owner before provisioning. Check the
actual plan screen before submitting. Never enter a card or enable a paid plan
as part of this setup.

1. Create a new **Free** Neon project/database dedicated to DataFlow. Choose the
   same or nearest available region as the web service. Keep its SSL connection
   URL private; use the direct endpoint for migrations/backup. The application has
   a small bounded connection pool and does not need a second application-side
   queue or multiple workers.
2. Create a **Free Docker web service** from this repository, branch `main`.
   Build with the root Dockerfile and use `/api/health` as health check.
3. In hosting secrets set `DATABASE_URL` to the SSL PostgreSQL URL,
   `APP_ENV=production`, `COOKIE_SECURE=true`, `RETENTION_ENABLED=true` and
   `APP_ORIGINS=https://ACTUAL-SERVICE.onrender.com` (exact origin, no path).
   Never paste secrets into source, issues, screenshots or CI logs.
4. Optionally initialize the first administrator using private environment secrets
   `BOOTSTRAP_ADMIN_USER` and `BOOTSTRAP_ADMIN_PASSWORD` (12–128 characters).
   Migration 0006 records that initialization completed. It never resets or
   re-promotes an existing account on restart. Remove these two secrets afterwards.
   There is no HTTP setup endpoint or default admin password.
5. Deploy a verified green commit. Startup migrates before serving. Inspect build
   and runtime logs without copying credentials. When GitHub is connected, select
   **After CI Checks Pass**; a public repository URL without a provider connection
   needs manual deploys.
6. Visit the real HTTPS URL in a fresh browser. Test health, guest isolation,
   sample/profile, file upload, preview/apply/export, workflow reuse, language,
   phone layout and a controlled invalid input. Verify a redeploy retains SQL data.
   Record the deployed SHA and URL only after these checks.

The image binds `PORT`, runs as a non-root user and serves React and API from one
origin. No uploaded data is stored on the container filesystem. PostgreSQL keeps
source bytes, versions and ownership. Do not use SQLite on an ephemeral host.

## Cost and availability limits

As checked on 22 November 2026, Render Free sleeps after fifteen idle minutes,
can take about a minute to wake, and does not provide an interactive shell.
Its free PostgreSQL databases expire after thirty days, which is why they are
not the persistence choice here. See [Render Free](https://render.com/docs/free).

Neon Free currently includes 1 GB/project storage, 100 CU-hours/project and 5 GB
transfer. It can scale to zero after inactivity. These are provider limits, not
application promises; verify current allowances in the dashboard.
See [Neon plans](https://neon.com/docs/introduction/plans).

A free portfolio host has no application availability SLA. Monitor storage,
transfer and compute; suspend or reduce usage if the allowance is exhausted.
Do not enable paid overages without the owner's approval.

Application defaults bound imports, shared payload and active guests; two concurrent
data requests and two Argon2id operations are admitted per process. The container
accepts at most eight concurrent requests. These controls reduce risk; they are not
a measured production throughput or a substitute for host-level abuse controls.
Run one app process/instance because rate buckets and admission counters are local.

Reference: [Render Blueprints](https://render.com/docs/blueprint-spec),
[deploy behavior](https://render.com/docs/deploys),
[Neon connections](https://neon.com/docs/connect/connect-from-any-app).
