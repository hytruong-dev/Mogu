# 📖 Tài liệu API — Phân hệ Khám phá (Explore)

> **Base URL:** `http://<host>:3001/v1`  
> **Auth:** Bearer JWT (trừ các endpoint có nhãn `🔓 Public`)  
> **Response format:** `{ success: true, data: ..., timestamp: "..." }`

---

## Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [API Explore Feed](#2-api-explore-feed)
3. [API Topics (Chủ đề)](#3-api-topics-chủ-đề)
4. [API Articles (Bài viết)](#4-api-articles-bài-viết)
5. [API Community (Cộng đồng)](#5-api-community-cộng-đồng)
6. [Tích hợp Mobile](#6-tích-hợp-mobile)
7. [Tích hợp Admin](#7-tích-hợp-admin)
8. [Tổng hợp trạng thái tích hợp](#8-tổng-hợp-trạng-thái-tích-hợp)

---

## 1. Tổng quan kiến trúc

```
┌─────────────────────────────────────────────────┐
│              Phân hệ Khám phá                   │
├──────────────┬──────────────┬───────────────────┤
│   Topics     │   Articles   │    Community      │
│  (Chủ đề)   │  (Bài viết)  │   (Cộng đồng)     │
├──────────────┴──────────────┴───────────────────┤
│              Explore Feed (BFF)                 │
│   GET /explore/feed → tổng hợp 3 nguồn trên    │
└─────────────────────────────────────────────────┘
```

### DB Models liên quan

| Model | Bảng | Mô tả |
|---|---|---|
| `Topic` | `topics` | Chủ đề bài viết (Dinh dưỡng, Công thức...) |
| `Article` | `articles` | Bài viết có topic, tags, author |
| `ArticleTag` | `article_tags` | Junction: bài viết ↔ tags |
| `CommunityPost` | `community_posts` | Bài đăng của user |
| `PostLike` | `post_likes` | Like/unlike bài đăng |
| `PostComment` | `post_comments` | Comment bài đăng |

---

## 2. API Explore Feed

### `GET /v1/explore/feed`

> 🔐 **Yêu cầu auth**

Trả về dữ liệu tổng hợp cho tab **"Dành cho bạn"** trên mobile. Gọi 3 query song song:
- 5 topics đang active
- 1 bài viết nổi bật nhất (nhiều view nhất)
- 5 posts cộng đồng mới nhất

**Response:**
```json
{
  "topics": [
    {
      "id": "uuid",
      "slug": "dinh-duong",
      "title": "Dinh dưỡng",
      "coverImageUrl": "https://...",
      "articleCount": 12
    }
  ],
  "featuredArticle": {
    "id": "uuid",
    "slug": "protein-quan-trong",
    "title": "Tại sao protein quan trọng?",
    "summary": "...",
    "coverImageUrl": "https://...",
    "readMinutes": 5,
    "viewCount": 1234,
    "createdAt": "2026-08-01T00:00:00Z",
    "author": {
      "userId": "uuid",
      "displayName": "Mogu Team",
      "avatarUrl": "https://..."
    },
    "topic": { "id": "uuid", "title": "Dinh dưỡng", "slug": "dinh-duong" },
    "tags": ["protein", "dinh-duong"]
  },
  "recentPosts": [
    {
      "id": "uuid",
      "content": "Hôm nay mình nấu phở bò...",
      "imageUrls": ["https://..."],
      "likeCount": 42,
      "commentCount": 8,
      "createdAt": "2026-08-26T00:00:00Z",
      "author": {
        "userId": "uuid",
        "displayName": "user123",
        "avatarUrl": null
      }
    }
  ]
}
```

---

## 3. API Topics (Chủ đề)

### `GET /v1/topics` 🔓 Public

Lấy danh sách topics đang **active**, sắp xếp theo `displayOrder`.

**Response:** `Array<Topic>`
```json
[
  {
    "id": "uuid",
    "slug": "dinh-duong",
    "title": "Dinh dưỡng",
    "description": "Kiến thức về dinh dưỡng và ăn uống lành mạnh",
    "coverImageUrl": "https://...",
    "displayOrder": 1
  }
]
```

---

### `GET /v1/admin/topics` 🔐 CONTENT_ADMIN / SUPER_ADMIN

Danh sách **tất cả** topics (kể cả inactive), kèm số bài viết.

**Response:** `Array<Topic & { _count: { articles: number } }>`

---

### `POST /v1/admin/topics` 🔐 CONTENT_ADMIN / SUPER_ADMIN

Tạo topic mới.

**Request Body:**
```json
{
  "slug": "cong-thuc",
  "title": "Công thức nấu ăn",
  "description": "Hướng dẫn các công thức nấu ăn Việt Nam",
  "coverImageUrl": "https://...",
  "displayOrder": 2,
  "isActive": true
}
```

**Validation:**
- `slug`: required, unique
- `title`: required

---

### `PATCH /v1/admin/topics/:id` 🔐 CONTENT_ADMIN / SUPER_ADMIN

Cập nhật topic. Tất cả fields đều optional.

---

### `DELETE /v1/admin/topics/:id` 🔐 SUPER_ADMIN

Xóa topic. ⚠️ Sẽ xóa cascade các bài viết trong topic này.

---

## 4. API Articles (Bài viết)

### `GET /v1/articles` 🔓 Public

Danh sách bài viết **đã publish**, hỗ trợ lọc và tìm kiếm. Cursor pagination.

**Query Params:**

| Param | Type | Mô tả |
|---|---|---|
| `topicId` | string (uuid) | Lọc theo topic |
| `tag` | string | Lọc theo tag |
| `q` | string | Tìm kiếm theo tiêu đề / tóm tắt |
| `cursor` | string (uuid) | Con trỏ trang tiếp theo |
| `limit` | number | Số lượng (mặc định 20, tối đa 50) |

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "slug": "protein-quan-trong",
      "title": "Tại sao protein quan trọng?",
      "summary": "Protein đóng vai trò thiết yếu...",
      "coverImageUrl": "https://...",
      "readMinutes": 5,
      "viewCount": 1234,
      "status": "PUBLISHED",
      "createdAt": "2026-08-01T00:00:00Z",
      "updatedAt": "2026-08-10T00:00:00Z",
      "author": { "userId": "uuid", "displayName": "Mogu Team", "avatarUrl": null },
      "topic": { "id": "uuid", "title": "Dinh dưỡng", "slug": "dinh-duong" },
      "tags": ["protein", "dinh-duong"]
    }
  ],
  "nextCursor": "uuid-of-last-item",
  "hasMore": true
}
```

---

### `GET /v1/articles/:id` 🔓 Public

Chi tiết bài viết (theo `id` hoặc `slug`). Tự động tăng `viewCount` sau mỗi lần gọi.

**Response:** Giống object trong list, thêm field:
```json
{
  "content": "# Tại sao protein quan trọng?\n\nProtein là..."
}
```

---

### `POST /v1/articles` 🔐 User (tạo bài của mình)

Tạo bài viết mới với `status = DRAFT`.

**Request Body:**
```json
{
  "slug": "cach-nau-pho-bo",
  "title": "Cách nấu phở bò chuẩn Hà Nội",
  "summary": "Hướng dẫn chi tiết từng bước...",
  "content": "# Nguyên liệu\n\n...",
  "coverImageUrl": "https://...",
  "readMinutes": 8,
  "topicId": "uuid-cua-topic",
  "tags": ["pho", "bo", "ha-noi"]
}
```

---

### `PATCH /v1/articles/:id` 🔐 User (chỉ bài của mình)

Cập nhật bài viết. Tất cả fields optional.

---

### `GET /v1/admin/articles` 🔐 CONTENT_ADMIN / SUPER_ADMIN

Danh sách **tất cả** bài viết (mọi trạng thái). Hỗ trợ cùng query params như public.

---

### `PATCH /v1/admin/articles/:id` 🔐 CONTENT_ADMIN / SUPER_ADMIN

Cập nhật bài viết bất kỳ (kể cả của user khác).

---

### `PATCH /v1/admin/articles/:id/publish` 🔐 CONTENT_ADMIN / SUPER_ADMIN

Toggle publish/archive:
- `DRAFT` → `PUBLISHED`
- `PUBLISHED` → `ARCHIVED`
- `ARCHIVED` → `PUBLISHED`

**Response:** Article object với status đã thay đổi.

---

### `DELETE /v1/admin/articles/:id` 🔐 SUPER_ADMIN

Xóa vĩnh viễn bài viết.

---

## 5. API Community (Cộng đồng)

### `GET /v1/community/posts` 🔐 User

Feed bài đăng cộng đồng, cursor pagination.

**Query Params:**

| Param | Type | Mô tả |
|---|---|---|
| `cursor` | string (uuid) | Con trỏ trang tiếp theo |
| `limit` | number | Số lượng (mặc định 20) |

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "content": "Hôm nay mình nấu phở bò...",
      "imageUrls": ["https://...", "https://..."],
      "likeCount": 42,
      "commentCount": 8,
      "isLiked": false,
      "createdAt": "2026-08-26T10:00:00Z",
      "author": {
        "userId": "uuid",
        "displayName": "user123",
        "avatarUrl": null
      }
    }
  ],
  "nextCursor": "uuid",
  "hasMore": true
}
```

---

### `POST /v1/community/posts` 🔐 User

Tạo bài đăng mới.

**Request Body:**
```json
{
  "content": "Hôm nay mình nấu phở bò ngon lắm!",
  "imageUrls": ["https://...", "https://..."]
}
```

---

### `DELETE /v1/community/posts/:id` 🔐 User (chỉ bài của mình)

Xóa bài đăng.

---

### `POST /v1/community/posts/:id/like` 🔐 User

**Toggle like** (idempotent). Gọi lần 2 sẽ unlike.

**Response:**
```json
{ "liked": true }
```

---

### `GET /v1/community/posts/:id/comments` 🔐 User

Danh sách comments của bài đăng (không phân trang, lấy hết).

**Response:** `Array<Comment>`
```json
[
  {
    "id": "uuid",
    "content": "Trông ngon quá!",
    "createdAt": "2026-08-26T10:05:00Z",
    "author": {
      "userId": "uuid",
      "displayName": "friend123",
      "avatarUrl": null
    }
  }
]
```

---

### `POST /v1/community/posts/:id/comments` 🔐 User

Thêm comment.

**Request Body:**
```json
{ "content": "Trông ngon quá!" }
```

---

### `DELETE /v1/community/posts/:id/comments/:commentId` 🔐 User (chỉ comment của mình)

Xóa comment.

---

## 6. Tích hợp Mobile

**File:** `mobile/src/screens/ExploreScreenV2.tsx`  
**API Client:** `mobile/src/services/api/explore.ts`

### Tab "Dành cho bạn" ✅ Đã tích hợp

| Chức năng | API | Status |
|---|---|---|
| Load feed (topics + bài nổi bật + posts) | `GET /explore/feed` | ✅ Gọi khi mount tab |
| Pull-to-refresh | `GET /explore/feed` | ✅ |

### Tab "Món ăn" ✅ Đã tích hợp

| Chức năng | API | Status |
|---|---|---|
| Tìm kiếm món ăn | `GET /dishes?q=...` | ✅ Debounced search 400ms |
| Pull-to-refresh | `GET /dishes` | ✅ |

### Tab "Bài viết" ✅ Đã tích hợp

| Chức năng | API | Status |
|---|---|---|
| Load danh sách bài viết | `GET /articles` | ✅ Gọi khi vào tab |
| Tìm kiếm bài viết | `GET /articles?q=...` | ✅ Debounced search 400ms |
| Pull-to-refresh | `GET /articles` | ✅ |
| Lưu bài (bookmark) | — | ❌ Chưa có API, chỉ local state |
| Mở chi tiết bài viết | `GET /articles/:id` | ⚠️ Chưa xem chi tiết từ ExploreDetailScreen |

### Tab "Cộng đồng" ✅ Đã tích hợp

| Chức năng | API | Status |
|---|---|---|
| Load feed bài đăng | `GET /community/posts` | ✅ |
| Like/unlike | `POST /community/posts/:id/like` | ✅ Optimistic update + rollback |
| Tạo bài đăng | `POST /community/posts` | ⚠️ Có nút "+ Đăng" nhưng chưa gọi API |
| Xem comment | `GET /community/posts/:id/comments` | ⚠️ Chưa tích hợp (chỉ hiển thị số đếm) |
| Thêm comment | `POST /community/posts/:id/comments` | ❌ Chưa tích hợp |
| Pull-to-refresh | `GET /community/posts` | ✅ |

---

## 7. Tích hợp Admin

### Trang Topics (`/topics`) ✅ Đã tích hợp

**File:** `admin/src/pages/TopicsPage.tsx`

| Chức năng | API | Status |
|---|---|---|
| Xem danh sách topics | `GET /admin/topics` | ✅ |
| Tạo topic mới | `POST /admin/topics` | ✅ Modal form đầy đủ |
| Sửa topic | `PATCH /admin/topics/:id` | ✅ |
| Xóa topic | `DELETE /admin/topics/:id` | ✅ Confirm dialog |
| Toggle isActive | `PATCH /admin/topics/:id` | ✅ |

### Trang Articles (`/articles`) ✅ Đã tích hợp

**File:** `admin/src/pages/ArticlesPage.tsx`

| Chức năng | API | Status |
|---|---|---|
| Xem danh sách bài viết | `GET /admin/articles` | ✅ |
| Lọc theo topic | `GET /admin/articles?topicId=...` | ✅ |
| Tìm kiếm | `GET /admin/articles?q=...` | ✅ Debounced 400ms |
| Tạo bài viết | `POST /articles` | ✅ Modal với markdown content |
| Sửa bài viết | `PATCH /admin/articles/:id` | ✅ |
| Publish / Archive | `PATCH /admin/articles/:id/publish` | ✅ Toggle button |
| Xóa bài viết | `DELETE /admin/articles/:id` | ✅ Confirm dialog |

### Trang Community — **Chưa có trang riêng**

| Chức năng | API | Status |
|---|---|---|
| Xem / duyệt bài đăng | — | ❌ Chưa tạo trang admin |
| Xóa bài đăng vi phạm | `DELETE /community/posts/:id` | ❌ Endpoint backend có nhưng admin chưa dùng |

---

## 8. Tổng hợp trạng thái tích hợp

### Backend APIs

| # | Endpoint | Module | Status |
|---|---|---|---|
| 1 | `GET /explore/feed` | Explore | ✅ Hoàn chỉnh |
| 2 | `GET /topics` | Topics | ✅ Hoàn chỉnh |
| 3 | `GET /admin/topics` | Topics | ✅ Hoàn chỉnh |
| 4 | `POST /admin/topics` | Topics | ✅ Hoàn chỉnh |
| 5 | `PATCH /admin/topics/:id` | Topics | ✅ Hoàn chỉnh |
| 6 | `DELETE /admin/topics/:id` | Topics | ✅ Hoàn chỉnh |
| 7 | `GET /articles` | Articles | ✅ Hoàn chỉnh |
| 8 | `GET /articles/:id` | Articles | ✅ Hoàn chỉnh |
| 9 | `POST /articles` | Articles | ✅ Hoàn chỉnh |
| 10 | `PATCH /articles/:id` | Articles | ✅ Hoàn chỉnh |
| 11 | `GET /admin/articles` | Articles | ✅ Hoàn chỉnh |
| 12 | `PATCH /admin/articles/:id` | Articles | ✅ Hoàn chỉnh |
| 13 | `PATCH /admin/articles/:id/publish` | Articles | ✅ Hoàn chỉnh |
| 14 | `DELETE /admin/articles/:id` | Articles | ✅ Hoàn chỉnh |
| 15 | `GET /community/posts` | Community | ✅ Hoàn chỉnh |
| 16 | `POST /community/posts` | Community | ✅ Hoàn chỉnh |
| 17 | `DELETE /community/posts/:id` | Community | ✅ Hoàn chỉnh |
| 18 | `POST /community/posts/:id/like` | Community | ✅ Hoàn chỉnh |
| 19 | `GET /community/posts/:id/comments` | Community | ✅ Hoàn chỉnh |
| 20 | `POST /community/posts/:id/comments` | Community | ✅ Hoàn chỉnh |
| 21 | `DELETE /community/posts/:id/comments/:id` | Community | ✅ Hoàn chỉnh |

### Tổng hợp theo Frontend

| Frontend | Phần | Đã tích hợp | Chưa tích hợp |
|---|---|---|---|
| **Mobile** | Tab "Dành cho bạn" | ✅ Feed đầy đủ | — |
| **Mobile** | Tab "Món ăn" | ✅ Search dishes | — |
| **Mobile** | Tab "Bài viết" | ✅ List + search | ❌ Chi tiết bài, ❌ Bookmark API |
| **Mobile** | Tab "Cộng đồng" | ✅ Feed + like | ❌ Tạo bài, ❌ Comments |
| **Admin** | Topics | ✅ Full CRUD | — |
| **Admin** | Articles | ✅ Full CRUD + publish | — |
| **Admin** | Community | ❌ Chưa có trang | ❌ Moderation posts |

---

## Ghi chú phát triển

### Các tính năng còn thiếu (TODO)

1. **Mobile — Tạo bài cộng đồng**: Nút "+ Đăng" đã có trong UI nhưng chưa gọi `POST /community/posts`
2. **Mobile — Comments**: Hiện chỉ hiển thị `commentCount`, chưa mở giao diện xem/thêm comment
3. **Mobile — Bookmark bài viết**: Hiện lưu local state, cần API lưu bookmark phía server
4. **Mobile — Chi tiết bài viết**: `GET /articles/:id` đã có nhưng `ExploreDetailScreen` chưa gọi
5. **Admin — Quản lý Community**: Cần trang quản lý bài đăng để moderator có thể ẩn/xóa vi phạm

### Phân quyền

| Role | Topics | Articles | Community |
|---|---|---|---|
| `USER` | Read only | Read + tạo bài của mình | CRUD bài/comment của mình |
| `CONTENT_ADMIN` | CRUD | CRUD tất cả + publish | — |
| `SUPER_ADMIN` | CRUD + delete | CRUD + delete | — |
