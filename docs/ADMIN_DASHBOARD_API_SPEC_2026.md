# Đặc tả API & Dữ liệu cho màn "Tổng quan" (Admin Dashboard)

> Ngày lập: 18/09/2026
> Phạm vi: `admin/src/pages/DashboardPage.tsx` · `backend/` (module mới `admin-dashboard`) · `mobile/` (event tracking)
> Trạng thái hiện tại: Màn Tổng quan đang hiển thị **hỗn hợp dữ liệu thật + mock/hardcode + dữ liệu tính sai phạm vi**. Tài liệu này đặc tả toàn bộ API cần bổ sung để dashboard hiển thị 100% dữ liệu thật.
> Tham khảo best practices: mô hình BFF summary endpoint (Vercel/Stripe dashboard), trending score có time-decay (Hacker News gravity / Reddit hot), activity feed hợp nhất (GitHub audit-log pattern), time-series bucketing bằng `generate_series` (PostgreSQL).

---

## 0. Tóm tắt hiện trạng (Audit)

| # | Khu vực UI | Nguồn dữ liệu hiện tại | Vấn đề |
|---|---|---|---|
| 1 | KPI "Món đã xuất bản" | `GET /admin/dishes?limit=50` → filter client | ❌ Chỉ đếm trong 50 món đầu; sai khi DB > 50 món. (Lưu ý: response đã có `summary.published` nhưng FE chưa dùng) |
| 2 | KPI trend "+8% tuần này" | Hardcode trong JSX | ❌ 100% mock, không có API tăng trưởng |
| 3 | KPI "Chờ kiểm duyệt" | `GET /admin/review-queue?limit=50` → `total` | ⚠️ Số đúng nhưng fetch thừa 50 records chỉ để lấy count |
| 4 | KPI "Job đang chạy" | `GET /admin/import-jobs?limit=50` → filter client | ❌ Job active nằm ngoài 50 job mới nhất sẽ bị bỏ sót |
| 5 | KPI "Món lỗi trích xuất" | filter `status === 'FAILED'` trên 50 món | ❌ Sai phạm vi như #1 |
| 6 | Biểu đồ tăng trưởng 7 ngày | SVG với tọa độ + nhãn ngày fix cứng (`06/08`…`12/08`) | ❌ 100% mock, chưa có API time-series |
| 7 | "Nhiệm vụ cần giải quyết" — món tin cậy thấp | filter `confidenceScore < 70` trên 50 món | ❌ Sai phạm vi; backend cũng chưa persist `confidenceScore` vào bảng `dishes` (chỉ có `DishSource.reliability`) |
| 8 | "Gợi ý vận hành thông minh" | Template tĩnh + biến `pendingReview` | ⚠️ Chấp nhận được, nhưng nên nâng cấp thành insights API |
| 9 | "Pipeline tự động" | `GET /admin/import-jobs` | ✅ Dữ liệu thật, dùng được |
| 10 | "Món thịnh hành" | 5 món PUBLISHED mới update nhất + `dish.viewCount` | ❌ Model `Dish` **không có cột `viewCount`** → luôn hiển thị 0. Sắp theo `updatedAt` chứ không phải mức độ quan tâm |
| 11 | "Hoạt động gần đây" | Chỉ hiển thị import jobs | ❌ Thiếu hoạt động duyệt món, kiểm duyệt cộng đồng, audit admin |

**Nguồn dữ liệu đã có sẵn trong DB có thể tận dụng ngay:**

- `dishes` (status, publishedAt, createdAt) → KPI + time-series.
- `recommendation_logs` (event: `impression` / `click` / `save`, dishId, createdAt) → trending món ăn.
- `explore_engagement_events` (contentType, eventType, dwellMs) → engagement Explore.
- `saved_dishes` (savedAt) → độ quan tâm món.
- `reviews` (rating theo dish) → chất lượng món.
- `dish_editor_audit_logs` (action, fromStatus → toStatus, actorId) → activity feed duyệt món.
- `admin_action_audits` + `moderation_reports` → activity feed kiểm duyệt.
- `import_jobs` → pipeline + activity feed.
- `dish_sources.reliability` → tính điểm tin cậy (thay cho `confidenceScore` chưa tồn tại).

---

## 1. BACKEND — Module mới `admin-dashboard`

### 1.0 Cấu trúc file đề xuất

```
backend/src/admin-dashboard/
├── admin-dashboard.module.ts
├── admin-dashboard.controller.ts     # @Controller('admin/dashboard')
├── admin-dashboard.service.ts
└── dto/
    └── dashboard-query.dto.ts
```

Guard: `JwtAuthGuard + RolesGuard`, roles `CONTENT_ADMIN | REVIEWER | SUPER_ADMIN` (giống `admin/dishes`). Đăng ký module vào `app.module.ts`.

---

### 1.1 `GET /admin/dashboard/summary` — API tổng hợp KPI (quan trọng nhất)

Một lần gọi trả toàn bộ số liệu đếm + tăng trưởng. Backend chạy `Promise.all` các query `count`/`groupBy` (rất nhẹ vì có index), **không** trả về danh sách records.

**Query params:** `range?: '7d' | '30d'` (default `7d`).

**Response DTO:**

```jsonc
{
  "generatedAt": "2026-09-18T03:30:00Z",
  "range": { "from": "2026-09-11", "to": "2026-09-18" },

  "kpi": {
    "dishes": {
      "total": 35,                    // count dishes deletedAt=null
      "published": 33,                // count status=PUBLISHED
      "draft": 1,
      "pendingReview": 0,
      "failed": 0,                    // count status=FAILED — fix KPI #5
      "publishedThisWeek": 4,         // publishedAt >= from
      "publishedLastWeek": 3,         // tuần liền trước
      "publishedGrowthPercent": 33.3  // ((4-3)/3)*100, null nếu tuần trước = 0 — fix mock "+8%"
    },
    "importJobs": {
      "active": 0,                    // count status IN (PENDING..ENRICHING) — đếm toàn DB, fix KPI #4
      "failedLast7d": 0,
      "doneLast7d": 5
    },
    "moderation": {
      "openReports": 2,               // moderation_reports status IN (OPEN, REVIEWING)
      "activePosts": 120,
      "pendingComments": 0
    }
  },

  "tasks": [
    { "key": "PENDING_REVIEW",     "count": 0, "route": "/review",    "severity": "high" },
    { "key": "LOW_CONFIDENCE",     "count": 3, "route": "/foods?filter=low-confidence", "severity": "medium" },
    { "key": "OPEN_REPORTS",       "count": 2, "route": "/community", "severity": "high" },
    { "key": "UNLINKED_INGREDIENTS", "count": 7, "route": "/food-data", "severity": "low" },
    { "key": "FAILED_JOBS",        "count": 1, "route": "/ingest",    "severity": "medium" }
  ],

  "insight": {                        // nâng cấp "Gợi ý vận hành thông minh"
    "code": "REVIEW_BACKLOG",         // backend chọn insight ưu tiên cao nhất theo rule
    "message": "Có 5 món chờ kiểm duyệt quá 48 giờ. Ưu tiên xử lý để làm phong phú feed khám phá.",
    "ctaRoute": "/review"
  }
}
```

**Chi tiết truy vấn từng chỉ số:**

| Chỉ số | Truy vấn Prisma |
|---|---|
| `dishes.*` theo status | `dish.groupBy({ by: ['status'], where: { deletedAt: null }, _count })` — 1 query cho cả 5 số |
| `publishedThisWeek/LastWeek` | 2 × `dish.count({ where: { publishedAt: { gte, lt } } })` |
| `importJobs.active` | `importJob.count({ where: { status: { in: ACTIVE_STATUSES } } })` |
| `LOW_CONFIDENCE` | Xem mục 1.5 — cần chuẩn hóa nguồn dữ liệu tin cậy |
| `OPEN_REPORTS` | `moderationReport.count({ where: { status: { in: ['OPEN','REVIEWING'] } } })` (tái dùng logic `adminReportStats`) |
| `UNLINKED_INGREDIENTS` | Tái dùng `dishQueryService.getUnlinkedIngredients()` nhưng đổi thành count |

**Caching:** kết quả cache in-memory 60s (hoặc `@nestjs/cache-manager`) vì dashboard không cần realtime tuyệt đối; giảm tải khi nhiều admin mở cùng lúc.

---

### 1.2 `GET /admin/dashboard/growth` — Time-series cho biểu đồ 7/30 ngày

Thay thế toàn bộ SVG mock (#6). Dùng raw SQL với `generate_series` để **không bị mất ngày trống** (ngày không có món mới vẫn trả `0` — lỗi phổ biến khi group-by thuần):

```sql
SELECT d.day::date AS date,
       COUNT(ds.id) FILTER (WHERE ds.created_at::date = d.day)   AS new_dishes,
       COUNT(ds.id) FILTER (WHERE ds.published_at::date = d.day) AS published_dishes
FROM generate_series($1::date, $2::date, interval '1 day') AS d(day)
LEFT JOIN dishes ds
  ON ds.deleted_at IS NULL
 AND (ds.created_at::date = d.day OR ds.published_at::date = d.day)
GROUP BY d.day ORDER BY d.day;
```

**Query params:** `days?: number` (default 7, max 90).

**Response:**

```jsonc
{
  "days": 7,
  "series": [
    { "date": "2026-09-12", "newDishes": 5, "publishedDishes": 3, "newPosts": 12, "newArticles": 1 },
    { "date": "2026-09-13", "newDishes": 8, "publishedDishes": 6, "newPosts": 9,  "newArticles": 0 }
    // ... đủ N ngày, không có lỗ hổng ngày trống
  ]
}
```

`newPosts`/`newArticles` (optional, phase 2) giúp biểu đồ mở rộng thành multi-line khi cần.

---

### 1.3 `GET /admin/dashboard/trending-dishes` — Món thịnh hành thật

Fix #10. Nguồn dữ liệu: `recommendation_logs` (impression/click/save của mobile) + `saved_dishes` + `reviews`.

**Công thức trending score (có time-decay, tham khảo Hacker News gravity):**

```
raw   = clicks*2 + saves*5 + impressions*0.1 + ratingCount*3
score = raw / (ageHours + 2)^1.5        -- ageHours = giờ từ sự kiện gần nhất
```

Đơn giản hóa cho v1: chỉ cần đếm event trong cửa sổ 24h/7d gần nhất — đã đủ đúng nghĩa "được quan tâm nhiều trong ngày":

```sql
SELECT rl.dish_id,
       COUNT(*) FILTER (WHERE rl.event = 'click')      AS clicks,
       COUNT(*) FILTER (WHERE rl.event = 'save')       AS saves,
       COUNT(*) FILTER (WHERE rl.event = 'impression') AS impressions
FROM recommendation_logs rl
WHERE rl.created_at >= NOW() - interval '7 days' AND rl.dish_id IS NOT NULL
GROUP BY rl.dish_id
ORDER BY (COUNT(*) FILTER (WHERE rl.event='click'))*2
       + (COUNT(*) FILTER (WHERE rl.event='save'))*5
       + (COUNT(*) FILTER (WHERE rl.event='impression'))*0.1 DESC
LIMIT $1;
```

Sau đó hydrate tên/ảnh/category qua `dish.findMany({ where: { id: { in } } })`.

**Query params:** `window?: '24h' | '7d'` (default `7d`), `limit?: number` (default 5).

**Response:**

```jsonc
{
  "window": "7d",
  "items": [
    {
      "dishId": "uuid",
      "name": "Bún đậu mắm tôm",
      "slug": "bun-dau-mam-tom",
      "imageUrl": "https://.../cover.jpg",
      "categoryName": "Món Bắc",
      "metrics": { "views": 320, "saves": 45, "clicks": 120, "ratingAvg": 4.6 },
      "trendScore": 512.3,
      "rank": 1,
      "rankChange": 2               // so với window trước (optional, phase 2)
    }
  ],
  "fallback": false                  // true nếu chưa đủ event → fallback theo ratingCount + savedDish count
}
```

**Fallback bắt buộc:** khi hệ thống mới, ít event → sắp theo `saved_dishes` count + `ratingCount` để widget không bao giờ trống.

---

### 1.4 `GET /admin/dashboard/activities` — Activity feed hợp nhất

Fix #11. Union 4 nguồn, chuẩn hóa về một shape chung (GitHub audit-log pattern):

| Nguồn | Bảng | Ví dụ sự kiện |
|---|---|---|
| Import AI | `import_jobs` | `"Phở bò" — DONE 100%` |
| Duyệt món | `dish_editor_audit_logs` | `Reviewer A duyệt món "Bún riêu" (PENDING_REVIEW → PUBLISHED)` |
| Kiểm duyệt cộng đồng | `moderation_reports` (status != OPEN) + `admin_action_audits` | `Admin B gỡ bài đăng vi phạm (SPAM)` |
| Quản trị | `admin_action_audits` | `Super Admin cấp quyền REVIEWER cho user C` |

**Query params:** `limit?: number` (default 10, max 50), `types?: string` (csv filter), `cursor?: string`.

**Response:**

```jsonc
{
  "items": [
    {
      "id": "importjob:uuid",
      "type": "IMPORT_JOB",           // IMPORT_JOB | DISH_REVIEW | MODERATION | ADMIN_ACTION
      "status": "DONE",               // DONE | FAILED | IN_PROGRESS | INFO
      "title": "\"bánh tráng mắm ruốc\" — DONE",
      "description": "100% • AI_GENERATED",
      "actor": { "id": "uuid", "displayName": "Hệ thống" },
      "route": "/ingest",             // deep-link để admin click vào xem
      "occurredAt": "2026-09-18T03:17:00Z"
    }
  ],
  "pageInfo": { "nextCursor": "...", "hasNextPage": true }
}
```

Cách triển khai v1 đơn giản: query song song 4 bảng (mỗi bảng `take: limit`, orderBy time desc), merge + sort in-memory, cắt `limit`. Cursor = `occurredAt` ISO string. (Không cần bảng activity riêng ở v1; nếu về sau cần realtime thì ghi thêm vào `OutboxEvent` — đã có sẵn model.)

---

### 1.5 Chuẩn hóa "độ tin cậy" món ăn (fix #7)

Hiện `confidenceScore` chỉ tồn tại trong type của FE, **backend không persist**. Hai lựa chọn:

- **Option A (khuyến nghị, ít công):** tính on-the-fly khi cần = `AVG(dish_sources.reliability)` của món. `LOW_CONFIDENCE count` trong summary:

```sql
SELECT COUNT(*) FROM (
  SELECT d.id FROM dishes d
  JOIN dish_sources s ON s.dish_id = d.id
  WHERE d.deleted_at IS NULL AND d.status IN ('PUBLISHED','PENDING_REVIEW')
  GROUP BY d.id
  HAVING AVG(s.reliability) < 70
) t;
```

- **Option B (dài hạn):** thêm cột `confidence_score Int?` vào model `Dish` + migration, pipeline AI import ghi trực tiếp khi tạo món. Ưu điểm: query nhanh, filter được ở `/admin/dishes?maxConfidence=70`.

Nên làm A trước, B khi pipeline AI ổn định.

---

### 1.6 Bảng tổng hợp endpoint backend

| Method | Path | Mục đích | Fix vấn đề # | Ưu tiên |
|---|---|---|---|---|
| GET | `/admin/dashboard/summary` | Toàn bộ KPI + tasks + insight | 1,2,3,4,5,7,8 | **P0** |
| GET | `/admin/dashboard/growth?days=7` | Time-series biểu đồ | 6 | **P0** |
| GET | `/admin/dashboard/trending-dishes?window=7d&limit=5` | Món thịnh hành thật | 10 | **P1** |
| GET | `/admin/dashboard/activities?limit=10` | Activity feed hợp nhất | 11 | **P1** |

Tất cả: `@Roles('CONTENT_ADMIN','REVIEWER','SUPER_ADMIN')`, cache 60s riêng từng endpoint, Swagger tag `Admin — Dashboard`.

---

## 2. MOBILE — Nguồn phát sinh dữ liệu (event tracking)

Dashboard chỉ chính xác khi mobile gửi đủ tín hiệu. Hiện trạng:

| Tín hiệu | Hiện có? | Ghi chú |
|---|---|---|
| Save/unsave món | ✅ | `dishes.service.saveDish` đã log `recommendation_logs(event='save')` |
| Impression/click từ Random & Recommendation | ✅ một phần | `recommendation_logs` + `recommendation_events` |
| Explore article/post impression + dwell | ✅ | `POST /explore/events` (đã ship phase 2) |
| **Xem chi tiết món ăn (dish view)** | ❌ **THIẾU** | Không có API log view khi mở `FoodDetailScreen` → trending món không có dữ liệu "views" |

### Việc cần làm ở mobile

1. **M-D1 (P0): Log dish view.** Khi `FoodDetailScreen`/`DishDetailLoaderScreen` mount thành công, gửi event (fire-and-forget, debounce theo dishId trong session để không spam):

```ts
// mobile/src/services/api/dishes.ts
export const logDishView = (dishId: string, source?: string) =>
  api.post('/dishes/' + dishId + '/events', { event: 'view', source }).catch(() => {})
```

Backend thêm endpoint `POST /dishes/:id/events` (body: `{ event: 'view' | 'click' | 'share', source?: 'explore' | 'random' | 'search' | 'weekly_plan' }`) ghi vào `recommendation_logs`. Rate-limit 1 view/dish/user/5 phút (check log gần nhất hoặc dùng cache) để chống đếm ảo.

2. **M-D2 (P1): Bổ sung `source` cho save event** hiện có, để dashboard sau này phân tích được kênh nào hiệu quả.

3. **M-D3 (P2 — optional): Batch events.** Nếu lo lượng request, gom event vào queue và flush mỗi 10s/khi app background — giống pattern `POST /explore/events` đã nhận mảng.

> Mobile **không cần** gọi API dashboard nào — mobile chỉ là producer dữ liệu.

---

## 3. ADMIN — Việc cần làm ở frontend

### 3.1 API client + hooks mới

```
admin/src/api/dashboard.ts        # dashboardApi.summary / growth / trending / activities
admin/src/hooks/useDashboard.ts   # useDashboardSummary, useDashboardGrowth, useTrendingDishes, useDashboardActivities
```

```ts
// admin/src/api/dashboard.ts
export const dashboardApi = {
  summary: (range?: '7d' | '30d') =>
    api.get<DashboardSummary>('/admin/dashboard/summary', { params: { range } }).then((r) => r.data),
  growth: (days = 7) =>
    api.get<GrowthResponse>('/admin/dashboard/growth', { params: { days } }).then((r) => r.data),
  trendingDishes: (window: '24h' | '7d' = '7d', limit = 5) =>
    api.get<TrendingResponse>('/admin/dashboard/trending-dishes', { params: { window, limit } }).then((r) => r.data),
  activities: (limit = 10) =>
    api.get<ActivitiesResponse>('/admin/dashboard/activities', { params: { limit } }).then((r) => r.data),
}
```

Refetch policy (React Query): `summary`/`growth` staleTime 60s; `activities` refetchInterval 30s (khớp nhãn "Realtime"); `trending` staleTime 5 phút.

### 3.2 Sửa `DashboardPage.tsx`

| Khu vực | Thay đổi |
|---|---|
| 4 KPI cards | Bỏ `useAdminDishes({limit:50})` cho mục đích đếm → đọc `summary.kpi.dishes.published/total/pendingReview/failed`, `summary.kpi.importJobs.active`. Trend badge đọc `publishedGrowthPercent` (ẩn badge nếu `null`; đỏ/xanh theo dấu) |
| Biểu đồ 7 ngày | Xóa toàn bộ tọa độ + nhãn ngày hardcode trong `ActivityChart`. Nhận props `series` từ `useDashboardGrowth`, scale tọa độ theo `max` thực tế (đã có sẵn pattern `ModernLineChart` trong `ReportsPage.tsx` — tái sử dụng/trích thành component chung `components/charts/LineChart.tsx`) |
| TasksWidget | Render động từ mảng `summary.tasks` (key → label/icon map ở FE), thêm 3 task mới: báo cáo vi phạm, nguyên liệu chưa link, job lỗi |
| Insight banner | Đọc `summary.insight.message` + `ctaRoute`; giữ fallback template cũ nếu API chưa trả |
| PopularFoodsWidget | Đổi sang `useTrendingDishes`; hiển thị `metrics.views`/`saves` thật; badge nhỏ "Dữ liệu 7 ngày"; khi `fallback: true` đổi caption thành "Món được lưu nhiều nhất" |
| ActivityWidget | Đổi sang `useDashboardActivities`; icon theo `type` (IMPORT_JOB→Zap, DISH_REVIEW→ShieldCheck, MODERATION→Heart, ADMIN_ACTION→Users); click item navigate `item.route` |
| PipelineWidget | Giữ nguyên `useImportJobs` (đang đúng) nhưng giảm `limit` xuống 10 vì chỉ hiển thị 4 |

### 3.3 UX bổ sung

- Skeleton riêng từng widget (không chặn cả trang bằng 1 biến `loading` chung như hiện tại).
- Empty state + error state có nút "Thử lại" cho từng widget.
- Selector phạm vi thời gian `7 ngày / 30 ngày` ở góc biểu đồ (truyền `days` xuống API).
- Nhãn ngày trục X format `dd/MM` từ `series[].date` thật.

---

## 4. Thứ tự triển khai đề xuất

| Bước | Việc | Layer | Ưu tiên |
|---|---|---|---|
| 1 | Module `admin-dashboard` + `GET /summary` + `GET /growth` | Backend | P0 |
| 2 | `dashboard.ts` API client + wire 4 KPI + biểu đồ + tasks | Admin | P0 |
| 3 | `POST /dishes/:id/events` + mobile log dish view (M-D1) | Backend + Mobile | P0 |
| 4 | `GET /trending-dishes` (kèm fallback) + wire widget | Backend + Admin | P1 |
| 5 | `GET /activities` union 4 nguồn + wire widget | Backend + Admin | P1 |
| 6 | Insight rules engine (REVIEW_BACKLOG, LOW_CONFIDENCE_SPIKE, JOB_FAILURE_RATE…) | Backend | P2 |
| 7 | Cột `confidence_score` persist vào `dishes` (Option B mục 1.5) | Backend | P2 |
| 8 | Batch events mobile + `rankChange` trending | Mobile + Backend | P2 |

**Lưu ý về dữ liệu lịch sử:** `trending-dishes` và `growth` chỉ chính xác **kể từ khi mobile bắt đầu log dish view** (bước 3). Vì vậy nên ship bước 3 cùng đợt với bước 1–2, và bật fallback ở trending trong 1–2 tuần đầu.

---

## 5. Định nghĩa Done

- [ ] Không còn bất kỳ chuỗi/tọa độ/ngày tháng hardcode nào trong `DashboardPage.tsx`.
- [ ] Mọi con số KPI đúng với `COUNT(*)` trực tiếp trong DB (kiểm chứng bằng SQL tay).
- [ ] Biểu đồ hiển thị đúng 7 ngày gần nhất tính từ hôm nay, ngày trống = 0.
- [ ] "Món thịnh hành" đổi thứ hạng khi có tương tác thật từ mobile (test: mở 1 món nhiều lần từ 2 tài khoản → món lên rank).
- [ ] "Hoạt động gần đây" hiển thị ít nhất 3 loại sự kiện khác nhau (import, duyệt món, kiểm duyệt).
- [ ] Tất cả endpoint mới có Swagger docs + roles guard + cache 60s.
- [ ] Admin build (`tsc && vite build`) và backend build pass, không lint error.
