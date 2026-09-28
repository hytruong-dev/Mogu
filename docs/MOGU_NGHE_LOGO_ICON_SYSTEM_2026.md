# Mogu Nghé — Logo & Icon System 2026

## 1. Mục tiêu

Hệ thống mới kết hợp hai lớp nhận diện:

- **Logo:** nghé vàng đội nón lá, đại diện cho Việt Nam, bữa ăn và sự gần gũi.
- **Ngôn ngữ hình ảnh:** khối tròn mềm, vàng–đen–kem, điểm sáng lớn và biểu cảm thân thiện như character sheet tham chiếu.

Icon chức năng không biến thành hình minh họa phức tạp. Chúng giữ cấu trúc đơn giản để người dùng nhận ra nhanh, đồng thời dùng chung độ dày nét, đầu nét tròn và màu thương hiệu.

## 2. Wordmark

Wordmark mới được vẽ bằng path, không phụ thuộc font thiết bị.

- Chữ tròn, thấp và chắc, tương thích hình khối của linh vật.
- Fill vàng `#FFC928`.
- Viền nâu mực `#2A1D12`.
- Highlight kem `#FFF8E8`, chỉ dùng ở cạnh trên trái.
- Không dùng shadow hoặc gradient trong UI nhỏ.
- Khoảng trống an toàn tối thiểu bằng chiều rộng lòng chữ `o`.

Nguồn triển khai:

- `mobile/src/components/brand/MoguWordmark.tsx`
- `docs/assets/mogu-wordmark-nghe-v2.svg`

## 3. Token màu

- `yellow`: `#FFC928` — nhận diện chính, trạng thái được chọn.
- `honey`: `#F4A81C` — nhấn phụ và illustration.
- `cream`: `#FFF8E8` — nền và highlight.
- `ink`: `#2A1D12` — nét chính, thay cho đen tuyệt đối.
- `cocoa`: `#6B4A32` — chi tiết phụ.
- `coral`: `#FF796F` — thông báo, cảm xúc và cảnh báo nhẹ.
- `muted`: `#81786F` — icon chưa chọn.

Nguồn token: `mobile/src/theme/brand.ts`.

## 4. Hệ icon

### 4.1 Icon điều hướng vẽ riêng

- **Trang chủ:** mái nhà và đường cong chiếc bát.
- **Khám phá:** la bàn với kim dạng hạt gạo vàng.
- **Random:** ngôi sao lớn, sao nhỏ và nét chuyển động.
- **Sức khỏe:** trái tim kết hợp đường nhịp.
- **Cá nhân:** chân dung với đường nón lá tối giản.

Nguồn: `mobile/src/components/icons/navigation-icons.tsx`.

### 4.2 Icon chức năng dùng chung

Toàn bộ icon Lucide hiện có được đưa qua `mobile/src/components/icons/index.tsx`:

- Kích thước mặc định: `24`.
- Stroke mặc định: `2.15`.
- Đầu nét và góc nối: `round`.
- Màu mặc định: `ink`.
- Màn hình vẫn được phép truyền màu/fill riêng cho trạng thái semantic.

Không import trực tiếp từ `lucide-react-native` bên ngoài thư mục `components/icons`.

```tsx
import { Bell, Search } from '@/components/icons';
```

## 5. Trạng thái

- Default: nền trong suốt, nét `muted` hoặc `ink`.
- Selected: fill vàng, nét `ink`.
- Pressed: scale `0.96`, opacity `0.9`.
- Disabled: opacity `0.38`, không thêm màu mới.
- Destructive: dùng coral/đỏ semantic; không dùng vàng.

## 6. App icon

- Canvas vuông 1024 × 1024, không bake góc bo.
- Nghé chiếm khoảng 78–84% vùng nhìn.
- Nền vàng phẳng để giữ rõ tai, sừng và nón ở kích thước nhỏ.
- Android adaptive icon dùng foreground có safe area rộng hơn.

Tài sản:

- `mobile/src/assets/images/logo/mogu-app-icon-nghe-v1.png`
- `mobile/src/assets/images/logo/mogu-adaptive-foreground-nghe-v1.png`
- `mobile/src/assets/images/logo/mogu-nghe-mark.png`

## 7. Quy tắc FE

1. Icon tương tác phải có vùng chạm tối thiểu 44 × 44.
2. Không dùng emoji thay icon chức năng.
3. Không dùng icon glossy nhiều chi tiết dưới 48 px.
4. Illustration mascot có thể glossy; icon UI phải giữ flat/duotone.
5. Không đổi màu icon chỉ để trang trí; màu phải thể hiện trạng thái hoặc cấp độ nhấn.
6. Tên icon và `accessibilityLabel` phải mô tả hành động, không mô tả hình dáng.

## 8. Phạm vi đã áp dụng

- Wordmark trong Splash, Đăng ký, Khám phá, Chi tiết và Random.
- Dấu nghé trong Splash, Random và callout chi tiết.
- Năm icon bottom navigation.
- Toàn bộ import Lucide trong 71 file mobile qua lớp icon thương hiệu.
- App icon iOS/Android và Android adaptive icon.
