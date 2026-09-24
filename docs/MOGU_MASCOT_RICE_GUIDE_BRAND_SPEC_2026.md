# Mogu Mascot 2026 — Golden Rice Guide

## Ý tưởng

Tên làm việc: **Mogu Mầm**.

Linh vật mới là một hạt gạo vàng được nhân cách hóa, có thân hình giọt nước và ba mầm lúa trên đầu. Hình dáng gợi liên tưởng trực tiếp tới bữa ăn Việt Nam nhưng vẫn đủ trung tính để đại diện cho món ăn, sức khỏe, khám phá và lập kế hoạch.

Khác biệt với phiên bản cũ:

- bỏ thân tròn có lông;
- bỏ kính râm, tai nghe và hoodie;
- tạo silhouette hạt gạo dễ nhận biết khi thu nhỏ;
- dùng tạp dề và chiếc bát làm dấu hiệu liên quan đến ăn uống;
- giảm phụ kiện để nhân vật dễ animate và tái sử dụng.

## Tài sản

- [Character sheet](./assets/mogu-mascot-rice-guide-character-sheet-v1.png)
- [Mascot nền trong suốt](./assets/mogu-mascot-rice-guide-transparent-v1.png)
- [Minh họa onboarding](./assets/mogu-mascot-rice-guide-onboarding-v1.png)

File mascot transparent là PNG 1024×1536, định dạng 32-bit ARGB và có alpha thực.

## Dấu hiệu nhận diện bắt buộc

- Thân hạt gạo/giọt nước, đáy tròn và đỉnh hơi nhọn.
- Ba mầm lúa màu vàng mọc từ đỉnh đầu.
- Màu thân chủ đạo `#FFC928`.
- Đôi mắt oval đen lớn với một hoặc hai highlight nhỏ.
- Má cam san hô, chỉ dùng làm accent.
- Tạp dề đen có túi hình chiếc bát.
- Tỷ lệ đầu/thân lớn, tay chân ngắn và chắc.
- Viền gần đen, đồng nhất và đủ dày khi thu nhỏ.

Không được thay mầm lúa bằng tai động vật, sừng hoặc tóc người. Không thêm lại kính râm, tai nghe hoặc hoodie.

## Bảng màu

- Vàng chính: `#FFC928`
- Vàng bóng: `#E5A900`
- Highlight kem: `#FFF3B8`
- Viền và tạp dề: `#151515`
- Má san hô: `#FF6B4A`
- Nền sáng đề xuất: `#FFF9EA`

Các màu xanh/đỏ của thức ăn chỉ xuất hiện trong đạo cụ và không trở thành màu nhận diện chính của nhân vật.

## Tính cách

- Hiếu kỳ về món ăn.
- Tích cực nhưng không quá trẻ con.
- Đáng tin như một người hướng dẫn.
- Khuyến khích thay vì phán xét lựa chọn ăn uống.
- Biểu cảm rõ, phản hồi nhanh và thân thiện.

## Bộ pose cần sản xuất tiếp

### Điều hướng và onboarding

- Chào mừng/vẫy tay.
- Giới thiệu món bằng cách mở nắp cloche.
- Cầm bát món ăn.
- Chỉ dẫn sang trái/phải.

### Random món

- Tung xúc xắc hoặc xoay bánh xe món ăn.
- Hồi hộp chờ kết quả.
- Ăn mừng khi đã chọn món.
- Xin thử lại khi không có kết quả.

### Kế hoạch tuần

- Cầm lịch.
- Cầm ví/ngân sách.
- Đánh dấu hoàn thành.
- Suy nghĩ khi thiếu món phù hợp.

### Sức khỏe và nhật ký

- Cầm trái tim hoặc biểu đồ.
- Ghi chép vào sổ.
- Uống nước.
- Nhắc nhẹ khi người dùng quên ghi bữa.

## Quy tắc sử dụng trong app

- Onboarding hero: chiều cao khoảng 35–45% viewport.
- Home banner: chỉ dùng từ ngực trở lên hoặc pose đơn giản; không đặt quá ba đạo cụ.
- Empty state: 120–180px, ít chi tiết và biểu cảm rõ.
- Toast/success: dùng head icon hoặc pose check nhỏ.
- App icon: dùng phần đầu và ba mầm lúa, không dùng bát/tạp dề đầy đủ.
- Luôn giữ clear space tối thiểu bằng chiều rộng một mắt quanh nhân vật.
- Không kéo giãn, đổi tỷ lệ mắt hoặc crop mất mầm lúa.
- Không đặt trực tiếp trên nền vàng cùng sắc độ nếu không có viền hoặc surface tách lớp.

## Khả năng animation

Cấu trúc nên được tách layer khi dựng bản vector/Lottie:

- thân;
- mầm lúa trái/giữa/phải;
- mắt trái/phải;
- miệng và má;
- tay trái/phải;
- chân trái/phải;
- tạp dề;
- túi hình bát;
- đạo cụ riêng.

Micro-animation đề xuất:

- idle: thân nảy 2–3%, mầm lúa rung nhẹ;
- blink: 2 lần trong 4–6 giây;
- success: nhảy một nhịp, mầm lúa bung nhẹ;
- loading: khuấy bát hoặc xoay thìa;
- error: nghiêng đầu, hạ thìa, sau đó chỉ vào CTA khắc phục.

Hỗ trợ reduced-motion bằng pose tĩnh tương ứng.

## Prompt gốc

Tài sản được tạo bằng ImageGen tích hợp. Prompt định nghĩa một linh vật hạt gạo vàng hình giọt nước, ba mầm lúa, mắt oval, má san hô và tạp dề đen có túi hình bát; đồng thời cấm các yếu tố của mascot cũ như kính, tai nghe, hoodie và thân lông tròn.
