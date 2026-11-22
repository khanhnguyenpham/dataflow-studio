# DataFlow Studio

Ứng dụng web để kiểm tra bảng tính và xây dựng quy trình xử lý có thể chạy lại. Bài toán chính là tổng hợp báo cáo tháng từ các tệp bán hàng/sản phẩm chưa đồng nhất.

## Hiện trạng

Đã có không gian guest riêng, đăng nhập, nhập CSV/XLSX, chọn trang tính, xem trước và xem ô thiếu/dòng trùng/cảnh báo. Phần Làm sạch & xuất hỗ trợ thêm bước, xem trước tác động, xác nhận lưu phiên bản, khôi phục và tải CSV/XLSX/JSON hoặc báo cáo chất lượng. Giao diện hỗ trợ tiếng Việt/Anh. Dữ liệu không bị tự sửa; nguồn và các phiên bản được giữ riêng. Xem [hướng dẫn làm sạch](docs/CLEANING.md).

Đã có [quy trình dùng lại](docs/WORKFLOWS.md), nối dòng/ghép bảng có kiểm tra khóa, chốt phiên bản đầu vào, phát hiện đổi cấu trúc cột và lịch sử chạy. [Phân tích](docs/ANALYTICS.md) có đếm/tổng/trung bình, lọc dòng, biểu đồ cột/đường/tròn và báo cáo giữ phiên bản lịch sử. Có thể lưu phép tổng hợp vào quy trình để chạy với tệp tháng mới. Đã có [quản trị](docs/ADMIN.md) tài khoản, trạng thái lượt chạy, giới hạn, nhật ký và dọn dữ liệu hết hạn. Đã có [gợi ý khớp cột](docs/SCHEMA_ASSISTANCE.md), yêu cầu xem trước/xác nhận và xử lý tên cột đổi giữa các tháng. Chưa có hosting public được xác minh. Không coi checkpoint này là sản phẩm cuối.

## Chạy thử

Làm theo lệnh trong [README tiếng Anh](README.md#local-setup), dùng PostgreSQL và môi trường Python riêng. Mở web, chọn dùng thử để lấy bộ dữ liệu bán hàng giả lập. Nhập tệp của bạn hoặc chọn mẫu; mở Chất lượng dữ liệu để xem các vấn đề. Khi Excel có nhiều trang tính, cần chọn rõ trang muốn đọc.

Mỗi bộ dữ liệu thuộc một chủ sở hữu. Guest hết quyền truy cập sau hai giờ; dữ liệu được xóa khi tác vụ dọn guest chạy. Không dùng thông tin bí mật hoặc dữ liệu cá nhân trong guest public.

Tài khoản thường do người vận hành tạo; không có mật khẩu mặc định. Hướng dẫn cài đặt, kiểm thử và giới hạn hiện tại nằm trong README gốc và [tiến độ](docs/IMPLEMENTATION_STATUS.md).

## Hướng dẫn và trạng thái phát hành

Có [hướng dẫn người dùng](docs/USER_GUIDE.vi.md), [hướng dẫn quản trị](docs/ADMIN.md),
[cách xử lý lỗi](docs/TROUBLESHOOTING.md), [roadmap](docs/ROADMAP.md) và
[phần mã cần hiểu khi phỏng vấn](docs/INTERVIEW_GUIDE.md).
Bản hiện tại bổ sung quy tắc kiểm tra dữ liệu, giải thích khoảng IQR, biểu đồ
Recharts và kiểm tra giao diện ở sáu kích cỡ. Xem [bằng chứng và giới hạn kiểm tra](docs/RELEASE_CHECKLIST.md).

Chưa có URL public được xác minh. Cấu hình Render Free + Neon PostgreSQL đã chuẩn
bị; còn bước chủ tài khoản đăng nhập, tạo tài nguyên Free và kiểm tra qua HTTPS.
Không coi thiết kế triển khai là ứng dụng đã được xuất bản.
