# Thiết kế lại Sức khỏe — 29/09/2026

## Bộ hình PNG

- [01–03: Sức khỏe và tổng quan](noan-health-01-overview-04a57eca.png)
- [04–06: Nhật ký ngày, ghi bữa, chọn ngày](noan-health-02-journal-a9c87617.png)
- [07–09: Nhật ký tuần/tháng/năm](noan-health-03-periods-dbb562ca.png)
- [10–12: Xu hướng và tất cả tháng](noan-health-04-trends-30beee8c.png)
- [13–15: Dinh dưỡng, tải dữ liệu, lỗi tải](noan-health-05-states-b045461d.png)

Các PNG được tạo bằng công cụ image generation tích hợp. Brief dùng chung: NOAN UI sans-serif bo tròn, nền #FFFAF0, chữ #48210B, CTA #FFC928, card trắng; mỗi bảng ba màn đánh số theo danh mục bên dưới; tuyệt đối không card nước/bước chân/calo tiêu hao. Prompt riêng mô tả đúng bố cục và dữ liệu API từng view. Chữ, biểu đồ và số minh họa do công cụ tạo ảnh có thể sai hoặc không cộng khớp; tiêu chuẩn dữ liệu và tính toán khi triển khai phải theo đặc tả dưới đây, không chép số trong PNG vào code.

## Phạm vi và đối chiếu nguồn

Màn chính: `mobile/src/screens/HealthScreen.tsx`. Tổng quan và ghi bữa: `HealthDetailScreens.tsx`. Nhật ký mở rộng đang có ở `mobile/src/screens/meal-journal/MealJournalScreen.tsx` cùng các view ngày/tuần/tháng/năm, sheet dinh dưỡng và màn xu hướng. API: `mobile/src/services/api/health.ts`; backend: `backend/src/health/health.controller.ts`, `health.service.ts`, `meal-logs.service.ts`.

Graph được dùng để định vị; báo cáo coverage đánh dấu metadata thay đổi nên kết luận về dữ liệu bên dưới dựa trên đọc mã nguồn trực tiếp. Phạm vi đối chiếu là luồng Sức khỏe và các dữ liệu liên quan, không phải audit mọi module không liên quan của dự án.

## Dữ liệu hiện có và quy tắc hiển thị

- `/health/days/:localDate`: năng lượng đã nạp, mục tiêu, phần còn lại; ba macro; bốn nhóm BREAKFAST/LUNCH/DINNER/SNACK. Mục tiêu năng lượng ưu tiên healthTarget.energyKcal, sau đó profile.goalKcal.
- `burnedKcal` và `steps.count/source/syncedAt` hiện trả về null. Không tạo vòng hoạt động, mục tiêu bước mặc định hoặc nút kết nối thiết bị khi chưa có luồng tích hợp.
- Macro là tổng snapshot của các bữa đã ghi. Backend hiện cộng macro thiếu như 0 trong tổng; 0 không chứng minh dữ liệu dinh dưỡng đầy đủ. Không tự gắn nhãn “đủ dinh dưỡng” hoặc đưa lời khuyên cá nhân hóa từ các số này.
- `/meal-logs/stats?period=day|week|month|year&date=...&timezone=...`: totals, targets, số bữa, số ngày có nhật ký, trung bình mỗi ngày/trung bình trên ngày có ghi, series, weeklySeries, dayGroups, monthGroups, insights. Nhãn trung bình phải phân biệt đúng hai loại mẫu số.
- `/health/calendar`: chấm lịch theo ngày có nhật ký. Chọn ngày rồi mở nhật ký ngày; không coi ngày chưa ghi là ngày ăn 0 kcal.
- `/meal-logs` POST: bữa, thời gian, timezone, danh sách món, quantity và unitCode. Form hiện tại chọn một món, mặc định 1 SERVING. Thiết kế form chỉ dùng chức năng đang có; chọn nhiều món hoặc sửa khẩu phần cần triển khai bổ sung.
- Dữ liệu trong ảnh thiết kế là số mẫu để minh họa bố cục. App phải lấy API; không đưa số mẫu vào fallback.

## Bỏ nước uống

Đã bỏ card nước, +250 ml, state/mutation nước ở màn chính và mục tiêu nước ở màn tổng quan. Thay card nước/bước chân bằng ba thẻ đạm, tinh bột, chất béo từ API. Backend vẫn bảo toàn dữ liệu nước đã có và các endpoint cũ.

Hai endpoint tổng hợp được bổ sung `includeWater` boolean, mặc định true để tương thích client cũ:

```http
GET /health/days/2026-09-29?timezone=Asia%2FHo_Chi_Minh&includeWater=false
GET /health/calendar?month=2026-09&timezone=Asia%2FHo_Chi_Minh&includeWater=false
```

Khi false, backend không gọi WaterLogsService.list hoặc waterLog.findMany. Response ngày bỏ field water; dataStatus dựa trên nhật ký bữa. Response lịch bỏ hasWaterLog, chỉ lấy ngày có bữa; completionRatio là 1 khi có ít nhất một bữa, không phải mức hoàn thành mục tiêu dinh dưỡng. true hoặc không truyền giữ hành vi cũ. Giá trị boolean không hợp lệ trả lỗi qua ParseBoolPipe. Swagger mô tả flag. Không cần migration DB.

Mobile getDay/getCalendar gửi false; HealthDayResponse.water là optional. Cần triển khai backend mới trước mobile để đảm bảo server cũ không tiếp tục truy vấn nước vì bỏ qua flag. Cache query cũ có thể còn dữ liệu nhưng UI không đọc field water.

## Danh mục màn thiết kế — 15 màn, không bỏ các view hiện có

1. Sức khỏe chưa có nhật ký: ngày được chọn, năng lượng chưa có dữ liệu, mục tiêu nếu có, macro —, card nhật ký trống, CTA Ghi bữa ăn. Không số mẫu.
2. Sức khỏe có dữ liệu: năng lượng/mục tiêu, còn lại hoặc vượt mục tiêu, ba macro, số bữa và lối vào nhật ký.
3. Tổng quan dinh dưỡng ngày: năng lượng, macro, phân bố sáng/trưa/tối/phụ; ngày thật thay cho ngày cố định. Không nước, bước chân, calo tiêu hao giả hoặc lời khuyên cá nhân hóa cố định.
4. Nhật ký ngày: các bữa đã ghi và các slot chưa ghi, thông tin món/giờ/kcal theo API; mở chi tiết món có referenceId.
5. Ghi bữa: chọn sáng/trưa/tối/phụ, tìm món, chọn một món, tóm tắt, lưu. Ghi vào ngày đang chọn; occurredAt đặt 12:00 theo ngày thiết bị vì form chưa chọn giờ.
6. Chọn ngày: lịch tháng với chấm ngày có bữa; xác nhận về ngày được chọn.
7. Nhật ký tuần: tổng, số ngày ghi, trung bình theo ngày có ghi, danh sách ngày; drill-down ngày.
8. Nhật ký tháng: tổng, số ngày có dữ liệu, tóm tắt tuần/ngày; drill-down ngày.
9. Nhật ký năm: tổng năm, số bữa, tháng có dữ liệu; drill-down tháng.
10. Xu hướng tuần: switch năng lượng/số bữa; chart theo ngày; ngày thiếu có dấu —, không suy diễn lượng ăn 0.
11. Xu hướng tháng: chart theo weeklySeries, độ phủ nhật ký, mở danh sách ngày.
12. Tất cả tháng trong năm: 12 tháng, bộ lọc tất cả/có dữ liệu, mở tháng.
13. Sheet dinh dưỡng theo kỳ: năng lượng và macro, mục tiêu nếu có; không mục tiêu giả. title đổi theo ngày/tuần/tháng/năm.
14. Đang tải: skeleton đúng một card năng lượng, ba card macro, các hàng nhật ký; không hiện số mẫu trước API.
15. Lỗi tải: giữ header/ngày/navbar, thông báo và nút Thử lại. Không thay lỗi thành “chưa có dữ liệu”.

Các biến thể nhỏ dùng lại component, không tạo màn mới: chưa đặt mục tiêu (ẩn phần trăm), chưa đủ macro (— hoặc nhãn dữ liệu thiếu), tìm món không có kết quả, đang tìm, đang lưu, lưu lỗi (giữ form), lưu thành công (thông báo + refresh), xác nhận rời form có thay đổi. Các hành vi lưu lỗi/feedback này là tiêu chí triển khai thiết kế; chưa phải mọi hành vi đều đã có trong form hiện tại.

## Thiết kế và điều hướng

Nền kem #FFFAF0, card trắng, chữ nâu #48210B, CTA vàng #FFC928. Ba macro dùng điểm màu cam/vàng/xanh dịu và luôn có nhãn g. Tap target >=44, lề 20, card radius 20–24. Navbar giữ Trang chủ/Khám phá/Quét món/Sức khỏe/Cá nhân, Sức khỏe active. Chừa đáy đủ cho navbar và safe area.

Luồng chính: Sức khỏe → tổng quan hoặc nhật ký → kỳ ngày/tuần/tháng/năm → xu hướng/chi tiết ngày/tháng → chi tiết món. Ghi bữa → tìm/chọn món → lưu → refresh đúng ngày. Màn MealJournalScreen đã tồn tại nhưng Sức khỏe hiện mở MealsScreen đơn giản; thiết kế mới đề xuất đưa nhật ký mở rộng vào lối vào này. Việc nối toàn bộ điều hướng mới chưa thực hiện trong lượt thiết kế.

Nút chuông ở màn Sức khỏe hiện chưa có handler. Hình thiết kế giữ vị trí nhưng việc nối sang NotificationScreen cần thực hiện khi triển khai UI đầy đủ; không coi đây là chức năng đã hoạt động.

## Phần đã sửa và phần còn là thiết kế

Đã sửa luồng bỏ nước, macro thay thế, skeleton, ngày tổng quan, dữ liệu macro/phân bố, lời nhắc trung tính, trạng thái refresh và ngày ghi bữa. Không xóa dữ liệu nước cũ. Các PNG là bộ mockup để duyệt; chưa áp dụng toàn bộ hình ảnh vào tất cả các view nhật ký.

Kiểm chứng: TypeScript mobile/backend và regression test backend cho bỏ truy vấn nước, giữ tổng bữa, lịch chỉ theo bữa và tương thích flag mặc định. Chưa xác nhận trực quan toàn bộ trên thiết bị thật.
