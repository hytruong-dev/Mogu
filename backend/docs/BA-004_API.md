# BA-004: Phân hệ Món ăn — API Documentation

> Base URL: `http://localhost:3001/v1`
> Xác thực: `Authorization: Bearer <supabase_jwt>`

---

## 1. Taxonomy (Public — Không cần auth)

### GET `/taxonomy/regions`
Danh sách vùng miền (Bắc/Trung/Nam).
```json
[{ "id": "...", "code": "NORTH", "name": "Miền Bắc", "isActive": true }]
```

### GET `/taxonomy/provinces?regionId=<uuid>`
Tỉnh/thành, tùy chọn lọc theo `regionId`.
```json
[{ "id": "...", "code": "HN", "name": "Hà Nội", "regionId": "...", "region": {...} }]
```

### GET `/taxonomy/categories`
Danh mục món ăn (RICE, NOODLE, SOUP, ...).

### GET `/taxonomy/meal-types`
Loại bữa ăn (BREAKFAST, LUNCH, DINNER, SNACK, ANY).

### GET `/taxonomy/diet-types`
Chế độ ăn (VEGETARIAN, VEGAN, KETO, EAT_CLEAN, ...).

### GET `/taxonomy/goals`
Mục tiêu/nhu cầu (BALANCE, LOSE_WEIGHT, BUILD_MUSCLE, ...).

### GET `/taxonomy/allergens`
Danh mục dị ứng chuẩn (SEAFOOD, PEANUT, MILK, ...).

---

## 2. Ingredients (Public)

### GET `/ingredients?q=<tên>&allergenCode=<code>&limit=<n>`
Tìm kiếm từ điển nguyên liệu.
```json
[{ "id": "...", "code": "GA_DUNG_PHUONG", "name": "Gà đùi phương", "synonyms": ["thịt gà", "đùi gà"], "unit": "gram", "allergenCode": null }]
```

---

## 3. Public Dish Search

### GET `/dishes`
Tìm kiếm món PUBLISHED. Chỉ trả kết quả `status=PUBLISHED` và `deletedAt=null`.

**Query params:**
| Param | Type | Mô tả |
|---|---|---|
| `q` | string | Tìm kiếm tên (hỗ trợ tiếng Việt không dấu, e.g. `pho bo`) |
| `regionId` | UUID | Lọc theo vùng miền |
| `provinceId` | UUID | Lọc theo tỉnh/thành |
| `categoryCodes` | string[] | Danh mục (e.g. `categoryCodes=RICE&categoryCodes=NOODLE`) |
| `mealTypeCodes` | string[] | Loại bữa ăn |
| `dietTypeCodes` | string[] | Chế độ ăn |
| `goalCodes` | string[] | Mục tiêu |
| `maxBudget` | number | Ngân sách tối đa (VND) |
| `limit` | number | Số kết quả (mặc định 20, tối đa 100) |
| `cursor` | string | Cursor phân trang |
| `sort` | enum | `relevance` \| `popular` \| `newest` |

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Phở bò",
      "slug": "pho-bo",
      "status": "PUBLISHED",
      "prepMinutes": 30,
      "priceMin": 30000,
      "priceMax": 80000,
      "region": { "code": "NORTH", "name": "Miền Bắc" },
      "categories": [{ "category": { "code": "NOODLE", "name": "Bún / Phở / Mì" } }],
      "media": [{ "storageKey": "dishes/uuid/img.jpg", "bucket": "dish-images" }],
      "nutritionProfiles": [{ "calories": 450, "proteinG": 25 }]
    }
  ],
  "pageInfo": { "nextCursor": "uuid-or-null", "hasNextPage": false }
}
```

### GET `/dishes/:idOrSlug`
Chi tiết món ăn PUBLISHED. `idOrSlug` là UUID hoặc slug.

**Response đầy đủ bao gồm:**
- region, province
- categories, mealTypes, dietTypes, dishGoals
- dishIngredients (có ingredient dictionary mapping)
- dishAllergens
- nutritionProfiles (primary)
- recipes[0].steps (recipe mặc định)
- media (APPROVED)
- sources
- variants (PUBLISHED)

---

## 4. User Auth Required

### POST `/dish-randomizations`
Random món ăn theo tiêu chí, lưu snapshot lịch sử.

**Request:**
```json
{
  "mealTypeCode": "LUNCH",
  "goalCodes": ["HEALTHY"],
  "dietTypeCodes": [],
  "excludeDishIds": [],
  "maxBudget": 80000,
  "weatherCode": "RAIN"
}
```

**Hard filters (không bao giờ nới):**
- Allergen user: không trả `CONTAINS`
- Diet type hard: bắt buộc
- Meal type đã chọn

**Soft scoring (0–100):**
- Goal match: 0–40
- Time suitability: 0–10
- Popularity: 0–10
- Data quality: 0–20
- Novelty (7-day exclusion): 0–20

**Response success:**
```json
{
  "randomizationId": "uuid",
  "dish": { ...dishObject },
  "reason": { "summary": "Phù hợp với mục tiêu của bạn", "factors": ["..."] },
  "scoreBreakdown": { "goalMatch": 32, "novelty": 20, "total": 78 }
}
```

**Response no candidates:**
```json
{
  "dish": null,
  "reason": null,
  "randomizationId": null,
  "relaxableCriteria": ["mealType", "budget", "excludeList"],
  "message": "Không tìm thấy món phù hợp. Bạn có muốn nới điều kiện tìm kiếm?"
}
```

### POST `/dish-randomizations/:id/select`
Đánh dấu kết quả random đã được chọn (analytics).

### GET `/me/random-history?cursor=&limit=20`
Lịch sử random của user.

### GET `/me/saved-dishes?cursor=&limit=20`
Danh sách món đã lưu (cursor paginated).

### POST `/me/saved-dishes/:dishId`
Lưu món (idempotent). 200 OK.

### DELETE `/me/saved-dishes/:dishId`
Bỏ lưu món (idempotent). 200 OK.

---

## 5. Admin — Dish CRUD

> Cần header: `Authorization: Bearer <token>` của tài khoản có role `CONTENT_ADMIN` hoặc `SUPER_ADMIN`

### GET `/admin/dishes`
Danh sách món mọi trạng thái.

**Query params thêm:** `status` (DRAFT/PUBLISHED/...), `createdBy`

### GET `/admin/dishes/:id`
Chi tiết admin (bao gồm fieldEvidence, auditLogs, versions).

### GET `/admin/dishes/:id/evidence`
Evidence/confidence theo field path.

### GET `/admin/dishes/:id/versions`
Lịch sử phiên bản đã publish.

### POST `/admin/dishes`
Tạo bản nháp mới.
```json
{
  "name": "Phở bò tái",
  "shortDescription": "Phở bò truyền thống miền Bắc",
  "regionId": "uuid-NORTH",
  "categoryIds": ["uuid-NOODLE"],
  "mealTypeIds": ["uuid-BREAKFAST", "uuid-LUNCH"],
  "goalIds": [{ "goalId": "uuid-HEALTHY", "score": 75 }],
  "ingredients": [
    { "rawText": "bánh phở 200g", "quantity": 200, "unit": "g" },
    { "rawText": "thịt bò tái 100g", "ingredientId": "uuid-ingredient" }
  ],
  "priceMin": 30000,
  "priceMax": 80000
}
```

### PATCH `/admin/dishes/:id`
Cập nhật với **optimistic locking**.

**Header bắt buộc:** `If-Match: <version-number>`

**Error 409 khi version conflict:**
```json
{
  "error": {
    "code": "DISH_VERSION_CONFLICT",
    "message": "Món ăn đã được cập nhật bởi người khác. Vui lòng tải lại.",
    "currentVersion": 5
  }
}
```

### POST `/admin/dishes/:id/submit-review`
Gửi kiểm duyệt (DRAFT → PENDING_REVIEW).

### POST `/admin/dishes/:id/unpublish`
Gỡ xuất bản (PUBLISHED → UNPUBLISHED).
```json
{ "reasonCode": "CONTENT_QUALITY", "note": "Thông tin dinh dưỡng cần cập nhật." }
```

### POST `/admin/dishes/:id/republish`
Xuất bản lại (UNPUBLISHED → PUBLISHED). Cần role REVIEWER/SUPER_ADMIN.

### POST `/admin/dishes/:id/archive`
Archive món ăn. Mọi trạng thái → ARCHIVED.

### POST `/admin/dishes/:id/restore`
Khôi phục ARCHIVED → DRAFT. Chỉ SUPER_ADMIN.

### POST `/admin/dishes/:id/versions/:versionId/rollback`
Rollback về version đã publish (tạo version mới). Chỉ SUPER_ADMIN.

---

## 6. Admin — Review Queue

> Cần role `REVIEWER` hoặc `SUPER_ADMIN`

### GET `/admin/review-queue?status=PENDING_REVIEW&cursor=&limit=20&hasConflicts=`
Hàng đợi kiểm duyệt.

### POST `/admin/dishes/:id/approve`
Duyệt & publish. Chạy publish validation trước.
```json
{ "note": "Thông tin đầy đủ, ảnh rõ nét." }
```

**Error 422 khi validation fail:**
```json
{
  "error": {
    "code": "PUBLISH_VALIDATION_FAILED",
    "message": "Món chưa đủ điều kiện xuất bản.",
    "fieldErrors": [
      { "field": "media", "message": "Phải có ảnh chính đã được duyệt." },
      { "field": "sources", "message": "Phải có ít nhất một nguồn tham khảo." }
    ]
  }
}
```

### POST `/admin/dishes/:id/request-changes`
Yêu cầu chỉnh sửa (PENDING_REVIEW → CHANGES_REQUESTED).
```json
{
  "reasonCode": "INSUFFICIENT_SOURCE",
  "note": "Cần thêm nguồn cho thông tin dinh dưỡng.",
  "fieldsToCorrected": ["nutrition", "sources"]
}
```

### POST `/admin/dishes/:id/reject`
Từ chối. Bắt buộc có `reasonCode`.
```json
{ "reasonCode": "DUPLICATE", "note": "Trùng lặp với món ID abc-xyz." }
```

### POST `/admin/dishes/:id/evidence/:evidenceId/resolve`
Resolve evidence của một trường cụ thể.
```json
{ "note": "Đã xác nhận với nguồn chính thức.", "acceptedValue": { "calories": 450 } }
```

---

## 7. Admin — Import Jobs (BullMQ)

> Cần role `CONTENT_ADMIN` hoặc `SUPER_ADMIN`

### POST `/admin/import-jobs`
Tạo pipeline tự động tìm thông tin món ăn.

**Header tùy chọn:** `Idempotency-Key: <unique-key>` (chống tạo trùng)

**Request:**
```json
{
  "query": "Bún bò Huế",
  "sourceTypes": ["JSON_LD", "UNSTRUCTURED"],
  "maxSources": 5,
  "relatedKeywords": ["bún bò", "Huế"]
}
```

**Response:**
```json
{
  "id": "job-uuid",
  "query": "Bún bò Huế",
  "status": "PENDING",
  "progress": 0,
  "createdAt": "..."
}
```

**Pipeline 6 bước (stub):**
1. SEARCHING (10%) — Tìm URL
2. EXTRACTING (30%) — Trích xuất dữ liệu
3. NORMALIZING (50%) — Chuẩn hóa
4. RECONCILING (70%) — Đối chiếu nguồn
5. ENRICHING (85%) — Bổ sung dinh dưỡng
6. DONE (100%) — Tạo PENDING_REVIEW draft

### GET `/admin/import-jobs?status=&cursor=&limit=20`
Danh sách jobs.

### GET `/admin/import-jobs/:id`
Chi tiết job (status, progress, dishId nếu DONE).

### GET `/admin/import-jobs/:id/logs`
Step logs chi tiết từng bước.
```json
{
  "status": "DONE",
  "progress": 100,
  "stepLogs": [
    { "step": "SEARCH", "status": "completed", "at": "...", "data": { "urlsFound": 5 } },
    { "step": "EXTRACT", "status": "completed", "at": "...", "data": { "sourcesExtracted": 3 } }
  ]
}
```

### POST `/admin/import-jobs/:id/retry`
Retry job FAILED (chưa vượt maxAttempts).

### POST `/admin/import-jobs/:id/cancel`
Hủy job đang chạy.

---

## 8. Admin — Media

### POST `/admin/media/presign-upload`
Tạo signed URL để upload ảnh/video lên **Supabase Storage**.

**Hỗ trợ:** `image/jpeg`, `image/png`, `image/webp`, `video/mp4`, `video/webm`, `video/quicktime`

```json
{ "dishId": "uuid", "mimeType": "image/jpeg" }
```
**Response:**
```json
{
  "uploadUrl": "https://lkqvyvllmrbxgaoqrkhd.supabase.co/storage/v1/object/sign/dish-images/dishes/uuid/...",
  "storageKey": "dishes/uuid/1234567890-actorId.jpg",
  "token": "eyJ...",
  "expiresAt": "2026-08-13T06:00:00Z"
}
```

**Upload flow (Supabase Storage):**
1. Server tạo signed PUT URL
2. Client `PUT <uploadUrl>` với body là raw bytes của file + header `Content-Type: image/jpeg`
3. Client gọi `POST /admin/dishes/:id/media` với `storageKey` để commit metadata

### POST `/admin/dishes/:id/media`
Commit metadata sau khi upload.
```json
{
  "storageKey": "dishes/uuid/img.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 204800,
  "width": 1200,
  "height": 800,
  "altText": "Bát phở bò nóng hổi",
  "isPrimary": true
}
```

### POST `/admin/dishes/:id/media/:mediaId/approve`
Duyệt media (PENDING → APPROVED). Cần role REVIEWER.

### DELETE `/admin/dishes/:id/media/:mediaId`
Xóa media (DB + R2 object).

---

## 9. Error Codes

| Code | HTTP | Mô tả |
|---|---|---|
| `DISH_NOT_FOUND` | 404 | Không tìm thấy món hoặc chưa public |
| `DISH_VERSION_CONFLICT` | 409 | Optimistic lock conflict — cần tải lại |
| `PUBLISH_VALIDATION_FAILED` | 422 | Chưa đủ điều kiện publish |
| `INVALID_TRANSITION` | 400 | Chuyển trạng thái không hợp lệ |
| `DISH_NOT_EDITABLE` | 400 | Không thể sửa ở trạng thái hiện tại |
| `INSUFFICIENT_ROLE` | 403 | Không đủ quyền |
| `DUPLICATE_JOB` | 409 | Đã có import job đang chạy cho món này |
| `NOT_FAILED` | 400 | Chỉ retry job FAILED |
| `NOT_CANCELLABLE` | 400 | Không thể hủy ở trạng thái hiện tại |
| `MAX_ATTEMPTS_REACHED` | 400 | Vượt số lần thử tối đa |
| `INVALID_MIME_TYPE` | 400 | Loại file không được hỗ trợ |
| `UPLOAD_NOT_FOUND` | 400 | File chưa được upload hoặc hết hạn |
| `EVIDENCE_NOT_FOUND` | 404 | Không tìm thấy evidence |
| `VERSION_NOT_FOUND` | 404 | Không tìm thấy version |

---

## 10. Dish Lifecycle

```
DRAFT → PROCESSING → PENDING_REVIEW → PUBLISHED → UNPUBLISHED → ARCHIVED
DRAFT → PENDING_REVIEW (manual submit)
PENDING_REVIEW → CHANGES_REQUESTED → PENDING_REVIEW (resubmit)
PENDING_REVIEW → REJECTED → DRAFT (edit)
PUBLISHED → ARCHIVED
FAILED → PROCESSING (retry) / DRAFT (edit)
ARCHIVED → DRAFT (Super Admin restore)
```

Mỗi transition ghi **DishAuditLog** với actor, fromStatus, toStatus, reasonCode, note.
Mỗi lần publish tạo **DishVersion** snapshot bất biến (không xóa, không sửa).

---

## 11. Confidence Levels

| Range | Xử lý |
|---|---|
| 90–100 | Tự chọn làm giá trị đề xuất; vẫn chờ reviewer |
| 75–89 | Warning; reviewer xác nhận |
| 0–74 | Bắt buộc kiểm tra hoặc nhập thủ công |
| null | Chưa xác minh |

**Trường luôn cần reviewer xác nhận:** allergen, dinh dưỡng, nguồn gốc tranh chấp, copyright.

---

## 12. Idempotency

Các endpoints yêu cầu `Idempotency-Key` header:
- `POST /admin/import-jobs`
- `POST /admin/dishes/:id/approve` (recommend)
- `POST /me/saved-dishes/:dishId` (already idempotent by design)

---

## 13. Pagination

Tất cả danh sách dùng cursor-based pagination:
```json
{
  "data": [...],
  "pageInfo": {
    "nextCursor": "uuid-of-last-item-or-null",
    "hasNextPage": true
  }
}
```

Gửi `?cursor=<nextCursor>` để lấy trang tiếp theo.
`limit` mặc định 20, tối đa 100.
