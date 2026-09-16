# Đặc tả Admin User Management API

> Phiên bản: 1.0  
> Ngày đối chiếu source: 2026-09-15  
> Phạm vi: trang `admin/src/pages/UsersPage.tsx`, tài khoản người dùng, quyền truy cập, phiên đăng nhập và audit  
> Đối tượng sử dụng: Backend, Admin frontend, QA, Security, Privacy và Product

## 1. Có cần xây API quản lý người dùng không?

**Có**, vì Admin đã có trang Người dùng và hệ thống đã có account status, role, session, audit, community và privacy workflow. Khi có người dùng thật, tối thiểu phải có khả năng:

- Tìm tài khoản để hỗ trợ đăng nhập/xác minh.
- Xem trạng thái tài khoản và hoạt động bảo mật ở mức tối thiểu cần thiết.
- Gửi luồng đặt lại mật khẩu an toàn.
- Thu hồi phiên khi có rủi ro.
- Hạn chế và khôi phục tài khoản theo lý do có audit.
- Quản lý quyền Admin theo nguyên tắc least privilege.
- Theo dõi lịch sử hành động quản trị.

Tuy nhiên, Admin User Management **không đồng nghĩa** với quyền xem hoặc sửa mọi dữ liệu của người dùng. Admin thông thường không được:

- Xem chi tiết cân nặng, chiều cao, ngày sinh, bệnh lý, nhật ký bữa ăn hoặc dị ứng nếu không có purpose và permission chuyên biệt.
- Đổi trực tiếp mật khẩu rồi đọc/gửi mật khẩu tạm cho người dùng.
- Sửa goal, preference, saved dishes hay health target thay người dùng.
- Đánh dấu email đã xác minh thủ công nếu chưa có một quy trình chứng minh danh tính.
- Hard-delete account bằng một nút không có grace period, re-auth và audit.
- Tự cấp quyền ngang/cao hơn quyền của chính mình.

Dòng mô tả hiện tại trong UI “Quản lý tài khoản, sức khỏe và quyền truy cập” nên đổi thành **“Quản lý tài khoản và quyền truy cập”**. Sức khỏe là dữ liệu nhạy cảm và không cần cho tác vụ hỗ trợ tài khoản thông thường.

## 2. Hiện trạng dự án

### 2.1 Admin frontend

`UsersPage.tsx` có comment `TODO: connect API` và toàn bộ dữ liệu đang hard-code:

- 28.450 người dùng, 1.286 hoạt động hôm nay, 348 tài khoản mới, 17 bị hạn chế.
- Danh sách tên/email, mục tiêu, trạng thái, lần hoạt động cuối và ngày tham gia.
- Drawer chi tiết chứa email, goal, dị ứng, verification, saved count, random count và ba món đã lưu.
- Nút tìm kiếm, lọc trạng thái, lọc mục tiêu, xuất dữ liệu, xem hồ sơ và hạn chế tài khoản chưa gọi API.

Route `/users` hiện chỉ hiện cho `SUPER_ADMIN`. Đây là giới hạn an toàn cho MVP, nhưng không đủ cho vận hành dài hạn nếu nhân viên hỗ trợ cần một phần chức năng.

### 2.2 Backend

Backend hiện chỉ có:

```http
POST /v1/admin/accounts/:userId/reset-password
```

Endpoint này:

- Chỉ cho `SUPER_ADMIN`.
- Nhận `temporaryPassword` do Admin nhập.
- Dùng Supabase Admin API để đổi password trực tiếp.
- Sign out toàn bộ session.
- Đánh dấu `mustChangePassword=true` trong bảng `Account`.
- Ghi event `TEMP_PASSWORD_ISSUED`.

Đây không nên là luồng mặc định production. Admin biết mật khẩu tạm của người dùng và việc đổi password qua Admin API được áp dụng trực tiếp, không có confirmation flow. Contract đích nên gửi password-recovery link/token một lần cho chính người dùng.

### 2.3 Schema hiện có

Có thể tái sử dụng:

- `Profile.accountStatus`: `PENDING_VERIFICATION`, `ACTIVE`, `LOCKED`, `SUSPENDED`, `DELETED`.
- `Account`: username, lock counters, `mustChangePassword`, token version.
- `RefreshSession`: device label, platform, last used, revoked time.
- `ProfileRole`: role của tài khoản.
- `AuthAuditLog`: audit auth hiện tại.
- `PrivacyJob`: export/delete/clear data.
- Các relation count như saved dish, random history, posts và followers.

Phần còn thiếu:

- Không có controller/service list/detail/search user.
- Không có restriction record lưu lý do, thời hạn, actor và history.
- Không có admin action audit tổng quát.
- Không có user list export job.
- Không có permission model chi tiết theo chức năng.
- `LOCKED`, `SUSPENDED`, deletion workflow chưa có state transition contract rõ.

## 3. Phạm vi MVP và phạm vi không nên làm

### 3.1 MVP bắt buộc

- Dashboard summary.
- User list có search/filter/cursor.
- Support-safe user detail.
- Gửi email xác minh lại.
- Gửi password reset link.
- List/revoke sessions.
- Suspend/reinstate với reason, duration và audit.
- Audit log cho từng user.
- Export danh sách vận hành theo filter, không chứa health data.

### 3.2 Giai đoạn sau

- Tách role `ACCOUNT_SUPPORT`, `TRUST_SAFETY`, `SECURITY_ADMIN`, `PRIVACY_ADMIN`.
- Case/ticket ID bắt buộc khi mở PII nhạy cảm.
- Approval hai người cho role escalation hoặc permanent deletion.
- Risk signals, bulk actions có kiểm soát và SIEM integration.

### 3.3 Không đưa vào User Management mặc định

- Sửa health profile, allergy, meal logs, weekly plan hoặc recommendation settings.
- Xem danh sách món người dùng đã lưu trong drawer mặc định.
- Impersonate/“đăng nhập với tư cách user”.
- Download toàn bộ dữ liệu cá nhân từ nút export danh sách.
- Hard delete Supabase user ngay lập tức.
- Generic endpoint nhận tùy ý `accountStatus`, `roles` hoặc metadata.

## 4. Mô hình authorization

### 4.1 Nguyên tắc

- Deny by default.
- Kiểm tra permission ở backend trên mọi endpoint; ẩn menu frontend không phải authorization.
- Permission theo action, không chỉ theo tên role.
- Field-level authorization: có quyền xem list không có nghĩa được xem email đầy đủ hoặc audit chi tiết.
- Tác vụ nhạy cảm yêu cầu recent re-auth/MFA.
- Admin không được tác động lên chính mình đối với suspend, role removal, revoke-all hoặc delete.
- Không được suspend/xóa Admin cuối cùng có quyền `SUPER_ADMIN`.

### 4.2 Permission đề xuất

```text
users.read.list
users.read.detail
users.read.pii
users.read.security
users.send.verification
users.send.password_reset
users.sessions.revoke
users.suspensions.create
users.suspensions.end
users.locks.release
users.roles.read
users.roles.manage
users.audit.read
users.export.operational
users.privacy_cases.read
```

### 4.3 Mapping role đề xuất

MVP:

- `SUPER_ADMIN`: tất cả permission, nhưng vẫn cần re-auth/MFA và self/last-admin guard.
- `CONTENT_ADMIN`, `REVIEWER`: không có quyền user management.

Khi mở rộng:

- `ACCOUNT_SUPPORT`: list/detail tối thiểu, gửi verification/reset; không suspend hoặc quản lý role.
- `TRUST_SAFETY`: suspend/reinstate và xem moderation-related evidence; không xem health.
- `SECURITY_ADMIN`: session, lock và security audit.
- `PRIVACY_ADMIN`: privacy request/job theo case; không được tự do duyệt hành vi ăn uống.

## 5. Quy ước API

- Base URL: `/v1/admin`.
- Bearer token của Admin; access token sống ngắn.
- Management API production SHOULD chạy trên admin host riêng, CORS allowlist cụ thể, MFA bắt buộc.
- Response có `X-Request-Id`.
- Mutation có `Idempotency-Key` khi tạo action/job.
- Resource versioned dùng `ETag` và `If-Match`.
- List dùng opaque cursor `(sortValue,id)`, không so sánh thứ tự UUID.
- Error dùng `application/problem+json` và `code` máy đọc được.
- Timestamp ISO-8601 UTC; filter dashboard nhận timezone IANA.
- Không gửi service-role/secret key xuống Admin browser. Mọi Supabase Admin API chỉ chạy server-side.

## 6. Dashboard summary

### `GET /v1/admin/users/summary`

Query:

```text
from=2026-09-08
to=2026-09-15
timezone=Asia/Ho_Chi_Minh
compare=PREVIOUS_PERIOD
```

Response:

```json
{
  "period": {
    "from": "2026-09-08",
    "toExclusive": "2026-09-15",
    "timezone": "Asia/Ho_Chi_Minh"
  },
  "metrics": {
    "totalUsers": 28450,
    "activeUsersToday": 1286,
    "newUsers": 348,
    "restrictedUsers": 17
  },
  "comparison": {
    "activeUsersToday": { "absoluteChange": 98, "percentChange": 0.083 },
    "newUsers": { "absoluteChange": 47, "percentChange": 0.157 },
    "restrictedUsers": { "absoluteChange": 3, "percentChange": 0.214 }
  },
  "definitions": {
    "activeUser": "AUTH_OR_MEANINGFUL_EVENT",
    "restrictedUser": "ACTIVE_SUSPENSION_OR_SECURITY_LOCK",
    "version": "admin-user-metrics-v1"
  },
  "generatedAt": "2026-09-15T04:00:00.000Z"
}
```

Quy tắc:

- `totalUsers`: account không hard-deleted tại thời điểm snapshot.
- `activeUsersToday`: distinct user có login thành công hoặc event nghiệp vụ allowlist trong local date; không đếm mỗi API request.
- `newUsers`: account created trong `[from,toExclusive)`.
- `restrictedUsers`: có active suspension hoặc security lock; trả breakdown riêng nếu UI cần.
- Khi previous value bằng 0, `percentChange=null`; không chia cho 0.
- Không hard-code nhãn “so với hôm qua/tuần trước”; response phải trả period so sánh.

## 7. Danh sách người dùng

### `GET /v1/admin/users`

Query đề xuất:

```text
q=
status=ACTIVE|LOCKED|SUSPENDED|PENDING_VERIFICATION|DELETION_PENDING
emailVerified=true|false
primaryGoalCode=
role=
createdFrom=
createdTo=
lastActiveFrom=
lastActiveTo=
sort=CREATED_AT_DESC|LAST_ACTIVE_DESC|DISPLAY_NAME_ASC
cursor=
limit=20
```

Search:

- `q` trim, giới hạn 2–100 ký tự.
- Search exact/prefix trên normalized username/email; search display name qua trigram/full text nếu cần.
- Email search chỉ dành cho permission `users.read.pii`.
- Rate-limit và audit query chứa exact email.
- Không trả kết quả fuzzy email quá rộng.

Response:

```json
{
  "items": [
    {
      "userId": "uuid",
      "displayName": "Hương Giang",
      "username": "huonggiang",
      "avatarUrl": "https://cdn.example/avatar.webp",
      "email": "hu***@example.com",
      "emailMasked": true,
      "primaryGoal": { "code": "LOSE_WEIGHT", "name": "Giảm cân" },
      "accountStatus": "ACTIVE",
      "restriction": null,
      "emailVerified": true,
      "lastActiveAt": "2026-09-15T03:58:00Z",
      "joinedAt": "2024-01-12T08:00:00Z",
      "version": 7,
      "availableActions": ["VIEW", "SEND_PASSWORD_RESET", "SUSPEND"]
    }
  ],
  "pageInfo": {
    "nextCursor": "opaque-base64url",
    "hasNextPage": true
  }
}
```

`availableActions` do backend tính từ permission + target state + self/last-admin guard. Frontend dùng để disable/hide action, nhưng mutation vẫn phải authorize lại.

## 8. Chi tiết tài khoản an toàn cho support

### `GET /v1/admin/users/:userId`

Response mặc định:

```json
{
  "userId": "uuid",
  "identity": {
    "displayName": "Hương Giang",
    "username": "huonggiang",
    "avatarUrl": "https://cdn.example/avatar.webp",
    "email": "hu***@example.com",
    "emailMasked": true,
    "emailVerified": true
  },
  "account": {
    "status": "ACTIVE",
    "createdAt": "2024-01-12T08:00:00Z",
    "lastLoginAt": "2026-09-15T03:58:00Z",
    "lastActiveAt": "2026-09-15T04:01:00Z",
    "mustChangePassword": false,
    "failedLoginAttempts": 0,
    "lockedUntil": null,
    "version": 7
  },
  "access": {
    "roles": ["USER"],
    "activeSessionCount": 2
  },
  "productSummary": {
    "onboardingStatus": "COMPLETED",
    "primaryGoal": { "code": "LOSE_WEIGHT", "name": "Giảm cân" },
    "savedDishCount": 23,
    "randomRunCount": 156,
    "publishedPostCount": 4
  },
  "activeRestriction": null,
  "availableActions": ["SEND_PASSWORD_RESET", "REVOKE_SESSIONS", "SUSPEND"]
}
```

Field policy:

- Email masked mặc định. Endpoint/option reveal PII cần `users.read.pii`, re-auth và purpose/case ID.
- Goal có thể hiển thị như product metadata nếu thật sự cần filter/support; không trả allergy, BMI, weight, height, health target hoặc meal diary.
- Chỉ trả counter; không tải mặc định ba món đã lưu như mock UI.
- Không trả raw IP, user-agent, access token, refresh token, password hash, auth provider metadata hoặc internal Supabase object.
- `GET` đọc chi tiết PII cũng phải audit nếu reveal unmasked data.

## 9. Reveal PII có kiểm soát

Nếu nghiệp vụ support cần email đầy đủ:

### `POST /v1/admin/users/:userId/pii-access-grants`

```json
{
  "purposeCode": "ACCOUNT_RECOVERY_SUPPORT",
  "caseId": "SUP-2026-001234",
  "fields": ["EMAIL"]
}
```

Yêu cầu recent re-auth/MFA. Response là grant token scope-bound, sống ngắn, one-time hoặc thời hạn vài phút. Không dùng query `?includeSensitive=true` không có purpose.

MVP nhỏ có thể chưa làm grant resource, nhưng vẫn phải giới hạn `users.read.pii` cho Super Admin và audit mọi response email đầy đủ.

## 10. Email verification

### `POST /v1/admin/users/:userId/email-verification-reminders`

Header `Idempotency-Key`.

```json
{
  "reasonCode": "USER_REQUESTED_SUPPORT",
  "caseId": "SUP-2026-001234"
}
```

Response `202`:

```json
{
  "status": "QUEUED",
  "nextAllowedAt": "2026-09-15T04:10:00Z"
}
```

- Không cho Admin tự set `emailVerified=true` trong luồng thông thường.
- Rate-limit theo target account, actor và IP để tránh spam.
- UI thông báo trung tính; không đưa verification token vào response.

## 11. Password recovery cho Admin support

### Contract đích

```http
POST /v1/admin/users/:userId/password-reset-requests
```

```json
{
  "reasonCode": "USER_REQUESTED_SUPPORT",
  "caseId": "SUP-2026-001234",
  "revokeSessions": true
}
```

Response `202`:

```json
{
  "status": "QUEUED",
  "deliveryChannel": "EMAIL",
  "destinationMasked": "hu***@example.com",
  "expiresAt": "2026-09-15T05:00:00Z"
}
```

Quy tắc:

- Admin không nhập, đọc hoặc nhận password mới/password tạm.
- Token reset random, single-use, expire, gắn với user và lưu hash nếu tự quản lý.
- Reset link chỉ dùng redirect URL allowlist HTTPS.
- Gửi notification xác nhận sau khi password thay đổi.
- Rate-limit theo actor + target + IP; audit request và kết quả delivery.
- `revokeSessions=true` phải được policy xác định; có thể revoke khi reset hoàn tất thay vì ngay lúc gửi mail để tránh DoS.

Endpoint cũ `/admin/accounts/:userId/reset-password`:

- Đánh dấu deprecated ngay khi contract mới sẵn sàng.
- Không dùng cho user bình thường ở production.
- Nếu tạm giữ cho break-glass, bắt buộc MFA, reason/case, approval, audit, TTL, secure delivery; tuyệt đối không log password.

## 12. Session management

### `GET /v1/admin/users/:userId/sessions`

Permission `users.read.security`.

```json
{
  "items": [
    {
      "sessionId": "uuid",
      "deviceLabel": "Samsung Galaxy S24",
      "platform": "ANDROID",
      "createdAt": "2026-09-10T08:00:00Z",
      "lastUsedAt": "2026-09-15T03:58:00Z",
      "expiresAt": "2026-10-10T08:00:00Z",
      "status": "ACTIVE"
    }
  ]
}
```

### `POST /v1/admin/users/:userId/session-revocations`

```json
{
  "scope": "ALL",
  "sessionIds": [],
  "reasonCode": "SUSPECTED_COMPROMISE",
  "caseId": "SEC-2026-0042"
}
```

- `scope=SELECTED|ALL`.
- Idempotent và có audit.
- Không trả token hash.
- Khi revoke Supabase sessions, cần hiểu access JWT đã phát có thể còn hợp lệ đến `exp`; sensitive endpoint phải kiểm session/account status hoặc token version nếu cần chặn ngay.

## 13. Suspend, reinstate và security lock

Không dùng `PATCH /users/:id { accountStatus: ... }`. Dùng resource/action rõ nghĩa.

### `POST /v1/admin/users/:userId/suspensions`

Header: `Idempotency-Key`, `If-Match` account version, re-auth token.

```json
{
  "reasonCode": "COMMUNITY_POLICY_VIOLATION",
  "reasonNote": "Case moderation MOD-2026-1187",
  "caseId": "MOD-2026-1187",
  "startsAt": "2026-09-15T04:00:00Z",
  "endsAt": "2026-09-22T04:00:00Z",
  "revokeSessions": true,
  "notifyUser": true
}
```

Response `201`:

```json
{
  "suspensionId": "uuid",
  "userId": "uuid",
  "status": "ACTIVE",
  "reasonCode": "COMMUNITY_POLICY_VIOLATION",
  "startsAt": "2026-09-15T04:00:00Z",
  "endsAt": "2026-09-22T04:00:00Z",
  "accountVersion": 8
}
```

### `POST /v1/admin/users/:userId/suspensions/:suspensionId/end`

```json
{
  "reasonCode": "APPEAL_APPROVED",
  "caseId": "APL-2026-0088"
}
```

### Security lock

`LOCKED` do auth/risk engine tạo khi login abuse hoặc compromise. Không gộp với policy suspension.

`POST /v1/admin/users/:userId/security-unlocks` chỉ dành cho `users.locks.release`, yêu cầu đã giải quyết risk/case và recent re-auth.

State rules:

- `PENDING_VERIFICATION → ACTIVE`: qua verification flow.
- `ACTIVE → SUSPENDED`: active suspension.
- `SUSPENDED → ACTIVE`: suspension kết thúc và không còn restriction khác.
- `ACTIVE|SUSPENDED → LOCKED`: security control; unlock không tự xóa policy suspension.
- Deletion pending/deleted thuộc privacy workflow, không phải suspension.
- `DELETED` là terminal ở business view; restore chỉ theo backup/legal incident procedure, không phải nút UI thường.

## 14. Role management

### Read roles

`GET /v1/admin/users/:userId/roles`

### Assign

`PUT /v1/admin/users/:userId/roles/:role`

```json
{
  "reasonCode": "TEAM_ASSIGNMENT",
  "ticketId": "IAM-2026-0123",
  "expiresAt": null
}
```

### Revoke

`DELETE /v1/admin/users/:userId/roles/:role` với confirmation/re-auth payload qua action request nếu client/proxy không hỗ trợ DELETE body.

Guard bắt buộc:

- Chỉ permission `users.roles.manage`.
- Không self-escalate.
- Không cấp role cao hơn actor.
- Không xóa `SUPER_ADMIN` cuối cùng.
- Role thay đổi phải invalidate/reissue authorization context; không chờ JWT cũ hết hạn nếu permission nhạy cảm.
- Có thể yêu cầu approval hai người cho `SUPER_ADMIN`.
- Audit before/after roles, ticket, actor và result; không log token.

## 15. Audit log

### `GET /v1/admin/users/:userId/audit-events`

Query: `eventType`, `actorId`, `from`, `to`, `cursor`, `limit`.

```json
{
  "items": [
    {
      "eventId": "uuid",
      "eventType": "USER_SUSPENDED",
      "targetUserId": "uuid",
      "actor": { "id": "uuid", "displayName": "Admin A" },
      "reasonCode": "COMMUNITY_POLICY_VIOLATION",
      "caseId": "MOD-2026-1187",
      "result": "SUCCESS",
      "occurredAt": "2026-09-15T04:00:01Z",
      "requestId": "uuid",
      "changes": {
        "accountStatus": { "from": "ACTIVE", "to": "SUSPENDED" }
      }
    }
  ],
  "pageInfo": { "nextCursor": null, "hasNextPage": false }
}
```

`AuthAuditLog` hiện có thể giữ auth events, nhưng nên thêm `AdminActionAudit` hoặc audit envelope chung có `actorId`, `targetType`, `targetId`, action, reason, case, before/after sanitized, result và request ID.

Audit phải append-only, chống sửa trái phép và có retention/policy. Không ghi password, reset token, access/refresh token, health payload, raw IP hoặc signed URL.

## 16. Xuất danh sách người dùng

Nút “Xuất dữ liệu” trên trang list phải được đổi nhãn thành **“Xuất danh sách”** để không nhầm với data-subject export của từng user.

### `POST /v1/admin/user-list-exports`

Header `Idempotency-Key`, recent re-auth.

```json
{
  "filters": {
    "status": ["SUSPENDED"],
    "createdFrom": "2026-09-01",
    "createdTo": "2026-09-15"
  },
  "columns": [
    "userId",
    "displayName",
    "username",
    "accountStatus",
    "joinedAt",
    "lastActiveAt"
  ],
  "format": "CSV",
  "reasonCode": "OPERATIONS_REVIEW"
}
```

Response `202` có job ID. `GET /v1/admin/user-list-exports/:jobId` trả signed download URL ngắn hạn khi READY.

Không cho client yêu cầu cột arbitrary. Backend dùng column allowlist theo permission. Mặc định không export email đầy đủ, DOB, health, allergy, saved dishes, meal history hoặc token/session data. Export action và download phải audit.

## 17. Account deletion và privacy request

Admin User Management chỉ hiển thị trạng thái privacy workflow:

- `NONE`
- `PENDING_GRACE`
- `CANCELLED`
- `PROCESSING`
- `COMPLETED`
- `FAILED_REVIEW_REQUIRED`

Admin không hard-delete trực tiếp từ drawer. Nếu cần hỗ trợ request:

- `GET /v1/admin/users/:userId/privacy-cases` với permission chuyên biệt.
- `POST /v1/admin/privacy-cases/:caseId/actions` theo action allowlist và dual approval nếu cần.

Việc xóa Supabase Auth user phải diễn ra ở deletion worker sau khi xử lý storage ownership, retention/legal hold và dữ liệu liên quan. Đánh dấu `Profile.accountStatus=DELETED` không tự động vô hiệu toàn bộ JWT đã phát.

## 18. Database thay đổi đề xuất

### `AccountRestriction`

```text
id
userId
type = POLICY_SUSPENSION | SECURITY_LOCK | FEATURE_RESTRICTION
status = SCHEDULED | ACTIVE | ENDED | CANCELLED
reasonCode
reasonNoteEncrypted/null
caseId/null
startsAt
endsAt/null
createdBy
endedBy/null
endedAt/null
endReasonCode/null
createdAt
version
```

Index:

- `(userId,status,startsAt,endsAt)`.
- Partial unique cho một active restriction cùng type nếu policy yêu cầu.
- `(caseId)` khi có ticket integration.

### `AdminActionAudit`

```text
id
actorUserId
targetType
targetId
action
reasonCode
caseId/null
requestId
result
beforeSanitized/null
afterSanitized/null
ipHash/null
userAgentHash/null
occurredAt
```

### `AdminExportJob`

Owner actor ID, filters snapshot, column allowlist snapshot, status/progress, storage key, checksum, expiry, download count và error code an toàn.

### Admin permissions

Nếu chưa cần permission tables, giữ role guard cho MVP. Khi mở rộng, thêm permission catalog và role-permission mapping; không nhét danh sách permission tùy ý do client gửi vào JWT.

## 19. Transaction và concurrency

- Suspend: tạo restriction + đổi derived account status + revoke sessions + outbox notification + audit trong transaction/outbox boundary phù hợp.
- Reinstate: end restriction; chỉ set ACTIVE nếu không còn restriction/lock/deletion state khác.
- Role assign/revoke: compare version, guard last-admin, mutate và audit atomically.
- Counter dashboard là projection/cache; không update tay từ client.
- Idempotency record gắn actor, path/action, request hash và expiry. Cùng key khác body trả 409.
- Hai Admin cùng suspend một user không được tạo hai active suspension ngoài ý muốn.

## 20. Error codes

Các code tối thiểu:

```text
ADMIN_PERMISSION_DENIED
ADMIN_REAUTH_REQUIRED
ADMIN_MFA_REQUIRED
USER_NOT_FOUND
USER_VERSION_CONFLICT
USER_ALREADY_SUSPENDED
USER_NOT_SUSPENDED
USER_SECURITY_LOCK_ACTIVE
INVALID_STATE_TRANSITION
SELF_ACTION_NOT_ALLOWED
LAST_SUPER_ADMIN_GUARD
ROLE_ESCALATION_NOT_ALLOWED
PASSWORD_RESET_RATE_LIMITED
VERIFICATION_RATE_LIMITED
SESSION_ALREADY_REVOKED
EXPORT_COLUMN_NOT_ALLOWED
EXPORT_TOO_LARGE
PRIVACY_CASE_REQUIRED
IDEMPOTENCY_KEY_REUSED
```

Không trả raw Supabase/provider error ra browser. Map sang code ổn định, log provider error ở server với request ID và loại secret/PII.

## 21. Rate limit baseline

Con số phải hiệu chỉnh bằng telemetry:

- User list/search: 120 request/phút/actor; exact PII search thấp hơn và audit.
- User detail: 120/phút; PII reveal 20/giờ.
- Verification/password reset: 5/giờ/target và 30/giờ/actor.
- Suspend/reinstate/unlock: 30/giờ/actor.
- Session revocation: 30/giờ/actor.
- Role change: 10/giờ/actor.
- Export: 3 active/ngày/actor, giới hạn row và file size.

429 trả `Retry-After`.

## 22. Yêu cầu UI Admin tương ứng

- Không hiển thị mock nếu API lỗi; dùng skeleton, empty state và retry.
- Search debounce 300–500 ms và cancel request cũ.
- Filter được phản ánh trên URL để reload/back giữ trạng thái.
- Table dùng server pagination; không tải toàn bộ user về browser.
- Drawer chỉ fetch detail khi mở.
- Email masked mặc định.
- “Hạn chế tài khoản” mở dialog có reason, duration, case ID, impact và confirmation.
- Destructive/sensitive action hiển thị target identity rõ, yêu cầu re-auth khi server yêu cầu.
- Không dùng toggle cho suspension/roles; action phải có confirmation và result rõ.
- Button disabled/loading trong lúc submit, không gửi lặp.
- Version conflict yêu cầu reload state; không overwrite im lặng.
- Saved dish preview hiện tại nên bỏ khỏi drawer mặc định hoặc chuyển thành count.
- Tất cả icon button có accessible label; menu/action hỗ trợ keyboard và focus management.

## 23. Tiêu chí nghiệm thu

### Authorization

- USER/CONTENT_ADMIN/REVIEWER bị 403 trên mọi endpoint user admin.
- Permission thiếu field PII chỉ nhận email masked.
- Frontend sửa `availableActions` không bypass được backend.
- Admin không suspend/revoke role chính mình hoặc xóa Super Admin cuối cùng.
- Mọi route/method đều được test deny-by-default.

### List/detail

- Search/filter/sort kết hợp đúng, cursor không trùng/bỏ item cùng timestamp.
- Stats có period/definition; phần trăm null khi denominator bằng 0.
- Drawer không trả health/allergy/meal details.
- User không tồn tại và user ngoài scope không làm lộ thông tin ngoài policy.

### Mutations

- Suspend/reinstate state transition đúng và idempotent.
- Concurrent suspension không tạo duplicate active record.
- Revoke session không trả token/hash.
- Password reset response không chứa password hoặc token.
- Role change invalidates quyền cũ đúng policy.
- Provider failure không để DB và Supabase state lệch mà không có reconciliation job.

### Audit/privacy

- Mọi password reset, PII reveal, session revoke, restriction, role change, export và privacy action có actor/target/reason/result/request ID.
- Log không có password, token, health payload hoặc full export URL.
- Export chỉ có allowlisted columns và tự hết hạn.
- Hard delete chỉ qua privacy workflow có retention/legal review.

## 24. Lộ trình triển khai

### P0 — Thay mock bằng dữ liệu thật

1. `GET /admin/users/summary`.
2. `GET /admin/users`.
3. `GET /admin/users/:id` với email masked.
4. Admin API client + React Query hooks + loading/empty/error.

### P1 — Tác vụ hỗ trợ và an toàn tài khoản

1. Verification reminder.
2. Password reset link; deprecate temporary-password endpoint.
3. Session list/revoke.
4. Suspension/reinstatement + restriction schema.
5. Admin action audit.

### P2 — IAM và export

1. Role management guards và last-admin protection.
2. Permission granularity/MFA/re-auth.
3. Operational list export job.
4. Audit UI/filter và monitoring alerts.

### P3 — Privacy operations

1. Privacy case visibility.
2. Dual approval cho tác vụ cực nhạy cảm.
3. Deletion worker, storage cleanup và reconciliation.
4. Legal/security review trước production rollout.

## 25. Nguồn tham khảo và quyết định áp dụng

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html): áp dụng least privilege, deny by default và kiểm tra authorization trên mọi request.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html): management endpoint nên được bảo vệ bằng strong authentication/MFA, giới hạn network/CORS và audit security actions.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html): audit user administration, privilege changes, exports và truy cập dữ liệu nhạy cảm; sanitize dữ liệu log.
- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html): reset token phải random, single-use, có expiry; không gửi password cho người dùng/Admin và phải chống abuse/enumeration.
- [Supabase Password-based Auth](https://supabase.com/docs/guides/auth/passwords): dùng password recovery email/PKCE flow thay vì Admin đặt password trực tiếp.
- [Supabase Admin `updateUserById`](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid): thay đổi được áp dụng trực tiếp, chỉ gọi server-side và không bao giờ lộ secret/service-role key trong browser.
- [Supabase User Management](https://supabase.com/docs/guides/auth/managing-user-data): Auth schema không nên expose trực tiếp; xóa Auth user, Storage ownership, refresh session và thời hạn JWT phải được xử lý đúng.
- [Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15](https://vanban.chinhphu.vn/?docid=214590&pageid=27160): có hiệu lực từ 2026-01-01; việc Admin truy cập, export hoặc xử lý dữ liệu cá nhân cần privacy/legal review theo hoạt động thực tế.

Các yêu cầu pháp lý trong tài liệu là baseline kỹ thuật, không phải ý kiến pháp lý.

## 26. Definition of Done

Admin User Management chỉ được coi là hoàn tất khi:

1. Không còn dữ liệu user/stat mock trong `UsersPage.tsx`.
2. OpenAPI có schema cụ thể cho list/detail/action/error; frontend sinh type từ contract.
3. Integration test có ma trận role × endpoint × method × field.
4. Email masked mặc định và PII reveal có permission/audit.
5. Password reset không để Admin biết password/token.
6. Suspension, role và session actions có re-auth, idempotency, concurrency guard và audit.
7. Export là async, allowlisted, private, có TTL và download audit.
8. Health/allergy/meal data không xuất hiện trong Admin user DTO mặc định.
9. Security review và privacy/legal review hoàn tất trước khi bật production.

