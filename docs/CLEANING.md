# Cleaning and exports

**Check a rule** adds non-mutating validation to a recipe/workflow: required,
unique, normalized number or explicit-format date. It stops with column/count
and the first ten failing row positions (relative to this step's input, including
the header). Empty values fail unless explicitly allowed; required always rejects
blanks. A failed rule never creates an applied version.

Import never cleans values. Version 1 retains the parsed source and uploaded bytes. A recipe uses only typed operations, with a maximum of 20 steps. Columns refer to the output of the preceding step.

1. Open **Clean & export** and select a dataset.
2. Add operations. Trimming, Unicode NFC, rename, explicit missing-value fill, exact replacement, key-based deduplication, date/number conversion, filtering, split and combine are supported.
3. Preview before/after (first 10 rows), total row counts and per-step cell updates. Row filtering/deduplication is counted separately from cell updates. Adding or renaming columns is visible in the resulting headers, not counted as a cell update.
4. Confirm to create a new version. Previewing alone changes no dataset values. A new preview supersedes that dataset's pending draft; previews expire after 15 minutes. A changed current version makes a draft stale.
5. Restore any retained version. This changes the current pointer; it does not erase later history. A new branch receives the next unused version number. Guest workspaces retain up to five derived versions per dataset, other accounts twenty.

Dates require an explicit format. The engine rejects invalid or ambiguous dates rather than guessing. Number conversion requires explicit decimal/thousands separators and valid grouping. Identifiers remain strings unless the user explicitly selects conversion. Deduplication keeps the first row for each selected key; review the preview before accepting that policy. Combine adds a column and treats a missing component as empty text; split requires the requested number of parts on each non-null value. A failed conversion does not save partial changes.

Exports require explicit confirmation of the current version. Excel stores text rather than formulas; values that Excel cannot represent (control characters or text longer than 32,767 characters) are rejected rather than silently truncated. CSV uses UTF-8 with BOM and prefixes an apostrophe for formula-like fields, including negative numbers. Use JSON for exact text interchange. The quality JSON includes source checksum and the applied lineage of the exported version.

Storage checks include source bytes, parsed records, previews and retained versions. The conservative JSON budget is 64 MiB for guests and 256 MiB for other accounts; it can reject a large recipe even when the source upload is below 5 MiB. The original source-file quota (10/50 MiB) and dataset-count quota (3/30) also apply. Owner row locks serialize write quotas on PostgreSQL.

## Tiếng Việt

Mở **Làm sạch & xuất**, chọn bảng, thêm các bước rồi bấm **Xem trước thay đổi**. Kiểm tra số dòng, các ô cập nhật và kết quả trước/sau trước khi xác nhận. Bản xem trước không tự sửa dữ liệu. Nếu bảng đã đổi hoặc bản xem trước quá 15 phút, cần xem trước lại.

Mỗi lần áp dụng tạo một phiên bản riêng. Khôi phục chỉ chuyển phiên bản đang dùng, không xóa lịch sử. Chuẩn hóa ngày/số cần cấu hình rõ; hệ thống không đoán ngày sai, điền số tài chính hay sửa mã hàng. Khi loại trùng theo khóa, dòng xuất hiện đầu tiên được giữ lại.

Xuất tệp cần xác nhận phiên bản. Excel giữ dạng văn bản; CSV thêm dấu nháy đơn để tránh công thức chạy ngoài ý muốn. JSON giữ nguyên chuỗi. Báo cáo chất lượng kèm checksum nguồn và các bước xử lý. Xóa bảng sẽ xóa cả nguồn, phiên bản và bản xem trước; không thể hoàn tác thao tác xóa.
