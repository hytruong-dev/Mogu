# API Docs — BA-003: Trang chủ & Điều hướng

> **Base URL:** `http://localhost:3001/api/v1`  
> **Auth:** Tất cả endpoint yêu cầu header `Authorization: Bearer <access_token>`  
> **Swagger UI:** `http://localhost:3001/api/docs`

---

## Mục lục

| # | Method | Endpoint | Mô tả |
|---|--------|----------|-------|
| 1 | GET | `/home` | Dashboard tổng hợp trang chủ (BFF) |
| 2 | GET | `/recommendations/home` | Danh sách gợi ý món cá nhân hóa |
| 3 | POST | `/dishes/:id/save` | Lưu món vào danh sách yêu thích |
| 4 | DELETE | `/dishes/:id/save` | Bỏ lưu món |
| 5 | GET | `/nutrition/today` | Tóm tắt dinh dưỡng hôm nay |
| 6 | GET | `/notifications/unread-count` | Đếm thông báo chưa đọc |
| 7 | GET | `/notifications` | Danh sách thông báo |
| 8 | PATCH | `/notifications/:id/read` | Đánh dấu thông báo đã đọc |
| 9 | GET | `/catalogs/goals` | Danh sách quick goals trang chủ |

---

## 1. GET `/home` — Dashboard tổng hợp

**Mô tả:** BFF aggregator — gọi một lần, nhận đủ dữ liệu cho toàn bộ trang chủ. Mỗi widget có `status` riêng; lỗi một widget không làm sập toàn response.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response 200:**
```json
{
  "generatedAt": "2026-08-12T03:30:00.000Z",
  "localDate": "2026-08-12",
  "cacheTtl": 300,
  "profileVersion": 2,

  "greetingStatus": "ok",
  "greeting": {
    "phrase": "Chào buổi sáng",
    "name": "Huy",
    "full": "Chào buổi sáng, Huy!"
  },

  "recommendationsStatus": "ok",
  "recommendations": [
    {
      "dishId": "uuid-dish-1",
      "name": "Phở bò",
      "imageUrl": "https://cdn.mogu.app/dishes/pho-bo.jpg",
      "calories": 450,
      "prepMinutes": 15,
      "priceRange": "35000-60000",
      "reasonShort": "Phù hợp với khẩu vị của bạn",
      "isSaved": false
    }
  ],

  "nutritionStatus": "empty",
  "nutritionSummary": null,

  "notificationStatus": "ok",
  "unreadCount": 3
}
```

**Widget status values:**

| Widget | Giá trị `status` | Ý nghĩa |
|--------|-----------------|---------|
| `greetingStatus` | `ok` / `error` | Luôn có greeting nếu ok |
| `recommendationsStatus` | `ok` / `error` / `empty` | `empty` khi không có món nào phù hợp |
| `nutritionStatus` | `ok` / `error` / `empty` | `empty` khi chưa ghi bữa ăn hôm nay |
| `notificationStatus` | `ok` / `error` | `unreadCount = 0` nếu error |

**Greeting logic theo giờ (múi giờ Asia/Ho_Chi_Minh):**

| Khung giờ | Phrase |
|-----------|--------|
| 05:00 – 10:59 | `Chào buổi sáng` |
| 11:00 – 13:59 | `Chào buổi trưa` |
| 14:00 – 17:59 | `Chào buổi chiều` |
| 18:00 – 04:59 | `Chào buổi tối` |

> `name` = `display_name` của user. Nếu chưa đặt tên → dùng `"bạn"` (không dùng email).

**Response lỗi:**
```json
// 401 — Token hết hạn hoặc không hợp lệ
{ "statusCode": 401, "message": "Unauthorized" }
```

---

## 2. GET `/recommendations/home` — Gợi ý món

**Mô tả:** Danh sách món gợi ý cá nhân hóa. Tự động loại các món vi phạm dị ứng của user. Hỗ trợ phân trang và lọc theo goal.

**Query params:**

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `page` | number | `1` | Trang hiện tại (≥ 1) |
| `limit` | number | `10` | Số item mỗi trang (1–50) |
| `goalCode` | string | — | Code của goal để lọc lý do gợi ý (vd: `BALANCE`, `LOSE_WEIGHT`, `BUILD_MUSCLE`) |

**Ví dụ request:**
```
GET /api/v1/recommendations/home?page=1&limit=10&goalCode=LOSE_WEIGHT
```

**Response 200:**
```json
{
  "data": [
    {
      "dishId": "uuid-dish-1",
      "name": "Salad gà",
      "imageUrl": "https://cdn.mogu.app/dishes/salad-ga.jpg",
      "calories": 320,
      "prepMinutes": 10,
      "priceRange": "30000-50000",
      "reasonShort": "Ít calo, hỗ trợ giảm cân",
      "isSaved": true
    },
    {
      "dishId": "uuid-dish-2",
      "name": "Cháo yến mạch",
      "imageUrl": null,
      "calories": 280,
      "prepMinutes": 8,
      "priceRange": null,
      "reasonShort": "Ít calo, hỗ trợ giảm cân",
      "isSaved": false
    }
  ],
  "page": 1,
  "limit": 10,
  "hasMore": true
}
```

**`reasonShort` theo goalCode:**

| `goalCode` | `reasonShort` |
|------------|--------------|
| `BALANCE` | Phù hợp với mục tiêu cân bằng dinh dưỡng |
| `LOSE_WEIGHT` | Ít calo, hỗ trợ giảm cân |
| `BUILD_MUSCLE` | Giàu protein, hỗ trợ tăng cơ |
| `EAT_HEALTHY` | Lành mạnh và tốt cho sức khỏe |
| `EXPLORE` | Khám phá hương vị mới |
| _(không truyền)_ | Phù hợp với khẩu vị của bạn |

> **Lưu ý:** Món trong `allergenCodes` của user bị loại hoàn toàn trước khi ranking — không bao giờ xuất hiện trong kết quả.

---

## 3. POST `/dishes/:id/save` — Lưu món

**Mô tả:** Lưu món vào danh sách yêu thích. **Idempotent** — gọi nhiều lần với cùng `id` chỉ tạo một bản ghi.

**Path param:** `id` — UUID của món ăn

**Ví dụ request:**
```
POST /api/v1/dishes/uuid-dish-1/save
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "dishId": "uuid-dish-1",
  "saved": true,
  "savedAt": "2026-08-12T03:45:00.000Z"
}
```

**Response lỗi:**
```json
// 404 — Món không tồn tại hoặc đã bị ẩn
{
  "statusCode": 404,
  "message": "Món ăn không tồn tại hoặc đã bị ẩn."
}
```

---

## 4. DELETE `/dishes/:id/save` — Bỏ lưu món

**Mô tả:** Xóa món khỏi danh sách yêu thích. **Idempotent** — nếu chưa lưu thì vẫn trả 200, không báo lỗi.

**Path param:** `id` — UUID của món ăn

**Ví dụ request:**
```
DELETE /api/v1/dishes/uuid-dish-1/save
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "dishId": "uuid-dish-1",
  "saved": false
}
```

**Response lỗi:**
```json
// 404 — dishId không tồn tại trong DB
{
  "statusCode": 404,
  "message": "Món ăn không tồn tại."
}
```

---

## 5. GET `/nutrition/today` — Dinh dưỡng hôm nay

**Mô tả:** Tóm tắt kcal, protein từ meal logs trong ngày local. Trả `dataStatus: "no_data"` khi chưa có bữa ăn nào (không bao giờ trả số 0 gây hiểu sai).

**Query params:**

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `localDate` | string | Hôm nay (VN tz) | Ngày cần xem, định dạng `YYYY-MM-DD` |

**Ví dụ request:**
```
GET /api/v1/nutrition/today?localDate=2026-08-12
```

**Response 200 — Chưa có dữ liệu:**
```json
{
  "date": "2026-08-12",
  "dataStatus": "no_data"
}
```

> Khi `dataStatus = "no_data"`, **không hiển thị số 0** trên UI. Thay vào đó hiển thị CTA "Ghi lại bữa ăn".

**Response 200 — Có dữ liệu một phần:**
```json
{
  "date": "2026-08-12",
  "dataStatus": "partial",
  "caloriesConsumed": 650,
  "calorieTarget": 2000,
  "proteinG": 28.5,
  "mealsLogged": 1
}
```

**Response 200 — Đủ dữ liệu (≥ 80% target):**
```json
{
  "date": "2026-08-12",
  "dataStatus": "complete",
  "caloriesConsumed": 1820,
  "calorieTarget": 2000,
  "proteinG": 85.2,
  "mealsLogged": 3
}
```

**`dataStatus` logic:**

| Giá trị | Điều kiện |
|---------|----------|
| `no_data` | Không có meal log nào trong ngày |
| `partial` | Có meal log, nhưng `caloriesConsumed < 80%` của `calorieTarget` (hoặc không có `calorieTarget`) |
| `complete` | `caloriesConsumed ≥ 80%` của `calorieTarget` |

---

## 6. GET `/notifications/unread-count` — Đếm thông báo chưa đọc

**Mô tả:** Trả raw count. Client tự xử lý hiển thị "99+" nếu `count > 99`.

**Response 200:**
```json
{
  "count": 5
}
```

> `count = 0` nghĩa là không có thông báo chưa đọc (không có badge).

---

## 7. GET `/notifications` — Danh sách thông báo

**Query params:**

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `page` | number | `1` | Trang (≥ 1) |
| `limit` | number | `20` | Số item (1–100) |

**Ví dụ request:**
```
GET /api/v1/notifications?page=1&limit=20
```

**Response 200:**
```json
{
  "data": [
    {
      "id": "notif-uuid-1",
      "type": "SYSTEM",
      "title": "Chào mừng đến với Mogu!",
      "body": "Khám phá hàng nghìn món ăn phù hợp với bạn.",
      "deepLink": "/home",
      "imageUrl": null,
      "status": "UNREAD",
      "readAt": null,
      "createdAt": "2026-08-12T03:00:00.000Z"
    },
    {
      "id": "notif-uuid-2",
      "type": "REMINDER",
      "title": "Đừng quên bữa trưa!",
      "body": "Có vài món ngon đang chờ bạn hôm nay.",
      "deepLink": "/recommendations",
      "imageUrl": "https://cdn.mogu.app/notifs/lunch.jpg",
      "status": "READ",
      "readAt": "2026-08-12T04:00:00.000Z",
      "createdAt": "2026-08-12T02:00:00.000Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "hasMore": false
}
```

**`type` values:**

| Giá trị | Mô tả |
|---------|-------|
| `SYSTEM` | Thông báo hệ thống (welcome, cập nhật) |
| `PROMO` | Khuyến mãi, sự kiện |
| `REMINDER` | Nhắc nhở bữa ăn, uống nước |
| `ACHIEVEMENT` | Huy hiệu, thành tích |

---

## 8. PATCH `/notifications/:id/read` — Đánh dấu đã đọc

**Mô tả:** Đánh dấu thông báo đã đọc. **Idempotent** — thông báo đã đọc vẫn trả 200. Validate ownership — chỉ đọc được thông báo của chính mình.

**Path param:** `id` — UUID của thông báo

**Ví dụ request:**
```
PATCH /api/v1/notifications/notif-uuid-1/read
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "id": "notif-uuid-1",
  "type": "SYSTEM",
  "title": "Chào mừng đến với Mogu!",
  "body": "Khám phá hàng nghìn món ăn phù hợp với bạn.",
  "deepLink": "/home",
  "imageUrl": null,
  "status": "READ",
  "readAt": "2026-08-12T03:45:30.000Z",
  "createdAt": "2026-08-12T03:00:00.000Z"
}
```

**Response lỗi:**
```json
// 404 — Thông báo không tồn tại
{
  "statusCode": 404,
  "message": "Thông báo không tồn tại."
}

// 403 — Cố đọc thông báo của người khác
{
  "statusCode": 403,
  "message": "Bạn không có quyền thao tác trên thông báo này."
}
```

---

## 9. GET `/catalogs/goals` — Quick goals trang chủ

**Mô tả:** Danh sách goals active để hiển thị Quick Goal trên trang chủ. Client nên cache theo `version`. **Lưu ý:** Quick goal chỉ là context cho phiên Random, **không tự đổi `primaryGoal` trong hồ sơ user**.

**Response 200:**
```json
{
  "version": "1.0.0",
  "goals": [
    {
      "id": "goal-uuid-1",
      "code": "BALANCE",
      "name": "Cân bằng",
      "description": "Duy trì chế độ ăn cân bằng, đa dạng",
      "displayOrder": 1
    },
    {
      "id": "goal-uuid-2",
      "code": "LOSE_WEIGHT",
      "name": "Giảm cân",
      "description": "Ưu tiên món ít calo, nhiều chất xơ",
      "displayOrder": 2
    },
    {
      "id": "goal-uuid-3",
      "code": "BUILD_MUSCLE",
      "name": "Tăng cơ",
      "description": "Ưu tiên món giàu protein",
      "displayOrder": 3
    },
    {
      "id": "goal-uuid-4",
      "code": "EXPLORE",
      "name": "Khám phá",
      "description": "Thử những hương vị mới mỗi ngày",
      "displayOrder": 4
    }
  ]
}
```

> Client dùng `version` để quyết định có cần fetch lại hay không (cache invalidation).

---

## Tổng hợp Error Codes

| HTTP | Mô tả | Khi nào |
|------|-------|---------|
| `401` | Unauthorized | Token thiếu, hết hạn hoặc không hợp lệ |
| `403` | Forbidden | Truy cập tài nguyên của user khác |
| `404` | Not Found | Dish/Notification không tồn tại |
| `500` | Internal Server Error | Lỗi server không xác định |

---

## Hướng dẫn tích hợp cho Mobile

### Luồng tải trang chủ khuyến nghị:

```
1. Gọi GET /home  →  nhận tất cả widget trong 1 request
2. Render skeleton ngay
3. Khi có data → update từng widget theo status:
   - greetingStatus === 'ok'  → hiển thị lời chào
   - recommendationsStatus === 'empty'  → ẩn section gợi ý
   - nutritionStatus === 'no_data'  → hiển thị CTA "Ghi lại bữa ăn" (KHÔNG hiển thị 0 kcal)
   - unreadCount > 0  → hiển thị badge (client format: count > 99 → "99+")
4. Pull-to-refresh  →  gọi lại GET /home
```

### Luồng Quick Goal → Random:

```
1. GET /catalogs/goals  →  hiển thị danh sách goals (cache theo version)
2. User tap goal  →  lưu goalCode vào session state (KHÔNG gọi API)
3. Mở màn Random  →  truyền goalCode như context phiên
4. GET /recommendations/home?goalCode=BALANCE  →  gợi ý theo goal
```

### Optimistic update khi Save/Unsave:

```
1. User tap icon tim  →  update UI ngay (isSaved = true)
2. Gọi POST /dishes/:id/save
3. Nếu lỗi 4xx/5xx  →  rollback UI (isSaved = false) + thông báo lỗi
4. Nếu thành công  →  giữ nguyên UI đã update
```
