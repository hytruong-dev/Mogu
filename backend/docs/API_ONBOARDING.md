# API Onboarding — Tài liệu cho Frontend

**Version:** 1.0 | **Base URL:** `https://api.mogu.app/v1` | **Auth:** Bearer Token (Supabase JWT)

---

## Tổng quan luồng Onboarding

```
AUTH (ACTIVE) → GET /onboarding (check state)
             ↓ NOT_STARTED / IN_PROGRESS
POST /onboarding/start      → session created
GET  /catalogs/onboarding   → load goals/preferences/allergens

Step 1: POST /onboarding/start
Step 2: PATCH /onboarding/steps/2   (name)
Step 3: PATCH /onboarding/steps/3   (birthday)
Step 4: PATCH /onboarding/steps/4   (gender)       hoặc POST /onboarding/steps/4/skip
Step 5: PATCH /onboarding/steps/5   (body)         hoặc POST /onboarding/steps/5/skip
Step 6: PATCH /onboarding/steps/6   (goal)
Step 7: PATCH /onboarding/steps/7   (preferences)  hoặc POST /onboarding/steps/7/skip
Step 8: GET  /onboarding/summary → POST /onboarding/complete

COMPLETED → Navigate to Home / Random
```

### Bước nào có thể Skip?

| Bước | Tên | Bắt buộc |
|------|-----|----------|
| 1 | Welcome | Không (chỉ trigger start) |
| 2 | Tên gọi | Có thể skip |
| 3 | Ngày sinh | **Bắt buộc** |
| 4 | Giới tính | Có thể skip |
| 5 | Chiều cao & cân nặng | Có thể skip |
| 6 | Mục tiêu | **Bắt buộc** (primary_goal) |
| 7 | Sở thích & hạn chế | Có thể skip |
| 8 | Hoàn tất | Trigger complete |

---

## Header chung

```
Authorization: Bearer <supabase_access_token>
Content-Type: application/json
x-profile-version: <number>   // Dùng để phát hiện conflict (optional nhưng khuyến nghị)
```

---

## 1. Catalog

### GET /v1/catalogs/onboarding

Lấy danh sách goals, dietary preferences, allergens. **Gọi 1 lần và cache theo `version`.**

**Response 200:**
```json
{
  "data": {
    "version": "1.0.0",
    "goals": [
      { "id": "uuid", "code": "BALANCE", "name": "Cân bằng", "description": "...", "displayOrder": 1 },
      { "id": "uuid", "code": "LOSE_WEIGHT", "name": "Giảm cân", "description": "...", "displayOrder": 2 },
      { "id": "uuid", "code": "BUILD_MUSCLE", "name": "Tăng cơ", "description": "...", "displayOrder": 3 },
      { "id": "uuid", "code": "EAT_HEALTHY", "name": "Ăn lành mạnh", "description": "...", "displayOrder": 4 },
      { "id": "uuid", "code": "SAVE_MONEY", "name": "Tiết kiệm", "description": "...", "displayOrder": 5 },
      { "id": "uuid", "code": "EXPLORE", "name": "Khám phá món mới", "description": "...", "displayOrder": 6 }
    ],
    "dietaryPreferences": {
      "taste": [
        { "id": "uuid", "code": "SPICY", "type": "TASTE", "name": "Cay", "displayOrder": 1 },
        { "id": "uuid", "code": "MILD", "type": "TASTE", "name": "Thanh đạm", "displayOrder": 2 }
      ],
      "diet": [
        { "id": "uuid", "code": "VEGETARIAN", "type": "DIET", "name": "Ăn chay", "displayOrder": 10 },
        { "id": "uuid", "code": "VEGAN", "type": "DIET", "name": "Thuần chay (Vegan)", "displayOrder": 11 }
      ]
    },
    "allergens": [
      { "id": "uuid", "code": "SEAFOOD", "name": "Hải sản", "displayOrder": 1 },
      { "id": "uuid", "code": "PEANUT", "name": "Đậu phộng", "displayOrder": 2 }
    ]
  },
  "statusCode": 200
}
```

---

## 2. Onboarding Session

### GET /v1/onboarding

Lấy trạng thái hiện tại của onboarding.

**Response 200:**
```json
{
  "data": {
    "onboardingStatus": "NOT_STARTED",
    "currentStep": 1,
    "totalSteps": 8,
    "profileVersion": 1,
    "onboardingVersion": "1.0",
    "draft": {},
    "completedAt": null
  },
  "statusCode": 200
}
```

`onboardingStatus`: `NOT_STARTED` | `IN_PROGRESS` | `COMPLETED` | `SKIPPED`

---

### POST /v1/onboarding/start

Khởi tạo session. **Idempotent** — gọi nhiều lần chỉ tạo 1 session.

**Request:** (không có body)

**Response 200:**
```json
{
  "data": {
    "alreadyCompleted": false,
    "onboardingStatus": "IN_PROGRESS",
    "currentStep": 1,
    "nextStep": 2
  },
  "statusCode": 200
}
```

---

### PATCH /v1/onboarding/steps/:step

Lưu dữ liệu cho từng bước.

**Header:** `x-profile-version: 1`

#### Bước 2 — Tên gọi

```http
PATCH /v1/onboarding/steps/2
```

```json
{
  "displayName": "Quang"
}
```

| Trường | Type | Bắt buộc | Ghi chú |
|--------|------|----------|---------|
| `displayName` | string \| null | Không | 1–50 ký tự. null = dùng "bạn" |

#### Bước 3 — Ngày sinh

```http
PATCH /v1/onboarding/steps/3
```

```json
{
  "dateOfBirth": "1995-06-15"
}
```

| Trường | Type | Bắt buộc | Validation |
|--------|------|----------|------------|
| `dateOfBirth` | string (ISO date YYYY-MM-DD) | **Có** | Không tương lai |

#### Bước 4 — Giới tính

```http
PATCH /v1/onboarding/steps/4
```

```json
{
  "gender": "MALE"
}
```

`gender`: `MALE` | `FEMALE` | `OTHER` | `PREFER_NOT_TO_SAY` | null

#### Bước 5 — Chiều cao & cân nặng

```http
PATCH /v1/onboarding/steps/5
```

```json
{
  "heightCm": 170,
  "weightKg": 65.5
}
```

| Trường | Type | Bắt buộc | Range |
|--------|------|----------|-------|
| `heightCm` | number \| null | Không | 80–250 |
| `weightKg` | number \| null | Không | 20–350, 1 decimal |

#### Bước 6 — Mục tiêu

```http
PATCH /v1/onboarding/steps/6
```

```json
{
  "primaryGoalId": "uuid-của-goal",
  "secondaryGoalIds": ["uuid-goal-2"]
}
```

| Trường | Type | Bắt buộc | Ghi chú |
|--------|------|----------|---------|
| `primaryGoalId` | UUID | **Có** | Lấy từ catalog |
| `secondaryGoalIds` | UUID[] | Không | Tối đa 2, không trùng primary |

#### Bước 7 — Sở thích & hạn chế

```http
PATCH /v1/onboarding/steps/7
```

```json
{
  "dietaryPreferenceIds": ["uuid-spicy", "uuid-vegan"],
  "noAllergies": false,
  "allergenIds": ["uuid-seafood"],
  "avoidIngredients": ["hành lá", "tiêu"]
}
```

| Trường | Type | Ghi chú |
|--------|------|---------|
| `dietaryPreferenceIds` | UUID[] | Lấy từ catalog |
| `noAllergies` | boolean | true = không có dị ứng. Loại trừ `allergenIds` |
| `allergenIds` | UUID[] | Chỉ dùng khi `noAllergies = false` |
| `avoidIngredients` | string[] | Tối đa 30, mỗi mục max 80 ký tự |

**Response 200 (tất cả các bước):**
```json
{
  "data": {
    "savedStep": 6,
    "stepName": "goal",
    "currentStep": 6,
    "nextStep": 7,
    "profileVersion": 1
  },
  "statusCode": 200
}
```

---

### POST /v1/onboarding/steps/:step/skip

Skip bước được phép (2, 4, 5, 7).

```http
POST /v1/onboarding/steps/4/skip
```

**Response 200:**
```json
{
  "data": {
    "skippedStep": 4,
    "stepName": "gender",
    "nextStep": 5
  },
  "statusCode": 200
}
```

---

### GET /v1/onboarding/summary

Lấy tóm tắt toàn bộ để hiển thị ở **Bước 8** (màn hình review trước khi hoàn tất).

**Response 200:**
```json
{
  "data": {
    "profile": {
      "displayName": "Quang",
      "dateOfBirth": "1995-06-15T00:00:00.000Z",
      "gender": "MALE",
      "heightCm": 170,
      "weightKg": 65.5,
      "noAllergies": false
    },
    "goals": {
      "primary": { "id": "uuid", "code": "BALANCE", "name": "Cân bằng" },
      "secondary": [{ "id": "uuid", "code": "EXPLORE", "name": "Khám phá món mới" }]
    },
    "dietaryPreferences": [
      { "id": "uuid", "code": "SPICY", "name": "Cay", "type": "TASTE" }
    ],
    "allergens": [
      { "id": "uuid", "code": "SEAFOOD", "name": "Hải sản" }
    ],
    "avoidIngredients": ["hành lá"],
    "onboardingStatus": "IN_PROGRESS",
    "profileVersion": 1
  },
  "statusCode": 200
}
```

---

### POST /v1/onboarding/complete

Hoàn tất onboarding. **Idempotent** — gọi nhiều lần chỉ hoàn tất 1 lần.

**Header:** `x-profile-version: 1`

**Request:** (không có body)

**Response 200:**
```json
{
  "data": {
    "alreadyCompleted": false,
    "onboardingStatus": "COMPLETED",
    "profileVersion": 2,
    "completedAt": "2026-08-11T03:07:44.038Z",
    "nextStep": "HOME"
  },
  "statusCode": 200
}
```

> **Frontend xử lý `nextStep = "HOME"`:** Navigate đến màn hình Home hoặc màn Random đầu tiên.

---

## 3. Profile Edit (sau onboarding)

Dùng để chỉnh sửa thông tin trong trang **Cá nhân** sau khi đã hoàn tất onboarding.

**Tất cả đều yêu cầu header:** `x-profile-version: <current_version>`

### GET /v1/profile/me

Lấy thông tin profile đầy đủ.

**Response 200:**
```json
{
  "data": {
    "userId": "uuid",
    "displayName": "Quang",
    "avatarUrl": null,
    "gender": "MALE",
    "dateOfBirth": "1995-06-15T00:00:00.000Z",
    "heightCm": 170,
    "weightKg": 65.5,
    "noAllergies": false,
    "onboardingStatus": "COMPLETED",
    "profileVersion": 2,
    "goals": {
      "primary": { "id": "uuid", "code": "BALANCE", "name": "Cân bằng" },
      "secondary": []
    },
    "dietaryPreferences": [],
    "allergens": [],
    "avoidIngredients": []
  },
  "statusCode": 200
}
```

---

### PATCH /v1/profile/basic

Cập nhật tên, ngày sinh, giới tính.

```json
{
  "displayName": "Quang Hy",
  "dateOfBirth": "1995-06-15",
  "gender": "MALE"
}
```

Tất cả fields đều optional — chỉ gửi fields cần thay đổi.

**Response 200:**
```json
{
  "data": {
    "displayName": "Quang Hy",
    "gender": "MALE",
    "dateOfBirth": "1995-06-15T00:00:00.000Z",
    "profileVersion": 3,
    "updatedAt": "2026-08-11T03:10:00.000Z",
    "message": "Thông tin cơ bản đã được cập nhật."
  },
  "statusCode": 200
}
```

---

### PATCH /v1/profile/health

Cập nhật chiều cao, cân nặng.

```json
{
  "heightCm": 172,
  "weightKg": 63.0
}
```

**Response 200:**
```json
{
  "data": {
    "heightCm": 172,
    "weightKg": 63,
    "profileVersion": 4,
    "updatedAt": "2026-08-11T03:10:00.000Z",
    "message": "Thông số sức khỏe đã được cập nhật."
  },
  "statusCode": 200
}
```

---

### PATCH /v1/profile/preferences

Cập nhật mục tiêu, sở thích, dị ứng. **Thay đổi dị ứng có hiệu lực ngay từ lần random tiếp theo.**

```json
{
  "primaryGoalId": "uuid-goal",
  "secondaryGoalIds": [],
  "dietaryPreferenceIds": ["uuid-pref"],
  "noAllergies": false,
  "allergenIds": ["uuid-allergen"],
  "avoidIngredients": ["tiêu"]
}
```

**Response 200:**
```json
{
  "data": {
    "profileVersion": 5,
    "updatedAt": "2026-08-11T03:10:00.000Z",
    "message": "Sở thích và mục tiêu đã được cập nhật.",
    "allergenWarning": "Thay đổi dị ứng có hiệu lực ngay từ lần gợi ý tiếp theo. Mogu không cam kết món ăn hoàn toàn không chứa chất gây dị ứng — vui lòng kiểm tra nhãn sản phẩm."
  },
  "statusCode": 200
}
```

> **Lưu ý:** `allergenWarning` chỉ có mặt trong response khi có thay đổi allergen. Frontend nên hiển thị thông báo này cho người dùng.

---

## 4. Error Codes

| Code | HTTP | Mô tả | Xử lý Frontend |
|------|------|-------|----------------|
| `ONB_001` | 400 | Bước onboarding không hợp lệ | Tải lại state từ GET /onboarding |
| `ONB_002` | 400 | Validation error (xem `field`) | Focus field lỗi, giữ data |
| `ONB_003` | 409 | Version conflict — data đã thay đổi ở nơi khác | Gọi GET /onboarding để lấy state mới |
| `ONB_004` | 400 | Catalog item không còn khả dụng | Xóa lựa chọn đó, thông báo user |
| `ONB_005` | — | Network error (client-side) | Retry, giữ draft local |
| `ONB_006` | 500 | Save failed | Retry |
| `ONB_007` | 500 | Complete failed | Retry, data vẫn được giữ |
| `ONB_999` | 500 | Unknown error | Retry với correlation_id |

**Format lỗi:**
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.",
  "code": "ONB_002",
  "field": "dateOfBirth"
}
```

---

## 5. Version Conflict (ONB_003)

Frontend **phải** gửi `x-profile-version` header với mọi PATCH/POST có ghi dữ liệu.

```
Frontend lưu profileVersion từ response trước.
Gửi x-profile-version: <saved_version> trong mọi PATCH.
Nếu nhận ONB_003:
  1. Gọi GET /onboarding để lấy state + profileVersion mới
  2. Merge data local với state server (ưu tiên server)
  3. Cập nhật x-profile-version
  4. Retry request
```

---

## 6. Resume sau gián đoạn

```
App khởi động → GET /auth/me
nextStep = "ONBOARDING" → GET /onboarding
currentStep = 4 → Mở bước 4 với draft data từ response
```

---

## 7. Enums tham khảo

**Gender:**
- `MALE` — Nam
- `FEMALE` — Nữ
- `OTHER` — Khác
- `PREFER_NOT_TO_SAY` — Không muốn trả lời

**GoalCode:**
- `BALANCE` — Cân bằng
- `LOSE_WEIGHT` — Giảm cân
- `BUILD_MUSCLE` — Tăng cơ
- `EAT_HEALTHY` — Ăn lành mạnh
- `SAVE_MONEY` — Tiết kiệm
- `EXPLORE` — Khám phá món mới

**AllergenCode:**
- `SEAFOOD`, `PEANUT`, `MILK`, `EGG`, `GLUTEN`, `SOY`, `TREENUT`, `FISH`, `SHELLFISH`, `SESAME`

---

## 8. Swagger UI

Môi trường dev: `http://localhost:3001/api/docs`
