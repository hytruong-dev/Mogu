# 🏢 Mogu Virtual IT Enterprise — Hệ thống 12 Vị trí Chuyên trách

Hệ sinh thái **Cursor Agent Skills** toàn diện cho dự án **Mogu**, mô phỏng cơ cấu tổ chức chuẩn mực của một công ty công nghệ sản phẩm (Product IT Company). 

Hệ thống cho phép bạn điều phối toàn bộ vòng đời sản phẩm: từ **Chiến lược sản phẩm, Phân tích nghiệp vụ, Thiết kế UI/UX, Lập trình Backend/Mobile/Web, Kỹ thuật dữ liệu AI, An toàn bảo mật, Kiểm thử tự động E2E, đến Vận hành phát hành và Tài liệu hóa**.

---

## 👥 Danh bạ 12 Phòng ban & Vị trí chuyên trách

| Khối phòng ban | Vai trò chuyên môn | Tên Skill trong Cursor | Trách nhiệm chính |
| :--- | :--- | :--- | :--- |
| **1. Quản lý Sản phẩm** | **Product Manager (PM)** | `@mogu-product-manager` | Định hướng tầm nhìn, nghiên cứu chân dung người dùng (User Personas), xây dựng PRD, đo lường OKRs/KPIs, chấm điểm ưu tiên tính năng (RICE). |
| **2. Phân tích Nghiệp vụ** | **Business Analyst (BA)** | `@mogu-business-analyst` | Viết tài liệu đặc tả chức năng (SRS), User Story với tiêu chí nghiệm thu Gherkin (`Given-When-Then`), quy tắc vòng đời món ăn và phân bổ calo thực đơn tuần. |
| **3. Thiết kế Sản phẩm** | **Product & UI/UX Designer** | `@mogu-uiux-designer` | Chuẩn hóa Design tokens, typography, bảng màu ẩm thực ấm áp, thiết kế hiệu ứng cuộn mượt (Collapsing Parallax Hero), kiểm tra công thái học di động. |
| **4. Ban Kiến trúc Kỹ thuật** | **Tech Lead / Engineering Manager** | `@mogu-orchestrator` | Tổng chỉ huy điều phối quy trình 5 pha, phân rã kiến trúc Monorepo, quản lý phụ thuộc chéo giữa các tầng hệ thống, bảo vệ chất lượng bàn giao. |
| **5. Kỹ thuật Backend** | **Senior Backend Lead** | `@mogu-backend-lead` | Xây dựng API NestJS + Fastify, thiết kế cơ sở dữ liệu Prisma/PostgreSQL, xử lý xác thực Supabase JWT, tối ưu hóa các transaction và DTO. |
| **6. Kỹ thuật Mobile** | **Senior Mobile Lead** | `@mogu-mobile-lead` | Phát triển ứng dụng React Native / Expo (Android & iOS), tối ưu animation 60fps Reanimated, kết nối camera/scan, xử lý mạng LAN và build APK/AAB. |
| **7. Kỹ thuật Frontend Web** | **Senior Web Lead** | `@mogu-web-lead` | Phát triển cổng quản trị Admin (`admin/`) bằng React 18, Vite, TailwindCSS, TanStack Query, xây dựng wizard import món ăn nhiều bước và bảng dữ liệu. |
| **8. Kỹ thuật Dữ liệu & AI** | **Data & ML Specialist** | `@mogu-data-ai-engineer` | Tinh chỉnh prompt AI Vision FoodScan, quản lý token suy luận, mô hình vector embedding CLIP cục bộ, tìm kiếm ngữ nghĩa pgvector, crawler dữ liệu món ăn. |
| **9. An toàn & Bảo mật** | **Security & Compliance Auditor** | `@mogu-security-specialist` | Đánh giá bảo mật OWASP, kiểm soát quyền truy cập RBAC, chống lộ khóa bí mật trong bundle/git, tuân thủ quyền riêng tư dữ liệu sức khỏe (GDPR/PDPA). |
| **10. Đảm bảo Chất lượng** | **QA Automation Lead** | `@mogu-qa-engineer` | Sử dụng Playwright MCP tự động mở trình duyệt web click test form, chụp ảnh màn hình làm bằng chứng (visual evidence), chạy Jest unit test, bắt lỗi console. |
| **11. Vận hành & Phát hành** | **DevOps & Release Engineer** | `@mogu-devops-release` | Giám sát & giải phóng port mạng (`3001`, `5173`, `8081`), bảo vệ kho Git chống commit file lớn >100MB / APK, chuẩn hóa Prisma migration & build production. |
| **12. Quản trị Tri thức** | **Technical Writer** | `@mogu-tech-writer` | Chuẩn hóa tài liệu API Swagger/OpenAPI, soạn thảo quyết định kiến trúc ADR, biên tập Release Notes, Changelogs và tài liệu hướng dẫn nhà phát triển. |

---

## 🔄 Vòng lặp Vận hành Tự động 5 Pha (Autonomous Software Lifecycle)

```
                            [Yêu cầu từ Bạn]
                                   │
                                   ▼
[PHA 1: KHÁM PHÁ & THIẾT KẾ]
  ├── @mogu-product-manager    ──> Định nghĩa vấn đề người dùng, KPI & viết PRD
  ├── @mogu-business-analyst   ──> Viết User Stories & Acceptance Criteria (Gherkin)
  └── @mogu-uiux-designer      ──> Thiết kế luồng UX, layout và animation
                                   │
                                   ▼
[PHA 2: KIẾN TRÚC, AN TOÀN & AI]
  ├── @mogu-orchestrator       ──> Phân tích phụ thuộc Monorepo & kế hoạch triển khai
  ├── @mogu-security-specialist──> Thẩm định rủi ro dữ liệu, RBAC & phân quyền API
  └── @mogu-data-ai-engineer   ──> Cấu hình vector search pgvector & pipeline AI
                                   │
                                   ▼
[PHA 3: LẬP TRÌNH ĐỒNG BỘ 3 TẦNG]
  ├── Prisma Schema Update     ──> Cập nhật schema.prisma & generate client
  ├── @mogu-backend-lead       ──> Xây dựng Controller, Service & DTOs
  ├── @mogu-mobile-lead        ──> Xây dựng màn hình React Native & API service
  └── @mogu-web-lead           ──> Xây dựng trang quản trị Admin Web
                                   │
                                   ▼
[PHA 4: KIỂM THỬ TỰ ĐỘNG & NGHIỆM THU]
  ├── @mogu-qa-engineer        ──> Chạy Jest test + Playwright E2E tự động duyệt web
  └── Visual Verification      ──> Chụp ảnh màn hình làm bằng chứng hoàn thành
                                   │
                                   ▼
[PHA 5: TÀI LIỆU HÓA & PHÁT HÀNH AN TOÀN]
  ├── @mogu-tech-writer        ──> Cập nhật Swagger docs & soạn thảo Release Notes
  └── @mogu-devops-release     ──> Build kiểm tra, check sạch port & git push an toàn
```

---

## 🎯 Ví dụ Sử dụng Thực tế

Bạn có thể gọi đích danh từng vai trò hoặc để Tech Lead tự phân phối công việc:

1. **Khởi động một tính năng hoàn toàn mới:**
   > *"@mogu-product-manager và @mogu-business-analyst hãy nghiên cứu và đặc tả tính năng 'Thử thách ăn uống lành mạnh 21 ngày' cho app Mogu."*

2. **Yêu cầu Tech Lead điều phối toàn bộ team:**
   > *"@mogu-orchestrator hãy lên kế hoạch và chỉ đạo các team làm tính năng cho phép Admin xem bản đồ các địa điểm ăn uống ngon được đề xuất."*

3. **Thẩm định bảo mật hệ thống:**
   > *"@mogu-security-specialist hãy rà soát lại các endpoint trong `backend/src/food-scan/` xem có nguy cơ lộ API key hoặc bị spam request không."*

4. **Kiểm thử tự động bằng trình duyệt:**
   > *"@mogu-qa-engineer hãy dùng Playwright mở trang `http://localhost:5173/admin/places`, thử tìm kiếm một địa điểm và chụp ảnh kết quả lại cho tôi."*

5. **Tối ưu trải nghiệm màn hình di động:**
   > *"@mogu-uiux-designer và @mogu-mobile-lead hãy làm mượt hiệu ứng cuộn trang công thức nấu ăn trên điện thoại Android."*

6. **Phát hành phiên bản mới:**
   > *"@mogu-tech-writer viết Release Notes cho phiên bản cập nhật hôm nay, và @mogu-devops-release kiểm tra build rồi push code lên GitHub."*
