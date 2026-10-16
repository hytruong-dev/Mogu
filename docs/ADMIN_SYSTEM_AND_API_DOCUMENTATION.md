# NOAN Admin Studio — Tài Liệu Kiến Trúc Hệ Thống & Đặc Tả Toàn Diện API

> **Phiên bản:** 2.0 (Chuyển đổi toàn diện sang shadcn/ui & Slate/Amber Design System)  
> **Cập nhật ngày:** Tháng 10/2026  
> **Phạm vi:** Toàn bộ hệ thống quản trị NOAN/Mogu (Frontend React Client & Backend NestJS REST API)

---

## MỤC LỤC
1. [Tổng Quan Kiến Trúc & Ngăn Xếp Kỹ Thuật (Tech Stack)](#1-tổng-quan-kiến-trúc--ngăn-xếp-kỹ-thuật)
2. [Cơ Chế Xác Thực & Phân Quyền (Auth & RBAC)](#2-cơ-chế-xác-thực--phân-quyền-auth--rbac)
3. [Quy Chuẩn Giao Thức API & Định Dạng Dữ Liệu](#3-quy-chuẩn-giao-thức-api--định-dạng-dữ-liệu)
4. [Đặc Tả Chi Tiết Từng Module API (14 Phân Hệ)](#4-đặc-tả-chi-tiết-từng-module-api)
   - [4.1. Dashboard & Chỉ Số Vận Hành (`/admin/dashboard`)](#41-dashboard--chỉ-số-vận-hành)
   - [4.2. Quản Lý Món Ăn & Công Thức (`/admin/dishes`)](#42-quản-lý-món-ăn--công-thức)
   - [4.3. Nhập Món Tự Động Bằng AI (`/admin/import-jobs`)](#43-nhập-món-tự-động-bằng-ai)
   - [4.4. Nhập Dữ Liệu Hàng Loạt Từ File/Spreadsheet (`/admin/dish-imports`)](#44-nhập-dữ-liệu-hàng-loạt-từ-filespreadsheet)
   - [4.5. Hàng Đợi Kiểm Duyệt Chất Lượng (`/admin/review-queue`)](#45-hàng-đợi-kiểm-duyệt-chất-lượng)
   - [4.6. Từ Điển Nguyên Liệu & AI Vision Enrichment (`/admin/ingredients`)](#46-từ-điển-nguyên-liệu--ai-vision-enrichment)
   - [4.7. Danh Mục Dữ Liệu Gốc / Taxonomy (`/admin/taxonomy`)](#47-danh-mục-dữ-liệu-gốc--taxonomy)
   - [4.8. Quản Lý Địa Điểm Quán Ăn (`/admin/places`)](#48-quản-lý-địa-điểm-quán-ăn)
   - [4.9. Báo Cáo Quét Món Thiếu AI Scan (`/admin/food-scan/missing-dishes`)](#49-báo-cáo-quét-món-thiếu-ai-scan)
   - [4.10. Khám Phá: Chủ Đề & Bài Viết Chuyên Sâu (`/admin/topics`, `/admin/articles`)](#410-khám-phá-chủ-đề--bài-viết-chuyên-sâu)
   - [4.11. Kiểm Duyệt Nội Dung & Cộng Đồng (`/admin/moderation`, `/admin/community`)](#411-kiểm-duyệt-nội-dung--cộng-đồng)
   - [4.12. Phát Thông Báo Hệ Thống & Push Notification (`/admin/notifications`)](#412-phát-thông-báo-hệ-thống--push-notification)
   - [4.13. Quản Lý Người Dùng & Nhật Ký Bảo Mật (`/admin/users`)](#413-quản-lý-người-dùng--nhật-ký-bảo-mật)
   - [4.14. Tải Lên & Quản Lý Đa Phương Tiện Media (`/admin/media`)](#414-tải-lên--quản-lý-đa-phương-tiện-media)
5. [Cấu Trúc Giao Diện & Thư Viện Thành Phần UI (Frontend Studio)](#5-cấu-trúc-giao-diện--thư-viện-thành-phần-ui)
6. [Mô Hình Vòng Đời Dữ Liệu Cốt Lõi (Lifecycle & State Machines)](#6-mô-hình-vòng-đời-dữ-liệu-cốt-lõi)
7. [Hướng Dẫn Cài Đặt, Cấu Hình Biến Môi Trường & Triển Khai](#7-hướng-dẫn-cài-đặt-cấu-hình-biến-môi-trường--triển-khai)

---

## 1. TỔNG QUAN KIẾN TRÚC & NGĂN XẾP KỸ THUẬT

Hệ thống NOAN Admin Studio được xây dựng theo mô hình Client-Server tách rời (Decoupled SPA & RESTful Service), hướng tới trải nghiệm người dùng tốc độ cao, khả năng chịu tải và tính toàn vẹn dữ liệu dinh dưỡng:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        NOAN ADMIN STUDIO (SPA)                         │
│  React 18 + TypeScript + Vite 8 + Tailwind CSS + shadcn/ui (Radix)    │
│  State: TanStack Query v5 + Axios Interceptor + WebSocket Client       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS REST / WSS Events
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        BACKEND API ENGINE                              │
│  NestJS 10 + TypeScript + Prisma ORM + BullMQ (Redis Queues)          │
│  Guards: JwtAuthGuard + RolesGuard (RBAC)                              │
└───────┬───────────────────────────┬────────────────────────────┬───────┘
        │                           │                            │
        ▼                           ▼                            ▼
┌──────────────────┐    ┌───────────────────────┐    ┌───────────────────┐
│ PostgreSQL 16    │    │ Supabase Storage / S3 │    │ External Services │
│ (Dữ liệu thực thể│    │ (Lưu trữ ảnh & media  │    │ (Openverse, USDA, │
│  quan hệ Prisma) │    │  nguyên liệu, món ăn) │    │  Geoapify, Expo)  │
└──────────────────┘    └───────────────────────┘    └───────────────────┘
```

### 1.1. Công Nghệ Phía Client (Frontend)
- **Framework & Build:** React 18, TypeScript 5, Vite 8 (HMR cực nhanh, tách bundle tự động).
- **Styling & Design System:** Tailwind CSS v3/v4, shadcn/ui primitives xây trên Radix UI, bộ icon chuẩn hóa Lucide React (không sử dụng raw emoji trên UI quản trị).
- **Data Fetching & Cache:** TanStack Query (`@tanstack/react-query` v5), tối ưu cache invalidation, tự động refetch ngầm, optimistic updates.
- **Biểu đồ & Giám sát:** Recharts hiển thị dữ liệu trực quan (Area, Bar, Pie charts).

### 1.2. Công Nghệ Phía Server (Backend)
- **Framework:** NestJS (Modular Architecture, Dependency Injection).
- **Database & ORM:** PostgreSQL với Prisma Client, quan hệ toàn vẹn dữ liệu ngoại khóa cascade hoặc restrict.
- **Message Queue & Workers:** BullMQ trên nền Redis xử lý bất đồng bộ các tác vụ nặng: Thu thập công thức AI, tìm kiếm ảnh nguyên liệu Openverse, làm giàu thực thể dinh dưỡng USDA/VFCT.
- **Giao diện thời gian thực:** WebSocket Gateway (`@WebSocketGateway({ namespace: '/import' })`) đẩy tiến trình pipeline 6 bước tới trình duyệt theo thời gian thực.

---

## 2. CƠ CHẾ XÁC THỰC & PHÂN QUYỀN (AUTH & RBAC)

### 2.1. Quản Lý Phiên Làm Việc (JWT & Token Rotation)
- Hệ thống lưu trữ 2 khóa trong trình duyệt:
  - `mogu_admin_token`: Access Token (JWT), thời hạn ngắn (15-60 phút).
  - `mogu_admin_refresh`: Refresh Token, thời hạn dài (7-30 ngày).
- **Axios Interceptor (`admin/src/api/client.ts`):**
  - **Request Hook:** Tự động đính kèm `Authorization: Bearer <mogu_admin_token>` vào mọi yêu cầu gửi lên server.
  - **Response Hook:** Khi server phản hồi HTTP `401 Unauthorized`, interceptor tự động bắt lỗi, tạm dừng luồng và gọi `POST /v1/auth/refresh` bằng refresh token. Nếu thành công, cập nhật cặp token mới và tự động thực hiện lại request ban đầu mà không làm gián đoạn người dùng. Nếu thất bại, xóa session và điều hướng về `/login`.

### 2.2. Ma Trận Phân Quyền Vai Trò (System Roles RBAC)

| Quyền hạn / Module | `SUPER_ADMIN` | `CONTENT_ADMIN` | `REVIEWER` |
|:---|:---:|:---:|:---:|
| **Xem Dashboard & KPI** | Có | Có | Có |
| **Quản lý món ăn (Tạo / Sửa / Xóa)** | Toàn quyền (Xóa cứng/mềm) | Tạo & Sửa bản nháp | Chỉ xem & Đánh giá |
| **Duyệt món & Xuất bản (Publish/Reject)** | Có | Không | Có |
| **Nhập món AI & File Spreadsheet** | Có | Có | Chỉ xem |
| **Quản lý Dữ liệu gốc & Nguyên liệu** | Toàn quyền | Tạo, Sửa, Gộp | Xem & Link |
| **Địa điểm quán ăn & Bản đồ** | Có | Có | Không |
| **Bài viết & Chủ đề Khám phá** | Toàn quyền | Soạn thảo & Sửa | Không |
| **Kiểm duyệt Cộng đồng & Báo cáo** | Toàn quyền | Xử lý báo cáo | Không |
| **Phát thông báo Broadcast In-App** | Có | Có | Không |
| **Quản lý Tài khoản & Phân quyền User** | Độc quyền | Không | Không |
| **Khóa tài khoản / Đổi mật khẩu** | Độc quyền | Không | Không |

---

## 3. QUY CHUẨN GIAO THỨC API & ĐỊNH DẠNG DỮ LIỆU

### 3.1. Chuẩn Hóa Phản Hồi (Transform Response Interceptor)
Mọi phản hồi thành công từ API Backend đều được bọc trong cấu trúc chuẩn:
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-10-16T03:30:00.000Z"
}
```
*Lưu ý:* `api/client.ts` của client đã cấu hình auto-unwrap, các hook và UI component nhận trực tiếp payload bên trong thuộc tính `data`.

### 3.2. Chuẩn Hóa Phân Trang (Cursor-based vs Offset-based)
1. **Cursor-based (Khuyên dùng cho feed, logs, bảng món ăn lớn):**
   ```typescript
   interface CursorPage<T> {
     items: T[]
     total?: number
     pageInfo: {
       nextCursor: string | null
       hasNextPage: boolean
     }
   }
   ```
2. **Offset-based (Dùng cho từ điển nguyên liệu, địa điểm, bảng cố định):**
   ```typescript
   interface OffsetPage<T> {
     data: T[]
     pagination: {
       page: number
       limit: number
       total: number
       totalPages: number
     }
   }
   ```

### 3.3. Xử Lý Khóa Lạc Quan (Optimistic Locking)
Để chống xung đột khi nhiều quản trị viên cùng chỉnh sửa một món ăn, endpoint `PATCH /admin/dishes/:id` hỗ trợ header HTTP `If-Match: <version>`. Nếu `version` trong cơ sở dữ liệu đã thay đổi, máy chủ trả về `HTTP 412 Precondition Failed` yêu cầu tải lại dữ liệu mới nhất.

---

## 4. ĐẶC TẢ CHI TIẾT TỪNG MODULE API (14 PHÂN HỆ)

### 4.1. Dashboard & Chỉ Số Vận Hành
Controller: `backend/src/admin-dashboard/admin-dashboard.controller.ts`  
Client API: `admin/src/api/dashboard.ts`

#### `GET /v1/admin/dashboard/summary`
- **Mục đích:** Cung cấp KPI tổng quan hệ thống, danh sách công việc cần xử lý gấp và thông tin insight.
- **Quyền hạn:** `SUPER_ADMIN`, `CONTENT_ADMIN`, `REVIEWER`.
- **Query Params:**
  - `range`: `'7d' | '30d'` (Mặc định: `'7d'`).
- **Phản hồi mẫu:**
  ```json
  {
    "generatedAt": "2026-10-16T03:30:00.000Z",
    "range": { "from": "2026-10-09T00:00:00.000Z", "to": "2026-10-16T23:59:59.000Z" },
    "kpi": {
      "dishes": {
        "total": 1250,
        "published": 1100,
        "draft": 85,
        "pendingReview": 45,
        "failed": 20,
        "publishedThisWeek": 28,
        "publishedLastWeek": 22,
        "publishedGrowthPercent": 27.27
      },
      "importJobs": { "active": 2, "failedLast7d": 1, "doneLast7d": 40 },
      "moderation": { "openReports": 3, "activePosts": 150, "pendingComments": 5 }
    },
    "foodScanMissingNew": 4,
    "tasks": [
      { "key": "REVIEW_QUEUE", "count": 45, "route": "/review", "priority": "high" },
      { "key": "FOOD_SCAN_MISSING", "count": 4, "route": "/food-scan-reports", "priority": "medium" }
    ],
    "insight": {
      "code": "HIGH_SCAN_UNMATCHED",
      "message": "Có 4 món ăn người dùng quét nhưng chưa có trong kho dữ liệu.",
      "ctaRoute": "/food-scan-reports"
    }
  }
  ```

#### `GET /v1/admin/dashboard/growth`
- **Query Params:** `days` (number, mặc định `7`).
- **Phản hồi:** Danh sách các điểm thời gian `series: [{ date: "YYYY-MM-DD", newDishes: 5, publishedDishes: 4 }]` (ngày không có biến động được tự động điền `0`).

#### `GET /v1/admin/dashboard/trending-dishes`
- **Query Params:** `window` (`'24h' | '7d'`), `limit` (number, mặc định `5`).
- **Phản hồi:** Danh sách món ăn có lượng xem, lưu và tương tác cao nhất.

#### `GET /v1/admin/dashboard/activities`
- **Query Params:** `limit` (number, mặc định `10`), `cursor` (string, tùy chọn).
- **Phản hồi:** Dòng thời gian các hành động nghiệp vụ vừa xảy ra trên hệ sinh thái (Job AI hoàn thành, món ăn được duyệt, báo cáo vi phạm mới).

---

### 4.2. Quản Lý Món Ăn & Công Thức
Controller: `backend/src/dishes/controllers/admin-dishes.controller.ts`  
Client API: `admin/src/api/dishes.ts`

#### `GET /v1/admin/dishes`
- **Mục đích:** Tra cứu và lọc danh sách món ăn theo mọi trạng thái vòng đời.
- **Query Params (`DishAdminQueryDto`):**
  - `q`: Từ khóa tìm kiếm theo tên món, tên thay thế.
  - `status`: Lọc theo `DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, `CHANGES_REQUESTED`, `ARCHIVED`.
  - `categoryCode`: Mã danh mục món ăn (VD: `mon-nuoc`, `mon-chay`).
  - `mealTypeCode`: Mã loại bữa ăn (VD: `sang`, `trua`, `toi`).
  - `regionId`: ID vùng miền địa lý (Bắc / Trung / Nam).
  - `limit`: Số bản ghi mỗi trang (1-100, mặc định `20`).
  - `cursor`: Khóa con trỏ phục vụ phân trang liên tục.

#### `GET /v1/admin/dishes/:id`
- **Mục đích:** Xem đầy đủ hồ sơ chi tiết món ăn bao gồm thông tin cơ bản, thành phần nguyên liệu (`dishIngredients`), các bước nấu (`recipeSteps`), chỉ số dinh dưỡng (`nutrition`), nguồn gốc xuất xứ (`sources`) và media đính kèm.

#### `GET /v1/admin/dishes/:id/validation`
- **Mục đích:** Chạy bộ kiểm tra chất lượng tự động trước khi cho phép gửi duyệt hoặc xuất bản.
- **Phản hồi cấu trúc (`DishValidationResult`):**
  ```typescript
  interface DishValidationResult {
    completionPercent: number // 0 - 100%
    sections: { key: string; status: 'VALID' | 'WARNING' | 'ERROR' }[]
    blockingErrors: { code: string; message: string; section: string }[]
    warnings: { code: string; message: string }[]
    ingredientIssues?: PendingIngredientIssue[]
    canSubmitReview: boolean
  }
  ```
- **Quy tắc chặn cứng (Blocking Errors):** Thiếu ảnh đại diện, thiếu calories khẩu phần, có nguyên liệu ở trạng thái `REJECTED` hoặc chưa liên kết từ điển, các bước công thức rỗng.

#### `POST /v1/admin/dishes`
- **Body:** `CreateDishDto` (Tạo toàn vẹn món ăn, nguyên liệu và các bước công thức trong một giao dịch cơ sở dữ liệu duy nhất).
- **Headers:** `Authorization: Bearer <token>`.

#### `PATCH /v1/admin/dishes/:id`
- **Headers:** `If-Match: <version>` (Tùy chọn, khóa lạc quan).
- **Body:** `UpdateDishDto` (Hỗ trợ cập nhật từng phần hoặc ghi đè mảng nguyên liệu/bước nấu).

#### `POST /v1/admin/dishes/:id/submit-review`
- **Chức năng:** Chuyển trạng thái món ăn từ `DRAFT` hoặc `CHANGES_REQUESTED` sang `PENDING_REVIEW` để đưa vào hàng đợi kiểm duyệt.

#### `POST /v1/admin/dishes/:id/unpublish` & `POST /v1/admin/dishes/:id/republish`
- **Chức năng:** Tạm thời gỡ bỏ món khỏi ứng dụng khách hàng (đưa về `UNPUBLISHED`) hoặc phát hành lại.

#### `POST /v1/admin/dishes/:id/archive` & `POST /v1/admin/dishes/:id/restore`
- **Chức năng:** Đưa món ăn vào kho lưu trữ hoặc khôi phục về trạng thái nháp (`DRAFT`).

#### `DELETE /v1/admin/dishes/:id`
- **Quyền hạn độc quyền:** `SUPER_ADMIN`.
- **Chức năng:** Xóa mềm món ăn (`deletedAt = NOW()`), giữ lại toàn vẹn dữ liệu liên kết lịch sử.

---

### 4.3. Nhập Món Tự Động Bằng AI
Controller: `backend/src/ai-import/import-jobs.controller.ts`  
Client API: `admin/src/api/import-jobs.ts`  
Gateway WebSocket: `backend/src/ai-import/import.gateway.ts` (Namespace `/import`)

#### `POST /v1/admin/import-jobs`
- **Mục đích:** Kích hoạt tác vụ thu thập, phân tích và trích xuất món ăn tự động từ tên gọi.
- **Body (`CreateImportJobDto`):**
  ```json
  {
    "query": "Bún bò giò heo Huế",
    "relatedKeywords": ["bún bò huế", "giò heo", "chả cua"],
    "regionHint": "central",
    "sourceTypes": ["AI_SYNTHESIS", "RECIPE_WEBSITES", "YOUTUBE"]
  }
  ```
- **Phản hồi:** Bản ghi `ImportJob` ở trạng thái `PENDING` kèm mã ID định danh.
- **Quy trình 6 bước ngầm của Worker:**
  1. `SEARCHING`: Thu thập thông tin từ đa nguồn mở.
  2. `EXTRACTING`: Trích xuất thành phần, định lượng thô và công thức chế biến.
  3. `NORMALIZING`: Chuẩn hóa nguyên liệu theo từ điển ẩm thực Việt Nam.
  4. `RECONCILING`: Đối soát trùng lặp với kho dữ liệu hiện có (Duplicate scoring).
  5. `ENRICHING`: Tính toán năng lượng, carbs, protein, fat, sodium theo bảng VFCT 2007 & USDA.
  6. `DRAFTING`: Tạo bản ghi món ăn dạng `DRAFT` và hoàn thành tiến trình (`DONE`).

#### `GET /v1/admin/import-jobs` & `GET /v1/admin/import-jobs/:id`
- **Chức năng:** Tra cứu danh sách và nhật ký chi tiết (`logs: [{ step, message, detail }]`) của từng job.

#### `POST /v1/admin/import-jobs/:id/cancel`
- **Chức năng:** Hủy bỏ tác vụ đang chạy nếu phát hiện người dùng thao tác nhầm.

---

### 4.4. Nhập Dữ Liệu Hàng Loạt Từ File / Spreadsheet
Controller: `backend/src/dish-file-imports/dish-file-imports.controller.ts`  
Client API: `admin/src/api/dish-imports.ts`

- `GET /v1/admin/dish-imports/template`: Tải về file mẫu Excel/CSV chuẩn có chứa sẵn các cột thông tin bắt buộc.
- `POST /v1/admin/dish-imports/sessions`: Khởi tạo phiên import từ file CSV/Excel tải lên, trả về bản xem trước 5 dòng đầu và bảng ánh xạ cột tự động gợi ý (`mapping`).
- `GET /v1/admin/dish-imports/sessions/:id`: Lấy tiến độ và trạng thái chi tiết của phiên xử lý.
- `PUT /v1/admin/dish-imports/sessions/:id/mapping`: Lưu cấu hình khớp nối cột dữ liệu nguồn với trường dữ liệu hệ thống (VD: Cột "Tên món" -> `name`, "Calo" -> `calories`).
- `POST /v1/admin/dish-imports/sessions/:id/validate`: Chạy kiểm tra toàn bộ file, trả về tổng số dòng hợp lệ, dòng cảnh báo và dòng lỗi.
- `PATCH /v1/admin/dish-imports/sessions/:id/rows/:rowNumber`: Sửa nhanh giá trị ô bị lỗi trực tiếp trên giao diện web mà không cần sửa file gốc.
- `POST /v1/admin/dish-imports/sessions/:id/commit`: Xác nhận tạo hàng loạt món ăn vào cơ sở dữ liệu theo tùy chọn: `duplicateMode` (`SKIP` | `CREATE_NEW`), `unknownIngredientMode` (`CREATE_SUGGESTION` | `SKIP`).

---

### 4.5. Hàng Đợi Kiểm Duyệt Chất Lượng
Controller: `backend/src/dish-review/dish-review.controller.ts`  
Client API: `admin/src/api/review.ts`

#### `GET /v1/admin/review-queue`
- **Quyền hạn:** `REVIEWER`, `SUPER_ADMIN`.
- **Query Params:** `status` (`'PENDING_REVIEW' | 'CHANGES_REQUESTED'`), `cursor`, `limit`.
- **Phản hồi:** Danh sách các món ăn kèm điểm tin cậy tổng thể, danh sách vấn đề cảnh báo và thông tin người gửi duyệt.

#### `POST /v1/admin/dishes/:id/approve`
- **Chức năng:** Phê duyệt chính thức món ăn. Trạng thái chuyển thành `PUBLISHED`, món ăn lập tức hiển thị trên ứng dụng di động Mogu.

#### `POST /v1/admin/dishes/:id/request-changes`
- **Body:** `{ "reasonCode": "INSUFFICIENT_NUTRITION", "note": "Vui lòng kiểm tra lại hàm lượng Natri quá cao" }`.
- **Trạng thái chuyển thành:** `CHANGES_REQUESTED`. Người biên soạn sẽ nhận được thông báo để chỉnh sửa.

#### `POST /v1/admin/dishes/:id/reject`
- **Body:** `{ "reasonCode": "POLICY_VIOLATION", "note": "Món ăn trùng lặp hoặc vi phạm tiêu chuẩn cộng đồng" }`.
- **Trạng thái chuyển thành:** `REJECTED`.

---

### 4.6. Từ Điển Nguyên Liệu & AI Vision Enrichment
Controller: `backend/src/ingredients/ingredients.controller.ts`  
Client API: `admin/src/api/ingredients.ts`

#### `GET /v1/ingredients` (Public API)
- **Mục đích:** Tìm kiếm tức thời danh mục nguyên liệu chuẩn (dùng cho thanh tìm kiếm nhanh).

#### `GET /v1/admin/ingredients`
- **Mục đích:** Quản lý toàn bộ kho từ điển nguyên liệu.
- **Query Params:**
  - `q`: Từ khóa tìm kiếm (hỗ trợ cả tên tiếng Việt, tiếng Anh và từ đồng nghĩa `synonyms`).
  - `status`: `ACTIVE`, `PENDING_REVIEW`, `REJECTED`, `MERGED`, `INACTIVE`.
  - `activationStatus`: `'all' | 'unactivated' | 'activated'`.
  - `allergenCode`: Lọc theo mã dị ứng (hải sản, đậu phộng, gluten, v.v.).

#### `POST /v1/admin/ingredients/resolve-batch`
- **Mục đích:** Nhận một mảng tên nguyên liệu thô từ bản ghi công thức, tự động khớp nối vào nguyên liệu chuẩn hoặc tạo nguyên liệu tạm (`CREATED_PENDING`) và kích hoạt tìm kiếm ảnh tự động.

#### `POST /v1/admin/ingredients/:id/approve`
- **Mục đích:** Quản trị viên duyệt nguyên liệu mới sinh ra từ AI, đưa vào sử dụng chính thức.

#### `POST /v1/admin/ingredients/:id/merge`
- **Mục đích:** Gộp 2 nguyên liệu trùng lặp (VD: Gộp "hành lá" vào "hành hoa"). Toàn bộ món ăn đang trỏ tới nguyên liệu cũ sẽ được cập nhật trỏ sang nguyên liệu đích.

#### `POST /v1/admin/ingredients/:id/image-searches` & `GET /v1/admin/ingredients/:id/image-candidates`
- **Mục đích:** Gọi pipeline AI tìm kiếm ảnh nguyên liệu miễn phí bản quyền (Openverse, Wikimedia Commons) và chấm điểm ảnh bằng mô hình Vision AI trước khi quản trị viên chọn ảnh đại diện.

---

### 4.7. Danh Mục Dữ Liệu Gốc / Taxonomy
Controller: `backend/src/taxonomy/admin-taxonomy.controller.ts`  
Client API: `admin/src/api/taxonomy.ts`

Quản lý toàn bộ các thực thể phân loại nền tảng:
- **Danh mục món ăn (`DishCategory`):** `GET`, `POST`, `PATCH`, `DELETE /v1/admin/taxonomy/categories`
- **Loại bữa ăn (`MealTypeTag`):** `GET`, `POST`, `PATCH`, `DELETE /v1/admin/taxonomy/meal-types`
- **Chế độ ăn kiêng (`DietType`):** `GET`, `POST`, `PATCH`, `DELETE /v1/admin/taxonomy/diet-types` (VD: Eat Clean, KETO, Thuần chay, Ít tinh bột)
- **Nhóm dị ứng (`Allergen`):** `GET`, `POST`, `PATCH`, `DELETE /v1/admin/taxonomy/allergens` (VD: Tôm cua, Đậu nành, Sữa động vật, Trứng gà)
- **Vùng miền địa lý (`Region` & `Province`):** Cung cấp danh mục 3 miền Bắc, Trung, Nam và danh sách 63 tỉnh thành.

---

### 4.8. Quản Lý Địa Điểm Quán Ăn
Controller: `backend/src/places/places.controller.ts` (Class `AdminPlacesController`)  
Client API: `admin/src/api/places.ts`

- `GET /v1/admin/places`: Tìm kiếm quán ăn theo nhà cung cấp (Geoapify/OSM), trạng thái xác minh (`isVerified`), tọa độ địa lý và số lượng món bán.
- `PATCH /v1/admin/places/:id`: Cập nhật tên quán, địa chỉ rút gọn, ảnh đại diện, trạng thái mở cửa (`OPEN` | `CLOSED`).
- `GET /v1/admin/places/:id/dishes`: Danh sách các món ăn trong kho dữ liệu Mogu được liên kết phục vụ tại quán này.
- `PATCH /v1/admin/places/:id/dishes`: Xác nhận (`CONFIRMED`), điều chỉnh giá bán VND hoặc gỡ liên kết giữa món ăn và địa điểm.
- `DELETE /v1/admin/places/:id?force=true`: Xóa quán ăn khỏi hệ thống bản đồ ẩm thực.

---

### 4.9. Báo Cáo Quét Món Thiếu AI Scan
Controller: `backend/src/admin-food-scan/admin-food-scan.controller.ts`  
Client API: `admin/src/api/food-scan-reports.ts`

- **Nghiệp vụ:** Khi người dùng chụp ảnh món ăn ngoài đời thực nhưng mô hình AI của ứng dụng Mogu không tìm thấy món tương ứng trong cơ sở dữ liệu, một sự kiện "món quét chưa có" sẽ được tạo tự động kèm ảnh chụp.
- `GET /v1/admin/food-scan/missing-dishes/summary`: Đếm số lượng món quét mới (`NEW`), đang xử lý (`IN_PROGRESS`), đã bổ sung (`ADDED`) hoặc bỏ qua (`DISMISSED`).
- `GET /v1/admin/food-scan/missing-dishes`: Danh sách các trường hợp quét thiếu, ảnh ký tạm (`Signed URL`) và danh sách các phỏng đoán của AI.
- `PATCH /v1/admin/food-scan/missing-dishes/:id`:
  - Liên kết với một món ăn đã có trong kho (`linkedDishId`).
  - Đánh dấu đã thêm món mới (`status = ADDED`).
  - Thêm tên phỏng đoán vào danh sách tên gọi phụ (`addAlias = true`) để lần quét sau AI nhận diện chính xác.

---

### 4.10. Khám Phá: Chủ Đề & Bài Viết Chuyên Sâu
Controllers: `backend/src/topics/topics.controller.ts`, `backend/src/articles/articles.controller.ts`  
Client API: `admin/src/api/explore.ts`

- **Chủ đề Khám phá (`Topics`):**
  - `GET /v1/admin/topics`: Danh sách chuyên đề hiển thị thanh cuộn ngang trên app di động (Ảnh bìa, slug nhận diện, thứ tự hiển thị `displayOrder`).
  - `POST`, `PATCH`, `DELETE /v1/admin/topics`: Tạo, sửa, ẩn/hiện hoặc xóa chủ đề.
- **Bài viết Ẩm thực (`Articles`):**
  - `GET /v1/admin/articles`: Quản lý danh sách bài viết (tiêu đề, tác giả, lượt xem, lượt thích, trạng thái `DRAFT`, `PUBLISHED`, `SCHEDULED`).
  - `POST /v1/articles` & `PATCH /v1/admin/articles/:id`: Soạn thảo bài viết, hỗ trợ định dạng Markdown, trích dẫn món ăn liên quan, ước tính thời gian đọc.
  - `PATCH /v1/admin/articles/:id/publish`: Hẹn giờ xuất bản bài viết tự động trong tương lai hoặc phát hành ngay lập tức.
  - `PATCH /v1/admin/articles/:id/pin`: Ghim bài viết chất lượng lên vị trí đầu tiên của tab Khám phá.

---

### 4.11. Kiểm Duyệt Nội Dung & Cộng Đồng
Controller: `backend/src/moderation/admin-moderation.controller.ts`  
Client API: `admin/src/api/moderation.ts`

- `GET /v1/admin/moderation/reports/stats`: Thống kê số lượng báo cáo chờ xử lý, số ca độ ưu tiên cao (`priority: HIGH`), tỷ lệ giải quyết trong ngày.
- `GET /v1/admin/moderation/reports`: Hàng đợi báo cáo vi phạm từ người dùng đối với bài đăng cộng đồng (`COMMUNITY_POST`), bình luận (`COMMENT`) hoặc tài khoản (`USER`).
- `PATCH /v1/admin/moderation/reports/:id`: Xử lý khiếu nại với các hành động:
  - `DISMISS`: Bác bỏ báo cáo (nội dung hợp lệ).
  - `HIDE_CONTENT`: Ẩn nội dung khỏi bảng tin cộng đồng.
  - `DELETE_CONTENT`: Xóa vĩnh viễn nội dung vi phạm.
  - `WARN_USER` / `RESTRICT_USER`: Cảnh cáo hoặc hạn chế quyền tài khoản tác giả.
- `GET /v1/admin/community/posts` & `PATCH /v1/admin/community/posts/:id/hide`: Quản lý trực tiếp mọi bài viết chia sẻ nhật ký ăn uống của người dùng trên toàn hệ sinh thái.

---

### 4.12. Phát Thông Báo Hệ Thống & Push Notification
Controller: `backend/src/admin-notifications/admin-notifications.controller.ts`  
Client API: `admin/src/api/notifications.ts`

#### `POST /v1/admin/notifications/broadcast`
- **Mục đích:** Gửi thông báo In-app và đẩy Expo Push Notification trực tiếp đến điện thoại người dùng.
- **Body (`BroadcastNotificationDto`):**
  ```json
  {
    "title": "Cập nhật thực đơn mùa mưa cùng Mogu v2.0",
    "body": "Khám phá ngay 20+ món lẩu và món nước ấm lòng vừa được cập nhật!",
    "type": "PROMO",
    "scope": "ALL",
    "deepLink": "mogu://explore"
  }
  ```
- **Phản hồi:** Thống kê kết quả đẩy (`totalRecipients`, `pushSentCount`, `pushFailedCount`).

#### `GET /v1/admin/notifications/history`
- **Mục đích:** Truy xuất lịch sử các lượt phát sóng thông báo trong quá khứ kèm tài khoản quản trị viên thực hiện.

---

### 4.13. Quản Lý Người Dùng & Nhật Ký Bảo Mật
Controller: `backend/src/admin-users/admin-users.controller.ts`  
Client API: `admin/src/api/users.ts`

- `GET /v1/admin/users/summary`: Thống kê tổng số tài khoản, người dùng kích hoạt hôm nay (DAU), tài khoản mới tạo và tài khoản bị hạn chế.
- `GET /v1/admin/users`: Danh sách người dùng hệ thống (email được tự động làm mờ `masked` theo tiêu chuẩn bảo mật dữ liệu cá nhân, trạng thái tài khoản, vai trò).
- `GET /v1/admin/users/:userId`: Hồ sơ quản trị chi tiết (lịch sử đăng nhập, thiết bị đăng ký, mục tiêu dinh dưỡng cá nhân).
- `POST /v1/admin/users/:userId/password-reset-requests`: Gửi link đặt lại mật khẩu an toàn vào hòm thư người dùng (quản trị viên không bao giờ nhìn thấy hoặc can thiệp mật khẩu gốc).
- `POST /v1/admin/users/:userId/session-revocations`: Hủy toàn bộ phiên đăng nhập đang hoạt động của tài khoản (dùng khi phát hiện rủi ro bảo mật).
- `POST /v1/admin/users/:userId/suspensions`: Khóa tài khoản tạm thời hoặc vĩnh viễn kèm lý do biên bản kiểm tra.
- `PUT /v1/admin/users/:userId/roles/:role`: Gán vai trò quản trị viên (`CONTENT_ADMIN`, `REVIEWER`, `SUPER_ADMIN`).

---

### 4.14. Tải Lên & Quản Lý Đa Phương Tiện Media
Controller: `backend/src/dish-media/dish-media.controller.ts`  
Client API: `admin/src/api/media.ts`

Quy trình tải lên ảnh lớn trực tiếp (Direct Presigned Upload) tránh nghẽn máy chủ chính:
1. Client gửi `POST /v1/admin/media/presign-upload` kèm dung lượng và `mimeType` (`image/jpeg`, `image/webp`).
2. Server tạo đường dẫn ký số an toàn và trả về `uploadUrl` cùng `storageKey`.
3. Trình duyệt đẩy trực tiếp file lên Supabase Storage bucket thông qua phương thức `PUT`.
4. Client gọi `POST /v1/admin/dishes/:dishId/media` để cam kết (`commit`) siêu dữ liệu (chiều rộng, chiều cao, dung lượng byte, ảnh chính `isPrimary`).

---

## 5. CẤU TRÚC GIAO DIỆN & THƯ VIỆN THÀNH PHẦN UI

Toàn bộ giao diện Admin Studio được thiết kế nhất quán theo hệ thống nguyên tử (Atomic Component System):

```
admin/src/
├── components/
│   ├── layout/               # Bộ khung nền tảng
│   │   ├── Sidebar.tsx       # Thanh điều hướng trái, phân nhóm nghiệp vụ, trạng thái Cloud
│   │   ├── Header.tsx        # Topbar kính mờ, Breadcrumbs, Quick Action, Avatar User
│   │   └── PageContainer.tsx # Vùng đệm lề chuẩn responsive 24-32px
│   ├── ui/                   # Thư viện shadcn/ui nguyên tử
│   │   ├── button.tsx        # Nút tương tác với các biến thể: default, outline, ghost, destructive
│   │   ├── card.tsx          # Thẻ chứa dữ liệu tiêu chuẩn (CardHeader, CardContent, CardTitle)
│   │   ├── dialog.tsx        # Cửa sổ Pop-up chuẩn Radix Dialog với phím tắt Escape
│   │   ├── sheet.tsx         # Drawer kéo trượt từ cạnh phải màn hình
│   │   ├── table.tsx         # Bảng dữ liệu chuẩn (TableHeader, TableRow, TableCell)
│   │   ├── badge.tsx         # Thẻ chỉ số trạng thái (success, warning, destructive, secondary)
│   │   ├── progress.tsx      # Thanh tiến độ phần trăm tiến trình
│   │   ├── skeleton.tsx      # Khung xương giả lập trạng thái chờ tải ngầm
│   │   ├── empty-state.tsx   # Trạng thái rỗng chuyên nghiệp kèm nút CTA
│   │   ├── ingredient-picker.tsx # Bộ chọn nguyên liệu thông minh hỗ trợ tìm kiếm & thêm mới
│   │   └── media-lightbox.tsx    # Cửa sổ phóng to xem chi tiết ảnh và video YouTube
│   └── foods/, ingest/, ...  # Các cụm phân hệ nghiệp vụ cụ thể
└── pages/                    # 14 trang điều hướng SPA chính
```

---

## 6. MÔ HÌNH VÒNG ĐỜI DỮ LIỆU CỐT LÕI (STATE MACHINES)

### 6.1. Vòng Đời Món Ăn (Dish Status Lifecycle)
```
  [Tạo mới / AI Ingest]
           │
           ▼
       ┌───────┐      Gửi kiểm duyệt      ┌────────────────┐
       │ DRAFT ├─────────────────────────►│ PENDING_REVIEW │
       └▲──┬───┘                          └──┬───────────┬─┘
        │  │                                 │           │
        │  │ Sửa lại         Yêu cầu sửa     │           │ Phê duyệt
        │  └───────────┐   ┌─────────────────┘           │
        │              ▼   ▼                             ▼
        │        ┌───────────────────┐             ┌───────────┐
        └────────┤ CHANGES_REQUESTED │             │ PUBLISHED │
                 └───────────────────┘             └─────┬─────┘
                                                         │
                                    Gỡ xuất bản / Lưu trữ│
                                                         ▼
                                                   ┌───────────┐
                                                   │ ARCHIVED  │
                                                   └───────────┘
```

### 6.2. Tiến Trình Nhập Món Tự Động 6 Bước (AI Pipeline)
```
[Tạo Job] ──► SEARCHING ──► EXTRACTING ──► NORMALIZING ──► RECONCILING ──► ENRICHING ──► DRAFTING ──► [DONE]
                (Tìm kiếm)   (Trích xuất)  (Chuẩn hóa NL)   (Đối soát)   (Dinh dưỡng)   (Lưu nháp)
```

---

## 7. HƯỚNG DẪN CÀI ĐẶT, CẤU HÌNH BIẾN MÔI TRƯỜNG & TRIỂN KHAI

### 7.1. Cấu Hình Biến Môi Trường Client (`admin/.env`)
```bash
# Đường dẫn API Backend
VITE_API_URL=http://localhost:3001/v1

# Địa chỉ Supabase Storage CDN tải ảnh
VITE_SUPABASE_URL=https://your-project.supabase.co
```

### 7.2. Lệnh Khởi Chạy & Biên Dịch (Commands)
```bash
# Cài đặt gói phụ thuộc
cd admin
npm install

# Chạy môi trường phát triển (Dev Server)
npm run dev
# -> Trình duyệt truy cập: http://localhost:5173

# Kiểm tra linter và kiểu dữ liệu TypeScript
npm run build
# -> Lệnh thực thi: tsc -b && vite build (Đạt 0 cảnh báo/lỗi)

# Xem trước bản đóng gói Production
npm run preview
```

### 7.3. Tiêu Chí Nghiệm Thu & Đảm Bảo Chất Lượng (QA Acceptance)
1. **Kiểm tra biên dịch:** Không có bất kỳ lỗi cú pháp hoặc thiếu type TypeScript nào (`Exit code: 0`).
2. **Khả năng tương thích thiết bị:** Đáp ứng chuẩn hiển thị Responsive từ màn hình laptop 1280px đến màn hình máy tính 4K.
3. **Độ tương phản & Khả năng tiếp cận:** Đạt chuẩn WCAG 2.2 Level AA về độ tương phản văn bản so với nền.
4. **Trạng thái mạng:** Mọi vị trí gọi API đều có `Skeleton` khi đang tải và `EmptyState` khi dữ liệu trống.
