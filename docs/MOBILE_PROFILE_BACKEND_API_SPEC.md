# Đặc tả Backend API cho Mobile Profile

> Phiên bản: 1.0  
> Ngày đối chiếu source: 2026-09-14  
> Phạm vi: `mobile/src/screens/ProfileScreen.tsx` và các màn con được mở từ Profile  
> Đối tượng sử dụng: Backend, Mobile, QA, Product và Security/Privacy reviewer

## 1. Mục tiêu và nguyên tắc dùng tài liệu

Tài liệu này biến toàn bộ dữ liệu mock đang xuất hiện trong giao diện Profile thành hợp đồng API có thể triển khai và kiểm thử. Đây là đặc tả chi tiết theo màn hình; các quy ước dùng chung như success envelope, cursor, date/time, `If-Match`, idempotency và lỗi vẫn tuân theo [02_API_CONTRACTS.md](./mobile-backend/02_API_CONTRACTS.md).

Các từ khóa `MUST`, `MUST NOT`, `SHOULD`, `MAY` trong tài liệu thể hiện mức bắt buộc triển khai.

Không được dùng giá trị mock làm fallback khi API lỗi. Mobile phải hiển thị skeleton, empty state hoặc error state tương ứng. Backend không được trả số `0` thay cho dữ liệu chưa biết.

## 2. Kết luận audit nhanh

Lưu ý: danh sách mock/hard-code dưới đây là snapshot khi tài liệu được lập. Mobile hiện đã nối một phần profile API, và từ 15/09/2026 đã có component chọn/upload avatar cùng avatar từ DB ở các màn hồ sơ/trang chủ/khám phá. Các yêu cầu API/BE trong tài liệu vẫn là tiêu chí nghiệm thu, không phải mô tả rằng mọi route đã hoàn tất.

Ở snapshot audit ban đầu, `ProfileScreen.tsx` là prototype tĩnh; ngoài `useState` cục bộ cho toggle/chip, màn hình chưa gọi `profileApi` hoặc service nghiệp vụ nào. Các dữ liệu dưới đây từng hard-code:

- Avatar local `avatar.jpg`, tên `Huy Trương/Huy Trường`, username `@huytruong`.
- Mục tiêu “Ăn cân bằng”; 24 bài viết, 128 món đã lưu, 18 người theo dõi.
- Chuỗi 12 ngày, kỷ lục 18 ngày, 36 bữa, 8 món mới và lịch hoàn thành 6/7 ngày.
- Ngày sinh, giới tính, giới thiệu, khu vực.
- Chiều cao, cân nặng, BMI, cân nặng mục tiêu, mức vận động và mục tiêu ngày.
- Khẩu vị, ẩm thực, ưu tiên chọn món và nguyên liệu cần tránh.
- Danh sách món lưu, lịch sử random, bài viết và nhật ký bữa ăn.
- Cài đặt, quyền riêng tư, quyền hệ điều hành, xuất/xóa dữ liệu và xóa tài khoản.

Backend đã có một phần route, nhưng còn thiếu hoặc chưa đúng contract của giao diện:

- `GET /profile/me`, `PATCH /profile/basic|health|preferences`, `GET /me/journey` đã tồn tại.
- `GET/PATCH /me/settings`, session management, password change, saved dishes, random history, meal log, measurements và health targets đã tồn tại ở mức khác nhau.
- Chưa có profile dashboard aggregate cho lần mở màn đầu.
- Basic profile chưa cập nhật được `username`, `bio`, `regionId` và avatar.
- `getJourney()` hiện trả `days: []`, tổng meal toàn thời gian thay vì theo tháng, và tổng nước toàn thời gian thay vì theo tháng/ngày.
- Avoid list đang lưu free text, chưa liên kết catalog `Ingredient`, nên hard-exclusion có thể sai chính tả hoặc sai nghĩa.
- Settings schema có `shareData` và `analyticsEnabled` nhưng DTO/service cập nhật không nhận hai field này; giao diện lại yêu cầu `profileVisibility`, `showDietActivity`, `allowComments` chưa có trong DB.
- `getHealthTarget()` tự sinh mục tiêu mặc định 2.000 kcal/120 g protein khi thiếu dữ liệu. Hành vi này có thể khiến số giả được hiểu là khuyến nghị cá nhân.
- Data export hiện được tạo `READY` ngay và trả snapshot JSON trực tiếp; chưa phải export job thật, chưa re-auth, chưa tạo file/signed URL.
- Account deletion chưa re-auth, chưa có cancel/status, chưa chống tạo nhiều request đang hoạt động.
- Danh sách bài viết hiện chưa hỗ trợ `scope=ME`, draft/saved tab và search như UI.
- Saved dishes chưa hỗ trợ search/filter và response thiếu kcal/thời gian nấu cần cho card.
- Random history dùng cursor theo UUID (`id < cursor`) thay vì cursor `(createdAt,id)` và chưa có endpoint summary ổn định.

### 2.1 Danh sách công việc giao BE

**GIỮ và chuẩn hóa response**

- `GET /v1/profile/me`
- `PATCH /v1/profile/basic`
- `PATCH /v1/profile/preferences`
- `GET /v1/me/journey`
- `GET/PATCH /v1/me/settings`
- `GET /v1/me/saved-dishes`
- `GET /v1/me/random-history`
- `GET /v1/health/days/:localDate`
- Session và password endpoints hiện có

**SỬA hành vi hoặc data model**

- Basic profile: thêm username, bio, region và atomic optimistic concurrency.
- Health update: append measurement thay vì chỉ overwrite profile.
- Preferences: transaction toàn khối và tách diet/taste/cuisine/priority/allergy/avoidance.
- Journey: tính đúng tháng/timezone, trả day status và persist achievement.
- Settings: cập nhật được notification/privacy field đang có trong DB và field UI còn thiếu.
- Saved dishes: thêm search/filter và card projection có image/kcal/time/price.
- Random history: opaque compound cursor, summary và mobile-safe DTO.
- Community posts: hỗ trợ `scope=ME`, draft, saved và search.
- Privacy jobs: async thật, recent re-auth, signed result và full deletion scope.

**TẠO MỚI**

- `GET /v1/me/profile-dashboard`
- Avatar upload-intent/finalize/status/delete
- `GET /v1/me/health-profile`
- Ingredient search và `PUT /v1/me/avoidances`
- Random history summary
- Saved posts list
- Account deletion status/cancel và export/download worker

Route cũ MAY được giữ một chu kỳ phát hành để tương thích, nhưng OpenAPI phải đánh dấu deprecated và mobile mới chỉ dùng route đích trong tài liệu này.

## 3. Ranh giới dữ liệu theo màn hình

### 3.1 Profile main

Màn main cần một response nhẹ, tối đa một round trip, gồm:

- Identity: display name, username, avatar thumbnail, primary goal label.
- Counters: published posts, saved dishes, followers.
- Journey preview: current streak, meals logged trong tháng, new dishes trong tháng, trạng thái 7 ngày gần nhất.
- Shortcut counters: saved dishes, random history, meal diary period, posts.
- Notification unread count.

Không đưa ngày sinh, cân nặng, dị ứng hoặc dữ liệu sức khỏe vào response màn main.

### 3.2 Edit profile

Các field UI yêu cầu:

- `displayName`
- `username`
- `dateOfBirth`
- `gender`
- `bio`
- `regionId` và `regionName`
- `avatar`

`dateOfBirth` là dữ liệu private. Public profile DTO MUST không chứa ngày sinh đầy đủ.

### 3.3 Journey

UI yêu cầu current streak, longest streak, calendar theo tháng, achievements và progress của mục tiêu tháng. Tất cả counter phải được BE tính từ event nghiệp vụ/meal logs; mobile không được gửi counter.

### 3.4 Health profile

UI yêu cầu latest height/weight, BMI derived, target weight, activity level và daily targets. Measurement history là nguồn thật; field latest trên profile chỉ là cache đọc nhanh.

### 3.5 Goal, preference và avoid list

Goal, taste, cuisine/diet và priority là catalog item có ID/code. Allergy và disliked ingredient là hai khái niệm khác nhau:

- Allergy/intolerance: hard safety constraint, chọn từ allergen catalog.
- Avoid ingredient: preference hoặc hard avoidance do user chỉ định, ưu tiên link `ingredientId`.
- Free text chỉ dùng khi chưa resolve được; phải lưu `normalizedText` và trạng thái `UNRESOLVED`.

### 3.6 Settings và privacy

Phân loại trước khi làm API:

- Server-backed: language, theme nếu muốn đồng bộ, notification preferences, privacy visibility, comments, analytics consent.
- Device-only: sound, haptic, biometric lock, trạng thái quyền Location/Notification/Camera. BE không thể cấp hoặc thu hồi quyền của OS.
- Security-backed: password, sessions/devices, export, clear data, account deletion.

### 3.7 Các danh sách mở từ Profile

Saved dishes, random history, posts và diary là các domain riêng. Profile chỉ điều hướng và hiển thị preview/counter; không nhồi toàn bộ danh sách vào `GET /profile/me`.

## 4. Quy ước API bắt buộc

### 4.1 Base và authentication

- Base: `/v1`.
- Tất cả endpoint trong tài liệu yêu cầu Bearer access token.
- Owner predicate phải nằm trong DB query, không fetch theo ID rồi mới bỏ qua authorize.
- `X-Timezone` dùng timezone IANA, ví dụ `Asia/Ho_Chi_Minh`.
- `X-App-Version`, `X-Platform`, `X-Request-Id` theo contract chung.

### 4.2 Concurrency

Resource profile/settings/health target có `version` và ETag. Response MUST trả:

```http
ETag: "12"
```

Update MUST gửi:

```http
If-Match: "12"
```

- Thiếu `If-Match`: `428 PRECONDITION_REQUIRED`.
- Version không khớp: `412 PRECONDITION_FAILED` theo HTTP semantics, hoặc giữ `409` trong giai đoạn tương thích. Contract đích dùng `412`.
- BE phải thực hiện compare-and-update trong một câu lệnh/transaction, không chỉ đọc version rồi update bằng `where userId`, vì hai request đồng thời vẫn có thể cùng vượt qua bước kiểm tra.

Ví dụ đích:

```sql
UPDATE profiles
SET display_name = :displayName,
    profile_version = profile_version + 1
WHERE user_id = :userId
  AND profile_version = :expectedVersion
RETURNING *;
```

### 4.3 Partial update

- Field vắng mặt: giữ nguyên.
- Field có `null`: xóa nếu field cho phép nullable.
- Không dùng truthy check cho number/boolean.
- DTO dùng allowlist; từ chối `userId`, role, counters, computed BMI và timestamps do client gửi.

### 4.4 Error format

Contract mới SHOULD dùng `application/problem+json` theo RFC 9457, đồng thời giữ `code` máy đọc được:

```json
{
  "type": "https://api.mogu.vn/problems/profile-version-conflict",
  "title": "Profile version conflict",
  "status": 412,
  "detail": "Hồ sơ đã được cập nhật trên thiết bị khác.",
  "instance": "/v1/profile/basic",
  "code": "PROFILE_VERSION_CONFLICT",
  "currentVersion": 13,
  "errors": []
}
```

Validation field dùng JSON Pointer:

```json
{
  "type": "https://api.mogu.vn/problems/validation-failed",
  "title": "Validation failed",
  "status": 422,
  "code": "VALIDATION_FAILED",
  "errors": [
    {
      "pointer": "#/username",
      "code": "USERNAME_TAKEN",
      "message": "Tên người dùng đã được sử dụng."
    }
  ]
}
```

### 4.5 List và cursor

Mọi list dùng opaque cursor chứa `(sortTimestamp,id)`; không so sánh thứ tự UUID. `limit` mặc định 20, tối đa 50.

```json
{
  "items": [],
  "pageInfo": {
    "nextCursor": null,
    "hasNextPage": false
  }
}
```

## 5. API Profile dashboard

### `GET /v1/me/profile-dashboard`

Query:

- `localDate=2026-09-14`
- `timezone=Asia/Ho_Chi_Minh`
- `weekStartsOn=MONDAY`

Response đề xuất:

```json
{
  "profile": {
    "displayName": "Huy Trương",
    "username": "huytruong",
    "avatar": {
      "url": "https://cdn.example/avatar/uuid/128.webp",
      "blurHash": null,
      "status": "APPROVED"
    },
    "primaryGoal": {
      "id": "goal-uuid",
      "code": "BALANCED",
      "name": "Ăn cân bằng"
    }
  },
  "socialStats": {
    "publishedPostCount": 24,
    "savedDishCount": 128,
    "followerCount": 18
  },
  "journeyPreview": {
    "currentStreakDays": 12,
    "mealsLoggedThisMonth": 36,
    "newDishesThisMonth": 8,
    "recentDays": [
      { "localDate": "2026-09-08", "status": "COMPLETED" },
      { "localDate": "2026-09-09", "status": "COMPLETED" },
      { "localDate": "2026-09-14", "status": "IN_PROGRESS" }
    ],
    "definitionVersion": "journey-v1"
  },
  "shortcuts": {
    "savedDishes": 128,
    "randomRuns": 24,
    "mealLogsThisMonth": 36,
    "myPublishedPosts": 24,
    "myDraftPosts": 3
  },
  "notificationUnreadCount": 3,
  "generatedAt": "2026-09-14T04:15:00.000Z"
}
```

Quy tắc:

- Endpoint là read model/BFF, không phải nguồn dữ liệu mới.
- Counter có thể cache 30–60 giây; identity và safety preference không lấy từ cache dài hạn.
- Partial failure không thay bằng mock. Có thể trả `sections.<name>.status=UNAVAILABLE` nếu product chọn graceful degradation.
- `newDishesThisMonth` phải được định nghĩa là số dish khác nhau lần đầu được chọn hoặc meal-logged trong tháng, không phải số lần random.

## 6. API đọc và sửa hồ sơ

### `GET /v1/profile/me`

Response private:

```json
{
  "version": 12,
  "basic": {
    "displayName": "Huy Trương",
    "username": "huytruong",
    "dateOfBirth": "2000-03-12",
    "gender": "MALE",
    "bio": "Yêu món Việt và thích khám phá món mới.",
    "region": {
      "id": "region-uuid",
      "code": "VN-SG",
      "name": "TP. Hồ Chí Minh"
    },
    "locale": "vi-VN",
    "timezone": "Asia/Ho_Chi_Minh"
  },
  "avatar": {
    "mediaId": "media-uuid",
    "url": "https://cdn.example/avatar/uuid/512.webp",
    "thumbnailUrl": "https://cdn.example/avatar/uuid/128.webp",
    "status": "APPROVED"
  },
  "healthSummary": {
    "latestHeightCm": 170,
    "latestWeightKg": 65,
    "targetWeightKg": 62,
    "activityLevel": "MODERATE",
    "updatedAt": "2026-09-12T10:00:00.000Z"
  },
  "preferences": {
    "primaryGoal": { "id": "uuid", "code": "BALANCED", "name": "Ăn cân bằng" },
    "tastePreferences": [],
    "dietTypes": [],
    "selectionPriorities": [],
    "allergens": [],
    "avoidedIngredients": []
  },
  "updatedAt": "2026-09-14T04:00:00.000Z"
}
```

Không trả email, password hash, token, refresh session, internal role hoặc moderation note.

### `PATCH /v1/profile/basic`

```json
{
  "displayName": "Huy Trương",
  "username": "huytruong",
  "dateOfBirth": "2000-03-12",
  "gender": "MALE",
  "bio": "Yêu món Việt và thích khám phá món mới.",
  "regionId": "region-uuid"
}
```

Validation đề xuất:

- `displayName`: trim, 1–50 Unicode characters; không ép tên thật.
- `username`: 3–32 ký tự; lowercase canonical; cho phép `a-z`, `0-9`, `_`, dấu chấm nếu product chốt; unique case-insensitive; reserved words denylist.
- Mobile hiển thị `@`, nhưng API và DB lưu không có `@`.
- `bio`: tối đa 300 Unicode characters; plain text; loại control characters.
- `dateOfBirth`: ISO date-only, không parse thành instant theo timezone; không là tương lai. Nếu logic health chỉ dành cho adult thì response phải có `healthEligibility`, không chặn người dùng trẻ chỉ vì sửa profile.
- `gender`: enum đã thống nhất với onboarding; cho phép `null`/`UNSPECIFIED` theo quyết định product.
- `regionId`: phải là region active; không nhận raw location string làm canonical identity.

Username update nên rate-limit và có cooldown nếu username dùng trong URL công khai. Khi đổi, redirect/alias cũ là quyết định product, không mặc định giữ PII vô thời hạn.

### Catalog khu vực

`GET /v1/catalogs/regions?q=ho%20chi&countryCode=VN&cursor=&limit=20`

Response item: `{ id, code, name, countryCode, parentId, type }`. Search phải accent-insensitive cho discovery nhưng ID là giá trị submit.

## 7. Avatar upload

Không gửi base64 ảnh trong JSON profile. Dùng quy trình upload intent → object storage → finalize.

Ghi chú tích hợp mobile (15/09/2026): component `ImageUploadField` đã gọi intent → PUT binary đến signed URL → finalize và hỗ trợ tiến trình/thử lại. Backend hiện trả URL chứa `token=stub` (hoặc host `placeholder.supabase.co` khi thiếu cấu hình), nên mobile cố ý chặn upload và hiện lỗi cấu hình. BE MUST cấp signed URL thật, kiểm tra object thực sự tồn tại trước finalize, rồi trả URL công khai hợp lệ; không đánh dấu `APPROVED` chỉ vì client gọi finalize. Nên bổ sung idempotency cho intent/finalize và cleanup các media `UPLOAD_PENDING` quá hạn. Đây là điều kiện bắt buộc trước khi nghiệm thu upload avatar end-to-end.

### `POST /v1/me/avatar-upload-intents`

Header: `Idempotency-Key`.

```json
{
  "mimeType": "image/jpeg",
  "sizeBytes": 842133,
  "sha256": "base64url-sha256",
  "width": 1024,
  "height": 1024
}
```

Response `201`:

```json
{
  "mediaId": "media-uuid",
  "upload": {
    "method": "PUT",
    "url": "short-lived-signed-url",
    "headers": { "content-type": "image/jpeg" },
    "expiresAt": "2026-09-14T04:25:00.000Z"
  },
  "maxSizeBytes": 5242880,
  "allowedMimeTypes": ["image/jpeg", "image/png", "image/webp"]
}
```

### `POST /v1/me/avatar-upload-intents/:mediaId/finalize`

BE phải kiểm tra owner, object tồn tại, byte size, magic bytes, MIME, checksum, pixel dimensions; re-encode để loại metadata và payload ẩn; tạo thumbnail 128/256/512; scan/moderate; sau đó mới set avatar.

Response có thể là `202` nếu xử lý async:

```json
{
  "mediaId": "media-uuid",
  "status": "PROCESSING",
  "jobId": "job-uuid",
  "pollAfterMs": 1500
}
```

### `GET /v1/me/avatar`

Trả `PROCESSING|APPROVED|REJECTED|FAILED` cùng URL ảnh cũ trong khi ảnh mới đang xử lý. Không làm avatar biến mất giữa quy trình.

### `DELETE /v1/me/avatar`

Yêu cầu `If-Match` profile. Xóa liên kết hiện tại trước, object được garbage collect theo retention; không tái sử dụng object path cũ để tránh CDN stale.

Giới hạn khuyến nghị: 5 MiB, tối đa 4096×4096, chỉ JPEG/PNG/WebP sau kiểm tra nội dung thật. Không tin extension hoặc `Content-Type` do client khai.

## 8. Journey, streak và achievements

### `GET /v1/me/journey`

Query bắt buộc: `month=YYYY-MM`, `timezone=IANA`.

```json
{
  "month": "2026-09",
  "timezone": "Asia/Ho_Chi_Minh",
  "streak": {
    "currentDays": 12,
    "longestDays": 18,
    "lastQualifiedLocalDate": "2026-09-14",
    "definitionVersion": "meal-log-one-per-day-v1"
  },
  "days": [
    {
      "localDate": "2026-09-01",
      "status": "QUALIFIED",
      "mealLogCount": 2,
      "targetCompletionRatio": 0.75
    }
  ],
  "achievements": [
    {
      "id": "achievement-uuid",
      "code": "EXPLORER_10",
      "name": "Người khám phá",
      "description": "Thử 10 món khác nhau",
      "progress": 8,
      "target": 10,
      "earnedAt": null,
      "iconKey": "sparkles"
    }
  ],
  "monthlyGoals": [
    { "code": "MEAL_LOGS", "label": "Ghi bữa ăn", "current": 36, "target": 60, "unit": "MEAL" },
    { "code": "NEW_DISHES", "label": "Thử món mới", "current": 8, "target": 10, "unit": "DISH" },
    { "code": "WATER_TARGET_DAYS", "label": "Uống đủ nước", "current": 12, "target": 30, "unit": "DAY" }
  ],
  "totals": {
    "mealsLogged": 36,
    "distinctNewDishes": 8,
    "waterMl": 28600
  },
  "dataCoverage": {
    "mealLogs": 1,
    "water": 0.87,
    "activity": 0
  }
}
```

Streak v1 đề xuất: một local date đạt chuẩn nếu có ít nhất một meal log hợp lệ, không bị xóa. Chuỗi hiện tại được phép bắt đầu từ hôm qua nếu hôm nay chưa kết thúc. Tất cả phép tính dựa trên timezone của user tại thời điểm event; lưu `localDate` cùng event để không đổi lịch sử khi user đổi timezone.

Không tạo `earnedAt=now()` mỗi lần đọc. Achievement earned phải là record bền vững, idempotent, phát từ event/outbox.

## 9. Health profile và daily targets

### `GET /v1/me/health-profile`

```json
{
  "latestMeasurements": {
    "height": { "value": 170, "unit": "cm", "measuredAt": "2026-09-01T00:00:00Z" },
    "weight": { "value": 65, "unit": "kg", "measuredAt": "2026-09-12T00:00:00Z" }
  },
  "bmi": {
    "value": 22.5,
    "status": "AVAILABLE",
    "method": "WEIGHT_KG_DIV_HEIGHT_M_SQUARED",
    "applicability": "ADULT_SCREENING_ONLY",
    "calculatedAt": "2026-09-14T04:00:00Z"
  },
  "targetWeight": { "value": 62, "unit": "kg", "source": "USER_DEFINED" },
  "activityLevel": "MODERATE",
  "dailyTargets": {
    "energyKcal": 1850,
    "proteinG": 100,
    "carbsG": 210,
    "fatG": 62,
    "waterMl": 2000,
    "steps": 8000,
    "mode": "USER_DEFINED",
    "method": null,
    "formulaVersion": null,
    "inputsUsed": [],
    "requiresProfessionalReview": false,
    "version": 4
  },
  "warnings": []
}
```

### Measurement API

- `POST /v1/me/measurements` append `{ type, value, unit, measuredAt, source }`.
- `GET /v1/me/measurements?type=WEIGHT_KG&from=&to=&cursor=&limit=`.
- `DELETE /v1/me/measurements/:id` chỉ khi policy cho xóa; aggregate/latest phải recompute.
- `type`, `unit`, `source` phải enum; không để string tự do.

Khi cập nhật chiều cao/cân nặng từ màn Health, mobile tạo measurement mới; không chỉ overwrite `profiles.heightCm/weightKg`.

### Health target API

- `GET /v1/me/health-targets/current`.
- `PUT /v1/me/health-targets/current` với `If-Match`.
- `POST /v1/me/health-targets/recalculate` nếu user yêu cầu tính lại.

Không tự tạo một target mặc định mang vẻ cá nhân hóa khi thiếu input. Trả:

```json
{
  "status": "INSUFFICIENT_INPUT",
  "missingInputs": ["dateOfBirth", "activityLevel"],
  "dailyTargets": null
}
```

BMI chỉ tính khi có height/weight hợp lệ:

```text
BMI = weightKg / (heightCm / 100)^2
```

Làm tròn 1 chữ số chỉ ở display DTO; lưu/tính bằng precision đầy đủ. BMI là chỉ số sàng lọc, không phải chẩn đoán và phân loại adult không áp dụng trực tiếp cho trẻ em.

Target do hệ thống tính phải lưu `method`, `formulaVersion`, input snapshot, eligibility, calculatedAt và warnings. Không tự đưa target giảm cân cho người dưới 18 tuổi hoặc trường hợp cần tư vấn chuyên môn.

## 10. Goal, preferences và avoid ingredients

### Catalog

Tái sử dụng `GET /v1/catalogs/onboarding`, hoặc tách:

- `GET /v1/catalogs/goals`
- `GET /v1/catalogs/dietary-preferences?type=TASTE|CUISINE|DIET`
- `GET /v1/catalogs/selection-priorities`
- `GET /v1/catalogs/allergens`
- `GET /v1/ingredients/search?q=rau%20mui&limit=20`

Mobile render bằng label catalog nhưng submit ID/code. Catalog response có `catalogVersion`, `active`, `displayOrder` và localized label.

### `PATCH /v1/profile/preferences`

```json
{
  "primaryGoalId": "goal-uuid",
  "tastePreferenceIds": ["uuid"],
  "dietTypeSelections": [
    { "dietTypeId": "uuid", "constraint": "SOFT" }
  ],
  "selectionPriorities": [
    { "code": "HEALTHY", "weight": 0.9 },
    { "code": "ECONOMY", "weight": 0.8 },
    { "code": "QUICK", "weight": 0.2 },
    { "code": "NOVELTY", "weight": 0.7 }
  ]
}
```

Backend validate tất cả ID trong batch trước khi xóa/thay relation. Update toàn bộ preference phải chạy trong một transaction; implementation hiện tại delete/create tuần tự có thể để dữ liệu dở dang.

### `PUT /v1/me/avoidances`

Tách khỏi preferences để UI lưu độc lập và contract rõ hơn:

```json
{
  "allergens": [
    { "allergenId": "uuid", "severity": "UNKNOWN", "confirmed": true }
  ],
  "ingredients": [
    { "ingredientId": "uuid", "mode": "HARD", "reasonCode": "DISLIKE" },
    { "freeText": "hành sống", "mode": "HARD", "reasonCode": "DISLIKE" }
  ],
  "noKnownAllergies": false
}
```

Quy tắc:

- `noKnownAllergies=true` loại trừ danh sách allergens, nhưng không xóa avoid ingredient.
- Search debounce ở mobile; server rate-limit. Không tạo Ingredient catalog mới từ tìm kiếm của user.
- Free text normalize giữ dấu để định danh, có thêm folded form chỉ cho search.
- Duplicate theo `(userId, ingredientId)` hoặc `(userId, normalizedFreeText)`.
- Khi allergy/hard avoidance thay đổi, random và weekly sử dụng ngay; weekly plan chưa hoàn thành được đánh dấu `RECHECK_REQUIRED` nếu có nguy cơ.
- UI không được hứa “loại tuyệt đối” khi dish data coverage chưa đủ. API trả safety coverage/warning.

## 11. Saved dishes

### `GET /v1/me/saved-dishes`

Query:

- `q`: search tên món.
- `mealTypeCode=BREAKFAST`.
- `goalCode=HEALTHY`.
- `maxPriceVnd=50000`.
- `sort=SAVED_AT_DESC|NAME_ASC`.
- `cursor`, `limit`.

Response item phải đủ cho `FoodRow`:

```json
{
  "savedId": "uuid",
  "savedAt": "2026-09-12T10:00:00Z",
  "dish": {
    "id": "uuid",
    "slug": "pho-bo",
    "name": "Phở bò",
    "imageUrl": "https://cdn.example/dishes/pho.webp",
    "energyKcal": 420,
    "totalMinutes": 25,
    "price": { "lowVnd": 45000, "highVnd": 65000, "status": "KNOWN" },
    "isAvailable": true
  }
}
```

- `totalCount` MAY trả nếu query count không quá đắt; profile dashboard dùng cached counter riêng.
- Dish đã unpublish vẫn có thể hiện với `isAvailable=false` để user hiểu mục đã lưu, nhưng không mở flow đặt/chọn như dish active.
- `PUT /v1/me/saved-dishes/:dishId` idempotent.
- `DELETE /v1/me/saved-dishes/:dishId` idempotent, trả 204.

## 12. Random history

### `GET /v1/me/random-history/summary`

Query `from`, `to`, `timezone`.

```json
{
  "randomRunCount": 24,
  "selectedCount": 18,
  "retryCount": 6,
  "selectionRate": 0.75,
  "definitionVersion": "random-stats-v1"
}
```

Định nghĩa:

- `randomRunCount`: số random root request; retry là action của root, không nhân mẫu số nếu muốn đúng số “lần bắt đầu”.
- Nếu sản phẩm muốn đếm mọi kết quả hiển thị thì dùng tên `resultImpressionCount`, không dùng chung `randomRunCount`.
- `selectionRate = selectedRootCount / eligibleCompletedRootCount`; nếu mẫu số 0 trả `null`, không trả 0%.

### `GET /v1/me/random-history`

Query `outcome=SELECTED|RETRIED|DISMISSED`, `from`, `to`, `cursor`, `limit`.

Item:

```json
{
  "randomizationId": "uuid",
  "createdAt": "2026-09-14T05:10:00Z",
  "localDate": "2026-09-14",
  "mealSlot": "LUNCH",
  "outcome": "SELECTED",
  "compatibilityPercent": 90,
  "dish": {
    "id": "uuid",
    "name": "Phở bò",
    "slug": "pho-bo",
    "imageUrl": "https://cdn.example/pho.webp",
    "isAvailable": true
  }
}
```

Không trả raw `criteriaSnapshot`, full score breakdown hoặc internal fail detail trong list mobile.

## 13. My posts

UI có ba tab `Đã đăng`, `Bản nháp`, `Đã lưu`. Contract:

- `GET /v1/community/posts?scope=ME&status=PUBLISHED|DRAFT&q=&cursor=&limit=`.
- `GET /v1/me/saved-posts?q=&cursor=&limit=`.
- `PATCH /v1/community/posts/:postId` cho edit draft/owner post.
- `DELETE /v1/community/posts/:postId` soft delete.

Response item gồm author summary, content excerpt/full content theo view, media thumbnails, like/comment count, viewer state, visibility, moderation status, createdAt/updatedAt/publishedAt và `version`.

Backend hiện chỉ list `status=ACTIVE`, bỏ qua `scope/status/q`, và response có cả `data` lẫn `items`. Phải chuẩn hóa về một list envelope. Counter like/comment cập nhật transactionally; không để decrement âm khi concurrent unlike.

## 14. Meal diary shortcut

Profile diary dùng lại health domain:

- `GET /v1/health/days/:localDate?timezone=` cho calories/macros/targets và meal groups.
- `GET /v1/meal-logs?localDate=&timezone=&slot=&cursor=&limit=` khi cần chi tiết.
- `POST/PATCH/DELETE /v1/meal-logs` theo contract meal log.

Response health day phải phân biệt `null` và `0`, có coverage, source và target version. “Bữa tối chưa ghi” là empty slot derived từ slot policy, không phải meal log giả.

## 15. Settings

### `GET /v1/me/settings`

```json
{
  "version": 3,
  "language": "vi-VN",
  "theme": "SYSTEM",
  "notifications": {
    "pushEnabled": true,
    "mealReminders": true,
    "waterReminders": true,
    "weeklyPlan": true,
    "community": false,
    "marketing": false
  },
  "privacy": {
    "profileVisibility": "PRIVATE",
    "showDietActivity": false,
    "allowComments": true,
    "analyticsEnabled": false
  }
}
```

### `PATCH /v1/me/settings`

Partial update với `If-Match`:

```json
{
  "theme": "LIGHT",
  "notifications": { "community": true },
  "privacy": { "allowComments": false }
}
```

Validation dùng enum, không chấp nhận string bất kỳ. Marketing consent phải có audit/consent record riêng; tắt notification marketing và rút marketing consent là hai nghiệp vụ liên quan nhưng không được gộp thành một boolean không lịch sử.

### Device-only settings

Âm thanh và rung có thể lưu bằng AsyncStorage/SecureStore theo device. Nếu product muốn sync đa thiết bị, server field phải ghi rõ `soundPreference`/`hapticPreference`; app vẫn tôn trọng capability và OS setting.

Biometric lock là local security control. BE chỉ có thể phát hành/revoke session, không lưu biometric template.

## 16. Permission status

Các dòng Vị trí, Thông báo, Ảnh & Camera lấy trạng thái từ Expo/OS API. Không tạo API BE để “bật quyền”. Backend chỉ cần:

- Push installation register/delete.
- Location chỉ gửi trong request cần location và theo consent/purpose.
- Audit consent nếu pháp lý/product yêu cầu, không coi OS permission là consent xử lý dữ liệu cho mọi mục đích.

Response settings MAY trả `requiredAppCapabilities`, nhưng trạng thái `GRANTED|DENIED` phải do app hỏi OS.

## 17. Security account và sessions

- `POST /v1/auth/password-change`: yêu cầu current password/re-auth proof, revoke/rotate session theo policy.
- `GET /v1/me/sessions`: device label, platform, createdAt, lastUsedAt, isCurrent; không trả token/IP thô.
- `DELETE /v1/me/sessions/:sessionId`: owner-only, idempotent.
- `DELETE /v1/me/sessions?exceptCurrent=true`: recent re-auth.

Thao tác nhạy cảm gồm đổi mật khẩu, export, clear health/history, delete account và revoke all sessions MUST yêu cầu recent authentication. Có thể dùng `X-Reauth-Token` ngắn hạn, scope-bound, one-time hoặc thời hạn tối đa vài phút.

## 18. Privacy APIs

### Data export

`POST /v1/me/data-exports` với `Idempotency-Key` và re-auth → `202`:

```json
{
  "jobId": "uuid",
  "status": "QUEUED",
  "pollAfterMs": 3000
}
```

`GET /v1/me/data-exports/:jobId`:

```json
{
  "jobId": "uuid",
  "status": "READY",
  "download": {
    "url": "short-lived-signed-url",
    "expiresAt": "2026-09-14T06:00:00Z",
    "sha256": "base64url-sha256",
    "sizeBytes": 98122
  }
}
```

Export phải bao phủ dữ liệu người dùng theo policy, tạo file trong private storage, mã hóa khi phù hợp, có TTL và audit. Không trả toàn bộ export trực tiếp trong JSON polling response.

### Clear history/health

Contract đích:

- `DELETE /v1/me/random-history`.
- `DELETE /v1/me/health-data`.

Nếu xử lý nhanh trả 204; nếu async trả 202 job. Body cho DELETE không đáng tin cậy qua mọi client/proxy, nên confirmation scope đặt trong re-auth token hoặc dùng `POST /.../deletion-requests` nếu cần payload.

`clearHealth` phải transactionally xử lý meal logs, water logs, measurements, activity, targets và derived caches theo scope đã công bố. Implementation hiện chỉ meal logs/water nên chưa đúng kỳ vọng “Xóa dữ liệu sức khỏe”.

### Account deletion

- `POST /v1/me/account-deletion-requests` với re-auth và idempotency.
- `GET /v1/me/account-deletion-request` lấy trạng thái/grace end.
- `DELETE /v1/me/account-deletion-request` hủy trong grace period sau re-auth.

Chỉ được có một request active/user. Khi request được xác nhận, revoke session theo policy, chặn hoặc giới hạn login rõ ràng, purge/anonymize theo retention/legal obligations và xóa object storage liên quan. Không hứa “xóa ngay khỏi mọi backup” nếu hạ tầng không đáp ứng.

## 19. Database thay đổi tối thiểu

### Profile

Bổ sung hoặc chuẩn hóa:

- `usernameNormalized` unique case-insensitive; quyết định nguồn sự thật giữa `Account.username` và `Profile`.
- `bio` varchar/text giới hạn.
- `avatarMediaId` FK thay vì chỉ `avatarUrl`.
- `regionId` FK.
- `activityLevel` enum.
- Không nên đặt `targetWeightKg` trong profile nếu đã có versioned HealthTarget; có thể thêm target type vào HealthTarget.

### Media

`UserMedia`: owner, purpose `AVATAR`, objectKey, mime, bytes, dimensions, checksum, moderation/scan status, variants, createdAt, deletedAt. Unique object key; upload path chứa user ID + media UUID, không dùng filename người dùng.

### Preferences

- `UserSelectionPriority(userId, code, weight)` unique.
- `UserAvoidedIngredient` thêm `ingredientId`, `normalizedText`, `mode`, `reasonCode`, `resolutionStatus`.
- `UserDietType` dùng hard/soft rõ ràng; không trộn cuisine/taste với diet safety.

### Journey

- `AchievementDefinition` có code/version/rule metadata.
- `UserAchievement` unique `(userId, achievementId)` với `earnedAt` bền vững.
- Monthly goal nếu configurable cần `UserMonthlyGoal` hoặc policy version; không hard-code 60/10/31 trong response.

### Settings/privacy

`UserSetting` bổ sung notification categories và privacy fields đúng UI. `UserConsent` append-only cho consent có yêu cầu bằng chứng. `PrivacyJob` thêm idempotency key, progress, safe error code, started/finished time, result media key và active-request constraints.

## 20. Tính toán và quy tắc nghiệp vụ

### Counter

- Published posts: chỉ post published/visible, không gồm draft/deleted/rejected.
- Saved dishes: relation còn tồn tại; có thể gồm unavailable nhưng UI phải đánh dấu.
- Followers: unique active follow relation; cấm self-follow.
- Meal logs: exclude soft-deleted.
- New dishes: distinct dish identity theo definition version.

### Progress ratio

```text
ratio = target > 0 ? min(current / target, 1) : null
```

Trả thêm raw `current` và `target` để UI không suy ngược từ phần trăm. Nếu vượt target, có thể trả `rawRatio > 1` và `displayRatio=1`.

### Timezone

- Date-only (`dateOfBirth`) không convert timezone.
- Event instant lưu UTC; đồng thời lưu local date/timezone cần cho lịch sử.
- Month query xác định `[startInclusive,endExclusive)` từ timezone yêu cầu, rồi query instant range hoặc localDate đã materialize.

### Data coverage

Mọi metric derived từ nguồn không đầy đủ trả `coverage` và `status=COMPLETE|PARTIAL|NO_DATA`. Không biến no-data thành “đạt 0”.

## 21. Cache, hiệu năng và observability

- Profile dashboard p95 mục tiêu ≤ 400 ms khi cache warm, ≤ 800 ms khi cold ở region chính.
- List p95 ≤ 500 ms chưa tính tải media.
- Avatar finalize là async nếu scan/resize vượt 1 giây.
- Cache key dashboard gồm user ID, localDate, timezone và relevant version.
- Invalidate counter projection sau save/unsave, publish/delete post, follow/unfollow, meal log và random selection.
- Log chỉ request ID, route, latency, safe error code; không log DOB, health payload, bio, token hoặc signed URL.
- Metrics: error rate theo endpoint/code, version conflict rate, export/delete job latency, upload rejection reason, journey coverage.

## 22. Rate limits đề xuất

Các con số phải điều chỉnh bằng telemetry, nhưng baseline:

- Profile/settings update: 30/phút/user.
- Username availability/update: 10/phút; update có cooldown product-defined.
- Ingredient search: 60/phút/user với debounce client.
- Avatar intents: 10/giờ/user; finalize theo media ID idempotent.
- Export: 3/ngày/user, chỉ một active job.
- Account deletion: 3/ngày/user, một active request.
- Password/re-auth: theo auth security policy, chặt hơn endpoint thông thường.

Response 429 có `Retry-After` và error code ổn định.

## 23. Trạng thái Mobile bắt buộc phải hỗ trợ

BE contract phải cho phép mobile phân biệt:

- First load: skeleton ổn định, không nháy mock.
- Refresh: giữ dữ liệu cũ, hiển thị refresh state.
- Empty: chưa có bài/món/log/achievement; có CTA phù hợp.
- Partial: một section dashboard tạm unavailable.
- Offline: dữ liệu cache phải ghi nhận `updatedAt`; không giả là realtime.
- Save/update: button loading/disabled, success feedback, inline field errors.
- Version conflict: cho reload/merge, không ghi đè im lặng.
- Avatar processing/rejected: vẫn hiển thị avatar cũ và recovery action.
- Sensitive action: confirm → re-auth → processing → success/error.

Interactive response phải có dữ liệu cho accessibility state; icon button ở mobile cần label, toggle cần announce state. Đây là trách nhiệm mobile, nhưng BE phải trả enum/boolean rõ để UI không suy từ text.

## 24. Tiêu chí nghiệm thu API

### Profile main/edit

- Không còn chuỗi/số mock trong Profile main.
- Dashboard counters khớp query nguồn trong test fixture.
- Public DTO không lộ DOB/health/private preference.
- Username unique không phân biệt hoa thường; race đồng thời chỉ một request thành công.
- Hai PATCH cùng ETag không thể cùng thành công.
- Avatar giả MIME, quá cỡ, sai checksum hoặc không đúng owner bị từ chối.

### Journey/health

- Month và streak đúng qua DST/timezone boundary; riêng `Asia/Ho_Chi_Minh` vẫn test local midnight.
- Journey totals chỉ thuộc tháng query.
- Achievement GET không thay đổi `earnedAt`.
- BMI null khi thiếu input; không tạo target mặc định giả khi thiếu dữ liệu.
- Measurement mới cập nhật latest cache và invalidates health day/target khi cần.

### Preferences/avoid

- Update batch invalid ID rollback toàn bộ.
- `noKnownAllergies` và allergen list không cùng tồn tại.
- Avoid ingredient matched bằng ID; free text được normalize/dedupe.
- Hard safety change đánh dấu plan liên quan cần recheck.

### Lists

- Cursor không trùng/bỏ item khi nhiều record cùng timestamp.
- Saved filter trả đủ image/kcal/time/price status.
- Random summary có mẫu số/definition ổn định.
- My posts phân biệt published/draft/saved và owner authorization.

### Privacy/security

- Export/delete/clear/revoke-all yêu cầu recent re-auth.
- User A không đọc job/session/media của user B.
- Export URL private, ngắn hạn; expired URL không dùng được.
- Account deletion request idempotent, có status/cancel và một active request.
- Clear health xử lý đúng toàn bộ scope đã công bố và invalidates derived caches.

## 25. Lộ trình triển khai đề xuất

### P0 — Loại dữ liệu giả khỏi Profile main

1. Hoàn thiện `GET /v1/me/profile-dashboard`.
2. Chuẩn hóa `GET /v1/profile/me` và typed mobile DTO.
3. Nối saved/random/posts/diary preview vào endpoint domain thật.
4. Thêm loading/empty/error, không fallback mock.

### P1 — Edit, avatar, preferences và health

1. Migration username/bio/region/avatar media.
2. Atomic optimistic concurrency.
3. Avatar intent/finalize pipeline.
4. Transactional preference update và catalog-linked avoidance.
5. Measurement history, BMI applicability và health target provenance.

### P2 — Journey, settings và lists

1. Sửa journey monthly query/day status/achievement persistence.
2. Mở rộng settings theo UI và tách device-only.
3. Search/filter/cursor cho saved, random history và my posts.

### P3 — Privacy production readiness

1. Re-auth proof flow.
2. Async export thật và private signed download.
3. Clear-data scope đầy đủ.
4. Account deletion status/cancel/worker/retention.
5. Audit, rate limit, monitoring và privacy/legal review.

## 26. Nguồn tham khảo và quyết định áp dụng

- [RFC 9110 — HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html): áp dụng ETag/`If-Match` để tránh lost update; precondition sai dùng `412 Precondition Failed` trong contract đích.
- [RFC 9457 — Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html): áp dụng `application/problem+json`, type URI, status, detail và extension `code/errors` máy đọc được.
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html): áp dụng allowlist loại file, giới hạn kích thước, đổi tên/object key, kiểm tra nội dung và lưu tách biệt.
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html): áp dụng recent re-auth cho thao tác nhạy cảm và quản lý session an toàn.
- [Supabase Standard Uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads): dùng unique object path, tránh overwrite để không gặp CDN stale/race; avatar nhỏ phù hợp standard upload.
- [Supabase Storage access control](https://supabase.com/docs/guides/storage): dùng bucket/RLS và signed upload/download; service key không đưa xuống mobile.
- [WHO — Obesity and overweight](https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight): công thức BMI `kg/m²` và lưu ý phân loại thay đổi theo nhóm tuổi; áp dụng BMI chỉ như screening indicator có eligibility/disclaimer.
- [Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15](https://vanban.chinhphu.vn/?docid=214590&pageid=27160): có hiệu lực từ 2026-01-01; profile, health, export, consent và deletion phải được privacy/legal review theo phạm vi vận hành thực tế.
- [React Native Accessibility](https://reactnative.dev/docs/accessibility): mobile phải cung cấp role/label/state cho icon, toggle và feedback; BE trả state có cấu trúc thay vì text trình bày.

Các nguồn y tế dùng để định nghĩa dữ liệu và disclaimer, không thay thế thẩm định chuyên môn. Các yêu cầu pháp lý trong tài liệu là baseline kỹ thuật, không phải ý kiến pháp lý.

## 27. Definition of Done để bàn giao BE

BE chỉ coi phần Profile hoàn tất khi:

1. OpenAPI chứa schema cụ thể cho toàn bộ endpoint P0/P1, không còn `Record<string, unknown>` ở mobile client.
2. Contract test sinh từ OpenAPI chạy trong CI.
3. Integration test bao phủ owner authorization, concurrency, cursor, timezone, avatar validation và privacy jobs.
4. Mobile không còn render bất kỳ số/tên/ảnh sức khỏe mock nào khi API lỗi hoặc no-data.
5. Migration có backfill/rollback plan và không mất preference hiện tại.
6. Dashboard, list và jobs đạt SLO đã chốt bằng load test.
7. Security/privacy review ký duyệt trước khi bật export và account deletion ở production.

Phần quản trị tài khoản phía Admin được tách riêng tại [ADMIN_USER_MANAGEMENT_API_SPEC.md](./ADMIN_USER_MANAGEMENT_API_SPEC.md). Admin user DTO không được tái sử dụng private mobile profile DTO vì hai đối tượng có quyền xem field khác nhau.
