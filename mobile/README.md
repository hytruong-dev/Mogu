# Name
### mogu-mobile

# Synopsis


# Description

# Example

# Install:
`npm install mogu-mobile`

# Development build — Cook with NOAN

Nhận diện giọng nói dùng module native `expo-speech-recognition`, không có trong Expo Go.

- `npm install`
- Android: cài JDK/Android SDK, mở thiết bị hoặc emulator rồi chạy `npm run android:dev`. Lệnh sẽ prebuild và cài development build; không cần chạy prebuild `--clean`.
- iOS: trên macOS có Xcode, chạy `npm run ios:dev`.
- Sau khi đã cài build: `npm run start:dev`.
- Sau mỗi thay đổi plugin/quyền/module native, phải build lại. Fast Refresh không thêm module native được.

Vào màn **Đang nấu**, chọn **Nấu cùng NOAN** để đồng ý bật micro. Micro chỉ hoạt động trong phiên này; rời màn hoặc đưa app ra nền sẽ dừng thu âm. Expo Go vẫn dùng được thao tác vật lý, nhưng không nghe giọng nói.

Android 13+ cần speech service hỗ trợ tiếng Việt và model `vi-VN` tải trên thiết bị. Nếu thiếu model, dùng nút tải trong màn giọng nói rồi thử lại. Android 12 trở xuống dùng nút micro theo lượt; không hứa hẹn nghe liên tục. Emulator có thể thiếu speech service/model hoặc nhận micro máy tính kém; cần kiểm tra trên máy thật.

Lưu ý cấu hình: không đặt `microphonePermission: false` cho `expo-image-picker` hoặc `expo-audio` trong app này. Plugin có thể gỡ `RECORD_AUDIO` khỏi manifest cuối cùng, kể cả khi `android.permissions` và plugin speech đã khai báo.

Giọng NOAN ưu tiên cloud TTS. Khi không có mạng, app dùng audio đã cache, rồi fallback `expo-speech` tiếng Việt trên thiết bị nếu có. UI báo rõ khi dùng giọng thiết bị; chất lượng phụ thuộc voice đã cài. Thao tác vật lý và transcript luôn dùng được. Backend cần cấu hình Azure Speech hoặc một endpoint OpenAI hỗ trợ API speech thực sự (endpoint tương thích chat chưa chắc hỗ trợ audio).

Hồ sơ giọng “NOAN vào bếp”, cách cấu hình và lưu ý về giọng riêng có đồng ý của người lồng tiếng: xem `../docs/NOAN_COOKING_VOICE.md`.

# Test:
`npm run typecheck`

Parser và timer: `npx tsx --test src/screens/food-detail/voice/cooking-intents.test.ts src/screens/food-detail/cooking-timers.test.ts`.

Kiểm thử nghiệm thu cần máy thật đã đăng nhập và key cloud hợp lệ:

- Trước opt-in không có chỉ báo micro; từ chối quyền vẫn điều khiển nấu được.
- NOAN chào, chờ “bắt đầu”; nghe chỉ kết quả cuối, yêu cầu tiền tố NOAN ngoài cửa sổ trả lời.
- “Nguyên liệu”, “bước tiếp”, “đọc lại”, “hẹn giờ năm phút”, “còn bao lâu”; xác nhận có/không cho bỏ bước và hoàn tất.
- Chạm Dừng trong khi NOAN nói; không tự nghe chính giọng phát ra.
- Ra nền hoặc khóa màn hình: dừng micro/audio; thời gian timer tính theo deadline, không tự thu âm khi trở lại.
- Mất mạng sau khi tải script: thử audio đã cache, fallback giọng thiết bị tiếng Việt nếu có và lệnh local; câu hỏi tự do báo lỗi rõ ràng.
- Model vi-VN thiếu: tải rồi thử lại; máy Android 12 dùng nút micro theo lượt nếu service hỗ trợ on-device.
- Xác nhận ghi bữa ăn, thử gửi lại sau lỗi mạng: không tạo bản ghi trùng.
- Trong Azure/OpenAI dashboard, kiểm tra số ký tự/request thực tế và xác nhận cache script tránh tổng hợp lại. Không coi đơn giá trong plan là báo giá hiện hành.

Không thể dùng kết quả build hoặc test mock thay cho thử nghiệm STT tiếng Việt/micro trong bếp trên máy thật.

#License:
