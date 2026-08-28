# API Docs — Onboarding & Random Món Ăn

> Base URL: `http://<host>:3001/v1`  
> Tất cả endpoint (trừ đăng ký/đăng nhập) yêu cầu header:  
> `Authorization: Bearer <accessToken>`

---

## MỤC LỤC

1. [Onboarding](#1-onboarding)
   - [GET /onboarding](#11-get-onboarding--lấy-state-hiện-tại)
   - [POST /onboarding/start](#12-post-onboardingstart--bắt-đầu-onboarding)
   - [PATCH /onboarding/steps/:step](#13-patch-onboardingstepsstep--lưu-dữ-liệu-từng-bước)
   - [POST /onboarding/steps/:step/skip](#14-post-onboardingstepsstepskip--bỏ-qua-bước)
   - [GET /onboarding/summary](#15-get-onboardingsummary--tóm-tắt-review)
   - [POST /onboarding/complete](#16-post-onboardingcomplete--hoàn-tất-onboarding)
2. [Catalog (dữ liệu lookup)](#2-catalog--dữ-liệu-lookup)
3. [Random Món Ăn](#3-random-món-ăn)
   - [POST /dish-randomizations](#31-post-dish-randomizations--random-món-ăn)
   - [POST /dish-randomizations/:id/select](#32-post-dish-randomizationsidselect--chọn-món)
   - [GET /me/random-history](#33-get-merandom-history--lịch-sử-random)

---

## 1. Onboarding

### Luồng 8 bước

| Bước | Name | Nội dung | Bắt buộc | Có thể Skip |
|------|------|----------|----------|-------------|
| 1 | `welcome` | Màn chào — không gửi data | ✅ | ❌ |
| 2 | `name` | Tên hiển thị | ❌ | ✅ |
| 3 | `birthday` | Ngày sinh | ✅ | ❌ |
| 4 | `gender` | Giới tính | ❌ | ✅ |
| 5 | `body` | Chiều cao / cân nặng | ❌ | ✅ |
| 6 | `goal` | Mục tiêu chính (bắt buộc chọn 1) | ✅ | ❌ |
| 7 | `preferences` | Chế độ ăn + dị ứng | ❌ | ✅ |
| 8 | `summary` | Xem lại — không gửi data | ✅ | ❌ |

---

### 1.1 `GET /onboarding` — Lấy state hiện tại

Trả về trạng thái onboarding và dữ liệu draft đã lưu.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "status": "IN_PROGRESS",        // NOT_STARTED | IN_PROGRESS | COMPLETED
    "currentStep": 3,
    "totalSteps": 8,
    "completedSteps": [1, 2],
    "skippedSteps": [],
    "draft": {
      "displayName": "Quang",
      "dateOfBirth": null,
      "gender": null,
      "heightCm": null,
      "weightKg": null,
      "primaryGoalId": null,
      "secondaryGoalIds": [],
      "dietaryPreferenceIds": [],
      "allergenIds": [],
      "noAllergies": false,
      "avoidIngredients": []
    }
  }
}
```

---

### 1.2 `POST /onboarding/start` — Bắt đầu onboarding

Tạo session onboarding. **Idempotent** — gọi nhiều lần chỉ tạo 1 session.

**Request:** _(không cần body)_

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "status": "IN_PROGRESS",
    "currentStep": 1
  }
}
```

**Lỗi:**
| Code | HTTP | Mô tả |
|------|------|-------|
| `ONB_002` | 403 | Tài khoản chưa được kích hoạt |
| `ONB_002` | 404 | Không tìm thấy profile |

---

### 1.3 `PATCH /onboarding/steps/:step` — Lưu dữ liệu từng bước

**Header tùy chọn:**
```
x-profile-version: 1     // Version hiện tại, dùng để detect conflict
```

#### Bước 2 — Tên (`step=2`)
```json
{
  "displayName": "Quang"    // string, 1–50 ký tự | null để bỏ qua
}
```

#### Bước 3 — Ngày sinh (`step=3`)
```json
{
  "dateOfBirth": "1995-06-15"   // ISO date YYYY-MM-DD, không được là tương lai
}
```

#### Bước 4 — Giới tính (`step=4`)
```json
{
  "gender": "MALE"    // MALE | FEMALE | OTHER
}
```

#### Bước 5 — Thể trạng (`step=5`)
```json
{
  "heightCm": 170,    // số, 80–250 | null
  "weightKg": 65.5    // số, 20–350, tối đa 1 chữ số thập phân | null
}
```

#### Bước 6 — Mục tiêu (`step=6`)
```json
{
  "primaryGoalId": "uuid-goal",          // BẮT BUỘC — lấy từ /v1/catalogs/onboarding
  "secondaryGoalIds": ["uuid-goal-2"]    // Tùy chọn, tối đa 2 ID
}
```

#### Bước 7 — Sở thích & Dị ứng (`step=7`)
```json
{
  "dietaryPreferenceIds": ["uuid-pref"],  // Tùy chọn — ID chế độ ăn
  "noAllergies": false,                   // true = xác nhận không có dị ứng
  "allergenIds": ["uuid-allergen"],       // Tùy chọn — KHÔNG dùng cùng noAllergies=true
  "avoidIngredients": ["hành lá"]        // Tùy chọn — tối đa 30 item, mỗi item 1–80 ký tự
}
```

> ⚠️ `noAllergies=true` và `allergenIds` loại trừ nhau. Nếu gửi cả hai sẽ bị lỗi validation.

**Response `200` (tất cả các bước):**
```json
{
  "success": true,
  "data": {
    "step": 3,
    "stepName": "birthday",
    "saved": true,
    "nextStep": 4,
    "profileVersion": 2
  }
}
```

**Lỗi:**
| Code | HTTP | Mô tả |
|------|------|-------|
| `ONB_001` | 400 | Bước không hợp lệ |
| `ONB_003` | 400 | Bước không nhận data |
| `ONB_004` | 400 | Bước không thể bỏ qua |
| `ONB_005` | 409 | Onboarding đã hoàn tất |
| `ONB_006` | 409 | Profile version conflict |

---

### 1.4 `POST /onboarding/steps/:step/skip` — Bỏ qua bước

Chỉ áp dụng cho các bước có `skippable=true` (bước 2, 4, 5, 7).

**Request:** _(không cần body)_

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "step": 4,
    "skipped": true,
    "nextStep": 5
  }
}
```

**Lỗi:**
| Code | HTTP | Mô tả |
|------|------|-------|
| `ONB_004` | 400 | Bước này không thể skip |

---

### 1.5 `GET /onboarding/summary` — Tóm tắt review

Dùng ở **Bước 8** — hiển thị toàn bộ thông tin user đã nhập để review.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "displayName": "Quang",
    "dateOfBirth": "1995-06-15",
    "age": 31,
    "gender": "MALE",
    "heightCm": 170,
    "weightKg": 65.5,
    "bmi": 22.7,
    "primaryGoal": {
      "id": "uuid",
      "name": "Ăn uống cân bằng",
      "code": "BALANCED"
    },
    "secondaryGoals": [],
    "dietaryPreferences": [],
    "allergens": [
      { "id": "uuid", "name": "Đậu phộng", "code": "PEANUT" }
    ],
    "noAllergies": false,
    "avoidIngredients": ["hành lá"]
  }
}
```

---

### 1.6 `POST /onboarding/complete` — Hoàn tất onboarding

Validate dữ liệu bắt buộc, set status `COMPLETED`, tăng `profileVersion`. **Idempotent**.

**Header tùy chọn:**
```
x-profile-version: 2
```

**Request:** _(không cần body)_

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "completed": true,
    "profileVersion": 3,
    "redirectTo": "/home"
  }
}
```

**Lỗi:**
| Code | HTTP | Mô tả |
|------|------|-------|
| `ONB_007` | 400 | Thiếu dữ liệu bắt buộc (dateOfBirth hoặc primaryGoalId) |
| `ONB_006` | 409 | Profile version conflict |

---

## 2. Catalog — Dữ liệu lookup

Dùng để lấy danh sách ID cho các bước onboarding và random.

### `GET /catalogs/onboarding`

Trả về toàn bộ dữ liệu lookup cần thiết cho onboarding trong **1 lần gọi**.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "goals": [
      { "id": "uuid", "code": "BALANCED", "name": "Ăn uống cân bằng", "description": "..." }
    ],
    "dietaryPreferences": [
      { "id": "uuid", "code": "VEGETARIAN", "name": "Chay" }
    ],
    "allergens": [
      { "id": "uuid", "code": "PEANUT", "name": "Đậu phộng", "active": true }
    ]
  }
}
```

### `GET /taxonomy/goals`
### `GET /taxonomy/allergens`
### `GET /taxonomy/diet-types`

Từng endpoint riêng lẻ nếu cần (không cần auth).

---

## 3. Random Món Ăn

### Thuật toán

```
Hard filters (loại trừ cứng):
  ✦ Allergen của user (level=CONTAINS)
  ✦ Diet type hard của user
  ✦ Meal type (nếu chỉ định)
  ✦ Budget (nếu chỉ định)

Soft scoring (0–1):
  ✦ goalMatch      — khớp mục tiêu
  ✦ timeSuitability — phù hợp giờ trong ngày
  ✦ popularity     — ratingAvg cao
  ✦ dataQuality    — có đủ thông tin
  ✦ novelty        — chưa thấy gần đây (7 ngày)

→ Weighted random từ top candidates
```

---

### 3.1 `POST /dish-randomizations` — Random món ăn

**Request Body** _(tất cả optional)_:
```json
{
  "mealTypeCode": "LUNCH",          // BREAKFAST | LUNCH | DINNER | SNACK | ANY
  "goalCodes": ["BALANCED"],        // Mục tiêu — tăng điểm cho món phù hợp
  "dietTypeCodes": ["VEGETARIAN"],  // Chế độ ăn bổ sung
  "excludeDishIds": ["uuid1"],      // Món cần tránh (đã thấy trong phiên)
  "maxBudget": 80000,               // Ngân sách tối đa (VND)
  "weatherCode": "RAIN"            // HOT | COLD | RAIN — ảnh hưởng điểm
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "randomizationId": "uuid",       // Dùng để gọi /select sau khi chọn
    "dish": {
      "id": "uuid",
      "name": "Bún bò Huế",
      "slug": "bun-bo-hue",
      "description": "Món bún đặc trưng miền Trung...",
      "imageUrl": "https://...supabase.co/.../cover.webp",
      "region": { "id": "uuid", "name": "Miền Trung" },
      "priceMin": 40000,
      "priceMax": 60000,
      "prepMinutes": 20,
      "cookMinutes": 40,
      "difficulty": "MEDIUM",
      "mealTypes": ["LUNCH", "DINNER"],
      "nutrition": {
        "calories": 450,
        "proteinG": 25,
        "carbsG": 60,
        "fatG": 12
      },
      "score": {
        "goalMatch": 0.8,
        "timeSuitability": 0.9,
        "popularity": 0.75,
        "dataQuality": 1.0,
        "novelty": 0.6,
        "total": 0.81
      }
    },
    "algorithmVersion": "1.0",
    "appliedFilters": {
      "allergenCodes": ["PEANUT"],
      "hardDietTypeCodes": [],
      "mealTypeCode": "LUNCH",
      "maxBudget": 80000
    }
  }
}
```

**Fallback tự động (không cần client xử lý):**
1. Thử full filter (meal type + diet + budget)
2. Bỏ budget filter
3. Bỏ diet type filter
4. Bỏ meal type filter → lấy bất kỳ món published

**Lỗi:**
| Code | HTTP | Mô tả |
|------|------|-------|
| `RAND_001` | 404 | Không tìm thấy món phù hợp (rất hiếm, chỉ khi DB trống) |

---

### 3.2 `POST /dish-randomizations/:id/select` — Chọn món

Đánh dấu user đã **chọn** món từ kết quả random. Gọi sau khi user confirm.

**Params:**
- `id` — `randomizationId` từ response của POST /dish-randomizations

**Request:** _(không cần body)_

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "randomizationId": "uuid",
    "dishId": "uuid",
    "dishName": "Bún bò Huế",
    "selectedAt": "2026-08-25T09:30:00Z"
  }
}
```

**Lỗi:**
| Code | HTTP | Mô tả |
|------|------|-------|
| 404 | 404 | Randomization không tồn tại hoặc không thuộc user |

---

### 3.3 `GET /me/random-history` — Lịch sử random

Lấy danh sách các lần random gần đây của user.

**Query params:**
| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `limit` | number | `20` | Số bản ghi, tối đa 50 |
| `cursor` | string | - | Cursor pagination (từ response trước) |

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "dishId": "uuid",
        "dishName": "Bún bò Huế",
        "imageUrl": "https://...webp",
        "selectedAt": "2026-08-25T09:30:00Z",
        "createdAt": "2026-08-25T09:28:00Z"
      }
    ],
    "nextCursor": "uuid-last-item",   // null nếu hết
    "hasMore": false
  }
}
```

---

## Luồng Mobile hoàn chỉnh

### Onboarding Flow
```
App start
  ↓
POST /onboarding/start          ← Khởi tạo session
  ↓
GET  /catalogs/onboarding       ← Load goals, allergens, preferences
  ↓
[Bước 1] Màn chào — không gọi API
  ↓
[Bước 2] PATCH /onboarding/steps/2  { displayName }
         hoặc POST /onboarding/steps/2/skip
  ↓
[Bước 3] PATCH /onboarding/steps/3  { dateOfBirth }     ← BẮT BUỘC
  ↓
[Bước 4] PATCH /onboarding/steps/4  { gender }
         hoặc POST /onboarding/steps/4/skip
  ↓
[Bước 5] PATCH /onboarding/steps/5  { heightCm, weightKg }
         hoặc POST /onboarding/steps/5/skip
  ↓
[Bước 6] PATCH /onboarding/steps/6  { primaryGoalId }   ← BẮT BUỘC
  ↓
[Bước 7] PATCH /onboarding/steps/7  { allergenIds, ... }
         hoặc POST /onboarding/steps/7/skip
  ↓
[Bước 8] GET  /onboarding/summary   ← Hiển thị review
         POST /onboarding/complete   ← Xác nhận → vào Home
```

### Random Flow
```
User mở Random
  ↓
POST /dish-randomizations {
  mealTypeCode,        ← từ lựa chọn user
  goalCodes,           ← lấy từ profile user
  excludeDishIds,      ← các món đã thấy trong phiên
  maxBudget,           ← ngân sách user chọn
  weatherCode          ← từ GPS weather API
}
  ↓
Hiển thị kết quả (dishName, image, score...)
  ↓
User chọn "Chọn món này"
  ↓
POST /dish-randomizations/:randomizationId/select
  ↓
Navigate sang dish detail
```

---

## Response Format chung

Tất cả response đều wrap trong:
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-08-25T09:30:00Z"
}
```

**Error format:**
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Mô tả lỗi",
  "errors": [
    { "field": "dateOfBirth", "constraints": { "isDateString": "..." } }
  ]
}
```
