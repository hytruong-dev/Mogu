# Mogu Mobile — Profile UX Redesign 2026

## 1. Mục tiêu

Thiết kế lại màn **Cá nhân** theo hướng gọn, dễ quét và giúp người dùng nhanh chóng thực hiện ba nhóm việc:

1. Nhận biết hồ sơ và số liệu cá nhân.
2. Tiếp tục các hoạt động thường dùng: món đã lưu, Random, nhật ký và bài viết.
3. Kiểm tra hoặc cập nhật dữ liệu sức khỏe, cá nhân hóa và tài khoản.

Hai ảnh dưới đây là **hai trạng thái cuộn của cùng một màn**, không phải hai phương án khác nhau.

- Trạng thái đầu trang: [mogu-profile-overview-v2.png](./assets/mogu-profile-overview-v2.png)
- Trạng thái khi cuộn xuống: [mogu-profile-settings-v2.png](./assets/mogu-profile-settings-v2.png)

## 2. Thay đổi chính

- Bỏ card hồ sơ lớn chứa quá nhiều thành phần lồng nhau.
- Avatar, tên, username, mục tiêu và nút chỉnh sửa được đưa thành cụm nhận diện rõ ràng.
- Chỉ giữ ba số liệu quan trọng trên một hàng: bài viết, món đã lưu và người theo dõi.
- Gộp streak, số bữa, món mới và lịch tuần vào một card **Hành trình tuần này**.
- Các chức năng thường dùng nằm trong lưới **Lối tắt** 2 cột.
- Các cài đặt dùng list row nhất quán; giá trị hiện tại hiển thị ngay bên phải.
- Tách rõ **Sức khỏe & cá nhân hóa** và **Tài khoản**.
- Nút **Đăng xuất** là text action ít nổi bật, tránh bấm nhầm.
- Loại bỏ floating gear/debug overlay khỏi bản production.

## 3. Cấu trúc màn hình

### 3.1 Header

- Tiêu đề: `Cá nhân`.
- Nút chuông: mở danh sách thông báo.
- Nút bánh răng: mở cài đặt tài khoản và ứng dụng.
- Khi cuộn sâu, header có thể sticky; không cần giữ toàn bộ thống kê.

### 3.2 Hồ sơ

Hiển thị:

- Avatar.
- Tên hiển thị và username.
- Chip mục tiêu hiện tại, ví dụ `Mục tiêu · Khám phá`.
- Nút `Chỉnh sửa`.
- Ba metric có thể bấm: `Bài viết`, `Món đã lưu`, `Người theo dõi`.

Tương tác:

- `Chỉnh sửa` → màn chỉnh sửa avatar, tên, username, tiểu sử.
- `Bài viết` → danh sách bài viết của tôi.
- `Món đã lưu` → bộ sưu tập món đã lưu.
- `Người theo dõi` → danh sách người theo dõi; với `0`, vẫn mở empty state có giải thích.

### 3.3 Hành trình tuần này

- `Xem chi tiết` → trang thống kê hành trình.
- Ngày có ghi bữa: vòng tròn vàng và dấu check.
- Hôm nay: viền vàng có chấm giữa nếu chưa hoàn thành.
- Ngày không có dữ liệu: viền xám/vàng nhạt.
- Bấm một ngày → mở nhật ký bữa ăn của ngày đó.

### 3.4 Lối tắt

| Mục | Dữ liệu phụ | Điều hướng |
| --- | --- | --- |
| Món đã lưu | Số món | Saved dishes |
| Lịch sử Random | Số lần | Random history |
| Nhật ký bữa ăn | Kỳ hiện tại | Meal journal |
| Bài viết của tôi | Số bài | My posts |

Mỗi tile là một touch target duy nhất; không đặt button con bên trong tile.

### 3.5 Sức khỏe & cá nhân hóa

- `Thông tin sức khỏe`: hiển thị `Đã cập nhật` hoặc `Chưa hoàn tất`.
- `Mục tiêu & sở thích`: hiển thị mục tiêu hiện tại.
- `Nguyên liệu cần tránh`: hiển thị `Chưa thiết lập` hoặc số nguyên liệu.

### 3.6 Tài khoản

- Quyền riêng tư.
- Thông báo, kèm trạng thái `Đang bật` / `Đang tắt`.
- Trợ giúp & phản hồi.
- Về Mogu, kèm phiên bản ứng dụng.
- Đăng xuất: mở confirm dialog trước khi xóa session.

## 4. Trạng thái cần thiết

### Loading

- Skeleton cho avatar, tên, ba metric và card hành trình.
- Các shortcut có thể render sau bằng skeleton tile; không dùng spinner toàn màn hình.

### Empty và thiếu dữ liệu

- Chưa có avatar: dùng avatar chữ cái hoặc minh họa mặc định.
- Chưa có hành trình: `Bắt đầu ghi bữa đầu tiên` và CTA mở nhật ký.
- Chưa có món đã lưu/bài viết: giữ metric `0`, trang đích dùng empty state.
- Thiếu thông tin sức khỏe: label `Chưa hoàn tất`, không hiển thị lỗi đỏ.

### Error

- Nếu summary lỗi nhưng profile tải được, vẫn hiển thị hồ sơ và retry riêng cho card summary.
- Nếu toàn bộ profile lỗi, hiển thị inline error với `Thử lại`; bottom navigation vẫn hoạt động.

## 5. Quy tắc UI cho FE

- Khoảng cách ngang màn: `16px`.
- Khoảng cách giữa section: `24px`.
- Chiều cao list row: tối thiểu `56px`.
- Touch target: tối thiểu `44x44px`.
- Card radius: `16–20px`; không lồng card có shadow trong card khác.
- Chỉ dùng vàng cho active, CTA hoặc thông tin cần nhấn mạnh.
- Text phụ tối thiểu đạt độ tương phản WCAG AA.
- Dynamic Type: row tăng chiều cao khi chữ lớn; không truncate tên menu.
- Bottom navigation cố định và tôn trọng safe area.

## 6. Dữ liệu/API tối thiểu

### Profile overview

```json
{
  "id": "user_id",
  "displayName": "quanghy",
  "username": "quanghy12",
  "avatarUrl": "https://...",
  "currentGoal": {
    "code": "EXPLORE",
    "label": "Khám phá"
  },
  "stats": {
    "postCount": 2,
    "savedDishCount": 2,
    "followerCount": 0
  }
}
```

### Weekly journey summary

```json
{
  "streakDays": 1,
  "mealCount": 21,
  "newDishCount": 17,
  "days": [
    { "date": "2026-09-21", "mealCount": 0, "isToday": false },
    { "date": "2026-09-23", "mealCount": 5, "isToday": true }
  ]
}
```

### Settings summary

```json
{
  "healthProfileCompleted": true,
  "goalLabel": "Khám phá",
  "avoidedIngredientCount": 0,
  "notificationsEnabled": true,
  "appVersion": "1.0.0"
}
```

BE có thể trả về trong một endpoint dashboard hoặc ba endpoint độc lập. Nếu tách endpoint, FE phải render từng section độc lập để một request lỗi không chặn toàn màn hình.

## 7. Event tracking đề xuất

- `profile_viewed`
- `profile_edit_tapped`
- `profile_stat_tapped` với `type`
- `journey_detail_tapped`
- `journey_day_tapped` với `date`
- `profile_shortcut_tapped` với `destination`
- `profile_setting_tapped` với `setting`
- `logout_requested`, `logout_confirmed`, `logout_cancelled`

## 8. Prompt tạo mockup

Mockup được tạo bằng công cụ ImageGen tích hợp, sử dụng ảnh hiện trạng do người dùng cung cấp làm tham chiếu sản phẩm. Prompt yêu cầu hai trạng thái cuộn nhất quán, nền ivory, màu vàng Mogu, typography rõ, bỏ card lồng nhau, không có debug overlay và giữ bottom navigation hiện tại.
