# Mogu Dish Detail V2

## Mục tiêu

Giảm độ phức tạp của luồng chi tiết món bằng cách trả lời lần lượt bốn câu hỏi của người dùng:

1. Đây là món gì và có phù hợp với tôi không?
2. Tôi cần chuẩn bị những gì?
3. Bước hiện tại cần làm gì?
4. Nếu không nấu, tôi có thể ăn đúng món này ở đâu?

Prototype tương tác: `docs/design/mogu-dish-detail-v2.html`.

## Cấu trúc đề xuất

### 1. Chi tiết món

Phần đầu chỉ giữ ảnh, tên món, mô tả ngắn, tổng thời gian, chi phí tự nấu theo một phần và năng lượng theo một phần. Hai hành động chính là `Tự nấu món này` và `Tìm quán có món này`.

Nguyên liệu và cách làm nằm trong hai tab của cùng trang. Dinh dưỡng và dị ứng mở bằng bottom sheet. Nguồn dữ liệu đặt trong disclosure ở cuối trang.

Không hiển thị:

- Nhãn “phù hợp 73%” nếu chưa giải thích được cách tính.
- Cảnh báo dị ứng bằng trạng thái an toàn khi dữ liệu chưa tồn tại.
- Video khi món không có video thật.
- Nút hoặc icon cài đặt nổi không thuộc tác vụ của người dùng.

### 2. Chuẩn bị nguyên liệu

Hiển thị danh sách một cột gồm tên và định lượng. Người dùng có thể đánh dấu nguyên liệu đã có và đổi số khẩu phần. Mọi định lượng phải được scale từ khẩu phần gốc, đồng thời giữ đơn vị dễ đọc.

Ảnh nguyên liệu không phải thông tin chính. Chỉ dùng thumbnail khi ảnh đã chính xác, không làm tên nguyên liệu bị cắt hoặc tạo cuộn ngang.

### 3. Chế độ nấu

Mỗi màn chỉ hiển thị một bước:

- Tên bước và số thứ tự.
- Hướng dẫn với cỡ chữ lớn.
- Nguyên liệu dùng trong bước hiện tại.
- Ghi chú an toàn hoặc mẹo thực sự liên quan.
- Timer nếu bước có thời lượng.
- Nút trước và tiếp theo.

Danh sách toàn bộ bước mở bằng bottom sheet. Timer tiếp tục chạy khi sheet mở và cần cảnh báo khi kết thúc. Khi rời chế độ nấu, ứng dụng phải nói rõ tiến trình có được lưu hay không.

### 4. Ăn ngoài

Ưu tiên danh sách quán; bản đồ là chế độ xem thêm. Chỉ hiển thị một quán khi dữ liệu cho biết quán có bán đúng món đang xem.

Mỗi quán cần có:

- Tên và địa chỉ.
- Khoảng cách dựa trên vị trí thật hoặc khu vực người dùng chọn.
- Khoảng giá và đơn vị `/ phần`.
- Giờ mở cửa cùng thời điểm cập nhật.
- Nguồn xác nhận quán có bán món.
- Nút chỉ đường riêng của quán.

Đánh giá quán và đánh giá món phải là hai loại dữ liệu khác nhau. Không dùng đánh giá phở hoặc ảnh bún chả để đại diện cho một quán chỉ bán phở.

## Quy tắc dữ liệu và trạng thái thiếu

- `Chưa có dữ liệu dị ứng` phải được hiểu là trạng thái chưa xác minh, không phải an toàn.
- Dinh dưỡng luôn ghi rõ cơ sở tính: theo phần, theo 100 g hoặc toàn công thức.
- Giá luôn có ngữ cảnh: tự nấu hay mua tại quán, và tính theo phần hay toàn món.
- Thời gian trang chi tiết dùng tổng thời gian. Chế độ nấu hiển thị thời gian của từng bước.
- Khi thiếu ảnh, video, đánh giá hoặc địa điểm, ẩn module thay vì dựng dữ liệu minh họa trong production.
- Nội dung công thức, định lượng và an toàn thực phẩm phải qua quy trình xác minh riêng.

## Hệ thống giao diện

- Một màu nhấn vàng dành cho CTA chính; xanh đậm cho trạng thái và liên kết.
- Nền trắng, phân cấp bằng khoảng trắng và divider; hạn chế card lồng card.
- Spacing theo nhịp 4/8 dp; gutter màn điện thoại 20 dp.
- Body tối thiểu 16 sp khi là đoạn văn dài; nội dung bước nấu khoảng 18 sp.
- Touch target tối thiểu 44 pt trên iOS và 48 dp trên Android.
- Dùng icon vector cùng một bộ; icon chỉ có hình phải có accessibility label.
- Sticky CTA phải chừa safe area và content inset để không che nội dung cuối.
- Hỗ trợ Dynamic Type, screen reader, reduced motion và tương phản chữ tối thiểu 4.5:1.

## Luồng điều hướng

```text
Chi tiết món
├─ Dinh dưỡng & dị ứng → bottom sheet
├─ Nguyên liệu → tab trong trang
├─ Cách làm → tab trong trang
├─ Tự nấu → Chuẩn bị → Đang nấu từng bước
└─ Ăn ngoài → Danh sách đúng món → Chi tiết quán / bản đồ
```

## Tham khảo

- Kitchen Stories: cooking mode từng bước, điều chỉnh khẩu phần và timer — https://pages.kitchenstories.com/en/app
- Paprika: scale định lượng, đổi đơn vị và đánh dấu nguyên liệu — https://www.paprikaapp.com/help/ios/
- Samsung Food: tách dinh dưỡng tóm tắt và dữ liệu chi tiết — https://support.samsungfood.com/hc/en-us/articles/18725068057620-Nutrition-calculations-Macronutrients-Micronutrients-and-Health-Score

Các sản phẩm tham khảo được dùng để học cách tổ chức luồng. Thiết kế, nội dung và hệ màu trong prototype được xây lại cho Mogu.
