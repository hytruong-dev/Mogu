# Giọng “NOAN vào bếp”

NOAN là người bạn đồng hành trong bếp: ấm áp, sáng sủa, vui nhẹ nhưng không nói như trẻ con. Chào và chúc mừng có năng lượng hơn; từng bước nấu, số lượng, nhiệt độ, thời gian và cảnh báo phải chậm, rõ, không pha trò. Xưng “mình”, gọi người dùng là “bạn”. Không thêm lời đệm vào số liệu của công thức.

Ví dụ mở đầu: “NOAN đây! Hôm nay mình cùng nấu món canh chua nhé. Mình sẽ đọc từng bước thật rõ. Sẵn sàng thì nói bắt đầu nha.”

Hồ sơ giọng nằm ở `backend/src/cooking-voice/noan-voice-profile.ts`. OpenAI `gpt-4o-mini-tts` nhận chỉ dẫn phát âm/nhịp; Azure Speech dùng SSML với cao độ nhẹ và khoảng nghỉ câu. Trả lời câu hỏi cũng dùng cùng tính cách nhưng vẫn tuân thủ công thức và các quy tắc an toàn. Cache âm thanh công thức được đổi phiên bản khi hồ sơ giọng thay đổi. Nếu TTS máy chủ không có, app thông báo rõ và dùng giọng tiếng Việt của thiết bị (nếu có); giọng này không thể giống hệt giọng NOAN.

Để phát giọng trên thiết bị thật, cấu hình một trong hai dịch vụ ở `backend/.env`: `AZURE_SPEECH_KEY` cùng `AZURE_SPEECH_REGION`, hoặc `COOKING_OPENAI_API_KEY`. Nếu cả hai có mặt, Azure được ưu tiên. `COOKING_OPENAI_VOICE_ID` (nếu có cùng khóa OpenAI) ưu tiên một giọng riêng đã được tạo hợp lệ và có đồng ý của người lồng tiếng. Không đặt khóa API trong app mobile. Hiện repo chưa có bản ghi âm đồng ý hoặc ID giọng riêng, nên cấu hình mặc định tạo *phong cách giọng NOAN* trên giọng nền của nhà cung cấp, chưa phải âm sắc độc quyền.

Kịch bản thử nghe nên gồm lời chào, một bước có nguyên liệu và định lượng, một bước có hẹn giờ, một câu hỏi về dị ứng và lời chúc mừng hoàn thành. Trước khi phát hành, nghe trên Android/iOS thật và kiểm tra phát âm tên món địa phương, số lượng, độ dài khoảng nghỉ và mức âm lượng so với tiếng bếp.

## Bản thiết kế Voice Design đang chờ tạo mẫu

Prompt đã chuẩn bị trong ElevenLabs Voice Design (chưa tạo audio):

> An original Vietnamese male voice for NOAN, a friendly golden buffalo who guides home cooking. Young adult, light warm tenor, a gentle smile in the voice, natural Southern Vietnamese accent with clear nationwide pronunciation. Cheerful and slightly playful in greetings, calm and exact when reading ingredients, quantities, heat and timers. Medium pace, rounded vowels, crisp consonants, short pauses between steps. Distinctive and memorable, never squeaky, childish, robotic or theatrical. Clean studio recording.

Đoạn đọc thử: “NOAN đây! Mình cùng nấu cơm tấm nhé. Bước một, ướp thịt trong mười phút. Xong thì nói bước tiếp nha.”

Đây là bản thiết kế âm sắc, **chưa phải file giọng đã tạo hoặc được thẩm âm**. Voice Design yêu cầu đoạn thử ít nhất 100 ký tự; trong giao diện hiện tại mức tạo tối thiểu là 100 credits. Sau khi tạo được mẫu, cần nghe kiểm tra phát âm tiếng Việt, chọn mẫu phù hợp rồi triển khai kết nối voice ID ElevenLabs vào luồng nấu ăn.
