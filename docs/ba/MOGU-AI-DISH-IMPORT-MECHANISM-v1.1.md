# Cơ chế AI tự động nhập món — Hiện trạng và đặc tả nâng cấp v1.1

**Dự án:** Mogu  
**Ngày cập nhật:** 28/08/2026  
**Phiên bản tài liệu:** 1.1  
**Phạm vi:** AI Import tại Admin `/ingest` và dữ liệu Dish `DRAFT` được tạo  
**Đối tượng sử dụng:** BA, Product, FE, BE, QA, DevOps  
**Trạng thái:** Đặc tả nâng cấp trên nền implementation hiện tại

---

## 1. Cách đọc tài liệu

Tài liệu phân biệt rõ ba mức:

| Nhãn | Ý nghĩa |
|---|---|
| **AS-IS** | Chức năng đã có trong implementation hiện tại |
| **TO-BE P0** | Bắt buộc nâng cấp để dữ liệu Dish tạo ra đủ và đúng cấu trúc |
| **TO-BE P1** | Hardening cần hoàn thành trước Production |
| **FUTURE** | Mở rộng sau này; không được mô tả như đã triển khai |

Những phần TO-BE trong tài liệu là yêu cầu triển khai mới, không phải mô tả code đã tồn tại.

---

## 2. Tóm tắt điều hành

### 2.1. AS-IS

Chức năng **Nhập món bằng AI** cho phép admin nhập tên món. Hệ thống hiện tại:

1. Gọi AI để sinh thông tin món, nguyên liệu và công thức.
2. Làm sạch tên nguyên liệu và quy đổi một số đơn vị.
3. Đối chiếu hoặc tạo mới Ingredient.
4. Gọi AI lần hai để ước tính dinh dưỡng.
5. Tìm ảnh từ Wikipedia/Unsplash.
6. Lưu Dish ở trạng thái `DRAFT`.

Món không tự động gửi duyệt và không tự động xuất bản.

### 2.2. Vấn đề đã xác nhận

- Vùng miền và tỉnh/thành thường bị bỏ trống.
- Category, meal type, goal, diet và flavor chưa được tạo hoặc chưa map vào DB.
- Category và meal type đang xuất hiện lặp giữa bước Thông tin cơ bản và Phân loại.
- Ingredient name có thể chứa cả quantity, unit, mô tả và cách sơ chế.
- Các đơn vị như `củ`, `tép`, `cây`, `quả`, `đĩa` có thể bị đổi sai thành `g`.
- Ingredient mới có thể được tạo quá dễ từ prefix matching.
- Recipe title có thể thiếu hoặc không khớp với Dish name.
- Recipe step title có thể chứa Markdown như `**Sơ chế thịt**`.
- Nutrition basis, serving size và preview có thể không nhất quán.
- Confidence dinh dưỡng có thể cao dù không có nguồn xác minh.

### 2.3. TO-BE v1.1

Không giải quyết các vấn đề trên bằng cách chỉ kéo dài prompt. Pipeline mới phải kết hợp:

```text
Taxonomy DB
+ AI structured extraction
+ Ingredient parser
+ Deterministic rule engine
+ Cross-field validator
+ Targeted repair
```

Kết quả vẫn là một Dish `DRAFT`, nhưng dữ liệu phải được tách đúng cấu trúc, liên kết đúng taxonomy và ghi rõ field nào cần admin kiểm tra.

---

## 3. Mục tiêu và ngoài phạm vi

### 3.1. Mục tiêu

- Tự động điền vùng miền và tỉnh/thành khi có đủ độ tin cậy.
- Tự động điền category, meal type, goal, diet và flavor.
- Không để AI phát minh UUID hoặc taxonomy value ngoài hệ thống.
- Tách nguyên liệu thành name, quantity, unit, specification và preparation.
- Giữ đơn vị nấu ăn tự nhiên; chỉ chuyển đổi riêng cho nutrition calculation.
- Bắt buộc Recipe có title phù hợp với Dish.
- Kiểm tra tính nhất quán giữa ingredient, recipe, servings và nutrition.
- Chỉ repair field thiếu/sai; không sinh lại toàn bộ món.
- Không ghi đè field admin đã chỉnh sửa.
- Giữ nguyên trải nghiệm AI Import đơn giản của BA-007 v1.2.

### 3.2. Ngoài phạm vi v1.1

- Cho admin chọn website/video/source trong luồng chính.
- Evidence/conflict editor nhiều màn.
- Tự động gửi Dish sang `PENDING_REVIEW`.
- Tự động xuất bản.
- Pause/resume job.
- Retry từ checkpoint do người dùng điều khiển.
- Import CSV/XLSX.

Website extraction, Nutrition DB thật và field evidence có thể phát triển ở P1/FUTURE nhưng không làm tăng số màn hình chính của BA-007 v1.2.

---

## 4. Nguyên tắc kiến trúc

### 4.1. AI không phải nguồn sự thật của taxonomy

AI chỉ được chọn từ danh sách taxonomy code do backend cung cấp. Backend chịu trách nhiệm map code sang database ID.

Không cho AI trả trực tiếp:

- `regionId`
- `provinceId`
- `categoryId`
- `mealTypeId`
- `goalId`
- `dietTypeId`
- `flavorId`
- `ingredientId`

### 4.2. Không ghi raw AI output trực tiếp xuống DB

Raw output phải đi qua:

1. JSON schema validation.
2. Normalization.
3. Taxonomy resolution.
4. Ingredient resolution.
5. Rule enrichment.
6. Cross-field validation.
7. Targeted repair nếu cần.

### 4.3. Không overwrite dữ liệu do admin sửa

Mỗi field nên có metadata nội bộ:

```ts
type FieldOrigin = 'AI' | 'RULE' | 'DATABASE' | 'USER';

type FieldMeta = {
  source: FieldOrigin;
  confidence?: number;
  updatedAt: string;
};
```

Khi `source === 'USER'`, AI enrichment mặc định không được ghi đè.

### 4.4. Confidence threshold

| Confidence | Hành vi |
|---:|---|
| `>= 90` | Có thể tự điền |
| `70–89` | Điền suggestion và đánh dấu `Cần kiểm tra` |
| `< 70` | Không auto-accept; để trống hoặc giữ candidate |

Riêng province/city, allergen và sodium cần quy tắc chặt hơn vì ảnh hưởng độ chính xác hoặc sức khỏe.

---

## 5. Đầu vào tạo job

### 5.1. API hiện tại

```http
POST /v1/admin/import-jobs
Authorization: Bearer <admin_jwt>
Content-Type: application/json
```

### 5.2. Request

```json
{
  "query": "Phở bò Hà Nội",
  "relatedKeywords": ["phở tái", "nước dùng xương"],
  "regionHint": "north",
  "sourceTypes": ["AI_GENERATED"]
}
```

| Field | Required | Validation | AS-IS behavior |
|---|:---:|---|---|
| `query` | Có | Trim; 2–150 ký tự | Tên món đưa vào prompt |
| `relatedKeywords` | Không | Tối đa 10; mỗi item tối đa 60 ký tự | Context bổ sung |
| `regionHint` | Không | `north`, `central`, `south` | Gợi ý vùng đưa vào prompt |
| `sourceTypes` | Không | Danh sách enum | Chỉ lưu/log; chưa kích hoạt extractor thật |

### 5.3. Lưu ý về sourceTypes

AS-IS, Website, Video và Nutrition không kích hoạt crawler hoặc integration nguồn thật. Dữ liệu vẫn là AI-generated.

TO-BE P0, giao diện mặc định gửi:

```json
{
  "sourceTypes": ["AI_GENERATED"]
}
```

Không hiển thị checkbox nguồn khi backend chưa có extractor tương ứng.

---

## 6. Cấu hình AI hiện tại

Backend sử dụng SDK tương thích OpenAI.

| Env | Default | Vai trò |
|---|---|---|
| `XKIRO_BASE_URL` | `https://api.xkiro.com/v1` | AI gateway |
| `XKIRO_API_KEY` | Không có | Server-side API key |
| `XKIRO_MODEL` | `deepseek/deepseek-chat-v3.1` | Model sinh dữ liệu |

| Tác vụ | Temperature | Max tokens |
|---|---:|---:|
| Sinh dữ liệu món | `0.2` | `3000` |
| Ước tính dinh dưỡng | `0.2` | `300` |

Temperature thấp không thay thế JSON schema validation.

### 6.1. TO-BE P0: provider adapter

AI layer nên expose contract độc lập provider:

```ts
interface DishAiProvider {
  generateDish(input: GenerateDishInput): Promise<RawDishExtraction>;
  estimateNutrition(input: NutritionInput): Promise<RawNutritionEstimate>;
  repairFields(input: RepairFieldsInput): Promise<PartialDishExtraction>;
}
```

Mọi provider response phải được validate trước khi pipeline sử dụng.

---

## 7. Pipeline tổng thể

### 7.1. State machine giữ nguyên

```text
PENDING
  → SEARCHING
  → EXTRACTING
  → NORMALIZING
  → RECONCILING
  → ENRICHING
  → DRAFTING
  → DONE | FAILED | CANCELLED
```

Không thêm màn hình cho từng sub-step.

### 7.2. Nội dung mới của từng trạng thái

| Status | AS-IS | TO-BE v1.1 |
|---|---|---|
| `SEARCHING` | Đọc query/context | Load taxonomy snapshot; validate input; lấy candidate set |
| `EXTRACTING` | AI sinh recipe JSON | AI trả structured output đầy đủ basic/classification/ingredient/recipe |
| `NORMALIZING` | Đổi một số unit; xóa text trong ngoặc | Parse ingredient thành field riêng; sanitize recipe; normalize quantity/unit |
| `RECONCILING` | Slug check; ingredient exact/prefix/create | Resolve taxonomy; exact/alias/fuzzy ingredient matching; business duplicate candidate |
| `ENRICHING` | AI nutrition; tìm ảnh | Rule engine cho goal/diet/flavor; nutrition validation; targeted repair; ảnh |
| `DRAFTING` | Ghi Dish aggregate | Final validation; atomic transaction; warnings/unresolvedFields; audit |

---

## 8. SEARCHING — Taxonomy snapshot và context

### 8.1. AS-IS

- Kiểm tra job còn hoạt động.
- Đọc query, keywords và region hint.
- Đổi region code sang display name.
- Không tìm website thật.

### 8.2. TO-BE P0

Backend phải load taxonomy trước khi gọi AI:

- Regions.
- Provinces/cities còn hiệu lực.
- Dish categories.
- Meal types.
- Goals.
- Diet types.
- Flavors.
- Dish types nếu có.
- Ingredient units.

### 8.3. Taxonomy preflight

Nếu taxonomy bắt buộc rỗng, job không nên tiếp tục với dữ liệu tự do.

Ví dụ lỗi:

```json
{
  "code": "AI_IMPORT_TAXONOMY_NOT_READY",
  "message": "Danh mục phân loại món chưa được cấu hình đầy đủ.",
  "details": {
    "missing": ["categories", "mealTypes"]
  }
}
```

### 8.4. Candidate set đưa vào AI

Không cần gửi toàn bộ database record. Chỉ gửi code, name, aliases và description cần thiết.

```json
{
  "regions": [
    { "code": "NORTH", "name": "Miền Bắc" },
    { "code": "CENTRAL", "name": "Miền Trung" },
    { "code": "SOUTH", "name": "Miền Nam" }
  ],
  "mealTypes": [
    { "code": "BREAKFAST", "name": "Bữa sáng" },
    { "code": "LUNCH", "name": "Bữa trưa" },
    { "code": "DINNER", "name": "Bữa tối" },
    { "code": "SNACK", "name": "Ăn vặt" },
    { "code": "DESSERT", "name": "Tráng miệng" }
  ]
}
```

Pipeline lưu `taxonomySnapshotVersion` để audit/reproduce kết quả.

---

## 9. EXTRACTING — Structured dish extraction

### 9.1. AS-IS

AI trả JSON thuần gồm name, description, difficulty, time, price, servings, ingredients và steps.

JSON lỗi được parser/fallback xử lý nhưng chất lượng fallback không đảm bảo.

### 9.2. TO-BE P0: output contract đầy đủ

```ts
type DishExtractionV11 = {
  schemaVersion: '1.1';
  basic: {
    name: string;
    alternateNames: string[];
    shortDescription: string;
    fullDescription?: string | null;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    prepMinutes: number;
    cookMinutes: number;
    servings: number;
    servingSize?: string | null;
    priceMin?: number | null;
    priceMax?: number | null;
    origin: OriginCandidate;
  };
  classification: DishClassificationCandidate;
  ingredients: ExtractedIngredient[];
  recipe: ExtractedRecipe;
  generalTips?: string[];
};
```

### 9.3. Origin candidate

```ts
type OriginCandidate = {
  originText?: string | null;
  regionCode?: string | null;
  provinceCode?: string | null;
  isRegionalSpecialty: boolean;
  confidence: number;
  reason?: string | null;
};
```

Quy tắc:

- `provinceCode` phải nằm trong taxonomy candidate được cung cấp.
- Province/city phải thuộc đúng region.
- Nếu chỉ suy đoán từ tên món và không có dữ liệu đáng tin, để `provinceCode = null`.
- Không tự tuyên bố món là đặc sản địa phương khi confidence thấp.
- AI-generated reason không được xem là evidence độc lập.

### 9.4. Classification candidate

```ts
type DishClassificationCandidate = {
  categoryCodes: string[];
  mealTypeCodes: string[];
  goalCodes: string[];
  dietTypeCodes: string[];
  flavorCodes: string[];
  dishTypeCode?: string | null;
  confidenceByField: Record<string, number>;
};
```

AI chỉ được chọn code từ candidate list. Unknown code bị loại và ghi warning.

### 9.5. Recipe contract

```ts
type ExtractedRecipe = {
  title: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  steps: Array<{
    stepNumber: number;
    title: string;
    description: string;
    durationMinutes?: number | null;
    tips?: string | null;
  }>;
};
```

`recipe.title` là required.

---

## 10. NORMALIZING — Ingredient parser v1.1

### 10.1. Vấn đề AS-IS

Ví dụ raw text:

```text
45 ml Mắm ruốt (loại mịn, màu nâu đỏ)
(Lọc qua rây để bỏ xác tôm/cá nếu có, giữ lại phần nước sệt.)
```

Nếu lưu toàn chuỗi vào Ingredient name thì:

- Không match được ingredient dictionary.
- Dễ tạo Ingredient trùng.
- Search/filter sai.
- Nutrition mapping sai.
- Admin khó chỉnh sửa.

### 10.2. Output đúng

```json
{
  "rawText": "45 ml Mắm ruốt (loại mịn, màu nâu đỏ) (Lọc qua rây...) ",
  "name": "Mắm ruốt",
  "canonicalNameCandidate": "Mắm ruốt",
  "quantity": 45,
  "quantityTo": null,
  "quantityText": null,
  "unitCode": "ML",
  "specification": "Loại mịn, màu nâu đỏ",
  "preparation": "Lọc qua rây để bỏ xác tôm/cá nếu có, giữ lại phần nước sệt.",
  "group": "Gia vị",
  "optional": false,
  "normalizedWeightGram": null
}
```

### 10.3. Schema

```ts
type ExtractedIngredient = {
  rawText: string;
  name: string;
  canonicalNameCandidate?: string | null;
  quantity?: number | null;
  quantityTo?: number | null;
  quantityText?: string | null;
  unitCode?: string | null;
  specification?: string | null;
  preparation?: string | null;
  group?: string | null;
  optional: boolean;
  normalizedWeightGram?: number | null;
};
```

### 10.4. Parser stages

1. Unicode normalize và trim whitespace.
2. Tách quantity/range ở đầu chuỗi.
3. Tách unit theo unit dictionary.
4. Phân loại nội dung trong ngoặc:
   - Mô tả chất lượng/loại → `specification`.
   - Động từ sơ chế → `preparation`.
5. Xóa quantity/unit/notes khỏi `name`.
6. Chuẩn hóa capitalization.
7. Match Ingredient dictionary/alias.
8. Tính normalized weight riêng nếu có conversion rule.

### 10.5. Không ép đơn vị nấu ăn thành gram

Recipe display giữ nguyên đơn vị tự nhiên:

| Raw | Quantity | Display unit | normalizedWeightGram |
|---|---:|---|---:|
| `3 củ hành tím` | 3 | `CỦ` | Chỉ có khi conversion đáng tin |
| `4 tép tỏi` | 4 | `TÉP` | Optional |
| `2 cây sả` | 2 | `CÂY` | Optional |
| `2 quả ớt` | 2 | `QUẢ` | Optional |
| `1 đĩa rau sống` | 1 | `ĐĨA` | Có thể để null |

Không được lưu các trường hợp trên thành `3 g`, `4 g`, `2 g`.

### 10.6. Unit dictionary tối thiểu

```text
WEIGHT: G, KG, MG
VOLUME: ML, L, TSP, TBSP, CUP
COUNT: CÁI, QUẢ, CỦ, TÉP, CÂY, NHÁNH, LÁ, MIẾNG, GÓI
SERVING: TÔ, CHÉN, BÁT, ĐĨA, PHẦN
QUALITATIVE: VỪA_ĐỦ, MỘT_ÍT
```

Quy đổi `chén`, `tsp`, `tbsp` chỉ áp dụng khi ingredient/context cho phép.

### 10.7. Quantity edge cases

| Raw | Kết quả |
|---|---|
| `1–2 muỗng canh` | `quantity=1`, `quantityTo=2`, `unit=TBSP` |
| `1/2 muỗng cà phê` | `quantity=0.5`, `unit=TSP` |
| `muối vừa đủ` | `quantity=null`, `quantityText="vừa đủ"` |
| `ớt tùy chọn` | `optional=true` |
| `nước hoặc nước dùng` | Tách preferred ingredient và alternative note; không đưa toàn bộ vào name |

---

## 11. RECONCILING — Ingredient resolution

### 11.1. AS-IS

Hệ thống:

1. Làm sạch tên.
2. Exact match normalized key.
3. Prefix match.
4. Không tìm thấy thì tạo Ingredient mới.

Prefix match và auto-create hiện có nguy cơ làm bẩn Ingredient dictionary.

### 11.2. TO-BE P0: matching order

```text
Exact canonical name
→ Exact alias/synonym
→ Normalized exact match
→ Fuzzy candidate ranking
→ UNRESOLVED
```

Prefix match không được tự quyết định nếu nhiều ingredient candidates gần nhau.

### 11.3. Resolution result

```ts
type IngredientResolution = {
  rawText: string;
  parsed: ExtractedIngredient;
  matchedIngredientId?: string | null;
  matchMethod: 'EXACT' | 'ALIAS' | 'NORMALIZED' | 'FUZZY' | 'NONE';
  confidence: number;
  candidates?: Array<{
    ingredientId: string;
    name: string;
    score: number;
  }>;
};
```

### 11.4. Auto-create rule

- Confidence `>= 90`: link Ingredient hiện có.
- `70–89`: giữ candidate và warning.
- `< 70`: `UNRESOLVED`.
- Không tạo canonical Ingredient mới chỉ từ low-confidence AI result.
- Nếu business vẫn cho phép tạo mới trong DRAFT, record phải có `needsReview=true` và không được dùng làm source tin cậy cho dish khác.

### 11.5. Synonym examples

```text
ba chỉ heo       → Thịt ba chỉ
mắm ruốc Huế     → Mắm ruốt
đường cát trắng  → Đường trắng
hành tím củ      → Hành tím
nước mắm ngon    → Nước mắm
```

Mô tả như `ngon`, `loại mịn`, `màu nâu đỏ` chuyển sang specification, không nằm trong canonical name.

---

## 12. RECONCILING — Dish duplicate detection

### 12.1. AS-IS

Slug trùng được thêm timestamp để tránh unique constraint. Đây không phải business duplicate detection.

### 12.2. TO-BE P1

Candidate score dựa trên:

- Normalized name.
- Alternate names.
- Region/province.
- Category.
- Main ingredients.
- Recipe similarity.

Import vẫn có thể tạo DRAFT mới, nhưng phải trả warning nếu duplicate score vượt ngưỡng.

Không update hoặc overwrite món `PUBLISHED` từ AI import.

---

## 13. Taxonomy resolution

### 13.1. Mapping rule

AI trả code; backend resolve:

```ts
const categoryIds = await taxonomy.resolveCategoryCodes(
  extraction.classification.categoryCodes,
  taxonomySnapshot,
);
```

Unknown code:

- Không tạo taxonomy record mới.
- Ghi `AI_IMPORT_UNKNOWN_TAXONOMY_CODE`.
- Đưa field vào `unresolvedFields`.

### 13.2. Region và province/city

Validator:

```text
province.regionId === selectedRegion.id
```

Quy tắc tự điền:

- Region confidence `>= 90`: auto-fill.
- Province/city chỉ auto-fill khi confidence đủ cao và không mâu thuẫn taxonomy.
- Nếu món phổ biến toàn quốc hoặc không chắc nguồn gốc: province/city để null.
- `originText` có thể lưu mô tả như `Ẩm thực Huế` nhưng không thay thế provinceId.

### 13.3. Category

Category phải lấy từ seeded taxonomy.

AI có thể đề xuất nhiều category nếu schema Dish hỗ trợ N–N.

Ví dụ candidate:

```json
{
  "categoryCodes": ["MEAT_DISH", "BRAISED_DISH"]
}
```

Không cho AI sinh free-text category như `Món ngon gia đình đặc biệt` nếu taxonomy không có code tương ứng.

### 13.4. Meal type

Meal type là multi-select.

AI đề xuất từ ngữ cảnh món; rule engine xác minh mức hợp lý.

Không mặc định mọi món đều phù hợp tất cả bữa ăn.

### 13.5. Goal

Goal không nên hoàn toàn do AI quyết định.

| Goal | Rule input |
|---|---|
| Cân bằng | Calories, macro ratio, serving size |
| Giảm cân | Calories/serving, energy density, protein, fiber |
| Tăng cơ | Protein/serving và tổng năng lượng |
| Ăn lành mạnh | Sodium, fat, fiber, ingredient profile |
| Tiết kiệm | Price evidence đủ tin cậy |
| Khám phá | Regional/specialty/uncommon classification |

Threshold phải cấu hình trong backend; không hardcode trong prompt.

Nếu không có dữ liệu giá đáng tin, không auto-gắn `Tiết kiệm`.

### 13.6. Diet type

Diet phải được suy ra từ canonical ingredients và ingredient attributes.

Ví dụ:

```text
VEGAN = mọi ingredient vegan AND không có unresolved ingredient
VEGETARIAN = không có meat/seafood-derived ingredient
GLUTEN_FREE = tất cả ingredient/sauce đã xác minh không gluten
```

Chỉ một ingredient chưa rõ cũng phải làm diet nhạy cảm chuyển sang warning hoặc không gắn.

### 13.7. Flavor

Flavor dùng hai lớp:

1. AI đề xuất.
2. Rule engine xác minh từ ingredient flavor profile và amount.

Ví dụ mapping:

```text
nước mắm, mắm ruốt → SALTY, UMAMI
đường → SWEET
ớt → SPICY
chanh, giấm, me → SOUR
nước cốt dừa, mỡ → RICH/FATTY
```

Không cần yêu cầu flavor confidence tuyệt đối; nhưng low-confidence flavor phải được đánh dấu.

---

## 14. ENRICHING — Rule engine

### 14.1. Thứ tự xử lý

```text
Resolved ingredients
→ Ingredient attributes
→ Nutrition estimate
→ Meal/goal/diet/flavor rules
→ Cross-field validation
```

### 14.2. Rule result

```ts
type ClassificationRuleResult = {
  categoryCodes: string[];
  mealTypeCodes: string[];
  goalCodes: string[];
  dietTypeCodes: string[];
  flavorCodes: string[];
  warnings: FieldWarning[];
};
```

AI candidate và rule result được reconcile:

- Cùng kết quả → tăng confidence.
- Mâu thuẫn → ưu tiên deterministic rule cho diet/goal sức khỏe.
- Không đủ dữ liệu → không gắn tag thay vì đoán.

---

## 15. ENRICHING — Nutrition v1.1

### 15.1. AS-IS

AI nhận ingredients đã normalize và trả calories, macro, fiber, sodium cho một khẩu phần.

Chưa đối chiếu USDA hoặc nguồn nutrition chuẩn.

### 15.2. TO-BE P0 output

```ts
type NutritionEstimateV11 = {
  basis: 'PER_SERVING' | 'PER_100G' | 'WHOLE_RECIPE';
  servings: number;
  servingName: string;
  servingG?: number | null;
  caloriesKcal?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  fiberG?: number | null;
  sodiumMg?: number | null;
  method: 'AI_ESTIMATED' | 'INGREDIENT_CALCULATED' | 'SOURCE_VERIFIED';
  confidence: number;
  sourceUrl?: string | null;
};
```

### 15.3. Validators

#### Serving consistency

```text
recipe.servings === nutrition.servings
nutrition.servingG consistent with dish servingSize
previewServingG === nutrition.servingG
```

#### Macro energy consistency

Approximate energy:

```text
expectedKcal = proteinG × 4 + carbsG × 4 + fatG × 9
```

Nếu calories lệch quá tolerance cấu hình, tạo warning và repair nutrition.

#### Source/confidence

- `sourceUrl` rỗng thì không được mô tả là source-verified.
- AI-only estimate không được gắn confidence như dữ liệu đã kiểm định.
- Sodium cao luôn tạo warning.
- Thiếu nutrition không chặn tạo DRAFT nhưng chặn health recommendation tùy rule.

### 15.4. Không nhầm toàn công thức với một khẩu phần

Nếu AI trả nutrition cho toàn công thức:

```text
perServing = wholeRecipe / servings
```

Không được hiển thị toàn bộ calories của 4 khẩu phần như calories cho một người.

### 15.5. FUTURE

- USDA FoodData Central.
- Bảng thành phần thực phẩm Việt Nam.
- Ingredient-level nutrition calculation.
- Evidence/source per nutrition field.

Các nguồn này chỉ được ghi trong UI sau khi integration thật hoạt động.

---

## 16. ENRICHING — Recipe validation

### 16.1. Recipe title

Required rules:

- Không rỗng.
- Có liên quan trực tiếp đến Dish name.
- Không chứa tên món khác.
- Không chứa Markdown syntax.

Fallback deterministic:

```ts
recipe.title = `Cách làm ${dish.name}`;
```

Ví dụ Dish `Thịt kho mắm ruốt` không được có recipe title `Phở gà truyền thống`.

### 16.2. Recipe step sanitation

Input:

```text
**Sơ chế và ướp thịt**
```

Output:

```text
Sơ chế và ướp thịt
```

Loại bỏ:

- Markdown `**`, `_`, backticks.
- HTML không cần thiết.
- Quote thừa.
- Ký tự control.

### 16.3. Cross-validation

- `stepNumber` liên tục từ 1.
- Có ít nhất một step.
- Ingredient được nhắc trong step nên tồn tại trong ingredient list.
- Tổng duration step không được mâu thuẫn nghiêm trọng với prep/cook time.
- Recipe servings phải khớp Dish servings.
- Steps không chứa nội dung unsafe hoặc instruction không liên quan nấu ăn.

### 16.4. Missing step title

Nếu description có nhưng title thiếu, backend có thể tạo title ngắn từ action verb:

```text
Sơ chế nguyên liệu
Ướp thịt
Thắng đường
Xào thịt
Kho với nước dừa
Hoàn thiện và trình bày
```

---

## 17. ENRICHING — Ảnh

### 17.1. AS-IS

Thứ tự:

1. Wikipedia tiếng Việt.
2. Wikipedia tiếng Anh.
3. Unsplash nếu có key.
4. Không có ảnh.

Món vẫn được tạo nếu không có ảnh.

### 17.2. TO-BE P1

Lưu metadata:

```ts
type DishImageCandidate = {
  url: string;
  sourceUrl: string;
  provider: 'WIKIPEDIA' | 'UNSPLASH';
  author?: string | null;
  license?: string | null;
  attribution?: string | null;
  isIllustrative: boolean;
};
```

Không mô tả ảnh minh họa là ảnh chính thức của món.

---

## 18. Cross-field validation và targeted repair

### 18.1. Final validation matrix

| Field/relationship | Rule | Severity |
|---|---|---|
| Dish name | Required; 2–150 ký tự | Blocking |
| Region/province | Province thuộc region | Blocking nếu có province sai |
| Category | Ít nhất 1 valid category | Review blocking |
| Meal type | Ít nhất 1 valid meal type | Review blocking |
| Ingredient name | Không chứa quantity/unit/preparation | Blocking |
| Ingredient unit | Phải thuộc unit dictionary hoặc null hợp lệ | Blocking |
| Ingredient resolution | Low confidence không auto-create canonical | Warning/block tùy schema |
| Diet | Không mâu thuẫn ingredient | Blocking |
| Recipe title | Required và khớp Dish | Blocking |
| Recipe steps | Ít nhất 1 step, numbering hợp lệ | Blocking |
| Servings | Dish/recipe/nutrition thống nhất | Blocking |
| Nutrition basis | Rõ per serving/per 100g/whole recipe | Blocking cho health use |
| Sodium | Có warning khi cao | Warning |
| Image | Có thể thiếu | Warning |

### 18.2. Targeted repair input

```json
{
  "jobId": "job_123",
  "dishContext": {
    "name": "Thịt kho mắm ruốt",
    "existingValidData": "<sanitized subset>"
  },
  "invalidFields": [
    {
      "path": "classification.categoryCodes",
      "reason": "EMPTY_REQUIRED_FIELD"
    },
    {
      "path": "classification.mealTypeCodes",
      "reason": "EMPTY_REQUIRED_FIELD"
    },
    {
      "path": "recipe.title",
      "reason": "TITLE_DISH_MISMATCH"
    }
  ]
}
```

### 18.3. Repair rules

- Chỉ gửi field lỗi và context tối thiểu cần thiết.
- Không yêu cầu model sinh lại toàn bộ Dish.
- Merge theo path whitelist.
- Validate lại repair output.
- Tối đa số lần repair theo config, đề xuất 1–2.
- Nếu vẫn lỗi: giữ DRAFT với warnings hoặc fail trước DRAFT theo severity.

---

## 19. Completion, warnings và unresolved fields

Không thêm job status mới. Job vẫn `DONE` khi tạo được Dish DRAFT.

Job detail nên mở rộng:

```ts
type AiImportJobQuality = {
  completionPercent: number;
  warnings: Array<{
    code: string;
    fieldPath: string;
    message: string;
    severity: 'WARNING' | 'REVIEW_BLOCKING';
  }>;
  unresolvedFields: string[];
};
```

Ví dụ:

```json
{
  "completionPercent": 86,
  "warnings": [
    {
      "code": "AI_IMPORT_PROVINCE_NEEDS_REVIEW",
      "fieldPath": "basic.provinceId",
      "message": "Tỉnh/thành được AI đề xuất nhưng chưa đủ dữ liệu xác minh.",
      "severity": "WARNING"
    }
  ],
  "unresolvedFields": ["classification.dietTypeIds"]
}
```

Không hiển thị `100% hoàn thiện` nếu required classification hoặc recipe title còn thiếu.

---

## 20. DRAFTING — Persistence

### 20.1. AS-IS

Hệ thống có thể ghi:

- Dish.
- DishIngredient.
- DishNutrition.
- RecipeStep.
- DishMedia.
- Ingredient links.

### 20.2. TO-BE P0 transaction

Một transaction tạo Dish aggregate:

```text
Dish
+ category tags
+ meal type tags
+ goal tags
+ diet tags
+ flavor tags
+ DishIngredient
+ NutritionProfile
+ Recipe
+ RecipeStep
+ DishMedia
+ warnings/audit
```

Nếu transaction fail, không để Dish nửa vời.

### 20.3. Status

Dish luôn được tạo với:

```text
DRAFT
```

AI import không được gọi approve/publish.

### 20.4. Idempotency

- Mỗi job chỉ có tối đa một `resultDishId`.
- Worker internal retry không tạo Dish thứ hai.
- DRAFT creation cần idempotency key dựa trên job ID.

---

## 21. Editor mapping và UI

### 21.1. Không tăng số màn hình AI Import

Giữ BA-007 v1.2:

```text
Nhập tên → Tiến trình → Tạo DRAFT → Mở editor → Gửi duyệt
```

Các validator và repair chạy backend.

### 21.2. Loại bỏ field bị lặp

Hiện UI có category và meal type ở cả Thông tin cơ bản và Phân loại.

Đề xuất:

- Bước 1: name, alternate names, description, region, province/city.
- Bước 2: category, meal type, goals, diets, flavors, dish type, price.

Nếu cần hiển thị ở bước 1, chỉ dùng read-only summary và bind cùng source of truth.

### 21.3. AI field indicators

Không cần evidence screen riêng. Editor chỉ cần:

- Badge `AI đề xuất`.
- Badge vàng `Cần kiểm tra` cho confidence 70–89.
- Highlight missing/review-blocking field.
- Tooltip raw ingredient text.
- Warning banner về dữ liệu AI.

### 21.4. Ingredient row

Nên hỗ trợ các cột/field:

| Field | UI |
|---|---|
| Ingredient | Canonical ingredient selector/search |
| Quantity | Numeric hoặc range |
| Unit | Culinary unit select |
| Specification | Mô tả loại/chất lượng |
| Preparation | Cách sơ chế |
| Required/optional | Toggle |
| Match status | Badge nếu unresolved |

### 21.5. Bổ sung field còn thiếu

Nút đề xuất trong editor:

```text
Bổ sung các trường còn thiếu bằng AI
```

Không auto-overwrite field user đã sửa.

---

## 22. API bổ sung đề xuất

### 22.1. Existing endpoints giữ nguyên

```http
POST /v1/admin/import-jobs
GET  /v1/admin/import-jobs
GET  /v1/admin/import-jobs/:id
POST /v1/admin/import-jobs/:id/cancel
```

### 22.2. Optional P1: enrich existing DRAFT

```http
POST /v1/admin/dishes/:id/ai-enrich
Authorization: Bearer <admin_jwt>
If-Match: <dish-version>
Content-Type: application/json
```

Request:

```json
{
  "sections": [
    "BASIC",
    "CLASSIFICATION",
    "INGREDIENTS",
    "RECIPE",
    "NUTRITION"
  ],
  "mode": "MISSING_ONLY"
}
```

Rules:

- Chỉ áp dụng cho Dish DRAFT.
- `MISSING_ONLY` không ghi đè field source USER.
- Bắt buộc optimistic locking.
- Ghi audit cho mọi field thay đổi.

Response:

```json
{
  "dishId": "dish_123",
  "version": 8,
  "updatedFields": [
    "regionId",
    "categoryIds",
    "mealTypeCodes",
    "recipe.title"
  ],
  "warnings": [],
  "unresolvedFields": []
}
```

Endpoint này là TO-BE; FE không gọi cho tới khi BE triển khai và feature flag được bật.

---

## 23. Socket.IO và frontend sync

### 23.1. AS-IS

- Namespace `/import`.
- Events `job:{jobId}`, `job:progress`.
- Polling fallback 5 giây.

### 23.2. Payload mở rộng đề xuất

```json
{
  "jobId": "job_123",
  "status": "ENRICHING",
  "progress": 82,
  "message": "Đang kiểm tra phân loại và dinh dưỡng...",
  "warningsCount": 1,
  "resultDishId": null
}
```

Không cần stream raw ingredient hoặc raw AI response qua Socket.IO.

### 23.3. Reconnect

- FE refetch GET job detail sau reconnect.
- Socket chỉ là notification channel; REST/DB là source of truth sau hardening.
- Dừng polling ở `DONE`, `FAILED`, `CANCELLED`.

---

## 24. Error contract

```json
{
  "success": false,
  "error": {
    "code": "AI_IMPORT_INGREDIENT_PARSE_FAILED",
    "message": "Không thể chuẩn hóa một số nguyên liệu.",
    "retryable": true,
    "details": {
      "ingredientIndexes": [3, 7]
    }
  }
}
```

### 24.1. Error codes đề xuất

| Code | Ý nghĩa | Hành vi |
|---|---|---|
| `AI_IMPORT_INVALID_QUERY` | Query không hợp lệ | Trả 400 |
| `AI_IMPORT_TAXONOMY_NOT_READY` | Thiếu master taxonomy | Fail trước AI call |
| `AI_IMPORT_INVALID_AI_RESPONSE` | JSON/schema lỗi | Controlled retry/repair |
| `AI_IMPORT_UNKNOWN_TAXONOMY_CODE` | AI trả code ngoài danh sách | Remove + warning/repair |
| `AI_IMPORT_INGREDIENT_PARSE_FAILED` | Không parse được ingredient | Mark unresolved/repair |
| `AI_IMPORT_INGREDIENT_AMBIGUOUS` | Nhiều candidate gần nhau | Không auto-link |
| `AI_IMPORT_RECIPE_TITLE_MISMATCH` | Recipe title sai Dish | Deterministic fallback/repair |
| `AI_IMPORT_NUTRITION_INCONSISTENT` | Serving/macro không khớp | Warning/repair |
| `AI_IMPORT_DRAFT_TRANSACTION_FAILED` | Không ghi được aggregate | Rollback + FAILED |
| `AI_IMPORT_JOB_NOT_FOUND` | Job memory mất hoặc ID sai | 404 |

---

## 25. Ví dụ hoàn chỉnh — Thịt kho mắm ruốt

Ví dụ minh họa; taxonomy code thực tế phải lấy từ DB.

```json
{
  "schemaVersion": "1.1",
  "basic": {
    "name": "Thịt kho mắm ruốt",
    "alternateNames": [],
    "shortDescription": "Thịt ba chỉ kho đậm đà với mắm ruốt, có vị mặn và thơm đặc trưng.",
    "difficulty": "MEDIUM",
    "prepMinutes": 30,
    "cookMinutes": 60,
    "servings": 4,
    "servingSize": "1 phần",
    "priceMin": 120000,
    "priceMax": 180000,
    "origin": {
      "originText": "Ẩm thực Huế",
      "regionCode": "CENTRAL",
      "provinceCode": "HUE_CITY",
      "isRegionalSpecialty": true,
      "confidence": 88,
      "reason": "Được nhận diện là món có liên hệ với phong cách sử dụng mắm ruốt Huế."
    }
  },
  "classification": {
    "categoryCodes": ["MEAT_DISH", "BRAISED_DISH"],
    "mealTypeCodes": ["LUNCH", "DINNER"],
    "goalCodes": ["DISCOVERY"],
    "dietTypeCodes": [],
    "flavorCodes": ["SALTY", "UMAMI"],
    "dishTypeCode": "DRY",
    "confidenceByField": {
      "categoryCodes": 94,
      "mealTypeCodes": 93,
      "goalCodes": 81,
      "flavorCodes": 95
    }
  },
  "ingredients": [
    {
      "rawText": "45 ml Mắm ruốt (loại mịn, màu nâu đỏ) (Lọc qua rây để bỏ xác tôm/cá nếu có, giữ lại phần nước sệt.)",
      "name": "Mắm ruốt",
      "canonicalNameCandidate": "Mắm ruốt",
      "quantity": 45,
      "quantityTo": null,
      "quantityText": null,
      "unitCode": "ML",
      "specification": "Loại mịn, màu nâu đỏ",
      "preparation": "Lọc qua rây để bỏ xác tôm/cá nếu có, giữ lại phần nước sệt.",
      "group": "Gia vị",
      "optional": false,
      "normalizedWeightGram": null
    },
    {
      "rawText": "3 củ hành tím, bóc vỏ và băm nhuyễn",
      "name": "Hành tím",
      "canonicalNameCandidate": "Hành tím",
      "quantity": 3,
      "unitCode": "CỦ",
      "specification": null,
      "preparation": "Bóc vỏ và băm nhuyễn",
      "group": "Gia vị",
      "optional": false,
      "normalizedWeightGram": null
    }
  ],
  "recipe": {
    "title": "Cách làm thịt kho mắm ruốt",
    "servings": 4,
    "prepMinutes": 30,
    "cookMinutes": 60,
    "difficulty": "MEDIUM",
    "steps": [
      {
        "stepNumber": 1,
        "title": "Sơ chế và ướp thịt",
        "description": "Sơ chế thịt ba chỉ, sau đó ướp với gia vị.",
        "durationMinutes": 25,
        "tips": null
      }
    ]
  }
}
```

Vì origin confidence trong ví dụ là 88, UI nên đánh dấu province/city `Cần kiểm tra`, không tự coi là dữ liệu đã xác minh.

---

## 26. Job storage, queue và retry

### 26.1. AS-IS

- Job lưu trong `Map` memory.
- Tối đa 100 job gần nhất.
- Backend restart làm mất lịch sử.
- Pipeline chạy trong backend process.

### 26.2. TO-BE P1

- PostgreSQL là source of truth cho job/status/result.
- BullMQ + Redis hoặc durable worker tương đương.
- Retry/backoff theo loại lỗi.
- Checkpoint nội bộ; không nhất thiết đưa pause/resume ra UI.
- Worker retry idempotent.
- Job events có sequence/eventId.

Retry provider tạm thời khác với nút `Tạo lại job` trên FE. FE tạo lại job mới; worker retry nội bộ không tạo Dish mới.

---

## 27. Security

### 27.1. REST

- JWT + RBAC cho create/list/detail/cancel/enrich.
- Chỉ `CONTENT_ADMIN` và `SUPER_ADMIN` tạo AI job.
- Rate limit theo user/tenant.
- Không log API key.

### 27.2. Socket.IO

TO-BE P1:

- Verify JWT handshake.
- Check role/scope.
- Room `import-job:{jobId}`.
- Không broadcast job cho client không có quyền.
- Reconnect refetch REST.

### 27.3. AI output

- JSON schema validation.
- Sanitize HTML/Markdown/control characters.
- Không thực thi text do AI tạo.
- Không đưa provider secret về FE.

### 27.4. FUTURE source fetching

Nếu bổ sung manual URL/crawler:

- SSRF protection.
- Block localhost/private/metadata IP.
- Validate redirect.
- Respect robots/terms.
- Prompt-injection isolation.
- Không lưu nguyên văn nội dung có bản quyền quá mức cần thiết.

---

## 28. Audit và observability

### 28.1. Audit events

```text
AI_IMPORT_JOB_CREATED
AI_IMPORT_EXTRACTION_COMPLETED
AI_IMPORT_TAXONOMY_RESOLVED
AI_IMPORT_INGREDIENT_NORMALIZED
AI_IMPORT_TARGETED_REPAIR_APPLIED
AI_IMPORT_DRAFT_CREATED
AI_IMPORT_CANCELLED
AI_IMPORT_FAILED
AI_DISH_ENRICHED
```

### 28.2. Metrics

- Job success/failure rate.
- Latency theo pipeline step.
- Invalid JSON rate.
- Targeted repair rate.
- Missing category/meal type rate.
- Ingredient unresolved rate.
- New ingredient creation rate.
- Recipe title mismatch rate.
- Nutrition inconsistency rate.
- Jobs tạo duplicate Dish.

Metrics giúp biết prompt/model có thật sự cải thiện hay chỉ thay đổi dữ liệu ngẫu nhiên.

---

## 29. Acceptance criteria

### AC-01 — Taxonomy ready

Nếu categories hoặc meal types chưa được seed, job trả lỗi cấu hình rõ ràng thay vì tạo Dish thiếu classification mà không cảnh báo.

### AC-02 — Valid taxonomy mapping

AI chỉ trả taxonomy code nằm trong candidate list; BE map đúng code sang ID.

### AC-03 — Region/province consistency

Province/city nếu có phải thuộc region đã chọn; confidence thấp không auto-accept.

### AC-04 — Category và meal type

Dish DRAFT có ít nhất một valid category và meal type, hoặc job trả review-blocking warning.

### AC-05 — Ingredient split

Raw ingredient `45 ml Mắm ruốt (...) (...)` được tách thành:

```text
name = Mắm ruốt
quantity = 45
unit = ML
specification = loại mịn, màu nâu đỏ
preparation = lọc qua rây...
```

### AC-06 — Culinary unit

`3 củ hành tím`, `4 tép tỏi`, `2 cây sả`, `2 quả ớt` không bị lưu thành gram nếu chưa có conversion đáng tin.

### AC-07 — Ingredient safety

Low-confidence prefix/fuzzy match không tự link hoặc tạo canonical Ingredient.

### AC-08 — Recipe title

Recipe title bắt buộc, không có Markdown và không chứa tên món khác.

### AC-09 — Recipe consistency

Recipe servings và Dish servings khớp; step numbering liên tục.

### AC-10 — Nutrition basis

Nutrition ghi rõ basis/method; preview serving khớp Nutrition serving.

### AC-11 — AI-only nutrition

Dữ liệu AI estimate không được hiển thị như dữ liệu source-verified.

### AC-12 — Targeted repair

Repair chỉ cập nhật field path lỗi và không làm thay đổi field hợp lệ.

### AC-13 — User edit protection

Enrichment `MISSING_ONLY` không overwrite field có source `USER`.

### AC-14 — Atomic DRAFT

Một job thành công tạo đúng một Dish `DRAFT`; transaction lỗi không để aggregate nửa vời.

### AC-15 — No auto publish

AI import không đổi Dish sang `PENDING_REVIEW` hoặc `PUBLISHED`.

---

## 30. Test plan

### 30.1. Unit tests

- Ingredient parser với number, fraction, range và qualitative quantity.
- Parentheses classification: specification vs preparation.
- Unit dictionary/alias conversion.
- Unicode/diacritic normalization.
- Exact, alias, fuzzy ingredient match.
- Province-region validation.
- Taxonomy unknown code rejection.
- Diet rule từ ingredient attributes.
- Goal rule từ nutrition/time/price.
- Flavor rule từ ingredient profile.
- Recipe title sanitizer/fallback.
- Macro calories validator.

### 30.2. Integration tests

- Load taxonomy snapshot → AI extraction → map DB IDs.
- Invalid AI JSON → controlled retry/repair.
- Missing classification → targeted repair.
- Ambiguous ingredient → unresolved warning.
- Nutrition whole recipe → per-serving conversion.
- Atomic DRAFT transaction.
- Idempotent worker retry.
- Enrich MISSING_ONLY + If-Match conflict.

### 30.3. E2E cases

1. Phở bò Hà Nội có region/category/meal/recipe/ingredients đầy đủ.
2. Thịt kho mắm ruốt tách đúng mắm ruốt, quantity, unit, specification, preparation.
3. Món không rõ tỉnh/thành để province null và warning.
4. Vegan candidate có một ingredient chưa xác định không được auto-gắn vegan.
5. Recipe title bị model trả tên món khác được repair/fallback.
6. Nutrition serving 450g không hiển thị preview 290g.
7. Job DONE mở đúng `/foods/:resultDishId`.
8. Admin sửa field rồi enrich lại không bị overwrite.
9. REVIEWER không tạo AI job.
10. Không có nhánh auto publish.

---

## 31. Kế hoạch triển khai

### Sprint/P0.1 — Taxonomy và structured output

- Seed/verify taxonomy tables.
- Taxonomy snapshot service.
- `DishExtractionV11` schema.
- Provider output validation.
- Map taxonomy code sang IDs.

### Sprint/P0.2 — Ingredient normalization

- Ingredient parser.
- Unit dictionary.
- Specification/preparation split.
- Alias/synonym dictionary.
- Loại auto prefix decision nguy hiểm.
- Unresolved warning.

### Sprint/P0.3 — Classification và recipe

- Goal/diet/flavor rule engine.
- Recipe title validator/fallback.
- Step sanitizer.
- Cross-field validator.
- Targeted repair.

### Sprint/P0.4 — Nutrition và persistence

- Nutrition basis/method.
- Serving/macro validation.
- Atomic Dish aggregate transaction.
- Completion/warnings/unresolvedFields.
- Audit.

### Sprint/P1 — Production hardening

- PostgreSQL job persistence.
- BullMQ/Redis worker.
- Idempotency/retry/backoff.
- Socket JWT/rooms.
- Metrics/alerts.
- Image license/attribution.
- Optional DRAFT enrichment endpoint.

---

## 32. Definition of Done

### BE

- Structured extraction schema v1.1 hoạt động.
- Không ghi raw AI data trực tiếp.
- Taxonomy code resolve đúng ID.
- Ingredient parser pass test suite.
- Low-confidence ingredient không làm bẩn dictionary.
- Rule engine điền classification khi đủ dữ liệu.
- Recipe title luôn hợp lệ hoặc có blocking warning.
- Nutrition basis nhất quán.
- Targeted repair không thay field hợp lệ.
- Một job tạo tối đa một DRAFT.

### FE

- Không hiển thị source chưa hoạt động.
- Editor không lặp source of truth category/meal type.
- Hiển thị AI suggestion/warning tối giản.
- Ingredient fields hiển thị đúng cấu trúc.
- Có thể gọi MISSING_ONLY khi endpoint được bật.
- Không có nút publish trong AI import.

### QA

- Pass toàn bộ acceptance criteria.
- Test ít nhất 30 món thuộc nhiều vùng/category khác nhau.
- Kiểm tra ingredient edge cases tiếng Việt.
- Kiểm tra refresh/socket fallback.
- Kiểm tra role và optimistic locking.
- Xác minh không có duplicate Dish do retry.

### DevOps

- Provider key server-side.
- Log/metric không lộ secret/raw sensitive data.
- Queue/storage/Redis monitoring khi P1 triển khai.
- Alert khi invalid JSON, unresolved ingredient hoặc job failure tăng bất thường.

---

## 33. Kết luận

Cơ chế v1.1 giữ nguyên trải nghiệm đơn giản:

```text
Tên món + context
→ AI structured extraction
→ Ingredient normalization
→ Taxonomy resolution
→ Rule enrichment
→ Nutrition + image
→ Cross-field validation
→ Targeted repair
→ Atomic DRAFT
→ Admin kiểm tra và gửi duyệt
```

Thay đổi quan trọng nhất là AI không còn tự quyết định toàn bộ dữ liệu và không ghi trực tiếp chuỗi tự do xuống database. AI tạo candidate có cấu trúc; backend kiểm soát taxonomy, unit, ingredient matching, classification, nutrition và tính nhất quán trước khi tạo Dish `DRAFT`.

