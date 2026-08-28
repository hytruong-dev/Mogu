# Báo cáo hiện trạng chức năng tự động nhập món

**Dự án:** Mogu  
**Ngày cập nhật:** 28/08/2026  
**Phạm vi:** Nhập món tự động bằng AI và nhập nhiều món từ CSV/XLSX  
**Đối tượng:** BA, Product Owner, QA và đội phát triển

---

## 1. Tóm tắt hiện trạng

Mogu hiện có **hai luồng nhập món tự động**:

1. **AI Import**: Admin nhập tên món, hệ thống gọi AI để sinh dữ liệu món và tạo bản nháp.
2. **File Import**: Admin tải CSV/XLSX chứa nhiều món, hệ thống đọc file, cho phép map cột, kiểm tra dữ liệu rồi tạo các bản nháp.

Các luồng đã có giao diện và API chính. Giao diện AI Import đã được chuẩn hóa theo bộ design gồm form nhập, màn hình pipeline, màn hình hoàn tất và lịch sử job. Kết quả đầu ra của cả hai luồng là món ở trạng thái **DRAFT**, không tự động xuất bản. Admin vẫn phải mở món, kiểm tra/chỉnh sửa và gửi kiểm duyệt.

> **Kết luận hiện tại:** Chức năng đã có prototype/full flow ở mức dùng thử nội bộ. Chưa nên xem là luồng production hoàn chỉnh vì một số phần vẫn dùng bộ nhớ tiến trình, chưa có worker queue bền vững và còn phụ thuộc cấu hình dịch vụ bên ngoài.

---

## 2. Luồng nghiệp vụ tổng thể

```text
Admin chọn cách nhập
        │
        ├── AI Import: nhập tên món
        │       └── AI sinh dữ liệu → enrich ảnh/dinh dưỡng → tạo DRAFT
        │
        └── File Import: tải CSV/XLSX
                └── đọc file → map cột → validate/sửa dòng
                    → chọn chính sách → chạy job → tạo DRAFT
                                      │
                                      ▼
                           Admin xem kết quả và chỉnh sửa
                                      │
                                      ▼
                           Kiểm tra hồ sơ → Gửi kiểm duyệt
```

### Quy tắc quan trọng

- Không tạo món ở trạng thái `PUBLISHED`.
- Món được tạo từ import phải được người quản trị kiểm tra lại.
- Dữ liệu do AI sinh là dữ liệu ước tính/gợi ý, đặc biệt là dinh dưỡng và công thức.
- Nếu lỗi một dòng/file, hệ thống có thể tiếp tục các dòng khác tùy `failureMode`.

---

## 3. Luồng A — Nhập món bằng AI

### 3.1. Cách sử dụng

Tại trang **Nhập món tự động** (`/ingest`):

1. Nhập tên món, ví dụ `Phở bò Hà Nội`.
2. Có thể thêm từ khóa liên quan.
3. Có thể chọn vùng miền.
4. Chọn loại nguồn mong muốn.
5. Bấm tạo job.
6. Theo dõi tiến trình.
7. Khi hoàn tất, mở preview và chọn **Mở để chỉnh sửa**.

### 3.2. Pipeline 6 bước

| Bước | Trạng thái | Nội dung |
|---|---|---|
| 1 | `SEARCHING` | Phân tích tên món và ngữ cảnh |
| 2 | `EXTRACTING` | AI sinh tên, mô tả, nguyên liệu, công thức |
| 3 | `NORMALIZING` | Chuẩn hóa tên và đơn vị nguyên liệu |
| 4 | `RECONCILING` | Đối chiếu món/nguyên liệu đã có |
| 5 | `ENRICHING` | Ước tính dinh dưỡng và tìm ảnh |
| 6 | `DRAFTING` | Ghi món, nguyên liệu, dinh dưỡng, bước nấu và media |
| 7 | `DONE` | Trả `resultDishId`, sẵn sàng chỉnh sửa |

Trạng thái kết thúc khác:

- `FAILED`: pipeline gặp lỗi.
- `CANCELLED`: admin đã hủy job.

### 3.3. Dữ liệu AI có thể tạo

- Tên món và mô tả ngắn.
- Độ khó, thời gian chuẩn bị/nấu, số khẩu phần.
- Danh sách nguyên liệu, số lượng, đơn vị, cách sơ chế.
- Các bước nấu, thời lượng và mẹo.
- Calories, protein, carbohydrate, fat, fiber, sodium.
- Ảnh món và ảnh nguyên liệu nếu tìm được.
- Slug và liên kết nguyên liệu với kho nguyên liệu.

### 3.4. API AI Import

Base URL: `/v1`

| Method | Endpoint | Mục đích |
|---|---|---|
| `POST` | `/admin/import-jobs` | Tạo job AI |
| `GET` | `/admin/import-jobs` | Lấy danh sách job |
| `GET` | `/admin/import-jobs/:id` | Xem chi tiết/progress/log |
| `POST` | `/admin/import-jobs/:id/cancel` | Hủy job |

Request tối thiểu:

```json
{
  "query": "Phở bò Hà Nội"
}
```

Request mở rộng:

```json
{
  "query": "Phở bò Hà Nội",
  "relatedKeywords": ["nước dùng xương", "ẩm thực miền Bắc"],
  "regionHint": "north",
  "sourceTypes": ["AI_GENERATED"]
}
```

Khi thành công, response chi tiết có `resultDishId`. ID này được dùng để mở màn hình chỉnh sửa món.

### 3.5. Theo dõi tiến trình

Frontend dùng Socket.IO namespace `/import`, nhận:

- `job:{jobId}`: cập nhật riêng cho một job.
- `job:progress`: broadcast tiến trình.

Payload gồm trạng thái, bước hiện tại, phần trăm, message, `resultDishId` và lỗi nếu có.

---

## 4. Luồng B — Nhập nhiều món từ CSV/XLSX

### 4.1. Mục đích

Luồng này phù hợp khi BA/content team có danh sách món hàng loạt và muốn kiểm tra dữ liệu trước khi tạo bản nháp.

File XLSX được đọc ở frontend và chuyển thành dữ liệu CSV/text trước khi gửi backend.

### 4.2. Các bước nghiệp vụ

1. Tải template CSV.
2. Chọn file CSV/XLSX.
3. Tạo import session.
4. Xem header và một số dòng mẫu.
5. Map cột file vào trường hệ thống.
6. Validate toàn bộ dòng.
7. Sửa các dòng lỗi trực tiếp nếu cần.
8. Revalidate dòng đã sửa.
9. Chọn chính sách import.
10. Bắt đầu job.
11. Theo dõi tiến độ và xem kết quả từng dòng.
12. Tải report CSV.

### 4.3. API File Import

| Method | Endpoint | Mục đích |
|---|---|---|
| `GET` | `/admin/dish-imports/template` | Tải template |
| `POST` | `/admin/dish-imports/sessions` | Tạo session từ CSV |
| `GET` | `/admin/dish-imports/sessions/:id` | Khôi phục session |
| `PUT` | `/admin/dish-imports/sessions/:id/mapping` | Lưu mapping |
| `POST` | `/admin/dish-imports/sessions/:id/validate` | Validate toàn bộ |
| `PATCH` | `/admin/dish-imports/sessions/:id/rows/:rowNumber` | Sửa dữ liệu một dòng |
| `POST` | `/admin/dish-imports/sessions/:id/rows/:rowNumber/revalidate` | Kiểm tra lại một dòng |
| `PUT` | `/admin/dish-imports/sessions/:id/options` | Lưu chính sách |
| `POST` | `/admin/dish-imports/sessions/:id/start` | Bắt đầu import |
| `GET` | `/admin/dish-imports/jobs/:jobId` | Xem trạng thái job |
| `GET` | `/admin/dish-imports/jobs/:jobId/rows` | Xem kết quả từng dòng |
| `POST` | `/admin/dish-imports/jobs/:jobId/cancel` | Hủy job |
| `GET` | `/admin/dish-imports/jobs/:jobId/report` | Tải báo cáo CSV |

Tất cả endpoint yêu cầu JWT và role `CONTENT_ADMIN` hoặc `SUPER_ADMIN`.

### 4.4. Giới hạn file hiện tại

- File rỗng bị từ chối.
- Tối đa **10.000 dòng**.
- Cột `name` là bắt buộc phải được map.
- Một trường đích không được map trùng nhiều lần.
- Dấu phân cách nhiều giá trị mặc định là `;`.

### 4.5. Chính sách import

| Chính sách | Ý nghĩa |
|---|---|
| `SKIP` | Bỏ qua món trùng |
| `CREATE_NEW` | Tạo món mới |
| `UPDATE_DRAFT_ONLY` | Chỉ cập nhật món đang là bản nháp |
| `DOWNLOAD_TO_R2` | Có ý định tải ảnh về storage |
| `URL_ONLY` | Chỉ lưu URL ảnh |
| `CREATE_SUGGESTION` | Tạo gợi ý khi chưa có nguyên liệu |
| `SKIP` cho nguyên liệu | Bỏ qua nguyên liệu không tìm thấy |
| `PARTIAL_SUCCESS` | Dòng lỗi không chặn dòng hợp lệ |
| `ROLLBACK_ALL` | Dự kiến rollback toàn bộ khi có lỗi |

Output status hiện được cố định là `DRAFT`.

---

## 5. Kiểm tra dữ liệu và xử lý trùng

### Các kết quả validate

- `VALID`: dòng đủ điều kiện import.
- `WARNING`: có thể import nhưng cần người kiểm tra.
- `ERROR`: không đủ điều kiện import.
- `DUPLICATE`: phát hiện món có khả năng trùng.

Summary trả về:

```json
{
  "total": 100,
  "valid": 85,
  "warning": 8,
  "error": 5,
  "duplicate": 2,
  "eligibleRows": 93
}
```

### Các kiểm tra chính

- Tên món có tồn tại hay không.
- Đối chiếu slug/tên món đã có.
- Kiểm tra vùng miền, danh mục, bữa ăn và mục tiêu.
- Kiểm tra định dạng số lượng, thời gian và dinh dưỡng.
- Đối chiếu nguyên liệu với kho hiện tại.
- Cho phép sửa và kiểm tra lại từng dòng.

---

## 6. Kết quả sau khi import

Một món được tạo sẽ có thể bao gồm:

- Bản ghi `Dish`.
- Quan hệ danh mục, bữa ăn, chế độ ăn, mục tiêu.
- `DishIngredient`.
- `DishNutrition`.
- `RecipeStep`.
- `DishSource` nếu có nguồn.
- `DishMedia` nếu có ảnh.

Sau khi import, admin cần:

1. Mở món từ preview hoặc danh sách Kho món ăn.
2. Kiểm tra các trường trong wizard 6 bước.
3. Bổ sung dữ liệu còn thiếu.
4. Kiểm tra dinh dưỡng và hình ảnh.
5. Chọn **Kiểm tra hồ sơ**.
6. Chọn **Gửi kiểm duyệt** khi đạt yêu cầu.

---

## 7. Phân quyền và an toàn dữ liệu

- Chỉ `CONTENT_ADMIN` và `SUPER_ADMIN` được gọi các endpoint file import.
- AI Import cũng là chức năng dành cho admin.
- Món mới không được publish tự động.
- Cần kiểm tra lại nội dung AI trước khi gửi kiểm duyệt.
- WebSocket AI hiện chưa xác thực JWT ở tầng socket; đây là rủi ro cần xử lý trước production.

---

## 8. Hiện trạng kỹ thuật

### Đã có

- Giao diện nhập AI và theo dõi 6 bước.
- Preview kết quả AI.
- Gọi AI qua xKiro/OpenAI-compatible API.
- Tìm ảnh qua Wikipedia và Unsplash fallback.
- Tạo/cập nhật nguyên liệu, dinh dưỡng, recipe steps và media.
- Giao diện upload CSV/XLSX.
- Auto-map header và map thủ công.
- Validate toàn bộ và revalidate từng dòng.
- Sửa dòng trước khi import.
- Chính sách duplicate và failure mode.
- Theo dõi job, hủy job và tải report.
- Session file import có lưu vào các bảng `dish_file_import_sessions`, `dish_file_import_rows` khi database sẵn sàng.

### Chưa hoàn thiện / cần BA xác nhận

1. **AI job store còn in-memory**: restart backend có thể làm mất danh sách job AI đang giữ trong bộ nhớ.
2. **AI pipeline chưa phải worker queue bền vững**: đang chạy bất đồng bộ trong process backend.
3. **WebSocket AI chưa xác thực**: cần gắn user/role và chỉ cho phép nghe job được phép xem.
4. **Kết quả AI chưa phải dữ liệu đã kiểm chứng**: nutrition và recipe cần human review.
5. **Unsplash phụ thuộc rate limit và API key**.
6. **Fallback khi AI trả JSON sai format chỉ ở mức xử lý lỗi/fallback**, chưa có cơ chế retry có kiểm soát.
7. **Xử lý ảnh `DOWNLOAD_TO_R2` cần xác nhận lại mức độ hoàn thiện end-to-end**.
8. **Rollback toàn bộ cần test kỹ với transaction/job nhiều dòng**.
9. **Cần bổ sung test tích hợp với DB thật**, đặc biệt các bảng schema BA-004/BA-007.
10. **Cần thống nhất một nguồn sự thật cho lịch sử job** giữa AI Import và File Import.

---

## 9. Tiêu chí nghiệm thu đề xuất cho BA

### AI Import

- [ ] Nhập tên món hợp lệ tạo được job.
- [ ] Job hiển thị đủ 6 bước và trạng thái cuối.
- [ ] Job thành công tạo đúng một món `DRAFT`.
- [ ] Món có nguyên liệu, recipe, nutrition và media theo dữ liệu thực tế nhận được.
- [ ] Job lỗi hiển thị message có thể xử lý.
- [ ] Admin mở được món bằng `resultDishId`.
- [ ] Job lỗi hoặc bị hủy có thể điền lại thông tin để tạo job mới.
- [ ] Không có món nào tự động chuyển `PUBLISHED`.

### File Import

- [ ] Tải được template.
- [ ] Từ chối file rỗng và file vượt quá 10.000 dòng.
- [ ] Map thiếu `name` phải báo lỗi.
- [ ] Validate phân biệt được valid/warning/error/duplicate.
- [ ] Sửa một dòng và revalidate cho kết quả mới.
- [ ] Chính sách duplicate hoạt động đúng.
- [ ] Có thể theo dõi tiến độ, hủy job và tải report.
- [ ] Các dòng hợp lệ tạo món `DRAFT`.
- [ ] Dòng lỗi có message và không làm mất thông tin các dòng khác khi chọn partial success.

### Kiểm duyệt sau import

- [ ] Mở món import từ preview.
- [ ] Tất cả dữ liệu hiển thị đúng trên các bước tương ứng.
- [ ] Validation checklist phản ánh đúng dữ liệu.
- [ ] Chỉ món đạt điều kiện mới được gửi kiểm duyệt.
- [ ] Món chuyển đúng trạng thái `PENDING_REVIEW`.

---

## 10. Kết luận để báo cáo BA

Chức năng tự động nhập món đã triển khai được luồng chính từ **nhập dữ liệu → xử lý → tạo bản nháp → xem/chỉnh sửa → gửi kiểm duyệt**. Hai hình thức AI và file hàng loạt đã có API và giao diện riêng.

Tuy nhiên, trạng thái hiện tại phù hợp nhất với **UAT/internal demo**, chưa nên xác nhận production-ready cho đến khi hoàn thiện:

- lưu trữ job bền vững;
- worker queue và retry;
- xác thực WebSocket;
- kiểm thử transaction/rollback;
- kiểm soát chất lượng dữ liệu AI;
- kiểm thử đầy đủ với database migration thực tế.

