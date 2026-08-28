# Cơ chế AI tự động nhập món — Hiện trạng triển khai

**Dự án:** Mogu  
**Ngày cập nhật:** 28/08/2026  
**Phạm vi:** AI Import tại trang Admin `/ingest`  
**Mục đích:** Mô tả chính xác cách hệ thống hiện tại tạo dữ liệu món ăn bằng AI.

---

## 1. Tóm tắt

Chức năng **Nhập món bằng AI** cho phép quản trị viên nhập tên món, sau đó hệ thống:

1. Gọi AI để sinh công thức và dữ liệu món.
2. Chuẩn hóa đơn vị và tên nguyên liệu.
3. Đối chiếu/tạo nguyên liệu trong kho dữ liệu.
4. Gọi AI để ước tính dinh dưỡng.
5. Tìm ảnh minh họa.
6. Lưu món thành bản nháp (`DRAFT`) để admin kiểm tra.

Món tạo ra **không được tự động xuất bản**. Admin cần mở món, kiểm tra/chỉnh sửa, kiểm tra hồ sơ rồi gửi kiểm duyệt.

> Dữ liệu công thức và dinh dưỡng hiện là dữ liệu do AI tạo/ước tính. Chúng không được xem là dữ liệu đã được kiểm chứng.

---

## 2. Đầu vào

### API tạo job

```http
POST /v1/admin/import-jobs
Authorization: Bearer <admin_jwt>
```

### Request

```json
{
  "query": "Phở bò Hà Nội",
  "relatedKeywords": ["phở tái", "nước dùng xương"],
  "regionHint": "north",
  "sourceTypes": ["AI_GENERATED"]
}
```

| Trường | Bắt buộc | Ý nghĩa hiện tại |
|---|---:|---|
| `query` | Có | Tên món cần tạo; 2–150 ký tự |
| `relatedKeywords` | Không | Từ khóa bổ sung được đưa vào prompt AI |
| `regionHint` | Không | Gợi ý `north`, `central`, `south`; được đưa vào prompt AI |
| `sourceTypes` | Không | Được lưu/log cùng job; chưa quyết định nguồn thu thập thực tế |

### Lưu ý về `sourceTypes`

Các lựa chọn Website, Video hoặc Nutrition trên giao diện **chưa kích hoạt crawler/trình trích xuất dữ liệu thực**. Ở phiên bản hiện tại, dữ liệu món vẫn được model AI sinh từ tên món và context được nhập.

---

## 3. Cấu hình AI

Backend sử dụng SDK tương thích OpenAI:

| Biến môi trường | Giá trị mặc định | Vai trò |
|---|---|---|
| `XKIRO_BASE_URL` | `https://api.xkiro.com/v1` | AI gateway |
| `XKIRO_API_KEY` | Không có mặc định | API key gọi gateway |
| `XKIRO_MODEL` | `deepseek/deepseek-chat-v3.1` | Model sinh dữ liệu |

Model được gọi với:

| Tác vụ | Temperature | Max tokens |
|---|---:|---:|
| Sinh công thức | `0.2` | `3000` |
| Ước tính dinh dưỡng | `0.2` | `300` |

Temperature thấp được dùng để giảm độ ngẫu nhiên của JSON và dữ liệu trả về.

---

## 4. Pipeline xử lý

```text
Admin nhập tên món
        │
        ▼
SEARCHING
        │ Phân tích yêu cầu, nhận vùng miền/từ khóa
        ▼
EXTRACTING
        │ Gọi AI sinh công thức, nguyên liệu, thời gian, giá
        ▼
NORMALIZING
        │ Chuẩn hóa tên và đơn vị nguyên liệu
        ▼
RECONCILING
        │ Kiểm tra món trùng; đối chiếu/tạo nguyên liệu
        ▼
ENRICHING
        │ AI ước tính dinh dưỡng; tìm ảnh minh họa
        ▼
DRAFTING
        │ Ghi dữ liệu xuống DB với trạng thái DRAFT
        ▼
DONE / FAILED / CANCELLED
```

Tiến trình được phát qua Socket.IO namespace `/import`. Frontend nhận `job:{jobId}` và `job:progress` để hiển thị 6 bước.

---

## 5. Chi tiết từng bước

### 5.1. `SEARCHING` — Phân tích yêu cầu

Hệ thống:

- Kiểm tra job còn đang chạy.
- Lấy `query`, `relatedKeywords`, `regionHint`.
- Đổi code vùng miền sang tên hiển thị để đưa vào prompt.
- Ghi log xác nhận tên món.

Đây chưa phải bước tìm kiếm website hay API nguồn bên ngoài.

### 5.2. `EXTRACTING` — Sinh công thức bằng AI

AI nhận prompt tiếng Việt, yêu cầu trả **JSON thuần**, không có Markdown.

AI được yêu cầu tạo:

- Tên món đầy đủ và mô tả ngắn.
- Độ khó, thời gian chuẩn bị/nấu.
- Khoảng giá VND, khẩu phần, cỡ khẩu phần.
- Danh sách nguyên liệu.
- Số lượng, đơn vị, cách sơ chế và nhóm nguyên liệu.
- Các bước nấu, thời lượng và mẹo.
- Tags/mẹo tổng quát.

Ví dụ output mong đợi:

```json
{
  "name": "Phở bò Hà Nội",
  "shortDescription": "Món phở truyền thống với nước dùng xương thơm.",
  "difficulty": "MEDIUM",
  "prepMinutes": 45,
  "cookMinutes": 120,
  "priceMin": 50000,
  "priceMax": 90000,
  "servings": 4,
  "servingSize": "1 tô (500g)",
  "ingredients": [
    {
      "name": "xương bò",
      "quantity": 1000,
      "unit": "g",
      "preparation": "chặt khúc, chần sơ",
      "group": "Nguyên liệu chính"
    }
  ],
  "steps": [
    {
      "stepNumber": 1,
      "title": "Sơ chế xương",
      "description": "Chần xương trong nước sôi để loại bỏ tạp chất.",
      "durationMinutes": 15,
      "tips": "Chần kỹ để nước dùng trong."
    }
  ]
}
```

Nếu model trả JSON không hợp lệ, service dùng parser/fallback hiện có để tránh làm pipeline crash; chất lượng dữ liệu fallback không được đảm bảo tương đương dữ liệu AI chuẩn.

### 5.3. `NORMALIZING` — Chuẩn hóa dữ liệu

Một số đơn vị dân gian được quy đổi:

| Đơn vị nhận từ AI | Giá trị chuẩn |
|---|---|
| `chén`, `ly` | `ml`, nhân 240 |
| `muỗng canh`, `tbsp` | `ml`, nhân 15 |
| `muỗng cà phê`, `tsp` | `ml`, nhân 5 |

Ví dụ:

```text
2 chén nước dùng → 480 ml nước dùng
1 muỗng canh nước mắm → 15 ml nước mắm
```

Tên nguyên liệu cũng được làm sạch trước khi đối chiếu:

```text
Rau thơm (húng lủi, ngò gai) → Rau thơm
Dầu ăn (để phi hành) → Dầu ăn
```

### 5.4. `RECONCILING` — Đối chiếu món và nguyên liệu

#### Kiểm tra món trùng

Hệ thống tạo slug từ tên món và tìm `Dish` còn hiệu lực có slug trùng:

- Không có slug trùng: dùng slug chuẩn.
- Có slug trùng: thêm timestamp vào slug để tránh lỗi unique.

Đây chỉ là cơ chế tránh lỗi dữ liệu kỹ thuật, **chưa phải cơ chế phát hiện trùng món theo nghiệp vụ**.

#### Đối chiếu nguyên liệu

Đối với mỗi nguyên liệu do AI sinh:

1. Xóa mô tả trong ngoặc và phần thay thế kiểu “hoặc …”.
2. Bỏ dấu, chuyển lowercase và bỏ ký tự đặc biệt để tạo key so khớp.
3. So khớp chính xác với kho `Ingredient`.
4. Nếu không khớp, thử so khớp tiền tố.
5. Nếu vẫn không có, tạo `Ingredient` mới.

Việc tìm ảnh cho nguyên liệu mới chạy song song, tối đa 5 tác vụ và timeout khoảng 4 giây/tác vụ.

### 5.5. `ENRICHING` — Dinh dưỡng và ảnh

#### Dinh dưỡng

Backend gọi AI lần thứ hai, đưa danh sách nguyên liệu đã chuẩn hóa vào prompt, rồi nhận dữ liệu cho một khẩu phần:

```json
{
  "calories": 480,
  "proteinG": 28,
  "carbsG": 52,
  "fatG": 14,
  "fiberG": 4,
  "sodiumMg": 900,
  "servingName": "1 tô (500g)",
  "servingG": 500
}
```

> Các số liệu này là ước tính AI. Hiện hệ thống chưa đối chiếu tự động với USDA hoặc bảng thành phần dinh dưỡng được kiểm định.

#### Ảnh món

Hệ thống không tạo ảnh bằng generative AI. Ảnh được tìm theo thứ tự:

1. Wikipedia tiếng Việt.
2. Wikipedia tiếng Anh.
3. Unsplash, nếu cấu hình `UNSPLASH_ACCESS_KEY`.
4. Không có ảnh nếu cả ba nguồn không trả kết quả.

Món vẫn có thể được tạo nếu không tìm thấy ảnh.

### 5.6. `DRAFTING` — Lưu bản nháp

Khi các bước trước thành công, backend tạo món với trạng thái:

```text
DRAFT
```

Dữ liệu có thể được ghi gồm:

- `Dish`
- `DishIngredient`
- `DishNutrition`
- `RecipeStep`
- `DishMedia` khi tìm được ảnh
- Liên kết đến các `Ingredient`
- Slug, thời gian, giá, khẩu phần và độ khó

Sau khi ghi thành công, response/WebSocket trả `resultDishId`. Frontend dùng ID này để mở `/foods/:dishId`.

---

## 6. Lưu trữ job và theo dõi tiến trình

### Backend

Job AI hiện được lưu bằng `Map` trong bộ nhớ process backend:

- Giữ tối đa 100 job gần nhất.
- Mất toàn bộ lịch sử khi backend restart/deploy.
- Không có worker queue bền vững.

### Frontend

Frontend:

- Dùng một Socket.IO singleton cho toàn admin.
- Nghe sự kiện theo job và event broadcast.
- Có polling fallback 5 giây khi danh sách có job đang hoạt động.
- Có màn hình tiến trình 6 bước, kết quả draft và lịch sử job.

---

## 7. Trạng thái job

| Trạng thái kỹ thuật | Nhãn hiển thị |
|---|---|
| `PENDING` | Đang xử lý |
| `SEARCHING` | Phân tích |
| `EXTRACTING` | Tạo dữ liệu |
| `NORMALIZING` | Chuẩn hóa |
| `RECONCILING` | Đối chiếu |
| `ENRICHING` | Bổ sung |
| `DRAFTING` | Tạo bản nháp |
| `DONE` | Đã tạo bản nháp |
| `FAILED` | Thất bại |
| `CANCELLED` | Đã hủy |

---

## 8. Điểm cần lưu ý trước khi Production

| Hạng mục | Hiện trạng | Rủi ro / việc cần làm |
|---|---|---|
| Dữ liệu AI | AI tự sinh | Cần human review và quy tắc kiểm tra dữ liệu |
| Dinh dưỡng | AI ước tính | Cần nguồn nutrition chuẩn nếu dùng cho khuyến nghị sức khỏe |
| Website/Video/USDA | Chưa trích xuất thật | Cần crawler/integration riêng |
| Job storage | In-memory | Cần DB + BullMQ/worker bền vững |
| Retry | Chưa có retry có kiểm soát | Cần retry/backoff và phân loại lỗi |
| WebSocket auth | Chưa xác thực tại socket gateway | Cần JWT/room theo user hoặc role |
| Trùng món | Chủ yếu tránh slug trùng | Cần fuzzy match và luồng xác nhận admin |
| Ảnh | Wikipedia/Unsplash fallback | Cần kiểm tra license, attribution và rate limit |
| Hủy job | Cooperative cancellation | Cần bảo đảm transaction/cleanup với job dài |

---

## 9. Kết luận

AI Import hiện là luồng **AI-generated draft**:

```text
Tên món + context
→ AI sinh công thức
→ Chuẩn hóa
→ Đối chiếu nguyên liệu
→ AI ước tính dinh dưỡng
→ Tìm ảnh
→ Tạo DRAFT
→ Admin kiểm tra và gửi duyệt
```

Nó chưa phải là luồng thu thập dữ liệu có trích dẫn nguồn tự động từ Website/Video/USDA. Các lựa chọn nguồn trên UI hiện chỉ có ý nghĩa context/log cho job.

