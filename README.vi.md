# DataFlow Studio

Ứng dụng web để kiểm tra bảng tính và xây dựng quy trình xử lý có thể chạy lại. Bài toán chính là tổng hợp báo cáo tháng từ các tệp bán hàng/sản phẩm chưa đồng nhất.

## Hiện trạng

**Web công khai:** [dataflow-studio.onrender.com](https://dataflow-studio.onrender.com/).
React và FastAPI chạy chung trên Render Free, dữ liệu lưu trong PostgreSQL của
Neon Free. Đã kiểm tra qua HTTPS ngày 22/11/2026; xem [bằng chứng kiểm tra](docs/PUBLIC_VERIFICATION.md).
Sau thời gian không sử dụng, host Free có thể mất khoảng một phút để khởi động.

Đã có không gian guest riêng, đăng nhập, nhập CSV/XLSX, chọn trang tính, xem trước và xem ô thiếu/dòng trùng/cảnh báo. Phần Làm sạch & xuất hỗ trợ thêm bước, xem trước tác động, xác nhận lưu phiên bản, khôi phục và tải CSV/XLSX/JSON hoặc báo cáo chất lượng. Giao diện hỗ trợ tiếng Việt/Anh. Dữ liệu không bị tự sửa; nguồn và các phiên bản được giữ riêng. Xem [hướng dẫn làm sạch](docs/CLEANING.md).

Đã có [quy trình dùng lại](docs/WORKFLOWS.md), nối dòng/ghép bảng có kiểm tra khóa, chốt phiên bản đầu vào, phát hiện đổi cấu trúc cột và lịch sử chạy. [Phân tích](docs/ANALYTICS.md) có đếm/tổng/trung bình, lọc dòng, biểu đồ cột/đường/tròn và báo cáo giữ phiên bản lịch sử. Có thể lưu phép tổng hợp vào quy trình để chạy với tệp tháng mới. Đã có [quản trị](docs/ADMIN.md) tài khoản, trạng thái lượt chạy, giới hạn, nhật ký và dọn dữ liệu hết hạn. Đã có [gợi ý khớp cột](docs/SCHEMA_ASSISTANCE.md), yêu cầu xem trước/xác nhận và xử lý tên cột đổi giữa các tháng.

## Chạy thử

Mở link công khai, chọn **Mở không gian dùng thử riêng**; mẫu bán hàng được nạp sẵn.
Trang **Tổng quan** hiển thị dữ liệu gần đây, quy trình và báo cáo của chính bạn.
Mở một bộ dữ liệu để xem chất lượng; qua **Làm sạch & xuất** để thêm bước,
xem trước, xác nhận phiên bản và tải kết quả. **Quy trình** dùng lại các bước đã
lưu; **Phân tích** tạo biểu đồ và lưu báo cáo theo phiên bản đã xem.
Hướng dẫn đầy đủ nằm trong
[hướng dẫn người dùng](docs/USER_GUIDE.vi.md).

Mở quy trình vừa lưu sẽ giữ lựa chọn nguồn và danh mục. Chuyển sang phân tích
giữ bộ dữ liệu đang chọn; mở báo cáo gần đây giữ đúng phiên bản đã lưu.
Xem [luồng làm việc](docs/PRODUCT_WORKSPACE.md) và ảnh thật trong README tiếng Anh.

Để chạy local, làm theo lệnh trong [README tiếng Anh](README.md#local-setup),
dùng PostgreSQL và môi trường Python riêng. Khi Excel có nhiều trang tính, cần
chọn rõ trang muốn đọc.

Mỗi bộ dữ liệu thuộc một chủ sở hữu. Guest hết quyền truy cập sau hai giờ; dữ liệu được xóa khi tác vụ dọn guest chạy. Không dùng thông tin bí mật hoặc dữ liệu cá nhân trong guest public.

Tài khoản thường do người vận hành tạo; không có mật khẩu mặc định. Hướng dẫn cài đặt, kiểm thử và giới hạn hiện tại nằm trong README gốc và [tiến độ](docs/IMPLEMENTATION_STATUS.md).

## Hướng dẫn và trạng thái phát hành

Có [hướng dẫn người dùng](docs/USER_GUIDE.vi.md), [hướng dẫn quản trị](docs/ADMIN.md),
[cách xử lý lỗi](docs/TROUBLESHOOTING.md), [roadmap](docs/ROADMAP.md) và
[phần mã cần hiểu khi phỏng vấn](docs/INTERVIEW_GUIDE.md).
Bản hiện tại bổ sung quy tắc kiểm tra dữ liệu, giải thích khoảng IQR, biểu đồ
Recharts và kiểm tra giao diện ở sáu kích cỡ. Xem [bằng chứng và giới hạn kiểm tra](docs/RELEASE_CHECKLIST.md).

Ứng dụng xử lý tệp có giới hạn, chạy một instance và dùng quy trình đồng bộ.
Gợi ý cột là luật/so khớp chuỗi có giải thích. Chưa có lịch chạy tự động, queue
phân tán hoặc cam kết xử lý tệp lớn. Triển khai hiện tại được thực hiện thủ công
sau khi CI của đúng commit đạt; không coi lựa chọn trên màn hình host là bằng
chứng tự động triển khai đã hoạt động.
