# Analytics and saved reports

Charts use Recharts (the only main chart library), lazy-loaded with analytics.
Arrow keys explore points; exact results remain in the adjacent table and JSON.

Select a dataset version, group column and row count, sum or average. For numeric operations choose the numeric column explicitly; inference does not silently coerce a date or ID. Confirm that you reviewed the selected version before calculating. An optional source-row filter runs before aggregation.

Calculations use bounded Decimal values, with 50 significant digits of working precision. Input numeric text must already use a dot decimal separator and no thousands grouping; clean it explicitly when needed. Invalid non-empty numbers fail visibly. Empty values are excluded from numeric operations and counted; all-empty numeric groups have a null result, not a made-up zero. Row counts include every matching row. Overall averages are weighted across valid source values, not averaged across group averages. With no filtered rows, count is zero and numeric totals remain null.

Bar charts support signed category values. Lines require normalized numeric or ISO-date groups and show ordered points, not a continuous-time interpolation. Pie charts require count/sum, at most eight groups, non-negative values and a positive total. Up to twenty non-empty groups are charted; the paginated table/export includes all groups (maximum 1,000). Missing numeric groups are omitted from the chart. Display labels are rounded; JSON preserves decimal text.

Name and save a preview to persist its configuration and dataset version. Reopening recomputes against that immutable version, even after restoring/cleaning the dataset. Filters, chart type and grouping remain part of the saved specification. There are up to ten saved reports per guest and thirty for other accounts. Deleting the source dataset also deletes its reports; deleting a report leaves the source intact.

Saved reports export CSV (formula-like group labels escaped) or JSON (configuration, exact values and source checksum). Dataset exports continue to support XLSX. A download requires explicit confirmation.

You can also save a previewed calculation as a workflow. Select another compatible dataset in Workflows and run it to create an aggregate-table preview. Applying that preview creates a new dataset version; source and earlier versions remain available. Transformations and an optional join run before aggregation when a definition combines them.

## Tiếng Việt

Chọn bảng, cột nhóm và phép đếm/tổng/trung bình. Với tổng hoặc trung bình, chọn rõ cột số và xác nhận đã kiểm tra phiên bản trước khi tính. Có thể lọc dòng trước khi tổng hợp. Ô trống được đếm riêng; số sai định dạng bị từ chối, không tự đoán hay bỏ qua.

Sau khi xem kết quả, đặt tên và lưu báo cáo. Báo cáo giữ cấu hình và phiên bản đã chọn; việc làm sạch/khôi phục sau đó không đổi số liệu lịch sử. Biểu đồ lấy số liệu thật từ các dòng đã chọn. Tệp JSON giữ số thập phân đầy đủ; số trên giao diện có làm tròn để dễ đọc.
