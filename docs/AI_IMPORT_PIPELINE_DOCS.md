# 🤖 Tài liệu — Hệ thống Nhập Món Tự Động bằng AI (AI Import Pipeline)

> **Phiên bản:** 1.0  
> **Module:** `backend/src/ai-import/`  
> **Giao diện Admin:** `admin/src/pages/IngestPage.tsx`

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Công nghệ sử dụng](#2-công-nghệ-sử-dụng)
3. [Kiến trúc hệ thống](#3-kiến-trúc-hệ-thống)
4. [Pipeline 6 bước](#4-pipeline-6-bước)
5. [API Endpoints](#5-api-endpoints)
6. [WebSocket Real-time](#6-websocket-real-time)
7. [Giao diện Admin (IngestPage)](#7-giao-diện-admin-ingestpage)
8. [Cấu trúc file](#8-cấu-trúc-file)
9. [Cấu hình môi trường](#9-cấu-hình-môi-trường)
10. [Luồng dữ liệu hoàn chỉnh](#10-luồng-dữ-liệu-hoàn-chỉnh)
11. [Giới hạn và TODO](#11-giới-hạn-và-todo)

---

## 1. Tổng quan

Hệ thống AI Import Pipeline cho phép admin **nhập món ăn mới vào hệ thống chỉ bằng tên món**, thay vì nhập tay toàn bộ thông tin. AI sẽ tự động:

- Sinh công thức đầy đủ (nguyên liệu, các bước nấu, thời gian, độ khó)
- Tính toán dinh dưỡng ước tính (kcal, protein, carbs, fat, fiber, sodium)
- Tìm ảnh đại diện từ Wikipedia / Unsplash
- Tạo và liên kết nguyên liệu vào kho `Ingredient`
- Tạo bản nháp món ăn (`status=DRAFT`) sẵn sàng để kiểm duyệt

Admin theo dõi **real-time** tiến trình qua WebSocket, sau khi hoàn thành có thể xem preview chi tiết và mở form chỉnh sửa trực tiếp.

---

## 2. Công nghệ sử dụng

### Backend

| Công nghệ | Vai trò |
|---|---|
| **NestJS** | Framework backend, module/service/controller/gateway |
| **OpenAI SDK** (`openai` npm package) | Gọi AI API theo chuẩn OpenAI Chat Completions |
| **xKiro AI Gateway** | Proxy AI với nhiều model, base URL: `https://api.xkiro.com/v1` |
| **DeepSeek Chat v3.1** (`deepseek/deepseek-chat-v3.1`) | Model AI mặc định — free, nhanh, tốt cho JSON output |
| **Socket.IO** (`@nestjs/websockets`, `socket.io`) | WebSocket server push real-time progress |
| **Prisma ORM** | Lưu dish, ingredients, nutrition, recipeSteps, DishMedia |
| **Supabase Storage** | Upload ảnh AI tìm được vào bucket `dish-images` |
| **Supabase JS SDK** | Client để upload file lên storage |
| **Wikipedia API** | Tìm ảnh cho món ăn và nguyên liệu (miễn phí, không cần key) |
| **Unsplash API** | Tìm ảnh chất lượng cao (cần `UNSPLASH_ACCESS_KEY`) |
| **slugify** | Tạo slug URL-friendly từ tên món tiếng Việt |
| **In-memory Store** | Giữ tối đa 100 jobs gần nhất (không persist qua restart) |

### Admin Frontend

| Công nghệ | Vai trò |
|---|---|
| **React 19** | UI framework |
| **socket.io-client** | Kết nối WebSocket nhận real-time progress |
| **@tanstack/react-query** | Fetch danh sách jobs, invalidation |
| **shadcn/ui** (Button, Card, Input, Badge) | UI components |
| **Tailwind CSS** | Styling |
| **lucide-react** | Icons |

---

## 3. Kiến trúc hệ thống

```
Admin UI (IngestPage)
    │
    │  POST /admin/import-jobs  (REST)
    ▼
ImportJobsController
    │
    ▼
ImportJobsService ──── ImportJobsStore (in-memory, max 100 jobs)
    │
    │  runPipeline() — bất đồng bộ, không block HTTP response
    │
    ├──── Step 1: SEARCHING   — phân tích tên món, build context
    ├──── Step 2: EXTRACTING  ─── AiService.generateDishData()
    │                              └─ xKiro → DeepSeek → JSON công thức
    ├──── Step 3: NORMALIZING — chuẩn hóa đơn vị (chén→ml, muỗng→g)
    ├──── Step 4: RECONCILING ─── PrismaService (check trùng slug)
    │                              └─ upsertIngredients() với fuzzy match
    ├──── Step 5: ENRICHING   ─── AiService.estimateNutrition()
    │                              └─ AiService.searchDishImage()
    │                                   ├─ Wikipedia VI/EN API
    │                                   └─ Unsplash API (nếu có key)
    └──── Step 6: DRAFTING    ─── PrismaService.dish.create()
                                   ├─ dishIngredients (linked)
                                   ├─ nutrition (1-1)
                                   ├─ recipeSteps
                                   └─ DishMedia (upload Supabase Storage)
    │
    │  Mỗi bước → ImportGateway.emitProgress()
    ▼
Socket.IO Gateway (/import namespace)
    │
    │  emit `job:{id}` + `job:progress`
    ▼
Admin UI — StepTracker nhận real-time cập nhật
```

---

## 4. Pipeline 6 bước

| Bước | Key | Tên hiển thị | % | Công việc |
|---|---|---|---|---|
| 1 | `SEARCHING` | Tìm nguồn | 0% | Phân tích tên món, xác nhận yêu cầu, build context |
| 2 | `EXTRACTING` | Trích xuất AI | 16% | Gọi AI sinh công thức đầy đủ (nguyên liệu + các bước) |
| 3 | `NORMALIZING` | Chuẩn hóa | 32% | Đổi đơn vị dân gian → chuẩn (chén→ml, muỗng canh→ml) |
| 4 | `RECONCILING` | Đối chiếu | 50% | Kiểm tra trùng slug; upsert tất cả nguyên liệu vào kho `Ingredient` |
| 5 | `ENRICHING` | Làm giàu dữ liệu | 68% | Tính dinh dưỡng AI + tìm ảnh (Wikipedia/Unsplash) |
| 6 | `DRAFTING` | Tạo bản nháp | 84% | Lưu Dish DRAFT + DishMedia vào PostgreSQL + Supabase Storage |
| ✅ | `DONE` | Hoàn tất | 100% | Pipeline thành công, `resultDishId` sẵn sàng |
| ❌ | `FAILED` | Thất bại | — | Lỗi bất kỳ bước nào |
| 🚫 | `CANCELLED` | Đã hủy | — | Admin hủy thủ công qua API |

### Chi tiết Bước 2 — AI Prompt

AI nhận prompt tiếng Việt yêu cầu trả về JSON thuần:

```json
{
  "name": "tên món đầy đủ",
  "shortDescription": "mô tả 1-2 câu",
  "difficulty": "EASY | MEDIUM | HARD",
  "prepMinutes": 30,
  "cookMinutes": 45,
  "priceMin": 40000,
  "priceMax": 80000,
  "servings": 4,
  "servingSize": "1 tô (400g)",
  "ingredients": [
    {
      "name": "thịt bò",
      "quantity": 500,
      "unit": "g",
      "preparation": "thái lát mỏng",
      "group": "Nguyên liệu chính"
    }
  ],
  "steps": [
    {
      "stepNumber": 1,
      "title": "Sơ chế nguyên liệu",
      "description": "Rửa sạch và thái nguyên liệu...",
      "durationMinutes": 15,
      "tips": "Nên ngâm thịt trước 10 phút để mềm hơn"
    }
  ],
  "tips": ["mẹo chung 1", "mẹo chung 2"],
  "tags": ["tag1", "tag2"]
}
```

**Model config:** `temperature: 0.2`, `max_tokens: 3000`

### Chi tiết Bước 4 — Upsert Nguyên liệu

Logic fuzzy matching để tránh tạo trùng:

1. **Chuẩn hóa tên AI** — xóa mô tả trong ngoặc và "hoặc X"
   - `"Rau thơm (húng lủi, ngò gai)"` → `"Rau thơm"`
   - `"Dầu ăn (để phi hành)"` → `"Dầu ăn"`
2. **Tạo key** — bỏ dấu, thường hóa, bỏ ký tự đặc biệt
3. **Batch query** toàn bộ `Ingredient` trong DB một lần
4. **Exact match** → dùng ID cũ
5. **Prefix match** (A bắt đầu B hoặc ngược lại) → dùng ID cũ
6. **Không tìm thấy** → tạo mới, tìm ảnh qua Wikipedia/Unsplash
7. Tìm ảnh chạy **song song**, tối đa 5 concurrent, timeout 4s/ảnh

### Chi tiết Bước 5 — Tìm ảnh

**Cho món ăn** (`searchDishImage`):
1. Wikipedia VI (chính xác nhất với tên món Việt)
2. Wikipedia EN (dùng bảng map tên Việt → tiêu đề Wikipedia EN)
3. Unsplash (fallback, scoring theo keyword relevance)

**Cho nguyên liệu** (`searchIngredientImage`):
1. Unsplash + query `"{tên EN} food"` + keyword scoring
2. Wikipedia VI (exact title match)
3. Wikipedia EN (exact title match)

Bảng map VI → EN gồm **150+ entries** cho nguyên liệu phổ biến: thịt gà, hải sản, rau củ, gia vị, tinh bột...

---

## 5. API Endpoints

> **Auth:** `Bearer JWT` — chỉ role `SUPER_ADMIN` hoặc `CONTENT_ADMIN`  
> **Base:** `POST/GET /v1/admin/import-jobs`

### `POST /v1/admin/import-jobs`

Tạo job mới. Pipeline chạy **bất đồng bộ** ngay lập tức, API trả về job object ngay.

**Request Body:**
```json
{
  "query": "Phở bò Hà Nội",
  "relatedKeywords": ["bún phở", "nước dùng xương"],
  "regionHint": "north",
  "sourceTypes": ["AI_GENERATED"]
}
```

| Field | Type | Required | Mô tả |
|---|---|---|---|
| `query` | string | ✅ | Tên món ăn cần nhập |
| `relatedKeywords` | string[] | ❌ | Từ khóa bổ sung để AI hiểu rõ hơn |
| `regionHint` | `north` \| `central` \| `south` | ❌ | Gợi ý vùng miền |
| `sourceTypes` | string[] | ❌ | Loại nguồn (mặc định: `["AI_GENERATED"]`) |

**Response `201 Created`:**
```json
{
  "id": "uuid",
  "query": "Phở bò Hà Nội",
  "status": "PENDING",
  "currentStep": 0,
  "totalSteps": 6,
  "progress": 0,
  "createdAt": "2026-08-26T10:00:00Z",
  "logs": []
}
```

---

### `GET /v1/admin/import-jobs`

Danh sách jobs, mới nhất trước. Cursor pagination.

**Query Params:**

| Param | Type | Mô tả |
|---|---|---|
| `limit` | number | Số lượng (mặc định 20) |
| `cursor` | string (uuid) | Con trỏ trang tiếp theo |

**Response:**
```json
{
  "data": [...],
  "nextCursor": "uuid",
  "total": 45
}
```

---

### `GET /v1/admin/import-jobs/:id`

Chi tiết 1 job kèm toàn bộ logs từng bước.

**Response:**
```json
{
  "id": "uuid",
  "query": "Phở bò Hà Nội",
  "status": "DONE",
  "currentStep": 6,
  "totalSteps": 6,
  "progress": 100,
  "currentStepName": "Hoàn tất",
  "currentStepMessage": "Bản nháp \"Phở bò Hà Nội\" đã sẵn sàng để kiểm duyệt",
  "resultDishId": "uuid-cua-dish",
  "suggestedImageUrl": "https://...",
  "completedAt": "2026-08-26T10:02:30Z",
  "logs": [
    {
      "step": "SEARCHING",
      "stepIndex": 1,
      "message": "Đã xác nhận tên món: \"Phở bò Hà Nội\"",
      "detail": "Vùng miền: Miền Bắc",
      "timestamp": "2026-08-26T10:00:01Z"
    },
    {
      "step": "EXTRACTING",
      "stepIndex": 2,
      "message": "AI đã sinh: 18 nguyên liệu, 5 bước nấu",
      "detail": "Độ khó: MEDIUM | Thời gian: 150 phút",
      "timestamp": "2026-08-26T10:00:08Z"
    }
    // ...
  ]
}
```

---

### `POST /v1/admin/import-jobs/:id/cancel`

Hủy job đang chạy (nếu còn trong trạng thái active).

**Response:** Job object với `status: "CANCELLED"`

---

## 6. WebSocket Real-time

### Kết nối

```
ws://localhost:3001/import
```

- **Namespace:** `/import`
- **Thư viện:** Socket.IO (client dùng `socket.io-client`)
- **Auth:** Hiện tại không verify JWT trên WS (chỉ HTTP endpoints mới verify)

### Events nhận

| Event | Mô tả |
|---|---|
| `job:{jobId}` | Update của 1 job cụ thể (theo UUID) |
| `job:progress` | Broadcast tất cả updates mọi job |

### Payload `WsJobProgress`

```typescript
interface WsJobProgress {
  jobId: string;
  status: ImportJobStatus;          // PENDING | SEARCHING | ... | DONE | FAILED | CANCELLED
  step: string;                     // Tên bước hiện tại
  stepIndex: number;                // 1–6
  totalSteps: number;               // 6
  progress: number;                 // 0–100
  message: string;                  // Mô tả chi tiết hành động hiện tại
  resultDishId?: string;            // Có khi status=DONE
  suggestedImageUrl?: string;       // URL ảnh AI tìm được
  errorMessage?: string;            // Có khi status=FAILED
}
```

### Ví dụ kết nối phía Admin (React)

```typescript
import { io } from 'socket.io-client'

const socket = io('http://localhost:3001/import')

// Lắng nghe job cụ thể
socket.on(`job:${jobId}`, (payload: WsJobProgress) => {
  updateJobProgress(payload)
})

// Lắng nghe tất cả jobs
socket.on('job:progress', (payload: WsJobProgress) => {
  updateJobList(payload)
})
```

---

## 7. Giao diện Admin (IngestPage)

**URL:** `/ingest`  
**File:** `admin/src/pages/IngestPage.tsx`

### Chức năng đã implement

#### Form tạo job
- **Ô nhập tên món** — required
- **Từ khóa liên quan** — optional, thêm nhiều tags
- **Vùng miền** — dropdown: Miền Bắc / Trung / Nam
- **Nguồn dữ liệu** — checkbox multi: AI tổng hợp, Website, Video, USDA

#### StepTracker
Hiển thị **real-time pipeline** với:
- 6 bubbles timeline dọc (pending → active với spinner → done/failed)
- Progress bar phần trăm
- Message chi tiết của bước đang chạy
- Cập nhật qua `useJobProgress(jobId)` hook kết nối WebSocket

#### Lịch sử jobs (Job Cards)
Mỗi job card hiển thị:
- Thumbnail ảnh (từ `suggestedImageUrl`) hoặc emoji placeholder
- Badge status màu sắc (PENDING / DONE / FAILED...)
- Summary: số nguyên liệu, bước nấu, calories, protein (parse từ logs)
- Nhấn card → mở `ImportJobPreviewModal`
- Job đang chạy → hiển thị `StepTracker` inline trong card

#### ImportJobPreviewModal
Preview chi tiết kết quả AI:
- Ảnh đại diện
- Tên món, mô tả, độ khó, thời gian, giá
- Nguyên liệu đầy đủ với nhóm (Nguyên liệu chính / Gia vị / Rau ăn kèm)
- Các bước nấu với thời gian và mẹo cho từng bước
- Dinh dưỡng (kcal, protein, carbs, fat, fiber)
- Nút **"Mở để chỉnh sửa"** → điều hướng sang FoodsPage với `?openEdit={dishId}` để mở EditDishModal

### Hooks

| Hook | File | Mô tả |
|---|---|---|
| `useImportJobs` | `hooks/useImportJobs.ts` | Fetch danh sách jobs + React Query |
| `useCreateImportJob` | `hooks/useImportJobs.ts` | Mutation tạo job mới |
| `useImportJobActions` | `hooks/useImportJobs.ts` | Cancel job |
| `useJobProgress(id)` | `hooks/useImportJobs.ts` | Socket.IO listener cho 1 job |

---

## 8. Cấu trúc file

```
backend/src/ai-import/
├── ai-import.module.ts          # Module NestJS — khai báo providers
├── ai.service.ts                # AiService: gọi AI + tìm ảnh Wikipedia/Unsplash
├── import-jobs.controller.ts    # HTTP REST controller (CRUD jobs)
├── import-jobs.service.ts       # Orchestrate pipeline 6 bước
├── import-jobs.store.ts         # In-memory job store (tối đa 100 jobs)
├── import.gateway.ts            # Socket.IO WebSocket gateway (/import)
└── dto/
    ├── create-import-job.dto.ts # DTO input: query, regionHint, relatedKeywords
    └── import-job.dto.ts        # DTO output: ImportJobDto, WsJobProgress, etc.

admin/src/
├── pages/IngestPage.tsx                         # Trang "Nhập món tự động"
├── api/import-jobs.ts                           # API client functions
├── hooks/useImportJobs.ts                       # React Query + Socket.IO hooks
└── components/ui/import-job-preview-modal.tsx   # Preview modal kết quả AI
```

---

## 9. Cấu hình môi trường

File: `backend/.env.local`

```env
# ── AI (xKiro Gateway) ────────────────────────────
XKIRO_API_KEY=xkiro_xxxxxxxxxxxxxxxxxxxxx
XKIRO_BASE_URL=https://api.xkiro.com/v1
XKIRO_MODEL=deepseek/deepseek-chat-v3.1

# ── Tìm ảnh ───────────────────────────────────────
UNSPLASH_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxx   # Optional — free plan 50 req/h

# ── Supabase (để upload ảnh) ──────────────────────
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxxxxx
```

### Thay đổi model AI

```env
# Các model miễn phí trên xKiro (thử đầu 2026)
XKIRO_MODEL=deepseek/deepseek-chat-v3.1   # Mặc định — nhanh, tốt cho JSON
XKIRO_MODEL=qwen/qwen3.5-flash            # Thay thế
```

---

## 10. Luồng dữ liệu hoàn chỉnh

```
Admin nhập "Phở bò Hà Nội" → POST /admin/import-jobs
         │
         ▼ (response ngay, pipeline chạy nền)
[WS: SEARCHING]  → "Đang phân tích yêu cầu cho món Phở bò Hà Nội..."
         │
         ▼
[WS: EXTRACTING] → Gọi xKiro → DeepSeek
                   → Nhận JSON: 18 nguyên liệu, 5 bước
[WS: log]        → "AI đã sinh: 18 nguyên liệu, 5 bước nấu"
         │
         ▼
[WS: NORMALIZING] → muỗng canh → 15ml, chén → 240ml
[WS: log]         → "Đã chuẩn hóa 18 nguyên liệu"
         │
         ▼
[WS: RECONCILING] → Check slug "pho-bo-ha-noi" → không trùng
                  → Upsert 18 nguyên liệu: 14 đã có, 4 tạo mới
                  → Tìm ảnh 4 nguyên liệu mới (parallel, 4s timeout)
[WS: log]         → "Đã xử lý 18 nguyên liệu | Mới: 4"
         │
         ▼
[WS: ENRICHING]  → estimateNutrition() + searchDishImage() [parallel]
                 → 520 kcal, 28g protein | Ảnh Wikipedia VI
[WS: log]        → "Dinh dưỡng: 520 kcal, 28g đạm | Ảnh: tìm được"
         │
         ▼
[WS: DRAFTING]  → dish.create() với dishIngredients + nutrition + recipeSteps
                → Upload ảnh → Supabase Storage → DishMedia record
[WS: log]       → "Đã tạo bản nháp thành công! Dish ID: abc123"
         │
         ▼
[WS: DONE]      → resultDishId: "abc123", progress: 100

Admin nhấn "Xem bản nháp" → ImportJobPreviewModal
Admin nhấn "Mở để chỉnh sửa" → /foods?openEdit=abc123 → EditDishModal
Admin kiểm duyệt → Publish (DRAFT → PUBLISHED)
```

---

## 11. Giới hạn và TODO

### Giới hạn hiện tại

| # | Vấn đề | Ảnh hưởng |
|---|---|---|
| 1 | **In-memory store** — jobs mất khi restart server | Lịch sử jobs biến mất sau deploy |
| 2 | **Không persist qua restart** | Không thể xem lại jobs cũ sau khi server khởi động lại |
| 3 | **WebSocket không auth** | Client nào cũng nghe được `/import` namespace |
| 4 | **Unsplash rate limit** | 50 req/h (free plan) → bị giới hạn khi import nhiều |
| 5 | **AI response không ổn định** | DeepSeek đôi khi trả không đúng format JSON → dùng fallback |
| 6 | **Không validate dupname** | Chỉ check slug, có thể tạo 2 món cùng tên nhưng slug khác |

### TODO

- [ ] **Lưu jobs vào PostgreSQL** thay vì in-memory (thêm bảng `import_jobs` vào Prisma schema)
- [ ] **WebSocket auth** — verify JWT token khi connect
- [ ] **Admin Community page** — trang moderation bài đăng cộng đồng
- [ ] **Retry từng bước** — hiện cancel toàn bộ job nếu 1 bước lỗi
- [ ] **Bulk import** — nhập nhiều món cùng lúc từ file CSV/JSON
- [ ] **Video extraction** (step type `VIDEO`) — hiện là stub, chưa implement
- [ ] **Website JSON-LD extraction** (step type `JSON_LD`) — hiện là stub
