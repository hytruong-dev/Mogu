# Hợp đồng API mobile

## 1. Chuẩn chung

### 1.1 Base URL và version

- Production: `https://api.<domain>/v1`.
- JSON UTF-8; field dùng `camelCase`; ID dùng UUID không tuần tự.
- Access token qua `Authorization: Bearer <token>`.
- Mọi response có `X-Request-Id`; client cũng có thể gửi `X-Request-Id` UUID.
- POST tạo resource hoặc khởi chạy job phải nhận `Idempotency-Key` UUID.
- Không đưa access token, API key provider hoặc signed storage key vĩnh viễn vào response.

### 1.2 Header ngữ cảnh

- `X-Timezone: Asia/Ho_Chi_Minh` — timezone IANA của người dùng.
- `X-Local-Date: 2026-09-11` — chỉ dùng như tiện ích; endpoint theo ngày vẫn phải có date rõ trên path/query.
- `X-Platform: ios|android|web`.
- `X-App-Version: 1.4.0`.
- `If-Match: "7"` cho resource có optimistic version. Không dùng custom header riêng cho từng domain ở contract mới.

### 1.3 Success envelope

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "94cfbd5c-4aa8-48ba-bf71-c05bb4c096ac"
  },
  "timestamp": "2026-09-11T04:10:00.000Z"
}
```

List dùng một cấu trúc duy nhất:

```json
{
  "success": true,
  "data": {
    "items": [],
    "pageInfo": {
      "nextCursor": null,
      "hasNextPage": false
    }
  },
  "timestamp": "2026-09-11T04:10:00.000Z"
}
```

### 1.4 Error envelope

```json
{
  "success": false,
  "error": {
    "code": "WEEKLY_PLAN_VERSION_CONFLICT",
    "message": "Kế hoạch đã được cập nhật trên thiết bị khác.",
    "details": {
      "expectedVersion": 7,
      "currentVersion": 8
    },
    "retryable": false
  },
  "requestId": "94cfbd5c-4aa8-48ba-bf71-c05bb4c096ac",
  "timestamp": "2026-09-11T04:10:00.000Z"
}
```

Mobile phải đọc `error.code`; implementation hiện chỉ đọc một phần shape lỗi nên cần sửa đồng thời.

HTTP status chuẩn:

- `200` đọc/sửa/action đồng bộ thành công; `201` tạo resource.
- `202` job đã nhận; response có `jobId`, `status`, `pollAfterMs`.
- `204` delete thành công không body.
- `400` body sai cú pháp/nghiệp vụ cơ bản; `401` token lỗi; `403` không có quyền.
- `404` không tồn tại hoặc không thuộc user; không tiết lộ object của user khác.
- `409` version/idempotency/state conflict; `422` request hợp lệ cú pháp nhưng không thể thỏa ràng buộc.
- `429` rate limit, có `Retry-After`; `503` provider tạm lỗi, có `retryable=true`.

### 1.5 Date, tiền và dinh dưỡng

- Instant: ISO-8601 UTC, ví dụ `2026-09-11T04:10:00.000Z`.
- Ngày địa phương: `YYYY-MM-DD`, luôn đi cùng timezone của người dùng/plan.
- Tiền: integer VND; không dùng float. Range gồm `lowVnd`, `expectedVnd`, `highVnd`.
- Khối lượng: gram; thể tích: ml; macro: gram; sodium: mg; energy: kcal.
- Dữ liệu thiếu là `null` và có `coverage`, không biến thành `0`.
- Nutrition luôn có `basis`, `servingSizeG`, `servings`, `sourceType`, `confidence`, `calculatedAt`.

### 1.6 Cursor

Cursor là opaque base64url chứa sort key và ID, ví dụ `(createdAt,id)`. Client không tự giải mã. Query thời gian giảm dần:

```sql
WHERE (created_at, id) < (:cursorCreatedAt, :cursorId)
ORDER BY created_at DESC, id DESC
LIMIT :limit + 1
```

## 2. Auth và session

### `POST /v1/auth/register` — Giữ và chuẩn hóa

Request:

```json
{
  "email": "user@example.com",
  "username": "mogu_user",
  "password": "<secret>",
  "consents": [
    { "type": "TERMS", "version": "2026-09-01", "accepted": true },
    { "type": "PRIVACY", "version": "2026-09-01", "accepted": true }
  ],
  "installationId": "0a90743f-1f80-42f4-9e56-342477389414"
}
```

Response `201`: `{ session, user, nextStep: "verify_email"|"onboarding" }`. Rate limit theo IP + normalized account identifier. Không log password.

### `POST /v1/auth/login` — Giữ

Request `{ "identifier": "mogu_user", "password": "<secret>", "installationId": "..." }`. Response `{ session, user, nextStep }`. `session.expiresAt` dùng milliseconds hoặc ISO nhưng chỉ chọn một; đề xuất ISO `accessTokenExpiresAt`.

### `POST /v1/auth/refresh` — Giữ, bắt buộc rotation

Request `{ "refreshToken": "...", "installationId": "..." }`. Mỗi refresh token chỉ dùng một lần. Phát hiện reuse thì revoke cả token family và yêu cầu đăng nhập lại.

### `POST /v1/auth/logout` — Giữ

Request `{ "refreshToken": "...", "allDevices": false }`. Idempotent: token đã revoke vẫn trả `200`.

### Password và verify — Mới

- `POST /v1/auth/password-reset-requests`: body `{ identifier }`; luôn trả thông báo chung.
- `POST /v1/auth/password-reset-confirmations`: body `{ tokenOrOtp, newPassword }`; revoke sessions cũ.
- `POST /v1/auth/email-verifications`: body `{ tokenOrOtp }`.
- `POST /v1/auth/email-verifications/resend`: rate-limit chặt.
- `POST /v1/auth/password-change`: yêu cầu currentPassword hoặc recent re-auth.

### Social login — Mới nếu giữ UI

`POST /v1/auth/oauth/exchange` nhận `{ provider, authorizationCode, codeVerifier, redirectUri, nonce, installationId }`. BE đổi code trực tiếp với provider, kiểm issuer/audience/nonce và liên kết account có kiểm soát. Không nhận “profile Google/Apple” do client tự khai.

### Session/device — Mới

- `GET /v1/me/sessions`: trả session ID, device label, platform, lastSeenAt, current; không trả token/IP thô.
- `DELETE /v1/me/sessions/:sessionId`: chỉ user hiện tại, re-auth với thao tác nhạy cảm.
- `DELETE /v1/me/sessions`: revoke all except current theo query `exceptCurrent=true`.

## 3. Onboarding và catalog

Giữ các endpoint hiện có, chuẩn hóa version bằng `If-Match`.

- `GET /v1/catalogs/onboarding`: catalog version, goals, taste preferences, diet types, allergens.
- `GET /v1/onboarding`: trạng thái, current step, draft, profile version.
- `POST /v1/onboarding/start`: idempotent; nếu đang có session thì trả session đó.
- `PATCH /v1/onboarding/steps/:step`: body theo step; transaction update draft + version.
- `POST /v1/onboarding/steps/:step/skip`: chỉ step optional.
- `GET /v1/onboarding/summary`: dữ liệu resolved trước complete.
- `POST /v1/onboarding/complete`: validate tổng thể, ghi profile + relation trong transaction.

Body preferences đích:

```json
{
  "goalCodes": [{ "code": "BALANCED", "priority": "PRIMARY" }],
  "tastePreferences": [{ "code": "SPICY", "strength": 2 }],
  "dietTypes": [{ "code": "VEGAN", "isHard": true }],
  "allergens": [{ "code": "PEANUT", "severity": "SEVERE" }],
  "avoidedIngredients": [
    { "ingredientId": "uuid", "reasonCode": "DISLIKE" },
    { "freeText": "ngò rí", "reasonCode": "DISLIKE" }
  ]
}
```

## 4. Home, notification và weather

### `GET /v1/home?localDate=2026-09-11&timezone=Asia/Ho_Chi_Minh`

Giữ BFF hiện có, response đích:

```json
{
  "generatedAt": "2026-09-11T04:10:00Z",
  "localDate": "2026-09-11",
  "profileVersion": 8,
  "widgets": {
    "greeting": { "status": "ok", "data": { "phrase": "Chào buổi sáng", "name": "An" } },
    "weather": { "status": "unavailable", "data": null },
    "weeklyPlan": { "status": "ok", "data": { "planId": "uuid", "spentVnd": 120000, "forecastVnd": 480000, "budgetVnd": 500000, "completedSlots": 4, "totalSlots": 21 } },
    "nutrition": { "status": "no_data", "data": null },
    "recommendations": { "status": "ok", "data": [] },
    "notifications": { "status": "ok", "data": { "unreadCount": 2 } }
  }
}
```

Cache key phải gồm user, localDate, timezone, profileVersion và currentPlanVersion. Mutation liên quan phải invalidate/tag cache.

### Notifications

- `GET /v1/notifications?cursor=&limit=20&status=UNREAD` — giữ, đổi sang cursor.
- `PATCH /v1/notifications/:id/read` — giữ, idempotent.
- `POST /v1/notifications/read-all` — mới, body `{ before?: instant }`.
- `PUT /v1/installations/:installationId/push-token` — upsert `{ expoPushToken, platform }`.
- `DELETE /v1/installations/:installationId/push-token` — logout/unregister.

Notification response có `deepLink: { route, params }`; route thuộc allowlist, không dùng URL tùy ý.

### Weather

`GET /v1/weather?lat=&lon=` — giữ. BE làm provider adapter, cache theo ô địa lý và thời gian, trả `observedAt`, `expiresAt`, `provider`; không lưu lịch sử vị trí chính xác nếu không cần.

## 5. Profile, settings và privacy

### Profile

- `GET /v1/profile/me` — giữ; trả `version` và các nhóm basic/health/preferences.
- `PATCH /v1/profile/basic` — giữ; thêm username, bio, regionId nếu UI giữ các field này.
- `PATCH /v1/profile/health` — giữ; measurement mới nên append lịch sử thay vì chỉ overwrite.
- `PATCH /v1/profile/preferences` — giữ; dùng shape onboarding ở trên.

Mọi PATCH yêu cầu `If-Match`; thiếu header trả `428 PRECONDITION_REQUIRED`, sai version trả `409 PROFILE_VERSION_CONFLICT` cùng representation mới nhất.

### Avatar upload — Mới

1. `POST /v1/me/avatar-upload` body `{ mimeType, sizeBytes, checksum }` → signed PUT URL và `mediaId`.
2. Client upload trực tiếp object storage.
3. `POST /v1/me/avatar-upload/:mediaId/complete` → verify checksum/type/size, enqueue moderation/resize.
4. `GET /v1/me/avatar` trả status; chỉ media APPROVED làm avatar công khai.

### Settings — Mới

- `GET /v1/me/settings`.
- `PATCH /v1/me/settings` với `If-Match`.

```json
{
  "language": "vi",
  "theme": "SYSTEM",
  "notifications": {
    "weeklyPlan": true,
    "mealReminder": true,
    "community": false,
    "marketing": false
  },
  "privacy": {
    "profileVisibility": "PRIVATE",
    "showDietActivity": false,
    "allowComments": true
  }
}
```

Âm thanh/rung/biometric/OS permissions không gửi vào đây trừ khi sản phẩm cần đồng bộ đa thiết bị.

### Journey và achievements — Mới

`GET /v1/me/journey?month=2026-09` trả current/longest streak, day statuses, badges, monthly totals và `dataCoverage`. Không nhận counter từ client.

### Data export/delete/clear — Mới

- `POST /v1/me/data-exports` → `202 { jobId }` sau recent re-auth.
- `GET /v1/me/data-exports/:jobId` → status và signed download URL ngắn hạn khi READY.
- `POST /v1/me/account-deletion` → tạo yêu cầu có grace period và revoke session theo policy.
- `POST /v1/me/account-deletion/cancel` trong grace period sau re-auth.
- `DELETE /v1/me/random-history` và `DELETE /v1/me/health-data`: yêu cầu confirmation token/re-auth, async khi lượng dữ liệu lớn, có audit.

## 6. Dish, search, saved và review

### `GET /v1/dishes`

Giữ endpoint; query: `q`, `regionCode`, `categoryCodes`, `mealTypeCodes`, `dietTypeCodes`, `goalCodes`, `maxBudgetVnd`, `sort`, `cursor`, `limit`. Public/mobile chỉ thấy PUBLISHED.

List item tối thiểu:

```json
{
  "id": "uuid",
  "slug": "bun-bo-hue",
  "name": "Bún bò Huế",
  "thumbnailUrl": "https://...",
  "defaultNutrition": { "caloriesKcal": 520, "proteinG": 28.4, "carbsG": 58.0, "fatG": 18.2, "basis": "PER_SERVING", "servingSizeG": 550, "coverage": 0.93 },
  "price": { "lowVnd": 45000, "expectedVnd": 55000, "highVnd": 70000, "confidence": 0.72, "observedAt": "2026-09-01T00:00:00Z" },
  "allergenAssessment": "VERIFIED|POSSIBLE|UNKNOWN",
  "isSaved": false
}
```

### `GET /v1/dishes/:idOrSlug`

Giữ endpoint, trả:

- Identity/status/version.
- Media APPROVED có credit/source.
- Taxonomy, region/province, meal type, diet/goal tags.
- `defaultNutrition` và `nutritionProfiles` có basis/provenance.
- Ingredients có amount, unit, gramEquivalent, optional flag.
- Allergens có source (`INGREDIENT_MAPPING`, `MANUAL_REVIEW`) và level.
- Recipe steps, servings, prep/cook time.
- Price estimate, review summary và `viewerState.isSaved/reviewed`.
- `dataQuality`: completeness, lastReviewedAt, warnings.

### Saved dish

Chuẩn duy nhất:

- `PUT /v1/me/saved-dishes/:dishId` → `{ dishId, saved: true, savedAt }`.
- `DELETE /v1/me/saved-dishes/:dishId` → `204`.
- `GET /v1/me/saved-dishes?filter=&cursor=&limit=`.

Có thể giữ route POST hiện tại trong một chu kỳ deprecation, nhưng mobile mới chỉ gọi contract trên.

### Reviews

- `GET /v1/dishes/:dishId/reviews?cursor=&limit=&sort=` — giữ.
- `PUT /v1/dishes/:dishId/reviews/me` — upsert `{ rating: 1..5, comment }`.
- `DELETE /v1/dishes/:dishId/reviews/me` — giữ ý nghĩa hiện tại.

Response list có `summary: { average, count, distribution }`. Không trả review bị ẩn.

### Similar và unified lookup — Mới

- `GET /v1/dishes/:dishId/similar?limit=10`.
- `GET /v1/food-lookup?q=&types=DISH,INGREDIENT,CUSTOM&cursor=` cho màn log meal.

## 7. Explore, article và community

### Explore BFF

`GET /v1/explore/feed?cursor=&limit=&timezone=` — giữ; section có stable ID/type/title/items/pageInfo. Không nhúng chi tiết đầy đủ.

### Article

- `GET /v1/articles?topicId=&q=&cursor=&limit=` — giữ.
- `GET /v1/articles/:idOrSlug` — giữ.
- `PUT/DELETE /v1/me/saved-articles/:articleId` — mới nếu giữ bookmark.
- `POST /v1/analytics/events:batch` — impression/open/read completion; server dedupe theo `eventId`.

Endpoint create/update article hiện có là author/admin concern, không để mobile user thường sửa bài nếu sản phẩm chưa có author workflow.

### Community

- `GET /v1/community/posts?scope=FOR_YOU|FOLLOWING|ME&status=&cursor=&limit=`.
- `GET /v1/community/posts/:postId` — mới.
- `POST /v1/community/posts` — giữ; body `{ content, mediaIds, dishIds, visibility }`.
- `PATCH /v1/community/posts/:postId` — mới cho chủ sở hữu/draft.
- `DELETE /v1/community/posts/:postId` — giữ, soft-delete.
- `PUT /v1/community/posts/:postId/likes/me`; `DELETE .../likes/me` — thay toggle.
- `PUT/DELETE /v1/me/saved-posts/:postId` — nếu UI bookmark.
- `GET /v1/community/posts/:postId/comments?parentId=&cursor=&limit=`.
- `POST /v1/community/posts/:postId/comments` body `{ content, parentCommentId?: uuid }`.
- `PATCH/DELETE /v1/community/comments/:commentId` — owner/moderator.
- `PUT/DELETE /v1/community/comments/:commentId/likes/me`.
- `PUT/DELETE /v1/me/following/:profileId`.

Các counter cập nhật trong transaction/event projection, không tin count client gửi. Nội dung/media đi qua moderation; response cho tác giả có moderation status, public feed chỉ có PUBLISHED.

## 8. Randomization

### `GET /v1/randomization-context`

Giữ; response:

```json
{
  "profileVersion": 8,
  "defaults": {
    "mealSlot": "DINNER",
    "budgetMode": "PROFILE",
    "maxBudgetVnd": 70000,
    "goalCodes": ["BALANCED"],
    "dietTypeCodes": []
  },
  "hardConstraints": {
    "allergenCodes": ["PEANUT"],
    "hardDietTypeCodes": [],
    "avoidedIngredientIds": []
  },
  "catalogVersion": "2026-09-01"
}
```

### `POST /v1/dish-randomizations`

Giữ, yêu cầu `Idempotency-Key`.

```json
{
  "mealSlot": "DINNER",
  "goalCodes": ["BALANCED"],
  "dietTypeCodes": [],
  "budget": { "mode": "CUSTOM", "maxVnd": 70000 },
  "maxPrepMinutes": 45,
  "excludeDishIds": ["uuid"],
  "context": {
    "weatherCode": "RAIN",
    "location": null
  }
}
```

Success response:

```json
{
  "randomizationId": "uuid",
  "status": "COMPLETED",
  "dish": {},
  "matchScore": 82,
  "scoreBreakdown": [
    { "code": "MEAL_SLOT", "weight": 20, "score": 1 },
    { "code": "BUDGET", "weight": 25, "score": 0.8 }
  ],
  "reasonCodes": ["MATCHES_DINNER", "WITHIN_EXPECTED_BUDGET"],
  "safety": { "allergenAssessment": "VERIFIED", "warnings": [] },
  "profileSnapshotVersion": 8,
  "algorithmVersion": "random-v2.0.0"
}
```

Không có ứng viên trả `422 RANDOM_NO_CANDIDATE` với `blockingConstraints` và `relaxableSuggestions`; hard constraints không nằm trong suggestions.

### Retry/select/event/history

- `POST /v1/dish-randomizations/:id/retry`: body chỉ có thêm exclusions; server kế thừa immutable request snapshot.
- `PUT /v1/dish-randomizations/:id/selection`: idempotent; body `{ selectedDishId, sourceAction, selectedAt }`.
- `POST /v1/analytics/events:batch`: dùng thay endpoint event riêng nếu hợp nhất analytics.
- `GET /v1/me/random-history?outcome=&from=&to=&cursor=&limit=`: cursor `(createdAt,id)`.

## 9. Weekly plan

### Config

- `GET /v1/weekly-plan-config` — giữ.
- `PUT /v1/weekly-plan-config` — giữ; yêu cầu `If-Match` khi đã tồn tại.

```json
{
  "budgetVnd": 500000,
  "durationDays": 7,
  "enabledSlots": ["MORNING", "LUNCH", "DINNER"],
  "kcalMode": "PROFILE",
  "kcalPerDay": null,
  "avoidRepeat": true,
  "preferHomeCook": false,
  "calorieTolerancePercent": 15,
  "budgetReservePercent": 5
}
```

`mealsPerDay` là derived = số phần tử unique của `enabledSlots`, bỏ khỏi input mới.

### Generate và job

`POST /v1/weekly-plans` thay alias generate về dài hạn; trong giai đoạn chuyển đổi giữ `POST /generate`. Header `Idempotency-Key`, body:

```json
{
  "startDate": "2026-09-14",
  "timezone": "Asia/Ho_Chi_Minh",
  "configVersion": 4
}
```

Response `202`:

```json
{
  "planId": "uuid",
  "jobId": "uuid",
  "status": "GENERATING",
  "pollAfterMs": 1500
}
```

- `GET /v1/weekly-plans/:planId/generation`: status, progress `{ completedSlots,totalSlots }`, error code, retryability.
- `GET /v1/weekly-plans/current`, list và detail — giữ; detail trả immutable config/profile snapshot metadata, day/slots, summary, safetyStatus.

### State/action

- `POST /v1/weekly-plans/:id/start` với `If-Match`.
- `POST /v1/weekly-plans/:id/regenerate` body `{ preserveLockedSlots: true }`, idempotency key; plan cũ còn nguyên đến khi mới READY.
- `POST /v1/weekly-plans/:id/archive` idempotent.
- `PUT /v1/weekly-plan-slots/:slotId/lock` body `{ locked: true }`, `If-Match`.
- `POST /v1/weekly-plan-slots/:slotId/swap` body `{ newDishId?, reasonCode }`, idempotency key + `If-Match`.
- `POST /v1/weekly-plan-slots/:slotId/complete` body `{ actualCostVnd?, actualServingFactor?, occurredAt, createMealLog }`, idempotency key + `If-Match`.
- `POST /v1/weekly-plan-slots/:slotId/skip` body `{ reasonCode? }`, idempotency key + `If-Match`.

Mọi slot action trả cả updated slot và plan summary/version; client không tự cộng/trừ totals.

## 10. Health, meal log và targets

### Health day BFF — Mới

`GET /v1/health/days/2026-09-11?timezone=Asia/Ho_Chi_Minh`

```json
{
  "localDate": "2026-09-11",
  "timezone": "Asia/Ho_Chi_Minh",
  "dataStatus": "PARTIAL",
  "energy": { "consumedKcal": 1240, "targetKcal": 1850, "remainingKcal": 610, "burnedKcal": null },
  "macros": {
    "protein": { "consumedG": 68, "targetG": 100 },
    "carbs": { "consumedG": 146, "targetG": 210 },
    "fat": { "consumedG": 42, "targetG": 62 }
  },
  "water": { "consumedMl": 1200, "targetMl": 2000 },
  "steps": { "count": 6240, "target": 8000, "source": "HEALTH_CONNECT", "syncedAt": "2026-09-11T03:00:00Z" },
  "mealGroups": [],
  "tips": [{ "code": "PROTEIN_BELOW_TARGET", "severity": "INFO", "message": "...", "inputCoverage": 0.91 }],
  "coverage": { "energy": 0.95, "macros": 0.80, "micronutrients": 0.30 }
}
```

`remainingKcal = max(target - consumed, 0)` cho progress UI; nếu cần surplus hiển thị thêm `overTargetKcal = max(consumed-target,0)`. Không tự trừ exercise khỏi intake target trừ khi product policy khai báo rõ.

### Calendar — Mới

`GET /v1/health/calendar?month=2026-09&timezone=Asia/Ho_Chi_Minh` trả `days: [{ localDate, hasMealLog, completionRatio }]`, timezone version và summary.

### Meal logs — Mới

`POST /v1/meal-logs`, idempotency key:

```json
{
  "mealSlot": "LUNCH",
  "occurredAt": "2026-09-11T05:10:00Z",
  "timezone": "Asia/Ho_Chi_Minh",
  "note": null,
  "source": { "type": "RANDOM", "randomizationId": "uuid" },
  "items": [
    {
      "referenceType": "DISH",
      "referenceId": "uuid",
      "quantity": 1,
      "unitCode": "SERVING",
      "gramEquivalent": 550
    }
  ]
}
```

BE resolve nutrition, lưu snapshot bất biến trên item và trả total. Không chấp nhận client tự gửi calories cho catalog item; custom item được phép nhưng đánh dấu `USER_DECLARED`.

- `GET /v1/meal-logs?localDate=&timezone=&slot=&cursor=&limit=`.
- `GET /v1/meal-logs/:id`.
- `PATCH /v1/meal-logs/:id` với `If-Match`; thay items trong transaction và tạo snapshot mới.
- `DELETE /v1/meal-logs/:id` với `If-Match`; soft delete/audit.

### Custom foods — Mới

- `POST /v1/me/custom-foods` với name, serving, calories, macro, optional barcode/note.
- `GET/PATCH/DELETE /v1/me/custom-foods/:id` owner-only.
- Dữ liệu custom không được dùng để gợi ý người khác và có `sourceType=USER_DECLARED`.

### Water — Mới

- `POST /v1/water-logs`: `{ amountMl: 250, occurredAt, timezone }`, idempotency key.
- `GET /v1/water-logs?localDate=&timezone=`.
- `DELETE /v1/water-logs/:id`.

Giới hạn input sản phẩm, ví dụ `1..3000 ml` mỗi entry; tổng ngày bất thường chỉ cảnh báo, không âm thầm sửa.

### Activity sync — Mới

`POST /v1/activity-sync`:

```json
{
  "provider": "HEALTH_CONNECT",
  "timezone": "Asia/Ho_Chi_Minh",
  "buckets": [
    {
      "type": "STEPS",
      "startAt": "2026-09-10T17:00:00Z",
      "endAt": "2026-09-11T17:00:00Z",
      "value": 6240,
      "sourceIds": ["hashed-origin-set"],
      "dedupeKey": "sha256:..."
    }
  ]
}
```

BE upsert theo `(user,provider,type,start,end,dedupeKey)`. Client phải dùng aggregate API của platform cho cumulative data.

### Measurements và targets — Mới

- `POST /v1/me/measurements`: `{ type: "WEIGHT_KG", value: 62.4, measuredAt, source }`.
- `GET /v1/me/measurements?type=&from=&to=&cursor=`.
- `DELETE /v1/me/measurements/:id`.
- `GET /v1/me/health-targets`.
- `PUT /v1/me/health-targets` với `If-Match`: targets + mode `SYSTEM_ESTIMATED|USER_DEFINED|PROFESSIONAL`.

Target response có `method`, `formulaVersion`, `inputsUsed`, `calculatedAt`, `warnings`; không gửi chẩn đoán.

### Camera recognition — Mới

- `POST /v1/food-recognitions/uploads` → presigned URL.
- `POST /v1/food-recognitions` body `{ mediaId }` → `202 jobId`.
- `GET /v1/food-recognitions/:id` → candidates `{ referenceType,referenceId,label,confidence,portionSuggestions,warnings }`.
- `POST /v1/food-recognitions/:id/confirm` body `{ candidateId, portion }` → trả draft meal-log payload; chỉ tạo log nếu `createMealLog=true` rõ ràng.

## 11. Recipe, reminders và place

### Recipe/cooking

Recipe là phần của Dish detail. Nếu cần cross-device:

- `POST /v1/cooking-sessions` body `{ dishId, servings }`.
- `PATCH /v1/cooking-sessions/:id` body `{ currentStep, checkedStepIds, timerCheckpoints }`, `If-Match`.
- `POST /v1/cooking-sessions/:id/complete`.

Timer chạy local; BE chỉ lưu checkpoint timestamp/duration.

### Meal reminder

- `POST /v1/meal-reminders`: `{ dishId, scheduledLocalDateTime, timezone, enabled }`.
- `PATCH/DELETE /v1/meal-reminders/:id` owner-only.
- Worker tính UTC từ local datetime + timezone và lưu cả timezone để xử lý DST/đổi timezone có chủ đích.

### Nearby place

`GET /v1/places/nearby?lat=&lon=&radiusM=3000&dishId=&openNow=true&cursor=`.

Response item phải có `provider`, `providerPlaceId`, `name`, `location`, `distanceM`, `openStatus`, `priceLevel`, `rating`, `userRatingCount`, `attributions`, `observedAt`. `dishAvailability` chỉ là `CONFIRMED|POSSIBLE|UNKNOWN`; mặc định UNKNOWN nếu không có menu source.

Không lưu/cached provider fields vượt chính sách. Place ID và dữ liệu được phép lưu phải tuân hợp đồng provider; app hiển thị attribution bắt buộc.

## 12. Analytics và event nghiệp vụ

`POST /v1/analytics/events:batch` nhận tối đa 50 event, mỗi event có `eventId`, type allowlist, occurredAt, sessionId và properties đã schema hóa. Dedupe theo eventId. Không nhận object tùy ý chứa PII.

Event analytics không thay thế event nghiệp vụ. `MEAL_LOG_CREATED`, `WEEKLY_SLOT_COMPLETED`, `RANDOM_DISH_SELECTED` được phát từ transaction/outbox của BE sau khi action thành công; client không được tự khai các event này để tính badge/streak.

## 13. Security và rate limit bắt buộc

- Query theo user resource luôn bao gồm owner predicate ngay trong DB access; không fetch theo ID rồi quên authorize.
- Field-level allowlist cho PATCH; DTO không nhận `userId`, role, counters, status duyệt hoặc calculated totals từ mobile.
- Re-auth cho password, export, clear data, delete account và revoke all sessions.
- Signed upload giới hạn MIME, size, checksum, storage prefix; scan/moderate trước public.
- Rate limit riêng: login/reset/OTP, random, plan generate, AI recognition, community writes và search.
- Endpoint job trả trạng thái, timeout và error code; retry bằng cùng idempotency key.
- Audit action nhạy cảm không chứa secret/PII thô.

