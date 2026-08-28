# 🍜 Tài liệu Database — Phân hệ Món ăn (Dish)

> **DB:** Supabase PostgreSQL 17  
> **ORM:** Prisma 7 + PrismaClientPg adapter  
> **Phiên bản schema:** v2.0 (BA-004)  
> **Cập nhật:** 2026-08-21

---

## 📋 Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Enum định nghĩa](#2-enum-định-nghĩa)
3. [Bảng Dish (dishes)](#3-bảng-dish)
4. [Taxonomy — Danh mục phân loại](#4-taxonomy)
5. [Thành phần & Dị ứng](#5-thành-phần--dị-ứng)
6. [Dinh dưỡng & Công thức](#6-dinh-dưỡng--công-thức)
7. [Media](#7-media)
8. [Tương tác người dùng](#8-tương-tác-người-dùng)
9. [Lịch sử Random & Gợi ý](#9-lịch-sử-random--gợi-ý)
10. [ERD Diagram (text)](#10-erd-diagram-text)
11. [Indexes & Performance](#11-indexes--performance)
12. [Lifecycle trạng thái món ăn](#12-lifecycle-trạng-thái)

---

## 1. Tổng quan kiến trúc

```
dishes                          ← Bảng trung tâm
  ├── dish_category_links       ← N-N với dish_categories
  ├── dish_meal_types           ← N-N với meal_type_tags
  ├── dish_diet_types           ← N-N với diet_types
  ├── dish_goals                ← N-N với goals (có score)
  ├── dish_ingredients          ← 1-N danh sách nguyên liệu
  │     └── ingredients         ← FK tùy chọn (nullable)
  ├── dish_allergens            ← N-N với allergens (có level)
  ├── dish_nutrition            ← 1-1 thông tin dinh dưỡng
  ├── recipe_steps              ← 1-N các bước nấu
  ├── dish_media                ← 1-N ảnh/video
  ├── reviews                   ← 1-N đánh giá
  ├── saved_dishes              ← N-N với users (lưu yêu thích)
  ├── random_histories          ← lịch sử random
  └── recommendation_logs       ← audit log gợi ý
```

**Taxonomy độc lập (catalog / seed data):**
```
regions → provinces
dish_categories
meal_type_tags
diet_types
allergens
ingredients
goals
```

---

## 2. Enum định nghĩa

### `DishStatus` — Trạng thái món ăn
| Giá trị | Mô tả |
|---------|-------|
| `DRAFT` | Bản nháp — AI tạo hoặc admin đang soạn |
| `PROCESSING` | Đang xử lý pipeline AI |
| `PENDING_REVIEW` | Chờ reviewer duyệt |
| `CHANGES_REQUESTED` | Reviewer yêu cầu chỉnh sửa |
| `PUBLISHED` | Đã xuất bản, hiển thị cho user |
| `UNPUBLISHED` | Tạm ẩn |
| `REJECTED` | Bị từ chối |
| `FAILED` | Pipeline thất bại |
| `ARCHIVED` | Lưu trữ, không hiển thị |

### `DishDifficulty` — Độ khó
| Giá trị | Mô tả |
|---------|-------|
| `EASY` | Dễ |
| `MEDIUM` | Trung bình |
| `HARD` | Khó |

### `AllergenLevel` — Mức độ dị ứng trong món
| Giá trị | Mô tả |
|---------|-------|
| `CONTAINS` | Chứa thành phần gây dị ứng |
| `MAY_CONTAIN` | Có thể chứa (cross-contamination) |
| `FREE_FROM` | Không chứa |

### `MediaType`
| Giá trị | Mô tả |
|---------|-------|
| `IMAGE` | Ảnh |
| `VIDEO` | Video |

### `ModerationStatus` — Kiểm duyệt media
| Giá trị | Mô tả |
|---------|-------|
| `PENDING` | Chờ duyệt |
| `APPROVED` | Đã duyệt |
| `REJECTED` | Bị từ chối |

---

## 3. Bảng Dish

**Tên bảng:** `dishes`

### 3.1 Thông tin cơ bản

| Cột | Kiểu | Bắt buộc | Mô tả |
|-----|------|----------|-------|
| `id` | UUID | ✅ | PK, auto-generated |
| `name` | VARCHAR(150) | ✅ | Tên món (VD: "Phở bò Hà Nội") |
| `slug` | VARCHAR(180) | ✅ | URL-friendly slug (VD: "pho-bo-ha-noi") |
| `alternate_names` | String[] | | Tên gọi khác / vùng miền |
| `search_text` | TEXT | | Full-text search index (denormalized) |
| `short_description` | VARCHAR(300) | | Mô tả ngắn cho card |
| `full_description` | TEXT | | Mô tả đầy đủ (Markdown) |
| `status` | DishStatus | ✅ | Trạng thái hiện tại (default: `DRAFT`) |

### 3.2 Nguồn gốc & Vùng miền

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `region_id` | UUID? | FK → `regions.id` |
| `province_id` | UUID? | FK → `provinces.id` |
| `origin_text` | VARCHAR(200)? | Mô tả nguồn gốc tự do |

### 3.3 Thông tin nấu ăn

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `difficulty` | DishDifficulty? | Độ khó |
| `prep_minutes` | SMALLINT? | Thời gian chuẩn bị (phút) |
| `cook_minutes` | SMALLINT? | Thời gian nấu (phút) |
| `servings` | DECIMAL(6,2)? | Số khẩu phần |
| `primary_meal_slot` | VARCHAR(50)? | Bữa chính: "breakfast", "lunch", "dinner" |

### 3.4 Giá cả

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `price_min` | INT? | Giá thấp nhất (VND) |
| `price_max` | INT? | Giá cao nhất (VND) |
| `currency` | CHAR(3) | Đơn vị tiền tệ (default: "VND") |
| `is_featured` | BOOLEAN | Món nổi bật |

### 3.5 Rating (denormalized)

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `rating_avg` | DECIMAL(3,2) | Điểm TB (0.00–5.00), cập nhật bởi trigger |
| `rating_count` | INT | Số lượt đánh giá |

### 3.6 Biến thể (Variants)

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `parent_dish_id` | UUID? | Self-relation: FK → `dishes.id` (max 1 cấp) |

> **Ví dụ:** "Phở bò tái" và "Phở bò chín" là variants của "Phở bò"

### 3.7 Versioning & Lifecycle

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `version` | INT | Phiên bản nội dung (tăng mỗi lần edit) |
| `publish_version` | INT | Phiên bản đã publish lần cuối |
| `published_at` | TIMESTAMPTZ? | Thời điểm publish |
| `reviewed_at` | TIMESTAMPTZ? | Thời điểm review |
| `reviewed_by` | UUID? | ID của reviewer |
| `archived_at` | TIMESTAMPTZ? | Thời điểm archive |
| `deleted_at` | TIMESTAMPTZ? | Soft delete |
| `created_by` | UUID? | ID người tạo |
| `updated_by` | UUID? | ID người cập nhật cuối |
| `created_at` | TIMESTAMPTZ | Auto |
| `updated_at` | TIMESTAMPTZ | Auto (updatedAt) |

---

## 4. Taxonomy

### 4.1 Region — Vùng miền

**Bảng:** `regions`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | UUID | PK |
| `code` | VARCHAR(50) | Unique code (VD: "NORTH", "SOUTH", "CENTRAL") |
| `name` | VARCHAR(100) | Tên vùng (VD: "Miền Bắc") |
| `is_active` | BOOLEAN | Hiển thị hay không |

**Seed data mặc định:** `NORTH` · `CENTRAL` · `SOUTH` · `HIGHLAND` · `MEKONG`

---

### 4.2 Province — Tỉnh thành

**Bảng:** `provinces`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | UUID | PK |
| `code` | VARCHAR(50) | Unique code (VD: "HN", "HCM") |
| `name` | VARCHAR(100) | Tên tỉnh |
| `region_id` | UUID | FK → `regions.id` (Restrict) |

---

### 4.3 DishCategory — Danh mục món ăn

**Bảng:** `dish_categories`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | UUID | PK |
| `code` | VARCHAR(50) | Unique (VD: "RICE", "NOODLE", "SOUP") |
| `name` | VARCHAR(100) | Tên danh mục |
| `description` | TEXT? | Mô tả |
| `is_active` | BOOLEAN | |
| `display_order` | INT | Thứ tự sắp xếp |

**Junction:** `dish_category_links` (dish_id + category_id) → Một món có thể thuộc nhiều danh mục

---

### 4.4 MealTypeTag — Loại bữa ăn

**Bảng:** `meal_type_tags`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | UUID | PK |
| `code` | VARCHAR(50) | VD: "BREAKFAST", "LUNCH", "DINNER", "SNACK" |
| `name` | VARCHAR(100) | Tên hiển thị |
| `is_active` | BOOLEAN | |
| `display_order` | INT | |

**Junction:** `dish_meal_types` (dish_id + meal_type_tag_id)

---

### 4.5 DietType — Chế độ ăn

**Bảng:** `diet_types`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | UUID | PK |
| `code` | VARCHAR(50) | VD: "VEGAN", "KETO", "LOW_CARB", "HALAL" |
| `name` | VARCHAR(100) | |
| `description` | TEXT? | |
| `is_active` | BOOLEAN | |
| `display_order` | INT | |

**Seed data (12 loại):**
```
NORMAL · VEGETARIAN · VEGAN · PESCATARIAN · HALAL
KETO · LOW_CARB · HIGH_PROTEIN · LOW_CALORIE · LOW_FAT · LOW_SODIUM · GLUTEN_FREE
```

**Junction:** `dish_diet_types` (dish_id + diet_type_id)

---

### 4.6 DishGoal — Mục tiêu sức khỏe của món

**Bảng:** `dish_goals`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `dish_id` | UUID | PK, FK → dishes |
| `goal_id` | UUID | PK, FK → goals |
| `score` | INT | Điểm phù hợp 0–100 (default: 50) |

> Dùng cho thuật toán randomization: món có `score` cao hơn với goal của user → ưu tiên gợi ý.

---

## 5. Thành phần & Dị ứng

### 5.1 Ingredient — Từ điển nguyên liệu

**Bảng:** `ingredients`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | UUID | PK |
| `code` | VARCHAR(100) | Unique (VD: "ING-0001") |
| `name` | VARCHAR(200) | Tên chuẩn (VD: "Thịt bò") |
| `synonyms` | String[] | Tên đồng nghĩa / phương ngữ / tên nhóm |
| `unit` | VARCHAR(50)? | Đơn vị mặc định (g, ml, muỗng...) |
| `allergen_code` | VARCHAR(50)? | Mã dị ứng liên quan (VD: "MILK") |
| `is_active` | BOOLEAN | |
| `image_url` | TEXT? | URL ảnh công khai |
| `image_key` | VARCHAR(500)? | Key trong Supabase Storage |

> **Hiện có:** ~1000 nguyên liệu ẩm thực Việt Nam đã được seed.

---

### 5.2 DishIngredient — Nguyên liệu của món

**Bảng:** `dish_ingredients`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | UUID | PK |
| `dish_id` | UUID | FK → dishes (Cascade delete) |
| `ingredient_id` | UUID? | FK → ingredients (nullable — có thể chưa link) |
| `raw_text` | VARCHAR(200) | Text gốc từ AI (VD: "500g thịt bò thái mỏng") |
| `quantity` | DECIMAL(10,3)? | Số lượng |
| `unit` | VARCHAR(50)? | Đơn vị |
| `preparation` | VARCHAR(100)? | Cách sơ chế (VD: "thái mỏng", "băm nhỏ") |
| `is_optional` | BOOLEAN | Nguyên liệu tùy chọn |
| `group_label` | VARCHAR(100)? | Nhóm (VD: "Nước dùng", "Phần ăn kèm") |
| `sort_order` | INT | Thứ tự hiển thị |

> **Lưu ý:** `ingredient_id` nullable để hỗ trợ nguyên liệu chưa có trong từ điển. Admin có thể link sau qua endpoint `/admin/dishes/unlinked-ingredients`.

---

### 5.3 Allergen — Danh mục dị ứng

**Bảng:** `allergens`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | UUID | PK |
| `code` | VARCHAR(50) | Unique (VD: "PEANUT", "MILK") |
| `name` | VARCHAR | Tên hiển thị |
| `description` | TEXT? | Ví dụ nguyên liệu cần tránh |
| `active` | BOOLEAN | |
| `display_order` | INT | |

**16 loại dị ứng chuẩn:**
```
PEANUT · TREE_NUT · MILK · EGG · FISH · SHELLFISH · MOLLUSK
SOY · WHEAT · GLUTEN · SESAME · CELERY · MUSTARD · SULFITE · LUPIN · OTHER
```

---

### 5.4 DishAllergen — Dị ứng trong món

**Bảng:** `dish_allergens`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `dish_id` | UUID | PK, FK → dishes |
| `allergen_id` | UUID | PK, FK → allergens (Restrict) |
| `level` | AllergenLevel | CONTAINS / MAY_CONTAIN / FREE_FROM |
| `confidence` | INT? | Độ tin cậy 0–100 (từ AI) |
| `resolved` | BOOLEAN | Đã xác minh bởi reviewer |
| `resolution_note` | TEXT? | Ghi chú của reviewer |

---

## 6. Dinh dưỡng & Công thức

### 6.1 DishNutrition — Thông tin dinh dưỡng

**Bảng:** `dish_nutrition` (quan hệ 1-1 với dishes)

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | UUID | PK |
| `dish_id` | UUID | UNIQUE FK → dishes |
| `calories` | DECIMAL(8,2)? | Năng lượng (kcal) |
| `protein_g` | DECIMAL(8,2)? | Đạm (g) |
| `carbs_g` | DECIMAL(8,2)? | Tinh bột (g) |
| `fat_g` | DECIMAL(8,2)? | Chất béo (g) |
| `fiber_g` | DECIMAL(8,2)? | Chất xơ (g) |
| `sodium_mg` | DECIMAL(10,2)? | Natri (mg) |
| `serving_name` | VARCHAR(100)? | Tên khẩu phần (VD: "1 tô") |
| `serving_g` | DECIMAL(8,2)? | Khối lượng khẩu phần (g) |

---

### 6.2 RecipeStep — Các bước nấu

**Bảng:** `recipe_steps`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | UUID | PK |
| `dish_id` | UUID | FK → dishes (Cascade) |
| `step_order` | INT | Thứ tự bước (unique per dish) |
| `instruction` | TEXT | Hướng dẫn (Markdown, có thể chứa tips) |
| `image_url` | TEXT? | Ảnh minh họa bước nấu |
| `duration_min` | SMALLINT? | Thời gian bước này (phút) |

> **Constraint:** `UNIQUE(dish_id, step_order)` — đảm bảo không trùng thứ tự bước.

---

## 7. Media

### DishMedia — Ảnh / Video của món

**Bảng:** `dish_media`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | UUID | PK |
| `dish_id` | UUID | FK → dishes (Cascade) |
| `type` | MediaType | IMAGE / VIDEO |
| `storage_key` | VARCHAR(500) | Key trong Supabase Storage |
| `bucket` | VARCHAR(100) | Tên bucket (default: "dish-images") |
| `mime_type` | VARCHAR(100) | VD: "image/webp", "image/jpeg" |
| `size_bytes` | INT | Kích thước file |
| `width` | INT? | Chiều rộng (px) |
| `height` | INT? | Chiều cao (px) |
| `duration_sec` | INT? | Thời lượng video (giây) |
| `checksum` | VARCHAR(100)? | MD5/SHA256 để detect trùng lặp |
| `alt_text` | VARCHAR(300)? | Text mô tả cho accessibility |
| `credit` | VARCHAR(300)? | Nguồn ảnh / tác giả |
| `source_url` | TEXT? | URL nguồn gốc (Unsplash, Wikipedia...) |
| `moderation_status` | ModerationStatus | PENDING / APPROVED / REJECTED |
| `is_primary` | BOOLEAN | Ảnh đại diện của món (chỉ 1 ảnh) |
| `sort_order` | INT | Thứ tự trong gallery |

> **Lưu ý:** Tất cả ảnh đã được chuyển đổi sang định dạng **WebP** để tối ưu hiệu suất.  
> URL công khai = `https://<supabase>/storage/v1/object/public/{bucket}/{storage_key}`

---

## 8. Tương tác người dùng

### 8.1 Review — Đánh giá

**Bảng:** `reviews`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | UUID | PK |
| `dish_id` | UUID | FK → dishes (Cascade) |
| `user_id` | UUID | FK → profiles (Cascade) |
| `rating` | INT | Điểm 1–5 |
| `comment` | TEXT? | Bình luận |
| `is_visible` | BOOLEAN | Hiển thị hay ẩn (default: true) |

> **Constraint:** `UNIQUE(dish_id, user_id)` — mỗi user chỉ đánh giá 1 lần / món.

---

### 8.2 SavedDish — Món yêu thích

**Bảng:** `saved_dishes`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → profiles |
| `dish_id` | UUID | FK → dishes (Cascade) |
| `saved_at` | TIMESTAMPTZ | Thời điểm lưu |

> API: **Idempotent** — gọi nhiều lần không tạo duplicate (UNIQUE constraint).

---

## 9. Lịch sử Random & Gợi ý

### 9.1 RandomHistory — Lịch sử random món

**Bảng:** `random_histories`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID | Không FK để tránh cascade phức tạp |
| `dish_id` | UUID? | FK → dishes (SetNull khi xóa món) |
| `criteria_snapshot` | JSON | Bộ lọc tại thời điểm random (allergens, diet, goals...) |
| `score_breakdown` | JSON? | Chi tiết điểm của từng tiêu chí |
| `reason_snapshot` | JSON? | Lý do gợi ý (để hiển thị cho user) |
| `algorithm_version` | VARCHAR(20) | Phiên bản thuật toán (VD: "1.0") |
| `is_selected` | BOOLEAN | User đã chọn món này không |
| `selected_at` | TIMESTAMPTZ? | Thời điểm chọn |

---

### 9.2 RecommendationLog — Audit log gợi ý

**Bảng:** `recommendation_logs`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID | Không FK (no cascade) |
| `dish_id` | UUID? | FK → dishes (SetNull) |
| `event` | VARCHAR | "impression" \| "click" \| "save" |
| `position` | INT? | Vị trí trong danh sách gợi ý |
| `session_id` | VARCHAR? | Session ID |
| `goal_code` | VARCHAR? | Goal đang active |

---

## 10. ERD Diagram (text)

```
regions (1) ──────────────── (N) provinces
    │                               │
    │ (N)                          (N)
    └──────── dishes ───────────────┘
                │
                ├──(N-N via dish_category_links)── dish_categories
                ├──(N-N via dish_meal_types)────── meal_type_tags
                ├──(N-N via dish_diet_types)────── diet_types
                ├──(N-N via dish_goals)─────────── goals (+ score)
                │
                ├──(1-N) dish_ingredients ──(N-1)?── ingredients
                ├──(N-N via dish_allergens)──── allergens (+ level)
                │
                ├──(1-1) dish_nutrition
                ├──(1-N) recipe_steps
                ├──(1-N) dish_media
                │
                ├──(1-N) reviews ◄── profiles
                ├──(1-N via saved_dishes) ◄── profiles
                ├──(1-N) random_histories
                └──(1-N) recommendation_logs
```

---

## 11. Indexes & Performance

| Bảng | Index | Mục đích |
|------|-------|----------|
| `dishes` | `(status, published_at)` | Lọc món đã publish, sắp xếp mới nhất |
| `dishes` | `(region_id, province_id)` | Lọc theo vùng miền |
| `dishes` | `(parent_dish_id)` | Tìm variants |
| `dish_goals` | `(goal_id, score)` | Randomization: sort theo score |
| `dish_ingredients` | `(dish_id)` | Lấy nguyên liệu nhanh |
| `dish_media` | `(dish_id, moderation_status)` | Lấy ảnh đã duyệt |
| `reviews` | `(dish_id)` · `(user_id)` | Query đánh giá |
| `saved_dishes` | `(user_id)` | Danh sách yêu thích của user |
| `random_histories` | `(user_id, created_at)` | Lịch sử gần đây của user |

**Extensions đã bật:**
- `pgcrypto` — `gen_random_uuid()`
- `unaccent` — tìm kiếm không dấu
- `pg_trgm` — GIN trigram index cho full-text search

---

## 12. Lifecycle trạng thái

```
[AI Import / Admin tạo]
         │
         ▼
      DRAFT ──────────────────────────────► FAILED
         │                                    (pipeline lỗi)
         │ Submit review
         ▼
   PENDING_REVIEW
         │
    ┌────┴────┐
    │         │
    ▼         ▼
PUBLISHED  CHANGES_REQUESTED
    │         │
    │         │ Admin sửa & resubmit
    │         ▼
    │      PENDING_REVIEW
    │
    ├──── UNPUBLISHED (admin tạm ẩn)
    │         │
    │         └── PUBLISHED (bật lại)
    │
    └──── ARCHIVED (lưu trữ vĩnh viễn)
              │
              └── REJECTED (bị từ chối hoàn toàn)
```

### Quy tắc chuyển trạng thái:
| Từ | Sang | Actor |
|----|------|-------|
| `DRAFT` | `PENDING_REVIEW` | Content Admin |
| `PENDING_REVIEW` | `PUBLISHED` | Reviewer |
| `PENDING_REVIEW` | `CHANGES_REQUESTED` | Reviewer |
| `PENDING_REVIEW` | `REJECTED` | Reviewer |
| `CHANGES_REQUESTED` | `PENDING_REVIEW` | Content Admin (sau khi sửa) |
| `PUBLISHED` | `UNPUBLISHED` | Content Admin / Super Admin |
| `UNPUBLISHED` | `PUBLISHED` | Content Admin / Super Admin |
| `*` | `ARCHIVED` | Super Admin |

---

## 📌 Ghi chú quan trọng

1. **Soft delete:** Món ăn không bị xóa cứng — dùng `deleted_at` timestamp.
2. **Optimistic locking:** Field `version` tăng mỗi lần update, dùng với `If-Match` header để tránh conflict đồng thời.
3. **Rating denormalized:** `rating_avg` và `rating_count` trên bảng `dishes` được cập nhật tự động bởi DB trigger sau mỗi INSERT/UPDATE/DELETE trên `reviews`.
4. **ingredient_id nullable:** `dish_ingredients.ingredient_id` có thể null khi AI tạo nguyên liệu chưa khớp với từ điển. Admin có thể link sau.
5. **Media WebP:** Tất cả ảnh lưu trên Supabase Storage đã được convert sang WebP để giảm dung lượng.
6. **Allergen hard-filter:** Khi random món, hệ thống loại bỏ cứng các món có `dish_allergens.level = CONTAINS` với allergen của user.
