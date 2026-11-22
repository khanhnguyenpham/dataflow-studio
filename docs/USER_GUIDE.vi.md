# Hướng dẫn DataFlow Studio

[English](USER_GUIDE.en.md)

## Bắt đầu

Chọn **Mở không gian dùng thử riêng** để mở phiên khách tách biệt, hết hạn sau hai giờ.
Bảng bán hàng tháng 10 tự được nạp. Đây là dữ liệu tự tạo, có lỗi để thử chức năng.
Phiên khách giữ tối đa ba bảng; tải kết quả cần giữ trước khi hết hạn. Quản trị viên
tạo tài khoản thường khi cần lưu công việc lâu hơn.

Chọn **Nhập dữ liệu** để tải CSV hoặc XLSX. Giới hạn ban đầu: 5 MiB, 10.000 dòng,
100 cột. Chọn encoding đúng cho CSV hoặc sheet cần đọc trong Excel. Hệ thống không
chạy macro, không truy cập liên kết ngoài và không tự sửa nội dung file.
Mã có số 0 đầu và các giá trị gốc vẫn được giữ dạng chữ.

Trong **Dữ liệu của tôi**, bảng có phân trang; trên điện thoại có thể mở từng dòng
để xem chi tiết. Đổi ngôn ngữ chỉ đổi cách hiển thị, không đổi giá trị dữ liệu.

## Kiểm tra chất lượng

Trang chất lượng cho biết ô trống, dòng trùng, kiểu gợi ý, thống kê số và tối đa
năm giá trị thường gặp ở mỗi cột. Kiểu dữ liệu và giá trị cần xem lại là nhận định
theo quy tắc, chưa phải kết luận nghiệp vụ.

Khoảng 1,5 × IQR được ghi rõ để giải thích cảnh báo bất thường. Giá trị bằng 0,
âm hoặc lớn không tự động bị coi là sai. Mẫu tháng 10 có sáu dòng, một dòng trùng,
một lượng bán thiếu, một lượng bán viết chữ và ngày 31/02 không hợp lệ.

## Làm sạch và lưu phiên bản

Trong **Làm sạch và xuất**, chọn thao tác, chọn cột rồi thêm bước. Các bước chạy
đúng thứ tự. Đổi ngày phải chọn định dạng; nếu chọn cả ngày/tháng và tháng/ngày,
giá trị có hai cách hiểu sẽ bị từ chối. Đổi số phải chọn dấu thập phân và phân nhóm.
Không đoán số tiền, mã hoặc ngày đúng thay người dùng.

Bước **Kiểm tra quy tắc** kiểm tra ô bắt buộc, tính duy nhất, số hoặc ngày hợp lệ.
Bước này không sửa giá trị. Nếu không đạt, quy trình dừng và chỉ rõ cột, số dòng
đầu tiên cần kiểm tra. Số dòng tính theo đầu vào của chính bước đó, gồm dòng tiêu đề;
các bước lọc/xóa trùng trước đó có thể làm vị trí thay đổi. Ô trống mặc định không
đạt; lựa chọn bỏ qua ô trống không áp dụng cho quy tắc bắt buộc.

Chọn xem trước để so sánh mười dòng đầu và số dòng/ô bị ảnh hưởng ở từng bước.
Chỉ thao tác xác nhận mới tạo phiên bản mới. File gốc không bị ghi đè.
Nếu xem trước hết hạn hoặc bảng đã thay đổi, cần tính lại.

Lịch sử cho phép quay về phiên bản cũ mà vẫn giữ những phiên bản sau. Khi xuất,
xác nhận lại phiên bản cần tải. CSV thêm dấu nháy trước giá trị có thể bị hiểu là
công thức; XLSX lưu ô chữ. JSON giữ chuỗi nguyên vẹn. Báo cáo chất lượng có checksum
nguồn và các bước đã làm.

## Chạy lại công việc hằng tháng

1. Nạp mẫu tháng 10, danh mục sản phẩm và tháng 11; vừa đủ ba bảng của phiên khách.
2. Chọn tháng 10, thêm bước xóa trùng theo **Order ID**. Mở phần lưu quy trình,
   đặt tên và chọn ghép trái với danh mục theo **Product Code**.
3. Trong **Quy trình**, chọn nguồn và danh mục rồi chạy. Kết quả xem trước có năm
   dòng và tên sản phẩm. Việc ghép tên chưa xử lý các lỗi ngày/lượng bán của tháng 10.
4. Chuyển nguồn sang tháng 11 và chạy lại định nghĩa đã lưu. Kết quả có ba dòng.
   Kiểm tra rồi xác nhận để lưu phiên bản dẫn xuất.

Khóa bên danh mục phải có và không trùng. Mã không khớp làm lượt chạy dừng, trừ khi
người dùng cho phép rõ ràng. Ghép trái giữ dòng không khớp với ô danh mục trống;
ghép trong bỏ những dòng đó và báo số lượng. Mẫu có mã sản phẩm không khớp dùng
để thử trường hợp này.

Khi cột thay đổi, công cụ gợi ý ánh xạ bằng tên và từ đồng nghĩa Anh–Việt.
Kiểm tra từng cặp, xem trước tên cột/dòng, xác nhận riêng nếu bỏ cột thừa.
Sau khi lưu phiên bản đã căn chỉnh mới chạy lại quy trình. Điểm giống tên không
phải xác suất ánh xạ đúng.

Có thể thêm, đổi thứ tự, tắt hoặc bỏ bước trong bản nháp; cần lưu phiên bản định
nghĩa trước khi chạy. Nút kiểm tra/tiếp tục lượt đang chờ dùng lại đúng lượt cũ.
Chưa hỗ trợ hủy giữa chừng. Lượt bị gián đoạn quá hai phút có thể được ghi nhận
thất bại khi kiểm tra lại; sửa đầu vào rồi chủ động tạo lượt mới.

## Phân tích

Chọn phiên bản tháng 11 đã xóa trùng, nhóm theo **Product Code**, tính tổng
**Quantity**, xác nhận đã kiểm tra phiên bản rồi tính. Tổng của mẫu là **12**,
gồm ba sản phẩm.

Biểu đồ cột dùng cho nhóm có thể âm. Đường yêu cầu trục số hoặc ngày ISO. Tròn
chỉ dùng tối đa tám nhóm đếm/tổng không âm, tổng lớn hơn 0. Biểu đồ hiển thị tối đa
20 nhóm có giá trị; bảng và tệp xuất giữ đầy đủ, giới hạn 1.000 nhóm.
Ô số trống được đếm riêng; số sai định dạng không bị lặng lẽ bỏ qua.

Lưu báo cáo sẽ giữ phiên bản và cấu hình đã chọn. Làm sạch/khôi phục nguồn sau đó
không đổi báo cáo cũ. Có thể lưu phép tính thành quy trình dùng cho tháng khác.
Xóa báo cáo không xóa nguồn; xóa bảng nguồn sẽ xóa báo cáo và lịch sử lượt chạy phụ thuộc.

Xem [cách xử lý lỗi](TROUBLESHOOTING.md). Bản public phục vụ portfolio; không tải
dữ liệu bí mật lên đó.
