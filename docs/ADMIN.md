# Operator and administrator guide

Run migrations before starting the application. Bootstrap the first administrator using `python -m app.cli create-user --admin` in a private terminal with `DATABASE_URL` set. The command prompts for credentials; there is no shipped admin account or default password. Regular accounts are created by an operator or an authenticated administrator. The service has a 100-account administrative creation cap; the operator CLI remains an explicit bootstrap/recovery tool.

## Permissions and accounts

Administration is visible only to administrators, and every endpoint independently enforces the role. Administrators manage access and operational metadata; they do not bypass ownership checks to read other people's datasets, versions, previews, workflows or reports.

Create an account with a 12–128 character password. Share initial credentials privately and ask the owner to change their password. Deactivation, role changes and password resets revoke existing sessions. At least one active administrator must remain. The shared configuration lock makes concurrent changes obey that rule. A password changed during an in-progress login cannot be used to create a new session after the reset.

The browser uses an HttpOnly cookie and in-memory CSRF value. Passwords/tokens are not saved to localStorage. Up to eight sessions per account are retained; normal sessions expire after eight hours and guests after two. Login attempts are bounded per process/IP. Guest creation allows ten attempts per five minutes, supporting shared office/student networks; total active guests and storage are bounded separately. The application supports one bounded instance; do not describe its in-memory request limiter as a distributed abuse-prevention service.

## Limits and storage

The Usage limits page edits bounded guest/user quotas for source files, datasets, retained versions, workflows, runs and reports, plus the active-guest and global payload budgets. Changes carry a configuration revision; a stale edit is rejected. Lowering limits does not delete existing data, but future writes may be blocked.

Defaults retain the earlier per-user quotas, with twenty active guest workspaces and a 256-MiB global payload budget. Storage accounting includes uploaded bytes, parsed source, previews, derived versions, workflow definitions and saved report specifications. Cached conservative sizes avoid scanning large JSON payloads for every quota check. Migration 0005 backfills legacy sizes without changing source bytes or values. Writes lock the singleton configuration row, then the owner, so simultaneous owners cannot exceed the shared budget. This deliberately serializes bounded writes; it is not a design for high-throughput multi-tenant ETL.

Accounted payload is not the actual PostgreSQL data-directory size. Indexes, WAL, sessions and audit metadata also consume disk. Monitor provider storage and backups independently before increasing limits.

## Retention and monitoring

While the app is awake, cleanup runs at startup and checks every sixty seconds. It removes expired guests (and their dependent data), previews and login sessions. Audit history is trimmed to thirty days and approximately 5,000 events. A sleeping/offline host cannot run cleanup until it starts again; expiry checks still deny access. An administrator can trigger cleanup, and the operator CLI `prune-guests` uses the same routine.

The operational run view filters real persisted pending/running/completed/failed states and error codes. Administrators cannot execute another owner's workflow through that view. Logs contain action identifiers, object IDs and application-selected counts/state metadata; no passwords, token values or uploaded cell values. Deleted actors are labelled as system/removed accounts.

Production configuration (`APP_ENV=production`) requires PostgreSQL, Secure cookies, retention enabled and explicit HTTPS origins. Boolean settings reject typos. Keep `DATABASE_URL` in hosting secrets and use HTTPS. Local development may use `COOKIE_SECURE=false` for loopback HTTP.

## Browser checks

Browser tests use a separate local database named `dataflow_e2e`, not the application's database. Migrate it, run `backend/tests/browser_accounts.py create` with its `DATABASE_URL`, set `E2E_DATABASE_URL`, and execute `backend/tests/browser_runner.py`. Set `DATAFLOW_PNPM` or `DATAFLOW_PYTHON` if those commands are not on PATH. `E2E_PORT` can select a spare loopback port. The runner redacts ephemeral passwords; admin traces are disabled. Afterwards run the fixture helper with `cleanup`. Runtime credential files are ignored and must never be committed.

## Tiếng Việt

Tạo quản trị viên đầu tiên bằng lệnh `create-user --admin` sau khi chạy migration. Mật khẩu được nhập trong terminal, không có mật khẩu mặc định. Trang **Quản trị** cho phép tạo/khóa tài khoản, đổi quyền, đặt lại mật khẩu, xem trạng thái lượt chạy, chỉnh giới hạn và xem nhật ký. Không thể khóa hoặc hạ quyền quản trị viên đang bật cuối cùng.

Đổi quyền, khóa tài khoản hoặc đặt lại mật khẩu sẽ thu hồi các phiên đăng nhập. Quyền quản trị không cho phép mở dữ liệu riêng của người khác. Giới hạn áp dụng cho lần ghi mới; dữ liệu cũ không bị xóa khi hạ giới hạn.

Khi máy chủ hoạt động, tác vụ dọn dữ liệu hết hạn chạy mỗi phút và lúc khởi động. Máy chủ ngủ sẽ dọn khi chạy lại. Nhật ký lưu thông tin thao tác và số lượng, không lưu mật khẩu hay nội dung ô dữ liệu.
