# Troubleshooting / Xử lý lỗi

| Symptom | Check and next action |
| --- | --- |
| CSV text is garbled or encoding fails | Select the file's actual encoding. Re-export UTF-8 from the source if appropriate; do not keep a lossy import. |
| Several Excel sheets | Select the intended sheet. Empty sheets, macros, external links and unsafe archives are rejected. |
| Missing, duplicate or changed columns | Compare the saved contract; review the mapping helper. Keep originals; align a derived version and rerun. |
| Conversion or rule fails | Read the column and row positions shown. Confirm formats/business corrections. Numbers and dates are never guessed. |
| Join fails | Inspect both key columns for blanks, duplicate lookup keys or unmatched values. Allow unmatched keys only with a deliberate policy. |
| Preview expired or source changed | Recalculate from the current version. The old preview cannot safely be applied. |
| Completed run has no result preview | Previews expire after fifteen minutes or can be superseded. History remains; create a new deliberate run. |
| Pending/running after connection loss | Use Check / continue this run. It reuses the ID. An interrupted run older than two minutes becomes failed on retry. |
| Numeric total fails | Normalize the chosen measure explicitly. Empty numbers are counted separately; invalid non-empty values are not discarded. |
| Line or pie not allowed | Use a bar chart or correct grouping. Line needs numbers/ISO dates; pie needs ≤8 non-negative count/sum groups and positive total. |
| Guest quota reached | Export needed results. Remove an unneeded dataset/workflow/report or ask an administrator for a permanent account. Expiry is not extended by activity. |
| Busy / 429 | Wait briefly and retry. Do not repeatedly click; processing, authentication and guest creation are bounded. |
| Signed out / 401 | The session may have expired or been revoked after a password/access change. Sign in again. |
| Forbidden / CSRF | Open the correct same-origin tab and refresh. Production requires HTTPS and the exact APP_ORIGINS value. |
| Database unavailable / 503 | Operator: inspect private DB connectivity, SSL, storage, connection limits and migrations. Do not reinitialize an existing database. |
| Health is slow after idle | A free host/database may be waking up. Wait before retrying; this is not a promised always-on deployment. |

Errors expose controlled codes and selected row/column counts, not raw SQL,
passwords, uploaded values or tracebacks. Operator logs intentionally omit SQL
parameters. Record the time, screen and error code when reporting a problem.
Do not attach confidential files or tokens to public issues.

Tiếng Việt: kiểm tra đúng cột/định dạng trước khi sửa; không thay số tiền hoặc mã
theo phỏng đoán. Khi dữ liệu đổi hoặc bản xem trước hết hạn, tính lại trước khi lưu.
Nếu lỗi kết nối CSDL, kiểm tra cấu hình và tình trạng máy chủ; không tạo lại CSDL
đang có dữ liệu để “sửa nhanh”.
