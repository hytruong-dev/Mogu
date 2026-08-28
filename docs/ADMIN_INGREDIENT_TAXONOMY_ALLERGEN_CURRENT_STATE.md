# Hiện trạng Backend Admin — Nguyên liệu, Danh mục, Chế độ ăn và Dị ứng

**Phiên bản tài liệu:** 1.0  
**Cập nhật:** 28/08/2026  
**Đối tượng:** BA, Product Owner, QA, Backend và Admin FE  
**Phạm vi:** Backend API đang có tại thời điểm lập tài liệu; không phải danh sách yêu cầu tương lai.

## 1. Mục tiêu và phạm vi

Backend hiện quản lý bốn nhóm dữ liệu dùng chung khi tạo, chỉnh sửa, kiểm duyệt và gợi ý món:

1. **Nguyên liệu** — từ điển nguyên liệu có thể liên kết vào món ăn.
2. **Danh mục món ăn** — phân loại loại món, ví dụ món nước, món kho, món hải sản.
3. **Chế độ ăn** — nhãn dinh dưỡng/chế độ ăn, ví dụ ăn thông thường, chay, ít tinh bột.
4. **Dị ứng** — danh mục tác nhân dị ứng phục vụ khai báo hồ sơ người dùng và đánh giá món.

Các endpoint Admin yêu cầu JWT hợp lệ. Role được sử dụng trong hệ thống:

- `SUPER_ADMIN`: toàn quyền trên bốn nhóm dữ liệu.
- `CONTENT_ADMIN`: tạo/sửa/ẩn dữ liệu nghiệp vụ.
- `REVIEWER`: chỉ được xem danh sách nguyên liệu Admin; không được tạo/sửa/ẩn nguyên liệu và không có quyền API quản trị taxonomy.

Tất cả URL bên dưới được hiểu có tiền tố `/v1`.

## 2. Tổng quan dữ liệu và liên kết nghiệp vụ

| Nhóm | Bảng/Model chính | Liên kết hiện có |
|---|---|---|
| Nguyên liệu | `ingredients` / `Ingredient` | `dish_ingredients` liên kết một nguyên liệu vào một món; có `allergenCode` dạng text |
| Danh mục | `dish_categories` / `DishCategory` | N-N với món qua `dish_category_links` |
| Chế độ ăn | `diet_types` / `DietType` | N-N với món qua `dish_diet_types` |
| Dị ứng | `allergens` / `Allergen` | Người dùng khai báo qua `profile_allergens`; món có thể có `dish_allergens` |

Lưu ý quan trọng: `Ingredient.allergenCode` hiện là mã text, **không phải foreign key** đến bảng `allergens`. Vì vậy hệ thống chưa có ràng buộc DB bảo đảm mã dị ứng của nguyên liệu luôn tồn tại trong danh mục dị ứng.

## 3. Màn/Module Nguyên liệu

### 3.1. Mục đích nghiệp vụ

Từ điển nguyên liệu cung cấp lựa chọn chuẩn hóa khi Admin tạo/sửa món. Mỗi ingredient có mã duy nhất, tên hiển thị, tên đồng nghĩa, đơn vị mặc định, mã dị ứng tùy chọn và ảnh minh họa.

AI Import v1.1 cũng dùng từ điển này để đối soát ingredient AI trả về theo thứ tự exact name → alias → normalized name → fuzzy matching. AI Import không tự tạo nguyên liệu canonical khi độ tin cậy thấp.

### 3.2. Dữ liệu lưu trữ

Model `Ingredient` hiện có:

- `id`: UUID.
- `code`: mã nguyên liệu duy nhất, tối đa 100 ký tự.
- `name`: tên chuẩn, tối đa 200 ký tự.
- `synonyms`: mảng tên đồng nghĩa.
- `unit`: đơn vị mặc định, tối đa 50 ký tự.
- `allergenCode`: mã dị ứng tùy chọn, tối đa 50 ký tự.
- `imageUrl`, `imageKey`: URL/key ảnh.
- `isActive`: trạng thái sử dụng; mặc định `true`.
- `createdAt`, `updatedAt`.

Khi ingredient được đưa vào món, bảng `dish_ingredients` lưu dữ liệu theo từng công thức: raw text, parsed name, số lượng, khoảng số lượng, đơn vị, sơ chế, specification/ghi chú thay thế, nhóm, optional và metadata resolve AI. Điều này cho phép cùng một nguyên liệu chuẩn xuất hiện với định lượng hoặc cách sơ chế khác nhau giữa các món.

### 3.3. API hiện có

#### API public dùng cho picker/tìm kiếm

`GET /ingredients`

Không yêu cầu đăng nhập. Chỉ trả ingredient `isActive = true`.

Query:

- `q`: tìm theo `name` hoặc `code`, không phân biệt hoa thường.
- `allergenCode`: lọc đúng theo mã dị ứng.
- `limit`: mặc định 20, tối đa 100.

Response trả: `id`, `code`, `name`, `synonyms`, `unit`, `allergenCode`, `imageUrl`.

#### API Admin

`GET /admin/ingredients`

- Role: `CONTENT_ADMIN`, `REVIEWER`, `SUPER_ADMIN`.
- Query: `q`, `allergenCode`, `isActive`, `page`, `limit`.
- Có phân trang dạng `{ data, pagination }`.
- Tìm kiếm Admin: `name`, `code`, hoặc synonyms khớp hoàn toàn trong mảng.
- Sắp xếp theo tên tăng dần.

`POST /admin/ingredients`

- Role: `CONTENT_ADMIN`, `SUPER_ADMIN`.
- Tạo ingredient.
- `code`, `name` là bắt buộc.
- Trùng `code` trả lỗi `409` với code `INGREDIENT_CODE_EXISTS`.

`PATCH /admin/ingredients/:id`

- Role: `CONTENT_ADMIN`, `SUPER_ADMIN`.
- Sửa `name`, `synonyms`, `unit`, `allergenCode`, `imageUrl`, `imageKey`, `isActive`.
- Không hỗ trợ đổi `code` sau khi tạo.
- Không tìm thấy trả `404` với `INGREDIENT_NOT_FOUND`.

`DELETE /admin/ingredients/:id`

- Role: `CONTENT_ADMIN`, `SUPER_ADMIN`.
- Không xóa vật lý; cập nhật `isActive = false`.

`POST /admin/ingredients/:id/presign-upload`

- Role: `CONTENT_ADMIN`, `SUPER_ADMIN`.
- Sinh signed upload URL cho Supabase bucket `ingredient-images`.
- API chỉ sinh URL upload; Admin FE phải upload file và sau đó gọi PATCH để lưu `imageUrl`/`imageKey`.

### 3.4. Quy tắc/giới hạn hiện tại

- Chưa kiểm tra format/case chuẩn của `code`; chỉ giới hạn kiểu chuỗi và độ dài.
- Chưa validate `allergenCode` có tồn tại trong bảng `allergens`.
- Không có cơ chế merge hai ingredient trùng hoặc chuyển toàn bộ tham chiếu từ ingredient cũ sang ingredient mới.
- Không có audit log riêng cho thao tác CRUD nguyên liệu.
- Soft delete không kiểm tra ingredient đã được dùng trong món hay chưa; các liên kết lịch sử vẫn giữ nguyên.
- Public search hiện không tìm full-text/không bỏ dấu, và synonyms dùng match chính xác ở API Admin.

## 4. Màn/Module Danh mục món ăn

### 4.1. Mục đích nghiệp vụ

Danh mục dùng để phân loại món. Một món có thể thuộc nhiều danh mục qua bảng liên kết `dish_category_links`. Danh mục active được dùng trong form tạo/sửa món, API công khai, lọc tìm kiếm và AI Import taxonomy snapshot.

### 4.2. Dữ liệu lưu trữ

Model `DishCategory`:

- `id`: UUID.
- `code`: mã duy nhất, tối đa 50 ký tự.
- `name`: tên danh mục, tối đa 100 ký tự.
- `description`: mô tả tùy chọn.
- `displayOrder`: thứ tự hiển thị, mặc định `0`.
- `isActive`: bật/tắt hiển thị, mặc định `true`.

### 4.3. API public

`GET /taxonomy/categories`

- Không yêu cầu đăng nhập.
- Chỉ trả category active.
- Sắp xếp theo `displayOrder` tăng dần.

### 4.4. API Admin

Toàn bộ API sau yêu cầu `SUPER_ADMIN` hoặc `CONTENT_ADMIN`.

`GET /admin/taxonomy/categories`

- Trả tất cả category, gồm cả inactive.
- Sắp xếp `displayOrder`, sau đó `name`.
- Hiện không có phân trang, tìm kiếm hoặc filter trạng thái.

`POST /admin/taxonomy/categories`

Body:

- `code`: bắt buộc, unique, tối đa 50 ký tự.
- `name`: bắt buộc, tối đa 100 ký tự.
- `description`: tùy chọn.
- `displayOrder`: số nguyên không âm, mặc định `0`.
- `isActive`: boolean, mặc định `true`.

Trùng code trả `409`.

`PATCH /admin/taxonomy/categories/:id`

- Sửa `name`, `description`, `displayOrder`, `isActive`.
- Không hỗ trợ đổi `code`.
- ID không tồn tại trả `404`.

`DELETE /admin/taxonomy/categories/:id`

- Soft delete bằng `isActive = false`.
- Không xóa vật lý và không xóa liên kết món hiện hữu.

### 4.5. Quy tắc/giới hạn hiện tại

- Chưa kiểm tra danh mục có đang được gắn vào món trước khi inactive.
- Không có endpoint reorder theo lô, dù DTO `ReorderItemDto` đã tồn tại.
- Không có cây danh mục/parent category; mô hình hiện là danh sách phẳng.
- Không có audit log, version hay optimistic locking.

## 5. Màn/Module Chế độ ăn

### 5.1. Mục đích nghiệp vụ

Chế độ ăn là taxonomy gắn N-N với món qua `dish_diet_types`. Dữ liệu được dùng trong lọc món, form Admin và AI Import taxonomy snapshot.

AI Import có rule an toàn: khi ingredient unresolved, hệ thống không nên tự xác nhận các nhãn nhạy cảm như vegan, vegetarian hoặc gluten-free chỉ dựa trên AI.

### 5.2. Dữ liệu lưu trữ

Model `DietType`:

- `id`: UUID.
- `code`: mã duy nhất.
- `name`: tên chế độ ăn.
- `description`: mô tả tùy chọn.
- `isActive`: trạng thái hiển thị.

Schema hiện không có `displayOrder` cho `DietType`; danh sách public/admin được sắp theo `code`.

### 5.3. API public

`GET /taxonomy/diet-types`

- Không yêu cầu đăng nhập.
- Chỉ trả record active.
- Sắp theo `code`.

### 5.4. API Admin

Toàn bộ API yêu cầu `SUPER_ADMIN` hoặc `CONTENT_ADMIN`.

`GET /admin/taxonomy/diet-types`

- Trả cả active và inactive.
- Sắp theo `code`.
- Chưa có phân trang, tìm kiếm/filter.

`POST /admin/taxonomy/diet-types`

- Body dùng cấu trúc `CreateCategoryDto`: `code`, `name`, `description`, `isActive`.
- `displayOrder` có trong DTO dùng chung nhưng không được lưu ở `DietType`.
- Trùng code trả `409`.

`PATCH /admin/taxonomy/diet-types/:id`

- Sửa `name`, `description`, `isActive`.
- Không đổi code.

`DELETE /admin/taxonomy/diet-types/:id`

- Soft delete bằng `isActive = false`.

### 5.5. Quy tắc/giới hạn hiện tại

- Không có bộ luật định nghĩa chính thức theo chế độ ăn trong module taxonomy.
- Rule phân loại AI hiện nằm ở AI Import, không phải cấu hình được từ màn Admin.
- Chưa kiểm tra diet type có đang được gắn với món trước khi inactive.
- Chưa có display order, audit log hoặc version.

## 6. Màn/Module Dị ứng

### 6.1. Mục đích nghiệp vụ

Dị ứng là danh mục tác nhân có nguy cơ. Nó hỗ trợ:

- Người dùng khai báo dị ứng trong profile qua `profile_allergens`.
- Gắn cảnh báo dị ứng cho món qua `dish_allergens`.
- Lọc/gợi ý món an toàn hơn cho người dùng.
- Gắn mã dị ứng tự do vào ingredient qua `Ingredient.allergenCode`.

`DishAllergen` có thêm dữ liệu nghiệp vụ `level`, `confidence`, `resolved`, `resolutionNote`; vì vậy cảnh báo của món có thể là dữ liệu đã kiểm chứng hoặc cần review.

### 6.2. Dữ liệu lưu trữ

Model `Allergen`:

- `id`: UUID.
- `code`: mã duy nhất, được chuẩn hóa uppercase khi tạo từ Admin.
- `name`: tên hiển thị.
- `description`: mô tả/phạm vi.
- `displayOrder`: thứ tự hiển thị.
- `active`: bật/tắt hiển thị.

### 6.3. API public

`GET /taxonomy/allergens`

- Không yêu cầu đăng nhập.
- Chỉ trả allergen `active = true`.
- Sắp theo `displayOrder`.

### 6.4. API Admin

Toàn bộ API yêu cầu `SUPER_ADMIN` hoặc `CONTENT_ADMIN`.

`GET /admin/taxonomy/allergens`

- Trả tất cả allergen gồm active/inactive.
- Sắp theo `displayOrder`, sau đó `code`.
- Chưa có phân trang, tìm kiếm/filter.

`POST /admin/taxonomy/allergens`

Body:

- `code`: bắt buộc; backend chuyển sang uppercase trước khi lưu.
- `name`: bắt buộc.
- `description`: tùy chọn.
- `displayOrder`: số nguyên không âm.
- `active`: boolean, mặc định `true`.

Trùng code không phân biệt hoa thường sau khi uppercase sẽ trả `409`.

`PATCH /admin/taxonomy/allergens/:id`

- Sửa `name`, `description`, `displayOrder`, `active`.
- Không đổi code.

`PATCH /admin/taxonomy/allergens/:id/toggle`

- Đảo trạng thái `active`.
- Phù hợp cho thao tác bật/tắt nhanh.

Không có `DELETE /admin/taxonomy/allergens/:id`. Về nghiệp vụ, dị ứng chỉ được inactive để tránh làm mất lịch sử profile/món.

### 6.5. Quy tắc/giới hạn hiện tại

- `allergenCode` của ingredient chưa có FK hoặc validation tham chiếu đến `Allergen.code`.
- Chưa có job tự động suy luận/đồng bộ `DishAllergen` khi Admin đổi allergen của một ingredient.
- Chưa có màn/API quản trị mức độ cảnh báo cho từng dish (`DishAllergen.level`) trong phạm vi taxonomy.
- Chưa có audit log, version hoặc kiểm tra ảnh hưởng trước khi inactive.

## 7. Quy ước lỗi và bảo mật

| Tình huống | Hành vi hiện tại |
|---|---|
| Không có JWT/không hợp lệ | Bị chặn bởi `JwtAuthGuard` |
| Không đúng role | Bị chặn bởi `RolesGuard` |
| Tạo trùng code | `409 Conflict` |
| Cập nhật/ẩn record không tồn tại | `404 Not Found` |
| DTO sai kiểu/độ dài | `400 Bad Request` qua ValidationPipe |
| Xóa category/diet/ingredient | Inactive/soft delete, không xóa vật lý |
| Dị ứng | Chỉ có toggle active/inactive |

## 8. Điểm cần BA xác nhận hoặc backlog đề xuất

1. **Chuẩn hóa liên kết ingredient–allergen:** Có cần bắt buộc `Ingredient.allergenCode` tham chiếu danh mục `Allergen` không? Nếu có, nên thay text code bằng FK hoặc validate code trước khi lưu.
2. **Tác động khi deactivate:** Có cho phép inactive category/diet/ingredient/allergen đang được dùng bởi món đã published không? UI cần cảnh báo số lượng record ảnh hưởng?
3. **Đổi code:** Code hiện bất biến sau tạo. BA cần xác nhận đây là chủ trương; nếu cần đổi mã phải có migration dữ liệu và xử lý các tham chiếu.
4. **Quản lý thứ tự:** Category/allergen có `displayOrder`; diet type không có. Có cần drag-drop/reorder hàng loạt cho cả ba màn taxonomy không?
5. **Cấu hình rule chế độ ăn và dị ứng:** Hiện rule nằm trong code/AI Import. Có cần màn BA/Admin cấu hình ingredient bị cấm, quy tắc suy luận và mức cảnh báo không?
6. **Merge nguyên liệu trùng:** Chưa có quy trình rà soát duplicate hoặc merge ingredient, trong khi synonyms đang là text array.
7. **Audit:** Các thao tác Admin chưa có nhật ký ai thay đổi gì/khi nào cho bốn màn này.
8. **Tìm kiếm/phân trang taxonomy:** Danh mục, diet type và allergen chưa phân trang hoặc tìm kiếm, phù hợp dữ liệu nhỏ nhưng sẽ cần bổ sung nếu danh mục tăng.

## 9. File tham chiếu kỹ thuật

- `backend/src/ingredients/ingredients.controller.ts`
- `backend/src/ingredients/ingredients.service.ts`
- `backend/src/ingredients/dto/create-ingredient.dto.ts`
- `backend/src/taxonomy/admin-taxonomy.controller.ts`
- `backend/src/taxonomy/taxonomy.controller.ts`
- `backend/src/taxonomy/taxonomy.service.ts`
- `backend/src/taxonomy/dto/taxonomy-admin.dto.ts`
- `backend/prisma/schema.prisma`
