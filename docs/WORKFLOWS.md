# Reusable workflows

## Create, run, confirm

1. In **My datasets**, load October sales, product lookup and November sales using the sample menu, or import your own files. Three datasets fit the guest limit.
2. Select October and open **Clean & export**. For this example, remove duplicate `Order ID` keys (keep first).
3. Expand **Save a reusable workflow**. Name it and describe the intended rule. Optionally choose append, left join or inner join; select lookup and keys. The definition stores column contracts and typed operations, not file values or hardcoded results.
4. Open **Workflows**, select the definition and source/lookup inputs. Run it. The backend records pending, running and completed/failed states. This bounded implementation executes on request; it does not claim a distributed queue, scheduled runs or cancellation.
5. Inspect the preview, row counts, matched/unmatched keys and unused lookup rows. Confirm to create a source dataset version. Export from **Clean & export**. Completed execution does not mean the result was applied.
6. Choose November and the appropriate lookup. Run the same saved version again. Input dataset versions and definition version are captured at creation; subsequent edits do not rewrite history.

October still has a bad date, textual quantity and missing quantity after deduplication. Joining labels does not fix these values. Review and explicitly resolve them using business decisions before numeric/date analytics; the system never guesses replacements. November has valid quantities and one duplicate order.

## Integration rules

- Append requires the same column names, but aligns a different order by exact names.
- Joins use exact text equality. Clean whitespace/case in the inputs explicitly when appropriate.
- Lookup keys must be non-empty and unique. Duplicate lookup keys fail rather than multiply sales rows.
- Repeated source keys are allowed for many-to-one joins; their count is reported.
- Unmatched source keys fail unless explicitly allowed. Left joins retain unmatched rows with missing lookup values; inner joins omit them. Counts are shown before applying.
- Colliding lookup column names receive `right.` prefixes. If this creates another collision, rename input columns explicitly.
- Output row, column and payload limits apply to integration as well as imports.

## Definitions, failures and retries

Saved column contracts are ordered. New/missing/renamed/reordered columns fail as schema drift. Inspect reported missing/unexpected names and the original contract. Draft steps can be added, reordered, removed or disabled. Save a new version using selected reference inputs after reviewing the rule; disabled steps are omitted. Running uses the saved version, never an unsaved draft. Change a join/key by saving a separately reviewed recipe from Clean & export.

Definitions are immutable, with up to ten retained versions. Guest limits: five workflows and thirty run-history entries; other accounts: twenty workflows and two hundred runs. Deleting a workflow removes its definitions/history, not previously applied dataset versions. Deleting an input dataset cascades its dependent runs. Storage budgets include definitions.

Retries reuse an idempotency key for the same request. A changed request with that key fails. Completed/failed executions are never implicitly reprocessed; create a new run for a deliberate rerun. An interrupted running execution is marked failed after two minutes when execution is retried; results are not silently reapplied. Previews expire after fifteen minutes and may be superseded by a new preview on the same dataset. History retains counts/status after preview expiry.

## Tiếng Việt

Trong **Làm sạch & xuất**, thêm các bước rồi mở **Lưu quy trình dùng lại**. Chọn cách ghép bảng và khóa nếu cần. Sau đó mở **Quy trình**, chọn nguồn tháng mới và bảng tra cứu để chạy. Kết quả mới là bản xem trước; cần xác nhận để lưu thành phiên bản dữ liệu.

Khóa tra cứu trùng hoặc trống bị từ chối. Khóa nguồn không khớp cần được kiểm tra hoặc chủ động chấp nhận. Nếu tên/thứ tự cột đổi, lượt chạy báo thất bại thay vì tự ghép nhầm. Có thể sửa thứ tự, tắt hoặc thêm bước vào bản nháp rồi lưu phiên bản quy trình mới. Lịch sử cũ không bị viết lại.
