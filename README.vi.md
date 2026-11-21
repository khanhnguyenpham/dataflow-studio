# DataFlow Studio

Ứng dụng web để kiểm tra bảng tính và xây dựng quy trình xử lý có thể chạy lại. Bài toán chính là tổng hợp báo cáo tháng từ các tệp bán hàng/sản phẩm chưa đồng nhất.

## Hiện trạng

Đã có không gian guest riêng, đăng nhập, nhập CSV/XLSX, chọn trang tính, xem trước và xem ô thiếu/dòng trùng/cảnh báo. Phần Làm sạch & xuất hỗ trợ thêm bước, xem trước tác động, xác nhận lưu phiên bản, khôi phục và tải CSV/XLSX/JSON hoặc báo cáo chất lượng. Giao diện hỗ trợ tiếng Việt/Anh. Dữ liệu không bị tự sửa; nguồn và các phiên bản được giữ riêng. Xem [hướng dẫn làm sạch](docs/CLEANING.md).

Chưa hoàn thành ghép bảng, workflow, analytics và quản trị. Chưa có URL public đã xác minh. Không coi checkpoint này là sản phẩm cuối.

## Chạy thử

Làm theo lệnh trong [README tiếng Anh](README.md#local-setup), dùng PostgreSQL và môi trường Python riêng. Mở web, chọn dùng thử để lấy bộ dữ liệu bán hàng giả lập. Nhập tệp của bạn hoặc chọn mẫu; mở Chất lượng dữ liệu để xem các vấn đề. Khi Excel có nhiều trang tính, cần chọn rõ trang muốn đọc.

Mỗi bộ dữ liệu thuộc một chủ sở hữu. Guest hết quyền truy cập sau hai giờ; dữ liệu được xóa khi tác vụ dọn guest chạy. Không dùng thông tin bí mật hoặc dữ liệu cá nhân trong guest public.

Tài khoản thường do người vận hành tạo; không có mật khẩu mặc định. Hướng dẫn cài đặt, kiểm thử và giới hạn hiện tại nằm trong README gốc và [tiến độ](docs/IMPLEMENTATION_STATUS.md).
