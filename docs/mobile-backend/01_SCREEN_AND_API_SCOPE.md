# Phạm vi chức năng theo giao diện mobile

Quy ước trạng thái:

- **Giữ**: API đã có và có thể tiếp tục dùng sau khi bổ sung contract test.
- **Sửa**: API đã có nhưng hợp đồng hoặc logic chưa đủ.
- **Mới**: cần xây endpoint/model mới.
- **Thiết bị**: xử lý trên mobile/OS; BE chỉ lưu tùy chọn hoặc đồng bộ khi cần.

## 1. Đăng nhập, đăng ký và onboarding

### Login

Dữ liệu cần: username/email, password, device ID ngẫu nhiên của app, platform, app version. Kết quả phải có access token ngắn hạn, rotating refresh token, user và `nextStep`.

- **Giữ** `POST /v1/auth/login`, `POST /v1/auth/refresh`, `GET /v1/auth/me`.
- **Sửa** refresh theo single-flight ở mobile và rotation/reuse detection ở BE.
- **Mới** luồng quên mật khẩu tự phục vụ gồm request và confirm token/OTP. Luồng hiện tại chỉ yêu cầu liên hệ admin, không khớp kỳ vọng app tiêu dùng.
- **Mới** `POST /v1/auth/oauth/exchange` nếu giữ nút Google/Apple. Nếu chưa triển khai thì ẩn nút, không để nút giả.
- **Mới** endpoint quản lý thiết bị/session cho màn Privacy.

### Register

Dữ liệu cần: email/username theo quyết định sản phẩm, password, chấp nhận điều khoản và phiên bản chính sách. Email phải được chuẩn hóa; thông báo lỗi không được tiết lộ quá mức tài khoản tồn tại ở các luồng recovery.

- **Giữ** `POST /v1/auth/register`.
- **Sửa** lưu consent append-only và thống nhất `nextStep`; type mobile hiện chấp nhận cả `home` và `HOME` là dấu hiệu contract chưa ổn định.
- **Mới** verify email/OTP nếu sản phẩm thật sự yêu cầu `verify_otp`; hiện chưa thấy endpoint verify tương ứng.

### Onboarding

Các bước UI thu thập tên, ngày sinh, giới tính, chiều cao, cân nặng, mục tiêu, khẩu vị, chế độ ăn và dị ứng/hạn chế.

- **Giữ** `GET /v1/onboarding`, `POST /start`, `PATCH /steps/:step`, `POST /steps/:step/skip`, `GET /summary`, `POST /complete`.
- **Sửa** không hard-code catalog trong mobile; dùng code từ `GET /v1/catalogs/onboarding`.
- **Sửa** tách `allergenIds`, `avoidedIngredientIds/freeText` và `dietTypes`. Giao diện hiện trộn “hải sản”, “thịt bò”, “gluten”, “ăn chay” vào các nhóm chưa nhất quán.
- **Sửa** validate ngày sinh thật (kể cả ngày nhuận), chiều cao/cân nặng hợp lý và phạm vi đối tượng. Không tự tạo calorie target cho người dưới 18 tuổi, thai kỳ/cho con bú hoặc trường hợp cần chăm sóc chuyên môn.

## 2. Home

### Header, greeting, thời tiết và thông báo

- **Giữ** `GET /v1/home` làm BFF, `GET /v1/weather`, `GET /v1/notifications/unread-count`.
- **Sửa** Home BFF nhận `localDate`, `timezone`, tọa độ tùy chọn; mỗi widget có `status`, `updatedAt` và không làm hỏng toàn response khi một provider lỗi.
- **Thiết bị** xin quyền vị trí. Chỉ gọi weather khi được phép; fallback là bỏ widget hoặc dùng vị trí người dùng đã chọn, không đoán vị trí từ IP như dữ liệu chính xác.

### Gợi ý nhanh và món đã lưu

- **Giữ** `GET /v1/recommendations/home`, `GET/POST/DELETE /v1/me/saved-dishes`.
- **Sửa** loại bỏ cặp legacy `/dishes/:id/save` để chỉ còn một contract save duy nhất.
- **Sửa** recommendation trả `reasonCodes` dựa trên điều kiện thật, `allergenAssessment`, price range có confidence và nutrition basis.

### Tóm tắt kế hoạch tuần và dinh dưỡng

- **Sửa** Home phải lấy kế hoạch hiện hành từ weekly domain và tiến độ từ slot, không dùng số mẫu.
- **Sửa** dự báo chi phí: `actualCompleted + expectedPending`, không dùng `max(actual, projected)`.
- **Sửa** `GET /v1/nutrition/today` thành summary đầy đủ calories, protein, carbs, fat, water, số bữa và coverage; số thiếu là `null`, không phải `0`.

## 3. Explore

### Feed, tab món, bài viết, cộng đồng và tìm kiếm

- **Giữ** `GET /v1/explore/feed`, `GET /v1/topics`, `GET /v1/articles`, `GET /v1/dishes`, `GET /v1/community/posts`.
- **Sửa** dùng một cursor chuẩn `(createdAt,id)` hoặc `(rank,id)`; response luôn có `items` và `pageInfo` thống nhất.
- **Sửa mobile bắt buộc** mọi card phải truyền đúng `dishId`, `articleId`, `postId` vào detail. Hiện detail chỉ nhận loại nội dung nên dễ mở dữ liệu mẫu/sai object.
- **Mới** `GET /v1/search/suggest` nếu cần autocomplete; search chính có thể tiếp tục dùng từng resource endpoint.
- **Mới** `POST /v1/analytics/events:batch` cho impression/open/search có sampling và consent; không chặn UI nếu analytics lỗi.

### Chi tiết món

- **Giữ** `GET /v1/dishes/:idOrSlug`, `/variants`, review và saved dish.
- **Sửa** detail trả rõ các phần: media, category/meal types, price estimate, nutrition profiles, ingredients, allergens, recipe, provenance, review summary, viewer state.
- **Sửa** không lấy phần tử đầu tiên của mảng nutrition một cách ngầm định; client yêu cầu `basis=PER_SERVING` và serving cụ thể hoặc BE trả `defaultNutrition`.
- **Mới** `GET /v1/dishes/:id/similar` cho các món liên quan.

### Chi tiết bài viết

- **Giữ** `GET /v1/articles/:id`.
- **Mới** save/unsave bài viết nếu icon lưu vẫn xuất hiện.
- **Mới** increment view bằng event bất đồng bộ/idempotent; không tăng view chỉ do prefetch.

### Community post detail

- **Mới** `GET /v1/community/posts/:id`.
- **Sửa** like thành `PUT /likes/me` và `DELETE /likes/me`, không dùng toggle.
- **Mới** reply comment với `parentCommentId`, phân trang comments, like comment, follow/unfollow tác giả và save post nếu UI giữ các nút này.
- **Mới** upload ảnh bằng presigned URL, finalize media và moderation status.

## 4. Random món

### Context và bộ lọc

- **Giữ** `GET /v1/randomization-context` nhưng response phải chứa default resolved từ profile, catalog code hợp lệ và hard constraints.
- **Sửa** request phải phản ánh toàn bộ UI: meal slot, budget mode/limit, goals, diets, excluded dishes, prep time, weather, distance/open-now khi có location intent.
- **Sửa mobile bắt buộc** retry giữ nguyên filter snapshot; hiện có nhánh gọi lại random không truyền đủ tham số.

### Kết quả, random lại và chọn món

- **Giữ** create/retry/select/history.
- **Sửa** một lần chọn chỉ sinh một selection event; không để mobile vừa gửi event vừa gọi select tạo bản ghi trùng.
- **Sửa** response `NO_CANDIDATE` không được thay bằng món mẫu. Trả lý do có cấu trúc và suggestion để người dùng tự nới soft filter.
- **Sửa** `matchScore` chuẩn hóa trên tổng trọng số đang hoạt động; `reasonCodes` chỉ mô tả điều kiện món thật sự thỏa.
- **Sửa** AI không nằm trên critical path chọn món và không được khẳng định an toàn dị ứng.

## 5. Weekly Plan và Edit Plan

### Cấu hình

- **Giữ** `GET/PUT /v1/weekly-plan-config`.
- **Sửa** `enabledSlots` là nguồn sự thật; bỏ `mealsPerDay` hoặc chỉ trả derived read-only.
- **Sửa** budget phải có `currency=VND`, duration chỉ thuộc `[3,5,7,14]`, slot unique, calorie mode rõ PROFILE/CUSTOM.
- **Sửa** hard constraints lấy từ profile nhưng được đóng băng vào config snapshot khi generate.

### Sinh và xem kế hoạch

- **Giữ** `POST /v1/weekly-plans/generate`, current/list/detail.
- **Sửa** generate có idempotency, transaction/outbox và trả job status. Mobile poll theo `planId`, dùng exponential backoff hoặc nhận push; không đợi cố định 3 giây rồi chỉ gọi current.
- **Sửa** get current không được che plan FAILED; trả trạng thái mới nhất có thể hành động và lỗi an toàn cho người dùng.
- **Sửa** một plan không được ACTIVE nếu còn slot vi phạm hard constraint hay budget cứng.

### Swap, lock, complete, skip, regenerate, archive

- **Giữ** endpoint hiện có nhưng **sửa** optimistic update thành điều kiện nguyên tử theo `version`.
- **Sửa** mọi action xác thực ownership, trạng thái plan cha và trạng thái slot.
- **Sửa** swap cập nhật plan totals + plan version trong cùng transaction và trả plan summary mới.
- **Sửa** complete slot có thể tạo meal log liên kết theo lựa chọn người dùng; phải idempotent để không ghi bữa hai lần.
- **Sửa** edit/regenerate giữ locked slots thật sự, chỉ tối ưu phần còn lại và không archive plan cũ trước khi plan mới READY.
- **Mới** `GET /v1/weekly-plans/:id/generation` hoặc job endpoint chung để xem progress có cấu trúc.

## 6. Health

Toàn bộ nhóm này hiện chưa đủ backend và là P0 nếu muốn bỏ dữ liệu mẫu.

### Dashboard ngày và overview

- **Mới** `GET /v1/health/days/:localDate` làm BFF cho total/target/remaining, macro, meal groups, water, steps, tip và data coverage.
- **Mới** `GET /v1/health/calendar?month=YYYY-MM` trả ngày có log, mức completion và streak hint.
- **Sửa** burned calories không được hard-code. Chỉ trả khi có nguồn activity đáng tin; nếu không là `null`.
- **Sửa** tip phải từ rule có mã và dữ liệu đủ coverage; không nói “thiếu 32g protein” khi input chỉ là ước lượng thiếu.

### Nhật ký bữa ăn

- **Mới** `GET/POST /v1/meal-logs`, `GET/PATCH/DELETE /v1/meal-logs/:id`.
- **Mới** mỗi log gồm slot, thời điểm, timezone, items, quantity, unit, gram equivalent, snapshot nutrition và source (`DISH`, `INGREDIENT`, `CUSTOM`, `RANDOM`, `WEEKLY_PLAN`, `CAMERA`).
- **Mới** custom food CRUD cho riêng người dùng; không tự đưa custom food vào catalog công khai.
- **Mới** endpoint tìm food/dish chung cho màn thêm bữa.
- **Sửa** save phải dùng chính items người dùng chọn; màn hiện tại cộng một con số cố định là không hợp lệ.

### Nước uống

- **Mới** `POST /v1/water-logs` với amount ml và occurredAt; `DELETE /v1/water-logs/:id`; tổng hợp nằm trong health day.
- **Sửa** nút `+250 ml` tạo entry thật, idempotent theo key; timezone dựa vào ngày đang xem.

### Bước chân và dữ liệu thiết bị

- **Thiết bị** xin quyền Health Connect/HealthKit và đọc dữ liệu trên thiết bị.
- **Mới** `POST /v1/activity-sync` nhận các bucket đã aggregate, provider record identifiers/hash và khoảng thời gian; upsert/dedupe, không cộng mù nhiều nguồn.
- **Mới** trạng thái kết nối/sync trong `GET /v1/integrations/health` và revoke server metadata.

### Camera nhận diện món

- **Mới** presign upload, tạo recognition job, xem job và xác nhận candidate.
- **Sửa** response luôn có top candidates + confidence + flags; confidence thấp yêu cầu tìm/chọn thủ công.
- **Sửa** ảnh và kết quả AI có retention ngắn; chỉ tạo meal log sau khi người dùng xác nhận món và khẩu phần.

## 7. Profile

### Profile main và edit

- **Giữ** `GET /v1/profile/me`, `PATCH /basic`, `/health`, `/preferences`.
- **Mới** avatar presign/finalize cho user media.
- **Sửa** username uniqueness, region ID, bio và avatar có validation/moderation.
- **Sửa** profile response không trả field nhạy cảm không cần cho màn hiện tại.

### Journey, streak, badge và hoạt động tháng

- **Mới** `GET /v1/me/journey?month=YYYY-MM`.
- **Mới** rule/badge catalog và user achievements. Backend tính từ sự kiện nghiệp vụ, không tin count do client gửi.
- **Sửa** streak tính theo local date/timezone và có định nghĩa “ngày hợp lệ” rõ trong tài liệu thuật toán.

### Health profile và targets

- **Mới** `GET/PUT /v1/me/health-targets`, lịch sử measurement.
- **Sửa** BMI tính từ measurement mới nhất nhưng phải ghi “chỉ số sàng lọc”, không dùng cho trẻ em như ngưỡng người lớn.
- **Sửa** calorie/macro/water target trả `method`, `inputsUsed`, `calculatedAt`, `requiresProfessionalReview`.

### Preferences và avoid list

- **Sửa** preference strength, diet hard/soft và allergen severity là các khái niệm riêng.
- **Sửa** avoid ingredient dùng ingredient ID khi match được; free text chỉ là trường hợp tạm và cần normalized text.
- **Sửa** thay đổi dị ứng có hiệu lực ngay đối với random/swap/generate; plan cũ cần được đánh dấu `safetyStatus=RECHECK_REQUIRED`.

### Saved, history, diary và posts

- **Giữ/Sửa** saved dishes và random history theo cursor chuẩn.
- **Mới** filter history theo outcome/date và xóa history theo job/action audit.
- **Mới** `GET /v1/me/posts?status=...`; draft/published/saved phải tách rõ.
- **Sửa** Diary dùng chính meal-log domain, không tạo hệ thống log thứ hai.

### Settings và Privacy

- **Mới** `GET/PATCH /v1/me/settings` cho server-backed preferences: language, theme, notification channels, privacy flags.
- **Thiết bị** âm thanh, rung, biometric lock và OS permissions được xử lý tại app/OS; BE chỉ lưu lựa chọn sync nếu sản phẩm cần đa thiết bị.
- **Mới** list/revoke sessions; đổi mật khẩu; export data job; xóa tài khoản với re-auth và grace period; clear random history; clear health data.
- **Sửa** không hứa “bảo mật tuyệt đối”. UI phải liên kết chính sách, mục đích xử lý, thời gian lưu và kênh hỗ trợ.

## 8. Food Detail Flow

### Nutrition, recipe, serving và reviews

- **Giữ/Sửa** Dish detail là nguồn chung. Serving selector phải nhân từ basis đã biết, không nhân mù toàn recipe.
- **Sửa** ingredient có lượng + đơn vị chuẩn hóa + gram equivalent; allergen assessment và nutrition coverage tách riêng.
- **Giữ** review list/create/delete mine; bổ sung summary distribution nếu UI hiển thị.

### Xác nhận ăn ngay/ăn sau

- **Mới** “ăn ngay” tạo meal log hoặc hoàn tất weekly slot theo explicit source link.
- **Mới** “ăn sau” tạo reminder resource có timezone; push notification chỉ được gửi khi user opt-in.

### Cooking mode

- **Thiết bị** countdown timer và trạng thái check bước có thể local-first.
- **Mới, tùy chọn** cooking session/checkpoint nếu cần tiếp tục trên nhiều thiết bị. Không cần BE cho timer đang chạy nếu sản phẩm không yêu cầu sync.

### Địa điểm gần đây

- **Mới** `GET /v1/places/nearby` qua provider adapter, chỉ bật khi có quyền vị trí và hợp đồng provider.
- **Sửa** phải trả provider attribution, place ID, khoảng cách, open status và thời điểm dữ liệu; không được suy ra nhà hàng chắc chắn có món chỉ từ tên/place category.
- **Thiết bị** mở chỉ đường bằng URL scheme/maps app.

## 9. Notification screen

- **Giữ** list, unread count, mark read.
- **Mới** mark all read, delete/archive nếu UI hỗ trợ; register/unregister push token theo installation.
- **Sửa** deep link phải dùng allowlist route + validated resource ID.
- **Sửa** BE lưu push ticket/receipt, dừng gửi vào token `DeviceNotRegistered`.

## 10. Chức năng không cần backend riêng

- Haptic/rung tại thao tác UI.
- Animation, selected tab, expanded card và trạng thái modal tạm thời.
- Countdown timer khi nấu nếu không yêu cầu đa thiết bị.
- Mở camera/location/notification permission của OS.
- Mở ứng dụng bản đồ để chỉ đường.
- Draft form chưa submit có thể local; nếu cần cross-device draft thì mới thêm draft endpoint.

