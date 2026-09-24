# Mogu — Weekly Plan Redesign đối chiếu Mobile/Backend 2026

## 1. Kết quả thiết kế

Các mockup dưới đây được thiết kế lại theo dữ liệu đang tồn tại trong repository:

- [Cấu hình tạo thực đơn](./assets/mogu-weekly-plan-system-config-v3.png)
- [Lịch ăn](./assets/mogu-weekly-plan-system-schedule-v3.png)
- [Tùy chọn tạo món](./assets/mogu-weekly-plan-system-options-v3.png)
- [Kế hoạch tuần trên Home](./assets/mogu-weekly-plan-system-home-v3.png)
- [Chi tiết thực đơn tuần](./assets/mogu-weekly-plan-system-detail-v3.png)

Ảnh người dùng cung cấp chỉ được dùng làm reference cho hiện trạng và nhận diện sản phẩm.

## 2. Nguồn đã đối chiếu

### Mobile

- `mobile/src/screens/EditPlanScreen.tsx`
- `mobile/src/components/weekly-plan/WeeklyPlanOptionSheets.tsx`
- `mobile/src/components/weekly-plan/WeeklyPlanFailureSheet.tsx`
- `mobile/src/components/weekly-plan/WeeklyPlanSuccessSheet.tsx`
- `mobile/src/screens/HomeScreen.tsx`
- `mobile/src/screens/WeeklyPlanScreen.tsx`
- `mobile/src/services/api/weekly-plan.ts`
- `mobile/src/services/api/types.ts`
- `mobile/src/lib/weekly-forecast.ts`

### Backend và database

- `backend/src/weekly-plans/dto/upsert-weekly-plan-config.dto.ts`
- `backend/src/weekly-plans/dto/generate-weekly-plan.dto.ts`
- `backend/src/weekly-plans/services/weekly-plan-config.service.ts`
- `backend/src/weekly-plans/services/weekly-plans.service.ts`
- `backend/src/weekly-plans/services/weekly-plan-generator.service.ts`
- `backend/src/weekly-plans/services/weekly-plan-calculator.service.ts`
- `backend/src/weekly-plans/constants/weekly-plan-weights.ts`
- `backend/src/weekly-plans/constants/weekly-plan-errors.ts`
- `backend/prisma/schema.prisma`

## 3. Dữ liệu hiện tại thực sự hỗ trợ

`WeeklyPlanConfig` hiện lưu:

- `budgetVnd`
- `kcalPerDay`
- `kcalMode`: `PROFILE | CUSTOM`
- `durationDays`: chỉ nhận `3 | 5 | 7 | 14`
- `enabledSlots`: `MORNING | LUNCH | DINNER | SNACK`
- `mealsPerDay`: field cũ, backend đã ghi rõ là deprecated và suy ra từ `enabledSlots`
- `avoidRepeat`
- `preferHomeCook`
- `calorieTolerancePercent`: `5–30`

`WeeklyPlan` hiện trả về:

- trạng thái kế hoạch;
- ngày bắt đầu/kết thúc;
- giới hạn, dự kiến và thực tế về ngân sách;
- mục tiêu, dự kiến và thực tế về kcal;
- lỗi tạo kế hoạch;
- danh sách ngày và slot;
- snapshot món, giá, kcal, macro;
- trạng thái slot, khóa, số lần đổi, hoàn thành hoặc bỏ qua.

Các API hiện có đủ cho:

- đọc/lưu cấu hình;
- tạo và polling tiến trình;
- đọc kế hoạch hiện tại/chi tiết/lịch sử;
- bắt đầu, tạo lại và lưu trữ kế hoạch;
- đổi, khóa, hoàn thành và bỏ qua từng bữa;
- lấy danh sách nguyên liệu theo ngày.

## 4. Các điểm mobile và backend đang lệch nhau

### 4.1 `mealsPerDay` không nên là nguồn dữ liệu độc lập

Backend đã suy ra số bữa từ số phần tử unique của `enabledSlots`, nhưng mobile vẫn có sheet chọn `1/2/3/4 bữa/ngày` rồi ánh xạ ngầm sang slot.

Rủi ro:

- `2 bữa/ngày` luôn biến thành sáng và tối, người dùng không thể chọn trưa và tối trong sheet đó.
- count và chip có thể lệch nhau.
- Home hiện hardcode `mealsPerDay = 3`, nên kế hoạch 1, 2 hoặc 4 bữa hiển thị sai.

Thiết kế mới:

- bỏ dropdown `số bữa/ngày` riêng;
- trong sheet Lịch ăn, người dùng chọn trực tiếp các slot;
- `mealsPerDay = unique(enabledSlots).length` chỉ là derived value;
- tổng số bữa = tổng số slot thực tế trong `plan.days`, không hardcode.

### 4.2 `cookMode` trên mobile không khớp backend

Mobile đang dùng `SELF_COOK | EAT_OUT`. Backend chỉ có boolean `preferHomeCook`.

Nghiêm trọng hơn, `EditPlanScreen.buildDto()` hiện không gửi `preferHomeCook`; chỉ gửi `avoidRepeat`. Vì vậy toggle tự nấu hiện không được lưu.

Thiết kế mới đổi nhãn thành `Ưu tiên món dễ tự nấu`, ánh xạ thẳng tới `preferHomeCook`.

### 4.3 `preferHomeCook` được lưu nhưng generator chưa sử dụng

Backend có field và DTO, nhưng `configSnapshot` chưa chứa `preferHomeCook`; generator cũng không đọc hoặc chấm điểm field này. UI hiện tại khiến người dùng tin rằng lựa chọn có tác dụng dù thuật toán chưa áp dụng.

Đây là phần BE cần bổ sung, mô tả ở mục 8.

### 4.4 `keepLockedMeals` không thuộc cấu hình tạo mới

Mobile hiển thị `Giữ món đã khóa`, nhưng:

- không có field tương ứng trong `WeeklyPlanConfig`;
- không được gửi trong DTO;
- không ảnh hưởng lần generate mới;
- API regenerate hiện archive kế hoạch cũ rồi tạo kế hoạch mới cùng config/ngày.

Thiết kế mới loại bỏ lựa chọn này khỏi màn tạo mới. Nếu sản phẩm muốn bảo lưu slot đã khóa khi regenerate, cần một contract riêng, không nên ngầm đặt trong config mặc định.

### 4.5 Khoảng kcal có backend nhưng chưa được đưa lên UI

`calorieTolerancePercent` đã được lưu và generator dùng khi truy vấn ứng viên. Đây là tùy chọn có tác dụng thật, nên thiết kế mới đưa vào sheet với các mức `±5%`, `±10%`, `±20%`, `±30%`.

### 4.6 Home đang gọi dữ liệu dự kiến là “đã chi tiêu/đã nạp”

`computeWeeklyForecast()` thực tế trả về tổng dự kiến của kế hoạch. Khi chưa hoàn thành bữa, `actualSpentVnd` và `actualKcal` vẫn bằng 0. Vì vậy Home không nên ghi `Chi tiêu` hoặc `Đã nạp` cho giá trị projected.

Thiết kế mới dùng:

- `Ngân sách dự kiến` → `projectedCostVnd / budgetLimitVnd`;
- `Năng lượng dự kiến` → `projectedKcal / targetKcal`;
- số thực tế chỉ hiển thị sau khi có slot `COMPLETED`.

### 4.7 Ngày kết thúc có nguy cơ lệch một ngày

Generator tạo ngày với `i = 0 .. durationDays - 1`, nhưng service đang tính `endDate = startDate + durationDays`. Với 7 ngày bắt đầu 23/09, danh sách slot là 23–29/09 nhưng `endDate` có thể là 30/09.

BE cần thống nhất một trong hai contract:

- khuyến nghị: `endDate` là ngày cuối cùng inclusive và tính `startDate + durationDays - 1`;
- hoặc giữ end-exclusive nhưng phải đổi tên/document rõ, đồng thời FE không dùng nó như ngày hiển thị cuối.

## 5. UX mới theo từng màn

### 5.1 Màn cấu hình

Giữ bốn nhóm dữ liệu đúng backend:

1. Ngân sách.
2. Năng lượng mỗi ngày và nguồn `PROFILE/CUSTOM`.
3. Lịch ăn gồm duration và enabled slots.
4. Tùy chọn tạo món gồm prefer home cook, repeat và kcal tolerance.

Summary phía trên cập nhật tức thời. CTA chính duy nhất là `Tạo thực đơn`; `Lưu làm mặc định` là action phụ.

### 5.2 Sheet Lịch ăn

- Chỉ cho chọn `3/5/7/14 ngày`.
- Chọn trực tiếp từng slot.
- Luôn yêu cầu tối thiểu một slot.
- Không hiển thị giờ ăn vì hệ thống hiện không lưu giờ.
- Ngày hiển thị cuối phải được tính theo contract inclusive.

### 5.3 Sheet Tùy chọn tạo món

- `Ưu tiên món dễ tự nấu` → `preferHomeCook`.
- `Hạn chế lặp món` → `avoidRepeat`.
- `Độ linh hoạt năng lượng` → `calorieTolerancePercent`.
- Dị ứng, chế độ ăn bắt buộc và nguyên liệu cần tránh luôn là hard constraint, không cho tắt trong sheet này.

### 5.4 Home

- READY: chip `Sẵn sàng`, CTA `Mở thực đơn`.
- ACTIVE: chip `Đang thực hiện`, hiển thị thêm số bữa hoàn thành.
- GENERATING: progress và CTA disabled.
- FAILED: lý do thân thiện và CTA `Điều chỉnh & tạo lại`.
- COMPLETED/ARCHIVED/expired: empty state cho kế hoạch mới.

Số ngày và số bữa phải lấy từ `plan.days`/`slots`, không dùng hằng số.

### 5.5 Chi tiết thực đơn

- Header summary dùng projected values khi READY.
- Day selector sinh từ `plan.days`.
- Meal card dùng trực tiếp snapshot trong slot.
- `Đổi` → swap endpoint.
- Khóa → lock endpoint.
- Checkbox hoàn thành → complete endpoint; nếu cần sửa giá/kcal thực tế thì mở confirm sheet.
- Menu phụ chứa bỏ qua, tạo lại và archive tùy trạng thái.
- `Bắt đầu kế hoạch` chỉ có ở READY; ACTIVE không hiển thị lại CTA này.

## 6. Contract FE dùng ngay, không cần thêm database

### Lưu config

```json
{
  "budgetVnd": 300000,
  "kcalPerDay": 2000,
  "kcalMode": "PROFILE",
  "durationDays": 7,
  "enabledSlots": ["MORNING", "LUNCH", "DINNER"],
  "avoidRepeat": true,
  "preferHomeCook": true,
  "calorieTolerancePercent": 10
}
```

FE không cần gửi `mealsPerDay`. Trong giai đoạn tương thích, backend vẫn có thể trả field này nhưng FE không dùng làm source of truth.

### Tạo kế hoạch

```json
{
  "startDate": "2026-09-23"
}
```

Config phải được lưu thành công trước khi gọi generate. `Idempotency-Key` phải được giữ ổn định khi retry cùng một thao tác; không tạo key mới chỉ vì request timeout.

## 7. Việc FE cần sửa

### Bắt buộc

- Gửi `preferHomeCook` và `calorieTolerancePercent` trong `buildDto()`.
- Thay `AdvancedOptions.cookMode` bằng `preferHomeCook: boolean`.
- Xóa `keepLockedMeals` khỏi config tạo mới.
- Hợp nhất duration và selected slots trong sheet `Lịch ăn` hoặc bảo đảm hai sheet dùng cùng một draft.
- Không gửi/đọc `mealsPerDay` như source of truth.
- Home tính `mealCount = sum(day.slots.length)` và số slot/ngày từ dữ liệu thực tế.
- Đổi label projected/actual cho đúng nghĩa.
- Hiển thị đúng state READY, ACTIVE, GENERATING và FAILED.
- Khi `kcalMode=PROFILE`, hiển thị giá trị hiệu lực từ profile nhưng giữ fallback nếu profile chưa có target.

### Nên làm

- Giữ dirty draft khi đóng sheet; hỏi xác nhận nếu người dùng thoát toàn màn khi chưa lưu.
- Hiển thị inline validation thay cho `Alert.alert` đối với lỗi cấu hình.
- Khi polling timeout, cho `Kiểm tra trạng thái` trước khi tạo request mới.
- Disable toàn bộ input trong lúc lưu/generate và chống double-submit.

## 8. Việc BE cần bổ sung hoặc sửa

### BE-01 — Áp dụng `preferHomeCook` vào generator

Không cần migration vì field đã tồn tại.

Thay đổi cần thiết:

1. Thêm `preferHomeCook` vào `configSnapshot` trong `WeeklyPlansService.generate()`.
2. Đọc field từ snapshot trong `WeeklyPlanGeneratorService.run()`.
3. Mở rộng candidate query để biết món có khả năng tự nấu. Có thể dùng tín hiệu hiện có:
   - có ít nhất một `recipeStep`;
   - có `dishIngredients`;
   - có `recipeTitle` hoặc thời gian chuẩn bị/nấu.
4. Đây nên là soft preference, không phải hard filter. Cộng điểm cho món có công thức; nếu pool nhỏ vẫn cho phép món khác.
5. Ghi score/reason snapshot để debug và giải thích lựa chọn.

Acceptance criteria:

- bật/tắt field làm thay đổi score hoặc thứ tự ứng viên;
- hard constraint về dị ứng/nguyên liệu tránh không bị nới;
- config snapshot của plan chứa giá trị đã dùng;
- unit test chứng minh cùng một pool có thứ tự khác nhau khi bật preference.

### BE-02 — Sửa semantics `endDate`

Khuyến nghị `endDate` inclusive:

```ts
endDate.setDate(endDate.getDate() + config.durationDays - 1);
```

Acceptance criteria: start `2026-09-23`, duration `7` trả end `2026-09-29` và generator tạo đúng bảy day group.

### BE-03 — Đồng bộ validation ngân sách

Mobile hiện cho slider về `0`, trong khi DTO yêu cầu `>=1`; cả hai đều không phản ánh mức khả thi của thuật toán.

Khuyến nghị:

- product xác nhận `MIN_WEEKLY_BUDGET_VND`, ví dụ `50.000`;
- backend dùng cùng minimum;
- trả validation code có field `budgetVnd`, `min`, `max`, `step`;
- tốt hơn: `GET /weekly-plan-config/options` trả constraint động để mobile không hardcode.

Response đề xuất:

```json
{
  "durationOptions": [3, 5, 7, 14],
  "budget": { "min": 50000, "max": 1000000, "step": 50000 },
  "kcal": { "min": 800, "max": 5000, "step": 50 },
  "calorieToleranceOptions": [5, 10, 20, 30],
  "availableSlots": ["MORNING", "LUNCH", "DINNER", "SNACK"]
}
```

Endpoint options là bổ sung khuyến nghị, không bắt buộc để ship UI đầu tiên.

### BE-04 — Sửa suggestion khi generate thất bại

Generator hiện có thể đề xuất `ENABLE_MEAL_SLOT: SNACK`. Việc thêm slot làm tăng số bữa cần sinh và không phải lúc nào cũng giúp khắc phục thiếu ứng viên.

Backend nên trả suggestion dựa trên nguyên nhân thực:

- `INCREASE_BUDGET` với giá trị tối thiểu tính được;
- `INCREASE_KCAL_TOLERANCE`;
- `DISABLE_AVOID_REPEAT`;
- `REMOVE_MEAL_SLOT` nếu một slot cụ thể không có ứng viên;
- `REVIEW_AVOIDED_INGREDIENTS` chỉ khi profile thực sự có dữ liệu tránh;
- `CATALOG_INSUFFICIENT` khi người dùng không thể tự khắc phục.

Contract đề xuất:

```json
{
  "code": "WEEKLY_PLAN_INSUFFICIENT_CANDIDATES",
  "message": "Chưa đủ món phù hợp cho bữa tối.",
  "details": {
    "failedSlot": "DINNER",
    "date": "2026-09-25",
    "candidateCount": 0,
    "slotsNeeded": 21
  },
  "suggestions": [
    { "type": "INCREASE_BUDGET", "value": 350000 },
    { "type": "INCREASE_KCAL_TOLERANCE", "value": 20 },
    { "type": "DISABLE_AVOID_REPEAT" }
  ]
}
```

### BE-05 — Nếu muốn giữ slot khóa khi regenerate

Chỉ bổ sung nếu product xác nhận nghiệp vụ. Không đặt vào config mặc định.

Request đề xuất:

```json
{
  "preserveLockedSlots": true
}
```

`POST /weekly-plans/:planId/regenerate` phải copy các slot locked còn hợp lệ sang plan mới trước khi fill các slot còn lại. Cần kiểm tra ngày, meal slot, dietary constraint và budget mới. Nếu không triển khai, UI không được hiển thị lựa chọn này.

## 9. Thay đổi database

Thiết kế được khuyến nghị không bắt buộc migration mới vì ba tùy chọn chính đã có trong `weekly_plan_configs`.

Chỉ cần migration nếu triển khai `preserveLockedSlots` như preference lâu dài hoặc thêm version cho config. Nếu cần optimistic locking thật cho config, thêm:

```prisma
version Int @default(1)
```

Sau đó `PUT /weekly-plan-config` phải kiểm tra `If-Match` và tăng version atomically. Hiện mobile gửi header version nhưng controller/service config chưa sử dụng nó.

## 10. Trạng thái và accessibility

- Loading config: skeleton, không nhảy layout.
- Saving: CTA phụ có progress, input có disabled semantics.
- Generating: hiển thị tiến trình từ generation endpoint; không chỉ spinner vô hạn.
- Error: bottom sheet có recovery action từ backend.
- Touch target tối thiểu 44pt iOS/48dp Android.
- Selected state luôn có check hoặc label, không chỉ đổi màu.
- Bottom sheet chuyển screen-reader focus vào title; khi đóng trả focus về control đã mở sheet.
- Dynamic Type không truncate label hoặc giá trị quan trọng.
- Sticky CTA tôn trọng keyboard và safe area.

## 11. Test cases tối thiểu

- Duration 3, 5, 7 và 14 tạo đúng số day group.
- Một, hai, ba và bốn enabled slots tạo đúng tổng slot.
- Slot tùy ý như `LUNCH + DINNER` không bị remap thành `MORNING + DINNER`.
- PROFILE dùng `goalKcal` hiện tại; thiếu goal dùng fallback có giải thích.
- CUSTOM chấp nhận biên min/max và từ chối ngoài khoảng.
- `avoidRepeat=true` được relax đúng khi pool thiếu và reason snapshot được ghi.
- `preferHomeCook` thực sự thay đổi ranking sau BE-01.
- Home không hiển thị `3 bữa/ngày` khi plan có cấu hình khác.
- projected và actual không bị gắn nhãn lẫn nhau.
- retry generate dùng cùng idempotency key.
- READY chỉ start một lần với đúng plan version.
- đổi/khóa/complete xử lý đúng version conflict.
- endDate và danh sách ngày không lệch một ngày.

## 12. Thứ tự triển khai khuyến nghị

1. FE sửa source of truth cho slot, label projected/actual và payload config.
2. BE sửa inclusive endDate và snapshot `preferHomeCook`.
3. BE triển khai scoring `preferHomeCook` và test.
4. FE thay ba sheet cũ bằng Lịch ăn + Tùy chọn tạo món.
5. FE cập nhật Home và WeeklyPlan detail theo state.
6. BE cải thiện error suggestions.
7. Tùy chọn: options endpoint và optimistic locking cho config.

## 13. Ghi chú tạo mockup

Mockup được tạo bằng ImageGen tích hợp. Prompt khóa thiết kế vào các field và action có thật trong codebase, loại bỏ giờ ăn và `keepLockedMeals` khỏi cấu hình tạo mới, đồng thời phân biệt rõ projected với actual.
