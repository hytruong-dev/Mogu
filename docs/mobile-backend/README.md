# Đặc tả backend cho toàn bộ giao diện mobile Mogu

Phiên bản tài liệu: 1.0  
Ngày đối chiếu mã nguồn và giao diện: 2026-09-11  
Phạm vi mã nguồn: `mobile/App.tsx`, `mobile/src/screens`, `mobile/src/services/api`, `backend/src`, `backend/prisma/schema.prisma`.

## 1. Mục tiêu

Bộ tài liệu này là hợp đồng triển khai giữa mobile, backend, data và QA. Nó trả lời bốn câu hỏi:

1. Mỗi màn hình mobile cần dữ liệu và hành động nào.
2. API nào đã có, API nào cần sửa và API nào phải xây mới.
3. Dữ liệu phải lưu theo đơn vị, nguồn gốc và mức tin cậy nào.
4. Thuật toán random món, lập thực đơn tuần, dinh dưỡng và ngân sách phải tính như thế nào.

Đây không phải tài liệu tư vấn y khoa. Các giá trị năng lượng, BMI, mục tiêu dinh dưỡng và gợi ý món chỉ phục vụ cá nhân hóa. Người dùng có thai/cho con bú, dưới 18 tuổi, có bệnh nền hoặc nhu cầu điều trị phải được hướng sang chuyên gia phù hợp; hệ thống không tự đặt mục tiêu giảm cân điều trị.

## 2. Tài liệu trong bộ đặc tả

- [01_SCREEN_AND_API_SCOPE.md](./01_SCREEN_AND_API_SCOPE.md): ma trận chức năng theo toàn bộ màn hình mobile, hiện trạng và phần BE phải cung cấp.
- [02_API_CONTRACTS.md](./02_API_CONTRACTS.md): quy ước API và hợp đồng endpoint chi tiết.
- [03_DATA_MODEL.md](./03_DATA_MODEL.md): mô hình dữ liệu đích, provenance, index, quyền riêng tư và vòng đời dữ liệu.
- [04_ALGORITHMS_AND_SOURCES.md](./04_ALGORITHMS_AND_SOURCES.md): công thức, thuật toán, tầng nới lỏng và nguồn dữ liệu chính thức.
- [05_DELIVERY_AND_ACCEPTANCE.md](./05_DELIVERY_AND_ACCEPTANCE.md): lộ trình triển khai, kiểm thử, SLO và tiêu chí nghiệm thu.

Tài liệu review chuyên sâu logic random/kế hoạch tuần hiện có nằm tại [PROJECT_REVIEW_RANDOM_MEAL_WEEKLY_BUDGET.md](../PROJECT_REVIEW_RANDOM_MEAL_WEEKLY_BUDGET.md). Khi có khác biệt, bộ đặc tả này là trạng thái đích; review cũ là bằng chứng về lỗi và nợ kỹ thuật của implementation hiện tại.

## 3. Kết luận nhanh sau khi đối chiếu

### 3.1 Phần đã có nền backend

- Đăng ký, đăng nhập, refresh token, lấy tài khoản hiện tại và đăng xuất.
- Onboarding có session, bước lưu/skip, version và complete.
- Hồ sơ cơ bản, sức khỏe cơ bản và sở thích có optimistic version.
- Danh mục món, chi tiết món, taxonomy, đánh giá và món đã lưu.
- Home BFF, gợi ý trang chủ, thông báo và thời tiết.
- Explore feed, chủ đề, bài viết và cộng đồng ở mức cơ bản.
- Random món và lịch sử random.
- Cấu hình, tạo, xem và thao tác kế hoạch ăn theo tuần.

### 3.2 Phần chưa đủ để giao diện hoạt động thật

- Health đang thiếu nhật ký bữa ăn có item/khẩu phần, sửa/xóa, tổng hợp theo ngày, nước uống, bước chân và lịch sử cân nặng.
- Profile đang dùng nhiều số liệu mẫu: streak, huy hiệu, hoạt động tháng, thống kê bài viết, thiết bị đăng nhập, quyền riêng tư, export/xóa dữ liệu.
- Cài đặt thông báo, ngôn ngữ, giao diện, âm thanh và rung chưa có nguồn dữ liệu thống nhất.
- Social login trên giao diện chưa có luồng backend hoàn chỉnh.
- Community thiếu endpoint chi tiết post, lưu post, theo dõi tác giả, reply và hành vi like/unlike tách biệt.
- Explore mở chi tiết theo loại nhưng chưa truyền đúng `dishId`, `articleId`, `postId`; BE không thể khắc phục lỗi điều hướng này một mình.
- Food detail/cooking/location phần lớn dùng mẫu; thiếu dữ liệu recipe hoàn chỉnh, cooking session tùy chọn và tích hợp địa điểm có attribution.
- Camera nhận diện món cần pipeline upload → job → candidates → người dùng xác nhận; kết quả AI tuyệt đối không được tự ghi thẳng vào nhật ký.
- Random và weekly hiện có lỗ hổng hard constraint, tính macro sai tên cột, nới lỏng không an toàn, dự báo chi phí sai và thiếu tính nguyên tử/idempotency.

### 3.3 Quyết định kiến trúc

- Giữ REST dưới `/v1`; sinh OpenAPI từ DTO và chặn merge nếu contract test thất bại.
- Dùng BFF cho Home và Health Overview, nhưng action vẫn là resource endpoint riêng.
- PostgreSQL là nguồn sự thật; Redis chỉ cache/queue. Không coi dữ liệu cache là dữ liệu nghiệp vụ.
- Hard allergy, hard diet và món tránh là ràng buộc không bao giờ được nới lỏng tự động.
- Mọi giá trị dinh dưỡng và giá tiền phải kèm basis, nguồn, thời điểm và mức tin cậy.
- Random và lập kế hoạch phải chạy trên dữ liệu đã duyệt; AI chỉ hỗ trợ nhập liệu/giải thích, không tự khẳng định an toàn dị ứng.
- Client gửi `localDate` và `timezone` IANA; server lưu thời gian UTC và tính biên ngày theo timezone của người dùng.

## 4. Phạm vi màn hình thực tế

Entry point thực tế là `mobile/App.tsx`. Navigation trong `mobile/src/navigation/index.tsx` là nhánh cũ và không được dùng làm nguồn tạo yêu cầu.

Các nhóm màn hình đang hoạt động gồm:

- Auth: Login, Register.
- Onboarding: Splash/Welcome, hồ sơ, cơ thể, mục tiêu, sở thích, hoàn tất.
- Main tabs: Home, Explore V2, Random, Health, Profile.
- Root detail: Notification, Food Detail Flow, Weekly Plan, Edit Plan.
- Detail lồng: tổng quan món, dinh dưỡng, công thức, cộng đồng, xác nhận bữa, địa điểm, kết quả random và chế độ nấu.
- Health detail: overview, danh sách bữa, ghi bữa, chi tiết món.
- Profile detail: settings, edit, journey, health profile, preferences, avoid list, saved dishes, privacy, random history, posts, diary.

`OpenAppScreen.tsx`, `ExploreScreen.tsx` và navigation cũ được coi là legacy. Không xây API riêng chỉ để phục vụ các màn này cho tới khi sản phẩm xác nhận đưa chúng trở lại.

## 5. Nguyên tắc không được vi phạm

1. Không hiển thị dữ liệu mẫu như dữ liệu thật. API thiếu dữ liệu trả `dataStatus: "no_data"`, không tự điền con số đẹp.
2. Không suy luận “an toàn dị ứng” từ tên món. Chỉ được kết luận khi thành phần và mapping allergen đã được duyệt; nếu không thì trả `allergenAssessment: "unknown"`.
3. Không dùng giá tối thiểu để cam kết món nằm trong ngân sách. Phải có `expected`, `low`, `high`, `observedAt` và `confidence`.
4. Không dùng UUID theo phép so sánh `<` làm cursor thời gian. Cursor là base64url của `(createdAt,id)` và query theo cặp này.
5. Không dùng client-provided user ID để phân quyền. Chủ sở hữu lấy từ access token, kiểm tra lại trên mọi object.
6. Không dùng toggle cho API cần retry. Like/save/lock dùng `PUT` để đạt trạng thái mong muốn, `DELETE` để bỏ.
7. POST tạo dữ liệu/khởi chạy job nhận `Idempotency-Key`; cùng key + cùng body trả cùng kết quả, khác body trả `409 IDEMPOTENCY_KEY_REUSED`.
8. Không sửa object theo version chỉ kiểm tra trước rồi update. Update phải có điều kiện `WHERE id=? AND version=?` trong transaction.
9. Mọi snapshot trong random/weekly/meal log là bất biến để lịch sử không đổi khi món hoặc hồ sơ bị sửa.
10. Log không chứa access token, refresh token, mật khẩu, ảnh sức khỏe, ngày sinh đầy đủ hoặc nội dung export.

