# Tự động tạo nguyên liệu và làm giàu ảnh khi tạo món

Ngày rà soát: 2026-09-14  
Phạm vi: tạo/sửa món thủ công trong Admin, AI import, bảng `Ingredient`, `DishIngredient` và Supabase Storage.

## 1. Kết luận

Dự án đã có một phần chức năng này trong AI import:

- `ImportJobsService.upsertIngredients()` tìm nguyên liệu, tạo record mới và gọi `AiService.searchIngredientImage()`.
- Tuy nhiên luồng tạo/sửa món thủ công chỉ ghi `ingredientId` mà client gửi. Khi Admin gõ tên không có trong DB, `DishIngredient` được lưu với `ingredientId = null`.
- Ở luồng AI import mới, ID nguyên liệu vừa tạo chưa được đưa lại vào `aggregate.ingredients`; code vẫn dùng kết quả resolve từ dictionary cũ. Vì vậy nguyên liệu có thể đã được tạo trong bảng `Ingredient` nhưng `DishIngredient` của món vẫn không link tới record đó.

Không nên sửa bằng cách gọi web search trực tiếp ngay trong transaction tạo món. Thiết kế đúng là:

```text
Admin/AI gửi danh sách nguyên liệu
  → normalize + resolve batch
  → tìm exact/synonym trong DB
  → nguyên liệu chưa có: tạo PENDING_REVIEW bằng upsert nguyên tử
  → tạo Dish + DishIngredient bằng ingredientId đã resolve
  → commit transaction
  → phát job INGREDIENT_IMAGE_ENRICHMENT
  → tìm candidate có license
  → tải/kiểm tra/upload Supabase
  → lưu provenance + trạng thái PENDING_REVIEW
  → Admin duyệt ảnh và allergen trước khi món được publish
```

Món vẫn phải tạo được khi không tìm thấy ảnh. Ảnh là enrichment bất đồng bộ, không phải điều kiện để transaction món thành công.

## 2. Lỗi và rủi ro trong implementation hiện tại

### ING-01 — ID nguyên liệu mới không được link vào món AI import

Luồng hiện tại gọi `upsertIngredients()` và nhận `ingredientIds`, nhưng khi dựng aggregate lại dùng:

```ts
ingredientId: resolution?.matchedIngredientId ?? null
```

`resolution` được tính trước lúc tạo nguyên liệu mới từ dictionary cũ. Do đó nguyên liệu vừa tạo vẫn thành `null` trong `DishIngredient`.

Cần dựng `resolvedByInputKey` từ kết quả upsert và dùng:

```ts
ingredientId:
  resolution?.matchedIngredientId
  ?? provisionedByInputKey.get(normalizeIdentity(ingredient.name))?.id
  ?? null
```

Kết quả trả về của resolve/provision phải có `inputIndex` hoặc `clientRef`; không match ngược bằng display name vì cùng tên có thể xuất hiện nhiều lần với cách chế biến khác nhau.

### ING-02 — Luồng tạo/sửa món thủ công không tự resolve

`DishCommandService.create()` và `update()` ghi thẳng `ing.ingredientId`. `IngredientPicker` chỉ hiển thị “Không tìm thấy”; nó không có action tạo nguyên liệu.

Cần dùng cùng một `IngredientCatalogService.resolveOrProvisionBatch()` cho:

- Admin tạo món.
- Admin sửa món.
- AI import.
- File import.

Không copy logic upsert vào bốn service.

### ING-03 — Prefix matching có thể link sai nguyên liệu

Code hiện bỏ dấu rồi dùng `startsWith` hai chiều. Ví dụ khóa `cá` có thể khớp `cà chua`; `gạo` có thể khớp nhầm `gạo nếp`; `bột` có thể chọn record đầu tiên bắt đầu bằng `bột`.

Prefix/fuzzy chỉ được dùng để đưa ra candidate cho người review, không auto-link. Auto-link chỉ khi:

- Exact `normalizedName` có dấu.
- Exact synonym đã được duyệt.
- External/catalog ID giống nhau.

### ING-04 — Có thể tạo trùng khi nhiều job chạy đồng thời

Hiện service đọc toàn bộ bảng rồi mới create; hai worker có thể cùng thấy “chưa tồn tại” và cùng tạo. `code` thêm suffix theo thời gian không ngăn duplicate semantic.

Cần unique index trên khóa identity đã chuẩn hóa và dùng database upsert. Chạy migration theo hai bước: backfill + báo collision để merge, sau đó mới tạo unique index.

### ING-05 — Mỗi job tải toàn bộ bảng Ingredient

`findMany({ isActive: true })` sẽ chậm và tốn memory khi catalog lớn. Query theo danh sách normalized names/synonyms của batch; fuzzy search dùng `pg_trgm` có index và giới hạn top candidates.

### ING-06 — Chỉ lưu URL ảnh ngoài, thiếu provenance/license

`imageUrl` hiện nhận trực tiếp URL từ Unsplash/Wikipedia. Record không lưu asset ID, source page, author, license, license URL, checksum hay thời điểm truy cập.

Điều này không đủ để audit và có thể vi phạm điều khoản provider. Unsplash yêu cầu dùng URL hotlink do API trả về, attribution cho photographer/Unsplash và gọi download tracking khi hành vi tương đương chọn/download ảnh; do đó không được tự động tải ảnh Unsplash về Supabase theo cách tổng quát: [Unsplash API Guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines).

### ING-07 — Tìm ảnh đang chặn pipeline tạo món

Mỗi ảnh có timeout nhưng nhiều chunk vẫn làm job chờ. Network/provider không nên kéo dài transaction hoặc quyết định món có tạo được hay không.

Tạo ingredient + dish trước; image enrichment chạy queue sau commit. Job có retry/backoff/circuit breaker và trạng thái riêng.

### ING-08 — Nguyên liệu mới đang được `isActive = true`

Nguyên liệu mới chưa được xác nhận synonym, allergen hoặc ảnh. Không nên cho random/weekly coi nó là dữ liệu an toàn ngay lập tức.

Đề xuất state:

- `PENDING_REVIEW`: đã tạo và có thể link trong món DRAFT.
- `ACTIVE`: reviewer đã xác nhận identity + allergen; dùng trong món published.
- `REJECTED` hoặc `MERGED`: record sai/trùng.
- `INACTIVE`: ngừng dùng nhưng vẫn giữ lịch sử.

## 3. Quy tắc nghiệp vụ

### BR-ING-001 — Không tạo ingredient theo mỗi phím gõ

Search autocomplete chỉ đọc DB. Chỉ provision khi:

- Admin bấm “Tạo nguyên liệu mới”, hoặc
- Admin submit/save draft món với lựa chọn `createMissingIngredients=true`, hoặc
- AI/file import đi vào bước reconcile.

### BR-ING-002 — Không để ảnh quyết định việc tạo món

Nếu provider lỗi/timeout/không có candidate, ingredient vẫn tồn tại với `imageStatus=NOT_FOUND|FAILED`, `imageUrl=null`. Món DRAFT vẫn được tạo.

### BR-ING-003 — Không auto-publish nguyên liệu mới

Ingredient mới là `PENDING_REVIEW`. Dish dùng ingredient pending có thể lưu DRAFT nhưng không submit/publish nếu safety mapping còn thiếu.

### BR-ING-004 — Dị ứng không suy ra từ tên tự do

AI hoặc regex có thể đưa ra `suggestedAllergenCodes`, nhưng chỉ reviewer hoặc rule mapping đã duyệt mới ghi hard allergen. Nếu ingredient unresolved/pending, validation món phải báo `INGREDIENT_SAFETY_UNVERIFIED`.

### BR-ING-005 — Mọi ảnh phải có nguồn và license

Ảnh chỉ được gắn khi có:

- `provider` và `providerAssetId`.
- `sourcePageUrl`, không chỉ CDN URL.
- `author`, `licenseCode`, `licenseUrl` khi license yêu cầu.
- MIME/dimensions/checksum.
- `fetchedAt`, score/breakdown và trạng thái review.

### BR-ING-006 — Không scrape Google/Bing/web recipe

Chỉ dùng API/provider được phép. Search engine trả URL web không chứng minh có quyền sao chép ảnh.

## 4. Chuẩn hóa và resolve nguyên liệu

### 4.1 Hai loại khóa khác nhau

Không dùng một hàm “bỏ dấu” cho cả identity và search.

`identityNormalized` dùng để unique/exact:

1. Unicode NFKC.
2. Lowercase theo locale ổn định.
3. Trim và gộp khoảng trắng.
4. Chuẩn hóa dấu câu an toàn.
5. **Giữ dấu tiếng Việt** để `cá`, `cà` và `ca` không thành một khóa.

`searchFolded` chỉ dùng search/ranking:

1. Từ `identityNormalized`.
2. Bỏ dấu.
3. Tokenize và tạo search text.

Phần trong ngoặc không nên bị xóa vô điều kiện. `bột mì (đa dụng)` có thể map về `bột mì` với specification riêng; nhưng `nấm (đông cô)` có thể mang identity quan trọng. Parser phải tách `canonical candidate` và `specification`, đồng thời giữ `rawText`.

### 4.2 Thuật toán resolve

Với mỗi input có `clientRef`:

1. Exact theo `identityNormalized` → `EXISTING_EXACT`.
2. Exact theo synonym normalized đã duyệt → `EXISTING_SYNONYM`.
3. Có nhiều candidate/similarity cao nhưng không exact → `AMBIGUOUS`, không auto-link.
4. Không có candidate → provision record `PENDING_REVIEW` bằng upsert.
5. Trả một kết quả cho từng input, giữ nguyên `clientRef`.

Response mẫu:

```json
{
  "items": [
    {
      "clientRef": "row-3",
      "inputName": "Rau răm",
      "ingredientId": "uuid",
      "canonicalName": "Rau răm",
      "resolution": "CREATED_PENDING",
      "imageStatus": "QUEUED",
      "needsReview": true
    }
  ]
}
```

### 4.3 Fuzzy candidate

Có thể dùng PostgreSQL `pg_trgm` trên `searchFolded`, nhưng:

- Chỉ trả top 5 candidate.
- Exact/synonym mới auto-link.
- Similarity threshold là config được benchmark bằng tập tên Việt, không hard-code từ cảm giác.
- Candidate mơ hồ phải hiện trong Admin để người dùng chọn.

Test bắt buộc: `cá` ≠ `cà chua`, `sả` ≠ `sả chanh` trừ synonym đã duyệt, `đậu phộng` = `lạc` chỉ sau khi synonym mapping tồn tại.

## 5. API đề xuất

### 5.1 Resolve batch dùng chung

`POST /v1/admin/ingredients/resolve-batch`

Request:

```json
{
  "createMissing": true,
  "items": [
    { "clientRef": "row-1", "rawName": "Thịt bò", "unit": "g" },
    { "clientRef": "row-2", "rawName": "Rau răm", "unit": "g" }
  ]
}
```

Giới hạn 100 items/request. Yêu cầu idempotency key hoặc tự idempotent qua unique identity. Response trả `EXISTING_EXACT`, `EXISTING_SYNONYM`, `CREATED_PENDING`, `AMBIGUOUS`, `INVALID` cho từng input.

### 5.2 Tích hợp trực tiếp khi lưu món

`POST /v1/admin/dishes` và `PATCH /v1/admin/dishes/:id` nhận:

```json
{
  "createMissingIngredients": true,
  "ingredients": [
    {
      "clientRef": "row-1",
      "ingredientId": null,
      "rawText": "300 g thịt bò thái lát",
      "canonicalNameCandidate": "Thịt bò",
      "quantity": 300,
      "unit": "g",
      "preparation": "thái lát"
    }
  ]
}
```

Application service thực hiện resolve trước rồi gọi command transaction tạo Dish. Không chạy external image search trong transaction.

Nếu `createMissingIngredients=false`, item không resolve được vẫn lưu được trong DRAFT với `ingredientId=null`, `needsReview=true`; submit review bị chặn.

### 5.3 Image enrichment/review

- `POST /v1/admin/ingredients/:id/image-searches` — enqueue tìm/tìm lại ảnh.
- `GET /v1/admin/ingredients/:id/image-candidates` — candidates + license/provenance.
- `PUT /v1/admin/ingredients/:id/image` — reviewer chọn candidate hoặc media upload.
- `DELETE /v1/admin/ingredients/:id/image` — gỡ ảnh, giữ audit.
- `GET /v1/admin/ingredient-enrichment-jobs/:jobId` — progress/error.

Không cần client poll từng ingredient khi tạo món; Admin có trang “Nguyên liệu cần duyệt” và job progress tổng.

## 6. Mô hình dữ liệu

### 6.1 Bổ sung `Ingredient`

```prisma
enum IngredientStatus {
  PENDING_REVIEW
  ACTIVE
  REJECTED
  MERGED
  INACTIVE
}

enum IngredientImageStatus {
  NOT_REQUESTED
  QUEUED
  SEARCHING
  PENDING_REVIEW
  APPROVED
  NOT_FOUND
  FAILED
}

model Ingredient {
  id                 String                @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  code               String                @unique
  name               String
  identityNormalized String                @unique @map("identity_normalized")
  searchFolded       String                @map("search_folded")
  synonyms           String[]              @default([])
  status             IngredientStatus      @default(PENDING_REVIEW)
  imageStatus        IngredientImageStatus @default(NOT_REQUESTED) @map("image_status")
  imageUrl           String?               @map("image_url")
  imageKey           String?               @map("image_key")
  mergedIntoId       String?               @map("merged_into_id") @db.Uuid
  version            Int                   @default(1)
}
```

Nếu không muốn enum migration ngay, có thể giữ `isActive` trong giai đoạn chuyển đổi nhưng không đủ biểu diễn review/merge; state enum là đích nên dùng.

### 6.2 `IngredientImageCandidate`

```prisma
model IngredientImageCandidate {
  id               String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  ingredientId     String   @map("ingredient_id") @db.Uuid
  provider         String
  providerAssetId  String   @map("provider_asset_id")
  sourcePageUrl    String   @map("source_page_url")
  originalUrl      String   @map("original_url")
  previewUrl       String?  @map("preview_url")
  author           String?
  authorUrl        String?  @map("author_url")
  licenseCode      String   @map("license_code")
  licenseUrl       String   @map("license_url")
  width            Int?
  height           Int?
  mimeType         String?  @map("mime_type")
  score            Int
  scoreBreakdown   Json     @map("score_breakdown")
  status           String   @default("FOUND")
  storageKey       String?  @map("storage_key")
  checksumSha256   String?  @map("checksum_sha256")
  fetchedAt        DateTime @default(now()) @map("fetched_at")

  @@unique([ingredientId, provider, providerAssetId])
  @@index([ingredientId, score(sort: Desc)])
}
```

Thêm audit cho create/merge/approve image/change allergen. Không hard-delete ingredient đã có DishIngredient; merge sẽ repoint relations trong transaction và giữ redirect/audit.

## 7. Pipeline ảnh

### 7.1 Provider ưu tiên

1. Wikimedia Commons qua MediaWiki API, lấy `imageinfo` + `extmetadata` để có author/license/source. MediaWiki cảnh báo `extmetadata` là truy vấn tốn chi phí nên chỉ lấy cho shortlist nhỏ: [MediaWiki Imageinfo API](https://www.mediawiki.org/wiki/API%3AImageinfo/en). Commons mô tả cách lấy `Artist`, `LicenseUrl`, `Credit` từ metadata máy đọc được: [Wikimedia Commons machine-readable data](https://commons.wikimedia.org/wiki/Help%3AMachine-readable_data).
2. Openverse làm fallback với filter license/source. Openverse là search cho nội dung mở nhưng chính Openverse cũng cảnh báo không bảo đảm license metadata luôn chính xác, nên vẫn phải kiểm source page: [Openverse documentation](https://docs.openverse.org/api/reference/made_with_ov.html).
3. Upload thủ công có attribution/license do Admin nhập và reviewer duyệt.
4. Không dùng Tavily/Google/Bing để tự lấy và rehost ảnh chỉ vì search trả một URL.
5. Unsplash chỉ dùng nếu quyết định giữ hotlink + attribution + download tracking đúng chính sách; không đưa vào pipeline rehost Supabase mặc định.

### 7.2 Query và ranking

Query builder dùng:

- Canonical Vietnamese name.
- Approved English alias.
- Food state: raw/cooked/dried/fresh.
- Context `ingredient`, tránh lẫn dish hoàn chỉnh.

Score 0–100 đề xuất:

```text
nameExact/aliasMatch       0..40
foodStateMatch             0..15
description/categoryMatch  0..15
imageQuality               0..10
preferredLicense           0..10
sourceReliability          0..10
wrong-topic/watermark      penalty 0..-50
```

Không tự approve chỉ vì score cao. Với MVP, score đủ ngưỡng chỉ tạo candidate PENDING_REVIEW. Sau khi có benchmark và tỷ lệ sai thấp mới cân nhắc auto-approve cho allowlist nguyên liệu phổ biến.

### 7.3 Downloader an toàn

- Chỉ HTTPS; allowlist provider download hosts.
- Chặn private, loopback, link-local, metadata IP; kiểm lại DNS sau redirect.
- Timeout, giới hạn redirect và tối đa khoảng 5 MB.
- Kiểm `Content-Type` và magic bytes; chỉ JPEG/PNG/WebP.
- Giới hạn pixel/dimensions để chống decompression bomb.
- Decode rồi re-encode WebP/JPEG; bỏ metadata không cần.
- Tính SHA-256 và dedupe.
- Upload path mới, ví dụ `ingredients/provider/{ingredientId}/{checksum}.webp`; `upsert=false` để tránh cache stale/race.
- Chỉ sau upload thành công mới update `imageKey/imageUrl` trong transaction ngắn.

Supabase khuyến nghị tránh overwrite cùng path để hạn chế race/cache stale và cho phép `upsert=false`: [Supabase standard uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads). Service role key chỉ ở backend.

## 8. Service/module đề xuất

```text
backend/src/ingredients/
  ingredient-normalizer.service.ts
  ingredient-resolver.service.ts
  ingredient-catalog.service.ts
  ingredient-enrichment.queue.ts
  ingredient-enrichment.processor.ts
  ingredient-image/
    image-provider.ts
    wikimedia-commons.provider.ts
    openverse.provider.ts
    image-license-policy.service.ts
    image-ranker.service.ts
    safe-image-downloader.service.ts
  dto/
  ingredients.controller.ts
```

`AiService` chỉ làm extraction/AI concern; chuyển `searchIngredientImage()` ra khỏi đây. Provider ảnh không phải AI service.

Luồng application:

```ts
const resolved = await ingredientCatalog.resolveOrProvisionBatch(inputs);

const dish = await prisma.$transaction((tx) =>
  dishCommand.createDraftAggregate(
    tx,
    mapDishWithResolvedIngredientIds(dto, resolved),
    actorId,
    audit,
  ),
);

await enrichmentQueue.enqueueNewIngredients(resolved.createdIds);
return dish;
```

Trong production nên dùng transactional outbox thay `await queue.add()` trực tiếp để không mất job sau khi DB commit.

## 9. Sửa tối thiểu cho code hiện tại

Nếu cần vá trước khi refactor đầy đủ:

1. Đổi kết quả `upsertIngredients()` thành `{ clientRef/inputIndex, inputKey, ingredientId, canonicalName, isNew }`.
2. Khi dựng `aggregate.ingredients`, ưu tiên `resolution.matchedIngredientId`, sau đó ID vừa provision theo `inputIndex`.
3. Bỏ prefix auto-match; chỉ exact match có dấu. Fuzzy chỉ tạo warning/candidates.
4. Không lưu `imageResults[idx]` trực tiếp vào `Ingredient.imageUrl`. Ít nhất phải lưu source/license; tốt nhất enqueue job và upload storage.
5. Nguyên liệu mới không `isActive=true` cho production recommendation trước review.
6. `DishCommandService.create/update` phải gọi cùng resolver hoặc endpoint resolve-batch trước khi persist.

Bản vá này vẫn cần migration unique identity để chống concurrent duplicate.

## 10. Giao diện Admin cần bổ sung

### 10.1 Hiện trạng của màn chỉnh sửa trong ảnh

- API chi tiết món đã include `dishIngredients.ingredient` với `id`, `name`, `allergenCode`, `imageUrl`.
- API `GET /ingredients?q=` cũng đã trả `imageUrl`.
- `IngredientPicker` hiện chỉ render thumbnail trong dropdown kết quả. Sau khi chọn, ô trong bảng lại chỉ hiển thị text.
- `DishIngredientRow` chỉ giữ `name` và `ingredientId`, không giữ `imageUrl`, `ingredientStatus` hoặc trạng thái resolve.
- Khi hydrate màn sửa món, code lấy `ingredientId` và tên nhưng bỏ `ingredient.imageUrl`.
- Ô “Tìm nguyên liệu chuẩn hóa...” phía trên chỉ lọc những dòng đã có trong bảng, không search catalog DB. Placeholder hiện tại dễ khiến Admin hiểu nhầm.
- Nút “Thêm nguyên liệu mới” hiện chỉ thêm một dòng trống, chưa tạo Ingredient trong DB.

Vì vậy cần tách rõ hai thao tác:

1. **Lọc danh sách hiện tại**: ô phía trên đổi placeholder thành `Lọc trong danh sách thành phần...`.
2. **Chọn/tạo ingredient catalog**: thực hiện tại picker của từng dòng.

### 10.2 State của mỗi dòng

Mở rộng row state:

```ts
type IngredientResolutionStatus =
  | 'EMPTY'
  | 'SEARCHING'
  | 'LINKED'
  | 'NOT_FOUND'
  | 'PROVISIONING'
  | 'PENDING_REVIEW'
  | 'AMBIGUOUS'
  | 'ERROR'

interface DishIngredientRow {
  id: number
  clientRef: string
  name: string
  ingredientId?: string
  ingredientImageUrl?: string
  ingredientStatus?: 'PENDING_REVIEW' | 'ACTIVE' | 'INACTIVE'
  resolutionStatus: IngredientResolutionStatus
  qty: string
  unit: string
  prep: string
  required: boolean
}
```

Khi load món để sửa:

```ts
{
  name: item.ingredient?.name ?? item.parsedName ?? item.rawText,
  ingredientId: item.ingredient?.id ?? item.ingredientId,
  ingredientImageUrl: item.ingredient?.imageUrl ?? undefined,
  ingredientStatus: item.ingredient?.status,
  resolutionStatus: item.ingredient?.id ? 'LINKED' : 'NOT_FOUND'
}
```

### 10.3 Cách hiển thị từng trạng thái

- `LINKED`: thumbnail 32–36 px lấy từ DB, tên canonical và dấu check xanh `Đã liên kết`.
- `LINKED` nhưng `imageUrl=null`: placeholder icon, text phụ `Chưa có ảnh`; không tự search lại mỗi lần render.
- Người dùng sửa text: xóa `ingredientId/imageUrl`, chuyển `SEARCHING`, debounce 300 ms.
- Có exact result: dropdown hiển thị ảnh, tên, synonym, allergen/status; chọn sẽ trở lại `LINKED`.
- Không có result: empty state có action `Tạo “Bún tươi” và tìm ảnh`.
- `PROVISIONING`: giữ nguyên kích thước dòng, spinner nhỏ + `Đang tạo nguyên liệu...`; disable action lặp.
- `PENDING_REVIEW`: trả ID ngay để link món, thumbnail placeholder hoặc ảnh candidate, badge vàng `Cần duyệt`.
- `AMBIGUOUS`: hiện tối đa 5 candidate để Admin chọn, không tự tạo/auto-link.
- `ERROR`: lỗi nằm ngay dưới field, có nút retry; vẫn cho lưu món DRAFT nếu policy cho phép.

Ảnh phải có `alt={ingredient.name}`; nút chỉ có icon cần `aria-label`; trạng thái loading dùng `aria-busy`. Empty state phải có hành động rõ thay vì chỉ báo “Không tìm thấy”. Đây cũng phù hợp với hướng dẫn UX đã áp dụng cho form này.

### 10.4 Luồng tạo từ picker

Khi IngredientPicker không có exact result:

- Hiện nút `Tạo “<tên>” thành nguyên liệu mới`.
- Hiện candidate gần giống để tránh duplicate.
- Cho xem trạng thái `Đang tìm ảnh`, `Cần duyệt`, `Không tìm thấy ảnh`.
- Không bắt người dùng chờ ảnh mới lưu được món.
- Trong bước Review Dish, hiển thị blocker cho ingredient chưa duyệt safety và link sang trang duyệt.

Trang “Nguyên liệu cần duyệt” có:

- Canonical name/raw examples/synonym candidates.
- Món nào đang dùng.
- Allergen suggestions và reviewer selection.
- Image candidates với source, author, license.
- Approve, merge vào ingredient có sẵn, reject, tìm lại ảnh hoặc upload thủ công.

API tạo/resolve trả Ingredient ngay, ví dụ:

```json
{
  "ingredient": {
    "id": "uuid",
    "name": "Bún tươi",
    "imageUrl": null,
    "status": "PENDING_REVIEW",
    "imageStatus": "QUEUED"
  },
  "resolution": "CREATED_PENDING",
  "enrichmentJobId": "uuid"
}
```

Frontend gắn `ingredient.id` vào row ngay. Khi ảnh được tìm và duyệt, React Query invalidate `['ingredient', id]` hoặc nhận job event rồi cập nhật `ingredientImageUrl`. Không cần chờ ảnh để lưu món.

### 10.5 Điều cần tránh trên giao diện hiện tại

- Không tự gọi API tạo ingredient khi người dùng mới đang gõ; nếu không sẽ sinh record rác cho mọi chuỗi trung gian.
- Không tự search internet chỉ vì component render lại hoặc vì `imageUrl` đang null.
- Không biến URL candidate chưa duyệt thành ảnh chính ngay.
- Không dùng màu xanh/check cho dòng chỉ có text nhưng `ingredientId=null`; trạng thái này là chưa liên kết.
- Không ghi “Không có cảnh báo dị ứng” từ regex tên. Allergen phải đến từ ingredient DB đã duyệt; chưa có mapping thì hiển thị `Chưa xác minh`.

## 11. Kiểm thử bắt buộc

### Resolve và concurrency

- Exact name và approved synonym trả ID cũ.
- `cá` không match `cà chua`; `gạo` không tự match `gạo nếp`.
- Hai worker provision cùng tên đồng thời chỉ có một Ingredient.
- Hai dòng cùng ingredient trong một batch trả cùng ID nhưng vẫn giữ hai `clientRef`.
- Ingredient vừa tạo được link vào mọi `DishIngredient` tương ứng.
- Transaction dish fail không tạo link nửa vời; ingredient orphan pending có cleanup/reuse policy.

### Image

- Provider timeout/not found không làm tạo món thất bại.
- Candidate thiếu license/source bị reject.
- Private/loopback redirect, MIME giả, file quá lớn và decompression bomb bị chặn.
- Cùng checksum không upload lặp.
- Unsplash asset không bị rehost nếu chưa có policy cho phép.
- Ảnh PENDING không hiển thị public trước approve.

### Publish/safety

- Dish có ingredient null/pending/safety unknown không publish.
- Merge ingredient repoint link đúng và không làm mất audit.
- Đổi allergen của ingredient làm các dish liên quan cần revalidation.

## 12. Lộ trình triển khai

### P0 — sửa tính đúng

- Sửa AI import để link ID nguyên liệu vừa tạo vào aggregate.
- Bỏ prefix auto-link.
- Thêm test duplicate batch/concurrency/linking.
- Chặn publish khi ingredient unresolved.

### P1 — dùng chung mọi luồng

- Tách normalizer/resolver/catalog service khỏi ImportJobsService.
- Tích hợp Admin create/update, AI import và file import.
- Thêm `identityNormalized`, status, unique index và màn pending review.

### P2 — image enrichment chuẩn

- Wikimedia Commons provider + license metadata.
- Candidate/ranker/safe downloader/Supabase provenance.
- Async queue/outbox, retry/backoff/metrics.
- Openverse fallback sau khi benchmark Commons coverage.

## 13. Tiêu chí hoàn thành

- Tạo món có nguyên liệu chưa tồn tại sẽ tạo đúng một Ingredient PENDING và link `ingredientId` vào món.
- Không có thao tác network ảnh trong transaction món.
- Không tìm thấy ảnh vẫn tạo được món DRAFT.
- Ảnh gắn vào Ingredient có storage key, source page, author, license, checksum và review status.
- Không auto-link theo prefix/fuzzy.
- Không publish món nếu còn ingredient unresolved hoặc safety chưa duyệt.
- Admin có thể approve, merge, reject và tìm lại ảnh.
- Metrics có provision created/existing/ambiguous, duplicate prevented, image hit rate, provider latency/error và review rejection rate.
