# Mogu Mobile — Weekly Plan Flow UX Redesign 2026

## Phạm vi

Ba thiết kế là ba trạng thái liên tiếp của cùng một luồng:

1. [Cấu hình kế hoạch](./assets/mogu-week-plan-config-v2.png)
2. [Không thể tạo kế hoạch](./assets/mogu-week-plan-error-v2.png)
3. [Tạo kế hoạch thành công](./assets/mogu-week-plan-success-v2.png)

## 1. Màn cấu hình

### Thứ tự ưu tiên

- Header: quay lại, tiêu đề, đặt lại.
- Summary: số ngày, số bữa, ngân sách, kcal/ngày.
- Ngân sách tuần.
- Mục tiêu năng lượng.
- Lịch ăn.
- Tùy chọn nâng cao.
- CTA cố định `Tạo thực đơn tuần`.

### Tương tác

- Nút `−`/`+` ngân sách: mỗi lần thay đổi theo bước cấu hình của hệ thống; nhấn giữ có thể tăng liên tục.
- Thanh ngân sách hỗ trợ kéo nhưng phải luôn có nút thay thế, không phụ thuộc gesture.
- `Theo hồ sơ`: dùng calorie target từ hồ sơ sức khỏe.
- `Tự đặt`: hiển thị numeric input và bàn phím số.
- `7 ngày`: mở bottom sheet chọn thời lượng.
- `3 bữa/ngày`: mở bottom sheet chọn số bữa.
- Chip Sáng/Trưa/Tối/Bữa phụ là multi-select; tối thiểu một bữa phải được chọn.
- `Tùy chọn nâng cao`: mở sheet chứa tự nấu, giới hạn lặp món và giữ món đã khóa.
- `Lưu làm mặc định`: lưu cấu hình, không tạo kế hoạch.
- `Tạo thực đơn tuần`: validate phía client, sau đó gửi request tạo.

## 2. Trạng thái thất bại

Không dùng alert chỉ có `OK`. Hiển thị bottom sheet có đường phục hồi:

- Lý do ngắn: kho món chưa đủ lựa chọn phù hợp.
- Gợi ý được tính từ backend, ví dụ tăng ngân sách, bật bữa phụ hoặc nới nguyên liệu tránh.
- `Điều chỉnh cấu hình`: đóng sheet, cuộn/focus tới trường được đề xuất đầu tiên.
- `Xem kho món đã duyệt`: mở danh sách món đang đủ điều kiện.
- `Để sau`: đóng sheet và giữ nguyên toàn bộ dữ liệu đã nhập.

Nếu backend trả lỗi theo trường, FE phải đặt lỗi ngay dưới trường liên quan, đồng thời sheet đóng vai trò tóm tắt.

## 3. Trạng thái thành công

Bottom sheet xác nhận phải trả lời ngay:

- Kế hoạch có bao nhiêu ngày và bữa.
- Ngân sách ước tính.
- Ngày bắt đầu.

Tương tác:

- `Xem thực đơn`: CTA chính, mở weekly plan vừa tạo.
- `Về trang chủ`: CTA phụ.
- `Chia sẻ kế hoạch`: mở native share sheet với deep link.
- Backdrop tap hoặc swipe-down chỉ đóng sheet sau khi creation state đã được lưu.

## Trạng thái CTA

- Disabled khi không có meal slot hoặc giá trị numeric ngoài giới hạn.
- Loading: khóa các field và đổi label thành `Đang tạo thực đơn…`; không cho gửi trùng.
- Timeout: giữ `requestId`, cho phép `Kiểm tra lại` trước khi tạo request mới.

## API contract đề xuất

### Request

```json
{
  "durationDays": 7,
  "budget": 300000,
  "dailyCalories": 2000,
  "calorieSource": "PROFILE",
  "mealSlots": ["BREAKFAST", "LUNCH", "DINNER"],
  "advanced": {
    "cookMode": "SELF_COOK",
    "limitRepeats": true,
    "keepLockedMeals": true
  },
  "idempotencyKey": "uuid"
}
```

### Success

```json
{
  "status": "CREATED",
  "planId": "weekly_plan_id",
  "startDate": "2026-09-23",
  "durationDays": 7,
  "mealCount": 21,
  "estimatedBudget": 300000
}
```

### Recoverable failure

```json
{
  "status": "INSUFFICIENT_CANDIDATES",
  "message": "Kho món hiện chưa đủ lựa chọn phù hợp với cấu hình này.",
  "suggestions": [
    { "type": "MIN_BUDGET", "value": 350000 },
    { "type": "ENABLE_MEAL_SLOT", "value": "SNACK" },
    { "type": "REVIEW_AVOIDED_INGREDIENTS" }
  ],
  "approvedDishCount": 12
}
```

FE không tự suy đoán mức ngân sách đề xuất; con số và suggestion phải đến từ BE.

## Chi tiết Lịch ăn

Mockup: [mogu-week-plan-schedule-v2.png](./assets/mogu-week-plan-schedule-v2.png)

`Lịch ăn` mở bằng bottom sheet vì thay đổi ngắn và có thể hoàn tác. Sheet gồm:

- Số ngày, ngày bắt đầu và ngày kết thúc.
- Danh sách `Bữa sáng`, `Bữa trưa`, `Bữa tối`, `Bữa phụ`.
- Mỗi bữa có trạng thái bật/tắt và giờ dự kiến.
- Bấm vào một bữa đang bật để mở time picker.
- Tắt bữa sẽ giữ giờ gần nhất trong local draft để có thể khôi phục khi bật lại.
- Tổng số bữa cập nhật tức thời theo `số ngày × số meal slot đã bật`.
- `Áp dụng lịch ăn` chỉ cập nhật draft của màn cha; chưa gọi API tạo thực đơn.
- Đóng bằng X hoặc swipe-down khi có thay đổi chưa áp dụng phải hỏi xác nhận bỏ thay đổi.

Payload draft đề xuất:

```json
{
  "startDate": "2026-09-23",
  "durationDays": 7,
  "mealSlots": [
    { "type": "BREAKFAST", "enabled": true, "time": "07:00" },
    { "type": "LUNCH", "enabled": true, "time": "12:00" },
    { "type": "DINNER", "enabled": true, "time": "18:30" },
    { "type": "SNACK", "enabled": false, "time": null }
  ]
}
```

## Chi tiết Tùy chọn nâng cao

Mockup: [mogu-week-plan-advanced-options-v2.png](./assets/mogu-week-plan-advanced-options-v2.png)

Đây là màn riêng vì các thiết lập ảnh hưởng trực tiếp tới số lượng ứng viên của thuật toán:

- `Ưu tiên tự nấu`: tăng trọng số món có công thức đầy đủ.
- `Cho phép món mua ngoài`: cho phép nhà hàng/quán ăn làm nguồn thay thế.
- `Hạn chế lặp món`: loại hoặc giảm trọng số món đã xuất hiện trong khoảng thời gian cấu hình.
- `Ưu tiên món mới`: tăng trọng số món người dùng chưa từng ghi hoặc đánh giá.
- `Món đã thích`: mở selector `Không ưu tiên / Ưu tiên nhẹ / Ưu tiên cao`.
- `Giữ các bữa đã khóa`: không thay các meal item có trạng thái locked.
- `Giữ nguyên ngày đã ghi`: không sinh lại ngày trong quá khứ hoặc ngày đã có log.

`Đặt lại` chỉ trả advanced options về mặc định; không reset ngân sách, kcal hay lịch ăn. `Lưu tùy chọn` cập nhật draft của màn lập kế hoạch. Nếu tập giới hạn khiến kho ứng viên quá nhỏ, FE hiển thị callout cảnh báo nhưng BE vẫn là nguồn quyết định cuối cùng.

Payload đề xuất:

```json
{
  "preferSelfCook": true,
  "allowOutsideMeals": true,
  "limitRepeats": true,
  "repeatWindowDays": 7,
  "preferNewDishes": true,
  "likedDishPreference": "LIGHT",
  "keepLockedMeals": true,
  "preserveLoggedDays": true
}
```

## Quy tắc UI/Accessibility

- Touch target tối thiểu 44pt iOS hoặc 48dp Android.
- Không dùng màu đơn lẻ để biểu thị selected/error; luôn kèm icon hoặc label.
- Bottom sheet dùng semantic modal và chuyển screen-reader focus vào tiêu đề.
- Lỗi dùng live announcement; khi đóng sheet, trả focus về CTA tạo thực đơn.
- Hỗ trợ Dynamic Type; button và row tăng chiều cao thay vì cắt chữ.
- Scrim đủ tối để tách modal nhưng nội dung nền không cần đọc được.
- Bottom CTA và sheet tôn trọng safe area.

## Event tracking

- `weekly_plan_config_viewed`
- `weekly_plan_value_changed` với `field`, `oldValue`, `newValue`
- `weekly_plan_create_requested`
- `weekly_plan_create_failed` với `reason`, `suggestionCount`
- `weekly_plan_recovery_selected` với `type`
- `weekly_plan_created` với `planId`, `durationDays`, `mealCount`
- `weekly_plan_opened`
- `weekly_plan_shared`

## Ghi chú tạo mockup

Ba mockup được tạo bằng ImageGen tích hợp, dùng các ảnh hiện trạng do người dùng cung cấp làm reference. Prompt giữ nhận diện ivory/vàng Mogu, thay alert chung chung bằng bottom sheet có khả năng phục hồi và giữ một CTA chính rõ ràng trên màn cấu hình.

## Định hướng mở rộng (Roadmap 2026)

Chi tiết đối chiếu thị trường tại [docs/ba/WEEKLY_PLAN_COMPETITOR_ANALYSIS_2026.md](./ba/WEEKLY_PLAN_COMPETITOR_ANALYSIS_2026.md).

### Giai đoạn 1 (Phase 1): Đi chợ tuần & Nhắc nhở giờ ăn (Triển khai ngay)
- **Danh sách đi chợ cả tuần (Weekly Grocery List)**:
  - Backend cung cấp `GET /weekly-plans/:planId/ingredients` gộp toàn bộ nguyên liệu của mọi slot trong tuần, phân loại theo quầy/nhóm (`THIT_CA`, `RAU_CU`, `GIA_VI`, `KHAC`) và tính ước lượng khối lượng/chi phí.
  - Mobile: Màn hình "Đi chợ tuần" truy cập từ Header `WeeklyPlanScreen`, hỗ trợ tick checkbox đã mua, lọc theo nhóm nguyên liệu.
- **Nhắc nhở giờ ăn (Meal Reminders)**:
  - Tích hợp `expo-notifications` nhắc nhở trước 30 phút theo lịch giờ ăn `mealSlotSchedule.time` của kế hoạch ACTIVE, hiển thị kèm tên món ăn được chọn.

### Giai đoạn 2 (Phase 2): Tương tác chi tiêu thực tế & Tuần mẫu
- **Ghi nhận chi tiêu thực tế**: Khi đánh dấu "Đã ăn" (`complete`), cho phép xác nhận số tiền thực tế đã chi. Hiển thị thanh đo ngân sách thực tế so với cam kết tuần.
- **Tuần mẫu (Template)**: Cho phép lưu kế hoạch tuần thành mẫu yêu thích và tạo nhanh tuần mới từ tuần trước.

### Giai đoạn 3 (Phase 3): Nấu dồn (Leftovers) & Tủ lạnh (Pantry)
- **Nấu dồn (Leftovers)**: Tùy chọn nâng cao nấu dồn bữa tối sang trưa hôm sau, giảm chi phí và thời gian nấu nướng.
- **Kho nguyên liệu sẵn có (Pantry)**: Quản lý nguyên liệu có sẵn tại gia đình, tự động trừ khỏi danh sách cần đi chợ.

