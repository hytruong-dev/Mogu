# Đánh giá tổng quan phân hệ Khám phá (Explore) — Thiếu sót & Lộ trình bổ sung

> Ngày đánh giá: 17/09/2026 · Cập nhật tiến độ: 17/09/2026
> Phạm vi: `mobile/` (ExploreScreenV2, ExploreDetailScreen, CommunityPostDetailScreen, explore/*), `backend/` (explore, articles, community, moderation, places), `admin/` (ArticlesPage, TopicsPage, CommunityPage, ReportsPage).
> Tài liệu liên quan: `EXPLORE_API_DOCS.md`, `MOBILE_EXPLORE_UX_REDESIGN_2026.md`.

---

## Trạng thái triển khai (sau roadmap)

| Phase | Hạng mục | Status |
|---|---|---|
| 1 | B8+A1+A5 Admin moderation + CommunityPage + posts | **DONE** |
| 1 | B9+M8 Social notifications + Bell Explore | **DONE** |
| 1 | M9 Public profile | **DONE** |
| 1 | B2+B3 Feed session cursor + comments pagination | **DONE** |
| 2 | B10+M5+B1 Events + ranking v1 | **DONE** |
| 2 | B7+M1+M10 Saved articles + màn Đã lưu | **DONE** |
| 2 | B11+M2+B12+M3 Search hợp nhất + topic feed | **DONE** |
| 2 | B13/M4/B4/M11/B6 Comment spam/edit/hashtag base | **DONE** (comment like API partial; reply post có sẵn) |
| 2 | A2+B17+A3 Analytics + editor preview | **DONE** |
| 3 | B15 Absolute shareUrl articles | **DONE** |
| 3 | B14 Hashtag parse + trending | **DONE** |
| 3 | B16 Video mime upload | **DONE** (feed player autoplay vẫn MVP ảnh-first) |
| 3 | A7 SCHEDULED + publishAt schema | **DONE** (schema); admin schedule UI tối thiểu |
| 3 | M7 Media aspect ratio | **DONE** |
| 3 | M13 Mention / A9 feed config | Backlog nhẹ |

### Hiệu chỉnh đối chiếu code

- **B9**: `notifications.service` + Outbox sẵn; đã thêm enum `SOCIAL_*` và wire like/comment/follow.
- **B10**: bảng `explore_engagement_events` + `POST /explore/events`.
- **B11**: `GET /explore/search`.
- **M8**: Bell Explore → NotificationScreen + unread badge.

---

## Migrations cần apply

```bash
cd backend
npx prisma migrate deploy
# hoặc apply thủ công:
# 20260917_social_notification_types
# 20260917_explore_phase2_engagement
```

---

## API mới chính

| Method | Path | Mục đích |
|---|---|---|
| GET | `/admin/moderation/reports` | Queue báo cáo |
| PATCH | `/admin/moderation/reports/:id` | Xử lý báo cáo |
| GET/PATCH/DELETE | `/admin/community/posts` | Quản lý post |
| GET | `/admin/explore/analytics` | Analytics admin |
| POST | `/explore/events` | Impression/dwell |
| GET | `/explore/search` | Search hợp nhất |
| GET | `/explore/feed?feedSessionId=` | Cursor ổn định |
| GET | `/topics/:slug/feed` | Topic feed |
| GET | `/me/saved-articles` | Bài viết đã lưu |
| GET | `/community/users/:userId` | Profile công khai |
| GET | `/community/hashtags/trending` | Trending tags |

---

## Lịch sử đánh giá gốc

Nội dung gap analysis ban đầu giữ làm tham chiếu thị trường. Các mục P0/P1 trong §2 đã được triển khai theo thứ tự §4; phần còn lại (mention autocomplete, HLS video player, feed config UI, universal links native) có thể làm sprint tiếp.
