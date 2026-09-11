# Kế hoạch triển khai: Ảnh món từ web search (có license)

**Dự án:** Mogu  
**Mục tiêu:** Xóa tạo ảnh món bằng AI (Gemini / Pollinations) và thay bằng tìm ảnh thật từ nguồn có giấy phép rõ ràng, tải về Supabase, tạo `DishMedia` với `moderationStatus=PENDING`.  
**Phạm vi không làm:** scrape Google/Bing Images hoặc website công thức bất kỳ; không đổi luồng ảnh nguyên liệu.

---

## 1. Bối cảnh và vấn đề

Pipeline import hiện (hoặc trước đây) tạo ảnh bìa món bằng image generation. Cách này:

- Không có nguồn/license rõ ràng để attribution.
- Phụ thuộc quota/model image API.
- Không phù hợp chính sách “ảnh chờ duyệt” với provenance đầy đủ.

Thay bằng **web image search** trên API chính thức (Wikimedia Commons, sau đó Openverse, …).

---

## 2. Mục tiêu sản phẩm

1. Món nháp vẫn tạo được khi **không tìm thấy ảnh**.
2. Ảnh tự động gắn chỉ khi đủ tin cậy (ngưỡng rank) và đủ provenance.
3. Admin review thấy **tác giả / license / source**, chọn candidate khác, hoặc **tìm lại ảnh** không chạy lại công thức.
4. Không cho Admin dán URL tùy ý làm ảnh chính từ luồng search.

---

## 3. Nguyên tắc cứng

- Không request tới `image.pollinations.ai` hoặc Gemini image generation cho ảnh món.
- Không scrape Google Images / Bing Images / HTML website công thức.
- Mọi URL download qua SSRF protection, giới hạn dung lượng, MIME + magic bytes.
- Ảnh mới luôn `PENDING`; không auto-publish.
- Candidate dưới ngưỡng tin cậy **không** gắn làm ảnh chính.

---

## 4. Nguồn ảnh (ưu tiên)

| Thứ tự | Provider | Ghi chú |
|--------|----------|---------|
| 1 (MVP) | Wikimedia Commons | MediaWiki Action API + `extmetadata` |
| 2 | Openverse | API có license filter |
| 3 (tuỳ chọn) | Pexels | Chỉ khi tỷ lệ tìm thấy còn thấp và attribution đủ |
| Không dùng | Unsplash (khi bắt buộc host trên Supabase theo ToS) | Đánh giá lại ở Giai đoạn 5 |
| Cấm | Google/Bing scrape, website recipe scrape | |

---

## 5. Luồng tổng thể

```text
Recipe normalized
  → QueryBuilder (+ vi-dish-aliases)
  → Providers (Commons → Openverse…)
  → Normalize candidates
  → LicensePolicy (allowlist)
  → Ranker (ngưỡng auto ≥ 80)
  → SafeDownloader → Supabase
  → DishMedia PENDING + provenance
  → Audit imageSearch trên import job
```

Score 60–79: không gắn primary; warning cần review thủ công.  
Score &lt; 60 hoặc không candidate: warning `DISH_IMAGE_NOT_FOUND`; vẫn tạo draft.  
Provider lỗi: warning `DISH_IMAGE_SOURCE_UNAVAILABLE`; không FAIL cả job.

---

## 6. Mô hình dữ liệu candidate

Mỗi candidate tối thiểu:

- `provider`, `providerAssetId`
- `title`, `sourcePageUrl` (trang File / work, không chỉ CDN)
- `downloadUrl` (sau khi qua policy)
- `thumbUrl` (tuỳ chọn)
- `author` / `authorUrl` (nếu nguồn có)
- `licenseCode`, `licenseUrl`
- `width`, `height`, `mime`
- `score` + breakdown (debug/audit)

---

## 7. Cấu trúc code đề xuất

`backend/src/ai-import/dish-image-search/`:

- `dish-image-search.types.ts`
- `providers/dish-image-provider.ts`
- `providers/wikimedia-commons.provider.ts`
- `providers/openverse.provider.ts` (Giai đoạn 4)
- `dish-image-query-builder.service.ts`
- `image-search-profiles/vi-dish-aliases.json`
- `dish-image-license-policy.service.ts`
- `dish-image-candidate-ranker.service.ts`
- `dish-image-download.service.ts`
- `dish-image-search.service.ts`

Tích hợp trong `import-jobs.service.ts` bước ENRICHING (song song nutrition nếu được).

---

## 8. Ranking

### 8.1. Trọng số (một config object)

Gợi ý trọng số (điều chỉnh theo benchmark):

- Khớp tên món / alias (cao)
- Khớp vùng / từ khóa địa phương
- Độ phân giải / tỉ lệ khung phù hợp cover
- License ưu tiên (CC0/PD &gt; CC BY &gt; CC BY-SA)
- Phạt title/mô tả lệch món, stock generic, watermark rõ

**Ngưỡng gắn ảnh chính tự động: score ≥ 80.**

---

## 9. License policy

Allowlist tối thiểu: CC0, Public Domain, CC BY, CC BY-SA (phiên bản rõ ràng).

Reject: thiếu license/source, NC/ND nếu product không chấp nhận, fair use không rõ, metadata trống.

---

## 10. Downloader an toàn

- Chỉ HTTPS; deny private/link-local/metadata IPs
- Giới hạn redirect; re-check host mỗi hop
- Max bytes; validate `Content-Type` + magic bytes
- Normalize (ví dụ sharp → WebP, max cạnh hợp lý)
- SHA-256; path storage kiểu `dishes/web-import/{jobId}/{checksumPrefix}.webp`

---

## 11. Lưu DishMedia

- `moderationStatus = PENDING`
- `sourceUrl` = trang nguồn (Commons File page / Openverse work)
- `credit` / author string hiển thị
- Thêm field provenance (Giai đoạn 3): `provider`, `providerAssetId`, `licenseCode`, `licenseUrl`, `attributionText`, `searchQuery`, `rankScore`, `checksum`, …

---

## 12. Admin — yêu cầu UX review ảnh

Khi Admin xem / chỉnh ảnh món từ luồng search:

- Hiển thị đúng **tác giả / license / source**.
- Có thể **chọn candidate khác**.
- Có thể **chạy lại tìm ảnh** mà **không tạo lại món** (không chạy lại công thức / nutrition).
- **Không thể** chọn URL do người dùng tự chèn trong luồng này.
- Ảnh mới vẫn ở trạng thái **chờ duyệt** (`PENDING`).

---

## 13. API Admin (Giai đoạn 3)

Gợi ý:

- `GET/POST …/dishes/:id/image-candidates` — list / refresh search
- `POST …/dishes/:id/search-image` — tìm lại ảnh (không re-import recipe)
- `POST …/dishes/:id/select-image` — chọn candidate đã có trong kết quả search (không nhận arbitrary URL)

Mọi select đều tạo/cập nhật media `PENDING` + provenance.

---

## 14. Cảnh báo / mã lỗi

| Code | Ý nghĩa |
|------|---------|
| `DISH_IMAGE_NOT_FOUND` | Không candidate đạt |
| `DISH_IMAGE_MANUAL_REVIEW_REQUIRED` | Có candidate nhưng dưới ngưỡng auto |
| `DISH_IMAGE_SOURCE_UNAVAILABLE` | Provider lỗi / timeout |
| `DISH_IMAGE_LICENSE_REJECTED` | Lọc license |

---

## 15. Config / env

- User-Agent bắt buộc cho Commons
- Timeout, concurrency, circuit breaker (Giai đoạn 4)
- Openverse API key nếu cần
- Không còn `GEMINI_IMAGE_*` / Pollinations fallback cho ảnh món

---

## 16. Không đụng

- Ảnh nguyên liệu (Unsplash / upload riêng)
- Công thức, parser nguyên liệu, nutrition (trừ chỗ wire ENRICHING)

---

## 17. Audit `imageSearch`

Ghi trên import job / draft metadata:

- queries đã chạy
- provider responses (số hit, lỗi)
- top candidates (id, score, license, source)
- candidate đã chọn (nếu có)
- download result / checksum
- warnings

---

## 18. Rủi ro

- Commons/Openverse thiếu ảnh món Việt → cần aliases + Openverse + benchmark
- Metadata license thiếu → reject đúng, tăng tỷ lệ MISSING
- SSRF nếu bỏ sót redirect check

---

## 19. Kiểm thử (tóm tắt)

- Không còn path Gemini/Pollinations cho ảnh món
- License accept/reject
- Ranker + ngưỡng 80
- Downloader SSRF / MIME / size
- Draft OK khi thiếu ảnh
- Admin: không nhận arbitrary URL; select candidate → PENDING

---

## 20. Bộ benchmark

Chuẩn bị ít nhất 30 món Việt Nam, gồm món phổ biến và món địa phương:

- Cá bống kho tộ Quảng Ngãi.
- Bột chiên trứng.
- Bún bò Huế.
- Bún riêu.
- Cao lầu.
- Mì Quảng.
- Bánh canh.
- Bánh cuốn.
- Cơm tấm.
- Thịt kho tàu.

*(Bổ sung đủ ≥ 30 món khi chạy benchmark Giai đoạn 4.)*

Với mỗi món, ghi:

- Query đã dùng.
- Provider trả kết quả.
- Candidate được chọn.
- Điểm tự động.
- Người kiểm duyệt đánh giá đúng/sai món.
- License có đầy đủ hay không.
- Thời gian và số request.

---

## 21. Tiêu chí nghiệm thu

- Không còn file hoặc runtime path tạo ảnh món bằng Gemini/Pollinations.
- Không có request tới `image.pollinations.ai` hoặc API image generation.
- 100% ảnh tự động lưu có source page, provider, author nếu nguồn cung cấp, license code và license URL.
- 0 ảnh lấy bằng scrape Google/Bing hoặc website bất kỳ.
- 100% ảnh được tải qua downloader có SSRF protection, giới hạn dung lượng và kiểm tra MIME.
- 100% ảnh mới được lưu ở `moderationStatus=PENDING`.
- Không tìm thấy ảnh vẫn tạo được món nháp và có warning rõ ràng.
- Admin có thể tìm lại và chọn ảnh khác mà không chạy lại công thức.
- Ít nhất 85% ảnh tự động chọn trong benchmark được người kiểm duyệt xác nhận đúng món.
- 100% ảnh dưới ngưỡng tin cậy không được tự động gắn làm ảnh chính.
- Backend build và toàn bộ test `ai-import`/`dishes` liên quan chạy thành công.

---

## 22. Thứ tự triển khai cho Cursor

### Giai đoạn 1 — Test bảo vệ và loại bỏ image generation

1. Viết test chứng minh không có request tạo ảnh Gemini/Pollinations.
2. Tách phần ảnh món khỏi `GeminiDishImageService` và import pipeline.
3. Gỡ các provider/config/error code tạo ảnh không còn dùng.
4. Giữ pipeline tạo món nháp hoạt động khi chưa có ảnh.

Hoàn thành khi build/test chạy và món có thể được nhập mà không gọi image generation.

### Giai đoạn 2 — Wikimedia Commons MVP

1. Tạo types, provider interface và Wikimedia provider.
2. Tạo query builder, license policy và ranker.
3. Tạo downloader an toàn và upload Supabase.
4. Tích hợp vào import pipeline.
5. Lưu `DishMedia PENDING` và provenance.

Hoàn thành khi một ảnh Commons hợp lệ có thể đi từ search đến DB bằng integration test.

### Giai đoạn 3 — DB provenance và admin review

1. Thêm migration provenance cho `DishMedia`.
2. Thêm API candidates/search/select.
3. Hiển thị source, author, license và candidate picker.
4. Thêm thao tác tìm lại ảnh riêng.

Hoàn thành khi admin có thể kiểm tra và thay candidate trước khi duyệt.

**Yêu cầu Admin bắt buộc trong giai đoạn này:**

- Hiển thị đúng tác giả/license/source.
- Có thể chọn candidate khác.
- Có thể chạy lại tìm ảnh mà không tạo lại món.
- Không thể chọn URL do người dùng tự chèn.
- Ảnh mới vẫn ở trạng thái chờ duyệt.

### Giai đoạn 4 — Openverse và độ ổn định

1. Thêm Openverse provider.
2. Thêm cache, retry, concurrency limit và circuit breaker.
3. Thêm dedupe theo asset ID/checksum.
4. Chạy benchmark 30 món và điều chỉnh query/ranking.

Hoàn thành khi đạt tiêu chí nghiệm thu ở mục 21.

### Giai đoạn 5 — Nguồn bổ sung, nếu cần

1. Đánh giá tỷ lệ tìm thấy ảnh sau Wikimedia + Openverse.
2. Chỉ thêm Pexels nếu tỷ lệ còn thấp và attribution đã hoàn chỉnh.
3. Không thêm Unsplash khi hệ thống vẫn yêu cầu tải ảnh về Supabase.
4. Chỉ bật AI vision để kiểm tra ảnh nếu sản phẩm đồng ý rõ ràng.

---

## 23. Prompt giao trực tiếp cho Cursor

```text
Đọc và triển khai theo:
docs/DISH_IMAGE_WEB_SEARCH_IMPLEMENTATION_PLAN.md

Mục tiêu là xóa chức năng tạo ảnh món ăn bằng AI và thay bằng tìm ảnh thật
từ nguồn có giấy phép rõ ràng, sau đó tải về Supabase và tạo DishMedia PENDING.

Bắt đầu Giai đoạn 1 rồi Giai đoạn 2. Không scrape Google Images, Bing Images
hoặc website công thức. Không dùng Pollinations, Gemini image generation hoặc
một fallback tạo ảnh khác. Không thay đổi luồng tìm ảnh nguyên liệu.

Ưu tiên Wikimedia Commons trong MVP. Mọi ảnh phải có source page, provider,
license và attribution trước khi download. URL download phải qua kiểm tra SSRF,
redirect, MIME, magic bytes, kích thước và dung lượng.

Worktree hiện có nhiều thay đổi khác. Chỉ sửa file liên quan và không ghi đè
thay đổi của người dùng. Dùng migration mới, không sửa migration đã tồn tại.

Sau mỗi giai đoạn hãy báo cáo:
- file đã thay đổi;
- hành vi trước và sau;
- migration/config đã thêm hoặc xóa;
- test đã chạy và kết quả;
- rủi ro hoặc công việc còn lại.
```
