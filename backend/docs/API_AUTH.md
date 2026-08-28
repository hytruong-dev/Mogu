# Mogu API — Authentication Module
**Version:** 1.0 | **Base URL:** `https://api.mogu.app/api/v1` | **Cập nhật:** 10/08/2026

> Tài liệu này dành cho **Frontend / Mobile team**.  
> Mọi request cần header: `Content-Type: application/json`  
> Request có `[AUTH]` cần header: `Authorization: Bearer <access_token>`

---

## 📦 Response Envelope (chuẩn chung)

Tất cả response đều bọc trong envelope:

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-08-10T10:00:00.000Z"
}
```

Khi lỗi:
```json
{
  "success": false,
  "statusCode": 400,
  "timestamp": "2026-08-10T10:00:00.000Z",
  "path": "/api/v1/auth/register",
  "message": "Validation failed",
  "code": "AUTH_OTP_INVALID"
}
```

---

## 🔐 Headers thêm (khuyến nghị)

| Header | Ví dụ | Mô tả |
|--------|-------|-------|
| `X-Platform` | `ios` / `android` | Platform thiết bị |
| `X-Correlation-Id` | `uuid-v4` | Tracking request |
| `X-App-Version` | `1.0.0` | Phiên bản app |

---

## 1. Đăng ký — `POST /auth/register`

**UC-AUTH-01** | Public — không cần token

### Request
```json
{
  "email": "user@example.com",
  "password": "Matkhau@123",
  "consentVersion": "1.0"
}
```

| Field | Type | Bắt buộc | Quy tắc |
|-------|------|-----------|---------|
| `email` | string | ✅ | Email hợp lệ |
| `password` | string | ✅ | Tối thiểu 8 ký tự, có chữ hoa, chữ thường, số |
| `consentVersion` | string | ✅ | Phiên bản Terms & Privacy đã hiển thị cho user |

### Response `201`
```json
{
  "success": true,
  "data": {
    "maskedEmail": "us***r@example.com",
    "message": "Mã xác minh đã được gửi đến email của bạn."
  }
}
```

### Lỗi

| Status | Code | Tình huống |
|--------|------|-----------|
| `400` | `AUTH_REGISTER_FAILED` | Lỗi khác từ Supabase |
| `409` | `AUTH_EMAIL_EXISTS` | Email đã tồn tại (trả response chung, không lộ thông tin) |
| `422` | — | Validation field errors |

> ⚠️ **Lưu ý:** Khi nhận `409`, vẫn hiển thị UI như bình thường để tránh lộ email đã đăng ký.

---

## 2. Xác minh OTP đăng ký — `POST /auth/verify-otp`

**UC-AUTH-01** | Public

### Request
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

### Response `200`
```json
{
  "success": true,
  "data": {
    "session": {
      "accessToken": "eyJhbGci...",
      "refreshToken": "eyJhbGci...",
      "expiresIn": 3600
    },
    "user": {
      "id": "uuid-v4",
      "displayName": null,
      "avatarUrl": null,
      "accountStatus": "ACTIVE",
      "onboardingStatus": "NOT_STARTED",
      "onboardingStep": 0
    },
    "nextStep": "onboarding"
  }
}
```

> **`nextStep`** — Frontend điều hướng theo giá trị này:
> - `"onboarding"` → màn hình onboarding
> - `"onboarding_resume"` → tiếp tục onboarding dở
> - `"home"` → màn hình chính

### Lỗi

| Status | Code | Tình huống |
|--------|------|-----------|
| `400` | `AUTH_OTP_INVALID` | OTP sai hoặc hết hạn |

---

## 3. Gửi lại OTP — `POST /auth/resend-otp`

**UC-AUTH-01** | Public

### Request
```json
{
  "email": "user@example.com"
}
```

### Response `200`
```json
{
  "success": true,
  "data": {
    "maskedEmail": "us***r@example.com",
    "cooldownSeconds": 60,
    "message": "Mã xác minh mới đã được gửi."
  }
}
```

### Lỗi

| Status | Code | Tình huống |
|--------|------|-----------|
| `400` | `AUTH_OTP_RATE_LIMITED` | Gửi lại quá nhanh — đợi `cooldownSeconds` |
| `400` | `AUTH_RESEND_FAILED` | Lỗi khác |

---

## 4. Đăng nhập — `POST /auth/login`

**UC-AUTH-02** | Public

### Request
```json
{
  "email": "user@example.com",
  "password": "Matkhau@123",
  "deviceId": "device-uuid-optional"
}
```

### Response `200`
```json
{
  "success": true,
  "data": {
    "session": {
      "accessToken": "eyJhbGci...",
      "refreshToken": "eyJhbGci...",
      "expiresIn": 3600
    },
    "user": {
      "id": "uuid-v4",
      "displayName": "Nguyễn Văn A",
      "avatarUrl": null,
      "accountStatus": "ACTIVE",
      "onboardingStatus": "COMPLETED",
      "onboardingStep": 3
    },
    "nextStep": "home"
  }
}
```

### Lỗi

| Status | Code | Tình huống | Hành động UI |
|--------|------|-----------|-------------|
| `401` | `AUTH_INVALID_CREDENTIALS` | Sai email hoặc mật khẩu | Hiển thị lỗi chung |
| `401` | `AUTH_PENDING_VERIFICATION` | Chưa xác minh email | Chuyển sang màn OTP |
| `401` | `AUTH_ACCOUNT_LOCKED` | Tài khoản bị khóa | Hiển thị thông báo + hướng dẫn |

> Khi nhận `AUTH_PENDING_VERIFICATION`, response có thêm:
> ```json
> { "nextStep": "verify_otp", "maskedEmail": "us***r@example.com" }
> ```

---

## 5. Làm mới token — `POST /auth/refresh`

Public

### Request
```json
{
  "refreshToken": "eyJhbGci..."
}
```

### Response `200`
```json
{
  "success": true,
  "data": {
    "session": {
      "accessToken": "eyJhbGci...",
      "refreshToken": "eyJhbGci...",
      "expiresIn": 3600
    }
  }
}
```

### Lỗi

| Status | Code | Tình huống |
|--------|------|-----------|
| `401` | `AUTH_REFRESH_FAILED` | Token hết hạn / bị thu hồi → buộc đăng nhập lại |

> **Lưu ý:** Luôn lưu `refreshToken` mới trả về để thay thế token cũ.

---

## 6. Thông tin user hiện tại — `GET /auth/me`

**[AUTH]** Cần Bearer token

### Response `200`
```json
{
  "success": true,
  "data": {
    "id": "uuid-v4",
    "displayName": "Nguyễn Văn A",
    "avatarUrl": "https://...",
    "accountStatus": "ACTIVE",
    "onboardingStatus": "COMPLETED",
    "onboardingStep": 3
  }
}
```

### Lỗi

| Status | Code | Tình huống |
|--------|------|-----------|
| `401` | — | Token không hợp lệ / hết hạn |

---

## 7. Quên mật khẩu — `POST /auth/forgot-password`

**UC-AUTH-03** | Public

### Request
```json
{
  "email": "user@example.com"
}
```

### Response `200`
```json
{
  "success": true,
  "data": {
    "message": "Nếu email này được đăng ký, bạn sẽ nhận được hướng dẫn trong ít phút."
  }
}
```

> ⚠️ **Luôn trả `200`** dù email có tồn tại hay không — để tránh lộ thông tin tài khoản.

---

## 8. Đặt lại mật khẩu — `POST /auth/reset-password`

**UC-AUTH-03** | Public

### Request
```json
{
  "email": "user@example.com",
  "otp": "654321",
  "newPassword": "NewPass@456"
}
```

| Field | Type | Bắt buộc | Quy tắc |
|-------|------|-----------|---------|
| `email` | string | ✅ | Email đã gửi reset |
| `otp` | string | ✅ | 6 ký tự từ email |
| `newPassword` | string | ✅ | Tối thiểu 8 ký tự, có chữ hoa, chữ thường, số |

### Response `200`
```json
{
  "success": true,
  "data": {
    "message": "Mật khẩu đã được cập nhật. Bạn có thể đăng nhập ngay."
  }
}
```

### Lỗi

| Status | Code | Tình huống |
|--------|------|-----------|
| `400` | `AUTH_OTP_INVALID` | OTP sai hoặc hết hạn |
| `400` | `AUTH_RESET_FAILED` | Mật khẩu mới không đạt chuẩn |

---

## 9. Đăng xuất — `POST /auth/logout`

**UC-AUTH-05** | **[AUTH]** Cần Bearer token

### Request
```json
{
  "scope": "current"
}
```

| `scope` | Ý nghĩa |
|---------|---------|
| `"current"` | Chỉ đăng xuất thiết bị hiện tại (mặc định) |
| `"all"` | Đăng xuất tất cả thiết bị |

### Response `200`
```json
{
  "success": true,
  "data": {
    "message": "Đăng xuất thành công."
  }
}
```

> **Sau khi nhận response:** Xóa `accessToken` và `refreshToken` khỏi local storage.

---

## 🔄 Luồng điều hướng khi mở app

```
Mở app
  ├── Không có token local → Welcome/Auth screen
  │
  ├── Có accessToken → GET /auth/me
  │     ├── 200 → điều hướng theo onboardingStatus
  │     └── 401 → thử POST /auth/refresh
  │             ├── 200 → lưu token mới → GET /auth/me lại
  │             └── 401 → xóa tokens → Welcome/Auth screen
  │
  └── Mạng lỗi + token còn hạn local → hiển thị offline UI
```

---

## 📊 Enum Values

### `accountStatus`
| Value | Ý nghĩa |
|-------|---------|
| `PENDING_VERIFICATION` | Chờ xác minh email |
| `ACTIVE` | Hoạt động bình thường |
| `LOCKED` | Bị khóa tạm thời |
| `SUSPENDED` | Bị đình chỉ |
| `DELETED` | Đã xóa |

### `onboardingStatus`
| Value | `nextStep` trả về | Điều hướng |
|-------|-------------------|-----------|
| `NOT_STARTED` | `"onboarding"` | Bắt đầu onboarding |
| `IN_PROGRESS` | `"onboarding_resume"` | Tiếp tục từ `onboardingStep` |
| `SKIPPED` | `"home"` | Vào Home |
| `COMPLETED` | `"home"` | Vào Home |

---

## ⚠️ Error Codes tổng hợp

| Code | HTTP | Mô tả |
|------|------|-------|
| `AUTH_REGISTER_FAILED` | 400 | Đăng ký thất bại |
| `AUTH_EMAIL_EXISTS` | 409 | Email đã tồn tại |
| `AUTH_OTP_INVALID` | 400 | OTP sai hoặc hết hạn |
| `AUTH_OTP_RATE_LIMITED` | 400 | Gửi OTP quá nhanh |
| `AUTH_RESEND_FAILED` | 400 | Gửi lại OTP thất bại |
| `AUTH_INVALID_CREDENTIALS` | 401 | Sai email hoặc mật khẩu |
| `AUTH_PENDING_VERIFICATION` | 401 | Chưa xác minh email |
| `AUTH_ACCOUNT_LOCKED` | 401 | Tài khoản bị khóa |
| `AUTH_REFRESH_FAILED` | 401 | Refresh token hết hạn |
| `AUTH_PROFILE_NOT_FOUND` | 401 | Profile không tồn tại |
| `AUTH_RESET_FAILED` | 400 | Đặt mật khẩu thất bại |

---

## 🧪 Môi trường test

| Môi trường | Base URL |
|-----------|---------|
| Development | `http://localhost:3001/api/v1` |
| Staging | `https://api-staging.mogu.app/api/v1` |
| Production | `https://api.mogu.app/api/v1` |

**Swagger UI (Development):** `http://localhost:3001/api/docs`

---

*Tài liệu này được tạo tự động từ MOGU-BA-001 v1.0. Mọi thắc mắc liên hệ Backend team.*
