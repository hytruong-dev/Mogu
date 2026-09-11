# Mogu — Review luồng chọn món ngẫu nhiên và thực đơn theo ngân sách

Ngày review: 2026-09-11  
Phạm vi: Mobile, Backend, Prisma schema, tài liệu BA-004/BA-005 liên quan đến chọn món ngẫu nhiên và thực đơn nhiều ngày.  
Mục tiêu tài liệu: chỉ ra phần chưa ổn/chưa hợp lý, giải thích tác động và chuyển thành backlog có thể giao cho developer hoặc AI coding agent.

Trạng thái: review và đề xuất triển khai; chưa sửa logic ứng dụng. Bản bổ sung ngày 2026-09-11 ở mục 10–17 hiệu chỉnh những nhận định cũ và bổ sung bằng chứng.

### Cách đọc tài liệu

- Đọc mục 10 trước để biết các hiệu chỉnh và giới hạn xác minh.
- Mục 3 là các findings ban đầu; mục 11 bổ sung lỗi dữ liệu, concurrency và lifecycle.
- Mục 12 và 15 là các quyết định sản phẩm đề xuất, chưa coi là yêu cầu đã được duyệt.
- Mục 13 chỉ rõ vị trí tối ưu và chỉ số cần đo.
- Mục 14 và 16 dùng để chia việc và nghiệm thu; mục 17 ghi phạm vi chưa kiểm tra.

## 1. Kết luận ngắn

Kiến trúc hiện tại đã có nền tảng tốt: tách module randomization và weekly plan, lưu snapshot món trong kế hoạch, có lịch sử random và audit đổi món. Đã có trường version, nhưng kiểm tra trước khi update chưa đủ để ngăn cập nhật đồng thời (xem R2-01). Kết quả TypeScript và giới hạn xác minh được ghi ở mục 7 và 10.

Tuy nhiên, chưa nên coi luồng cốt lõi là sẵn sàng cho production. Lý do chính:

1. Hard filter về chế độ ăn/nguyên liệu tránh có thể bị bỏ qua hoặc chưa được áp dụng đúng.
2. Cam kết ngân sách tuần trong BA-005 không được bảo đảm; thuật toán có thể trả plan vượt ngân sách và vẫn chuyển sang `READY`.
3. Nhiều lựa chọn trên mobile chỉ thay đổi giao diện nhưng không đi vào request/thuật toán.
4. Chế độ kcal `PROFILE`, `preferHomeCook`, `mealsPerDay` đang được lưu nhưng chưa thực sự điều khiển kết quả.
5. Weekly plan gần như chưa có unit test cho calculator, generator, swap và state transition.

Ưu tiên đề xuất: sửa P0 về an toàn món ăn trước, sau đó sửa tính đúng ngân sách và đồng bộ UI/API, rồi mới tối ưu độ ngẫu nhiên và cá nhân hóa.

## 2. Phần đang làm tốt

- Module hóa tương đối rõ: config, calculator, generator, swap, processor và API controller được tách riêng.
- `WeeklyPlanSlot` lưu snapshot tên, giá, kcal, macro và ảnh. Đây là hướng đúng vì dữ liệu món có thể thay đổi sau khi plan đã tạo.
- Có version cho plan/slot và kiểm tra conflict ở các thao tác start, lock, complete, skip, swap; cần bổ sung điều kiện version tại câu lệnh ghi để chống race (R2-01).
- Swap có audit record `WeeklyPlanSlotSwap`.
- Randomization có lưu history, score breakdown, top candidates và event; đây là nền tảng tốt để đo selection rate và cải thiện thuật toán.
- Allergen đã được xem là hard filter ở truy vấn chính của randomization.
- TypeScript check hiện pass trên cả backend, mobile và admin.

## 3. Findings theo mức độ ưu tiên

### P0 — Có thể đề xuất món không phù hợp ràng buộc sức khỏe

#### P0.1 Weekly plan đọc hard diet và nguyên liệu tránh nhưng không dùng để lọc

`weekly-plan-generator.service.ts` tạo `profileSnapshot` gồm `hardDietTypeCodes` và `avoidedIngredients`, nhưng `queryCandidates()` chỉ áp dụng allergen và meal type. Hai trường còn lại không xuất hiện trong điều kiện Prisma.

Tác động: người dùng ăn chay, thuần chay hoặc đã khai báo tránh một nguyên liệu vẫn có thể nhận món xung đột.

Đối chiếu:

- Code: `backend/src/weekly-plans/services/weekly-plan-generator.service.ts`, vùng dòng 72–78 và 256–316.
- BA-005 yêu cầu hard filter ở `backend/BA-005-IMPLEMENTATION-PLAN.md`, vùng dòng 188–219.

Khuyến nghị:

- Tạo một hàm/policy dùng chung để dựng hard constraints.
- Diet type phải được kiểm tra theo đúng semantics. Nếu user có nhiều ràng buộc hard, cần xác định rõ là món phải thỏa tất cả hay một tổ hợp hợp lệ; không nên dùng một `some ... in [...]` mà không có quyết định nghiệp vụ.
- Nguyên liệu tránh phải so với quan hệ `dishIngredients -> ingredient`, có chuẩn hóa alias/synonym; không so bằng tên món.
- Không bao giờ nới hard constraints trong fallback.

Tiêu chí nghiệm thu:

- Với profile chay + tránh đậu phộng, mọi slot trong plan đều thỏa cả hai điều kiện.
- Khi không có ứng viên an toàn, plan trả `FAILED/INSUFFICIENT_CANDIDATES`; không lấy món bất kỳ.

#### P0.2 Fallback của weekly plan bỏ toàn bộ điều kiện an toàn

`queryAnyPublishedDish()` chỉ giữ `PUBLISHED` và `deletedAt = null`. Hàm này được dùng ở fallback 3 và fallback cuối, vì vậy có thể bỏ allergen, diet, avoided ingredient, meal type, budget và kcal.

Tác động: fallback biến tình huống “thiếu dữ liệu” thành kết quả có thể gây hại cho người dùng.

Vị trí: `backend/src/weekly-plans/services/weekly-plan-generator.service.ts`, vùng dòng 139–177 và 365–400.

Khuyến nghị: xóa fallback “any published dish”. Fallback chỉ được nới soft constraints theo thứ tự được tài liệu hóa; hard constraints phải được truyền qua mọi tầng.

#### P0.3 Randomization nới hard diet và lọc nguyên liệu tránh sai cách

Trong randomization:

- Relaxation level thứ ba đặt `withDietType: false`, dù BA-004 mô tả hard diet là “không bao giờ nới”.
- Nguyên liệu tránh được kiểm tra bằng `d.name.includes(...)`, tức là so tên món thay vì ingredient của món.
- Nếu lọc nguyên liệu tránh làm danh sách rỗng, code giữ lại danh sách chưa lọc.
- Khi danh sách explicit excludes loại hết ứng viên, code cũng quay lại danh sách chưa loại.

Vị trí: `backend/src/randomization/randomization.service.ts`, vùng dòng 184–268.  
Đối chiếu: `backend/docs/BA-004_API.md`, vùng dòng 123–127.

Khuyến nghị:

- Tách `hardConstraints` khỏi `softConstraints`; relaxation chỉ thao tác trên soft constraints.
- Query ingredient relation trực tiếp tại DB.
- Nếu hard-filtered set rỗng, trả no-candidate và danh sách tiêu chí mềm có thể nới; không tự động phục hồi ứng viên vi phạm.
- `acceptedRelaxations` trong DTO hiện chưa được dùng; hoặc triển khai đúng, hoặc bỏ khỏi contract để tránh API giả.

#### P0.4 Swap món do user chỉ định không kiểm tra profile

Nhánh có `dto.newDishId` chỉ kiểm tra món published. Nó không kiểm tra allergen, hard diet, avoided ingredient, meal slot, nutrition hay ngân sách. Nhánh auto-pick cũng chỉ kiểm tra allergen và meal type, chưa kiểm tra hard diet/avoided ingredient/budget.

Vị trí: `backend/src/weekly-plans/services/weekly-plan-swap.service.ts`, vùng dòng 47–101.

Khuyến nghị: cả manual swap và auto swap phải đi qua cùng một eligibility policy với generator. Theo BA-005 hiện tại, ngân sách kế hoạch vẫn là giới hạn cứng khi swap. Nếu muốn cho phép vượt, cần thay đổi quyết định nghiệp vụ và tăng budget được xác nhận trước; không âm thầm đổi sang soft limit.

### P1 — Cam kết ngân sách và kcal chưa đúng với nghiệp vụ

#### P1.1 Plan có thể vượt ngân sách nhưng vẫn `READY`

BA-005 ghi rõ budget là hard limit và `projected <= budget` trước khi `READY`. Code hiện tại:

- Lọc ứng viên bằng điều kiện `priceMin <= slotBudget OR priceMax <= slotBudget`; nếu `priceMin` thấp nhưng trung bình giá vượt budget, món vẫn lọt.
- Cho món không có giá vào candidate và coi `priceAvg = 0`.
- Chỉ khi tổng tiền lớn hơn 150% ngân sách mới log warning; không có mức trần chặn và sau đó vẫn chuyển sang `READY`. Mức vượt trên 100% đến 150% còn không kích hoạt log này.
- Fallback có thể lấy món bất kỳ, mặc định giá 50.000đ.

Vị trí: `backend/src/weekly-plans/services/weekly-plan-generator.service.ts`, vùng dòng 181–247 và 274–338.  
Đối chiếu: `backend/BA-005-IMPLEMENTATION-PLAN.md`, dòng 13–17 và 211–219.

Khuyến nghị:

- Chốt một price semantics duy nhất. BA-005 hiện chọn `priceMin`; code đang dùng trung bình. Cần thống nhất tài liệu, API và UI.
- Không dùng giá 0 cho dữ liệu thiếu; loại ứng viên hoặc đánh dấu `PRICE_UNKNOWN` và không dùng cho plan hard-budget.
- Sinh plan theo remaining budget, không chia ngân sách từng slot một cách độc lập rồi bỏ qua tổng.
- Chỉ set `READY` sau validator cuối: `totalCost <= budgetLimit` và toàn bộ hard constraints pass.

#### P1.2 Thuật toán là greedy tuần tự, chưa cân bằng toàn plan

Comment nói “sorted by hardest first”, nhưng `slotTasks` không được sort theo số candidate. Mỗi slot dùng cùng phân bổ cố định, không cập nhật remaining budget/remaining slots. Điều này làm plan dễ thất bại hoặc vượt ngân sách dù tồn tại tổ hợp hợp lệ.

Vị trí: `backend/src/weekly-plans/services/weekly-plan-generator.service.ts`, vùng dòng 106–135.  
Đối chiếu: `backend/BA-005-IMPLEMENTATION-PLAN.md`, vùng dòng 253–259.

Khuyến nghị MVP:

1. Pre-fetch/count candidates cho từng loại slot.
2. Xử lý slot ít candidate trước.
3. Sau mỗi lựa chọn, tính lại remaining budget.
4. Nếu lựa chọn cuối làm total vượt budget, backtrack giới hạn hoặc chạy nhiều attempt có seed.
5. Chạy final validator trước transaction.

#### P1.3 Kcal mode `PROFILE` chỉ là nhãn

Profile có `goalKcal`, và generator đưa giá trị đó vào snapshot; nhưng calculator vẫn luôn dùng `config.kcalPerDay`. `kcalMode` không tham gia generator.

Tác động: người dùng chọn “Theo hồ sơ” nhưng vẫn nhận mục tiêu kcal thủ công/default, gây sai kỳ vọng.

Vị trí:

- `mobile/src/screens/EditPlanScreen.tsx`, vùng dòng 125–155 và 337–363.
- `backend/src/weekly-plans/services/weekly-plan-generator.service.ts`, vùng dòng 72–105.
- `backend/src/weekly-plans/services/weekly-plan-calculator.service.ts`, vùng dòng 15–30.

Khuyến nghị: resolve `effectiveKcalPerDay` lúc tạo plan: `PROFILE -> profile.goalKcal ?? 2000`, `CUSTOM -> config.kcalPerDay`; lưu giá trị và nguồn vào snapshot.

#### P1.4 Tolerance fallback có thể bị “nới” thành chặt hơn

DTO cho phép `calorieTolerancePercent` đến 30, nhưng fallback giới hạn bởi `MAX_KCAL_TOLERANCE * 100 = 20`. Nếu config là 30%, “looserTolerance” thành 20%, tức là chặt hơn. Ngoài ra biến `tolerancePercent` không được cập nhật sau fallback.

Vị trí: `backend/src/weekly-plans/services/weekly-plan-generator.service.ts`, vùng dòng 130–152; `backend/src/weekly-plans/constants/weekly-plan-weights.ts`, dòng 34–35.

Khuyến nghị: dùng cùng một đơn vị và invariant; ví dụ toàn bộ là số phần trăm nguyên 0–30. `nextTolerance = max(current, min(current + step, max))`.

### P1 — Giao diện đưa ra lựa chọn nhưng backend không nhận hoặc không dùng

#### P1.5 Nhiều tiêu chí ở Random Flow không đi vào request

Mobile cho chọn `need`, `foodType`, `distance`, `openOnly`, `excluded`, `diet`, nhưng request ở `fetchRandom()` chỉ gửi meal và budget. Người dùng nhìn thấy một bộ lọc có vẻ hoạt động, nhưng kết quả không phụ thuộc vào nó.

Vị trí: `mobile/src/screens/RandomFlowScreen.tsx`, vùng dòng 70–85 và 130–171.

Khuyến nghị:

- Lập mapping UI → API cho từng control.
- Control nào chưa hỗ trợ phải ẩn/disable kèm nhãn “sắp có”, không giả vờ đã áp dụng.
- Thêm contract test xác nhận mỗi control làm thay đổi request payload.

#### P1.6 Nút “Random lại” không gọi retry API

`fetchRandom(retryId)` có nhánh retry, nhưng callback đóng màn kết quả chỉ ghi event rồi quay về loading. `LoadingScreen.onDone` sau đó gọi `fetchRandom()` không có ID, nên tạo random mới thay vì retry có loại kết quả trước.

Vị trí: `mobile/src/screens/RandomFlowScreen.tsx`, vùng dòng 130–171, 225–257.

Khuyến nghị: giữ `pendingRetryId` trong state hoặc truyền thẳng qua loading completion; test rằng request thứ hai gọi `/dish-randomizations/:id/retry`.

#### P1.7 `mealsPerDay` có thể mâu thuẫn `enabledSlots`

UI cho chọn độc lập “số bữa/ngày” và các slot. Người dùng có thể chọn 2 bữa/ngày nhưng bật 4 slot. DTO không kiểm tra `enabledSlots.length === mealsPerDay`. Generator chỉ dùng `enabledSlots`, trong khi UI thống kê dùng `days * mealsPerDay`.

Vị trí:

- `mobile/src/screens/EditPlanScreen.tsx`, vùng dòng 365–418.
- `backend/src/weekly-plans/dto/upsert-weekly-plan-config.dto.ts`, vùng dòng 31–53.
- `backend/BA-005-IMPLEMENTATION-PLAN.md`, dòng 309–313.

Khuyến nghị: bỏ field trùng lặp và suy ra `mealsPerDay = enabledSlots.length`, hoặc thêm cross-field validator ở backend và tự đồng bộ ở mobile.

#### P1.8 Chỉnh config luôn tạo plan mới nhưng không xử lý rõ plan cũ

Màn “Lưu thay đổi” lưu config rồi gọi generate ngay. Nó không archive plan cũ và không hỏi user liệu muốn áp dụng từ plan kế tiếp hay thay plan hiện tại. Backend có thể có nhiều `READY` plan; `getCurrent()` chỉ lấy bản mới nhất.

Tác động: lịch sử khó hiểu, có plan mồ côi, và nếu DB có partial unique index cho `GENERATING`, thao tác nhanh có thể lỗi conflict.

Vị trí: `mobile/src/screens/EditPlanScreen.tsx`, vùng dòng 195–224; `backend/src/weekly-plans/services/weekly-plans.service.ts`, vùng dòng 59–115.

Khuyến nghị: tách “Lưu cấu hình” và “Tạo lại plan”; hoặc API `regenerate` nguyên tử với chính sách rõ cho plan cũ.

### P1 — Độ tin cậy, dữ liệu và riêng tư

#### P1.9 Weekly plan migration không nằm trong Prisma migrations chuẩn

Schema có các model weekly plan, nhưng thư mục `backend/prisma/migrations` không có migration tương ứng. Thay vào đó có script `backend/scripts/migrate-weekly-plan.ts` chạy raw SQL.

Tác động: môi trường mới chạy `prisma migrate deploy` có thể thiếu bảng/enum/index/RLS; schema drift giữa máy dev, test và production.

Khuyến nghị: đưa thay đổi vào migration có version, kiểm thử từ database rỗng, và loại bỏ quy trình thủ công sau khi backfill.

#### P1.10 Dữ liệu cá nhân không cần thiết được gửi vào prompt AI

AI explanation gửi display name, tuổi, mục tiêu sức khỏe, dị ứng và chế độ ăn sang model provider. Tên người dùng không cần thiết để giải thích món; tuổi chính xác cũng có thể giảm xuống nhóm tuổi hoặc bỏ nếu không dùng.

Vị trí: `backend/src/randomization/randomization.service.ts`, vùng dòng 320–347 và 683–781.

Khuyến nghị:

- Data minimization: bỏ display name, chỉ gửi thuộc tính thực sự cần cho lời giải thích.
- Có consent/notice phù hợp và chính sách retention/logging.
- Tách eligibility khỏi AI: model chỉ giải thích kết quả đã được rule engine xác minh, không quyết định an toàn.

#### P1.11 Job generation chưa idempotent rõ ràng

Queue retry tối đa 2 lần. Generator không kiểm tra trạng thái hiện tại hoặc slot đã tồn tại trước khi tạo. Nếu lần đầu commit thành công nhưng worker bị coi là thất bại sau commit, retry có thể đụng unique slot và đổi plan từ `READY` sang `FAILED`.

Vị trí: `backend/src/weekly-plans/processors/weekly-plan.processor.ts`, dòng 15–25; `backend/src/weekly-plans/services/weekly-plan-generator.service.ts`, vùng dòng 214–253.

Khuyến nghị: guard status, dùng generation attempt/idempotency key, và coi plan `READY` cùng đủ số slot là success no-op.

### P2 — Chất lượng thuật toán, UX và maintainability

#### P2.1 `preferHomeCook` và “Tùy chọn thêm” chưa có hiệu lực

`preferHomeCook` chỉ được lưu trong config. Generator không đọc nó. Card “Tùy chọn thêm” trên mobile không có handler và `avoidRepeat` luôn bị hardcode `true` khi save.

Khuyến nghị: hoặc triển khai end-to-end, hoặc bỏ khỏi giao diện/MVP contract.

#### P2.2 Swap auto luôn lấy món rating cao nhất

Auto swap query `orderBy ratingAvg desc` rồi chọn phần tử đầu. Người dùng bấm đổi nhiều lần dễ nhận cùng một món, không loại các món đã có trong plan và không dùng score/budget/kcal.

Khuyến nghị: dùng cùng candidate scorer với generator, loại toàn bộ dish IDs đang có trong plan và có retry history theo slot.

#### P2.3 Summary trên mobile bị cũ sau swap

Sau swap, mobile chỉ thay slot trong local state; không cập nhật `projectedCostVnd`/`projectedKcal`, và bỏ qua `budgetWarning` từ response. Thanh ngân sách/kcal vì vậy sai cho đến lần refetch.

Vị trí: `mobile/src/screens/WeeklyPlanScreen.tsx`, vùng dòng 185–195 và 261–302.

Khuyến nghị: backend trả plan summary mới trong response hoặc mobile refetch plan sau swap.

#### P2.4 Hardcode Supabase URL ở mobile

`mobile/src/services/api/randomization.ts` và legacy fallback trong `RandomFlowScreen.tsx` chứa project URL cố định. Backend lại dựng URL từ env.

Khuyến nghị: backend luôn trả canonical public URL; mobile không biết storage vendor/domain. Nếu cần fallback, dùng Expo environment config.

#### P2.5 API validation còn thiếu invariant

- `durationDays` mô tả chỉ nhận 3/5/7/14 nhưng DTO chỉ `@IsInt`, không `@IsIn`.
- `excludeDishIds` mô tả tối đa 20 nhưng không có `@ArrayMaxSize(20)`.
- Budget range không kiểm tra `minVnd <= maxVnd`.
- `mealsPerDay` không khớp số slot.

Khuyến nghị: bổ sung validator cấp field và class; thêm test 400 cho payload sai.

#### P2.6 Scoring có lỗi/độ lệch dữ liệu

- `dish.nutrition` trong Prisma là object một-một, nhưng `scoreCandidate()` kiểm tra `dish.nutrition?.length > 0`, nên nutrition quality bonus không được cộng.
- Randomization weighted-sample trên tối đa 500 ứng viên; điểm cao chỉ tăng xác suất chứ không bảo đảm kết quả thuộc top phù hợp. Cần xác định rõ “random” hay “recommend then randomize within top K”.
- Weekly query `take: 50` không có `orderBy`, nên tập candidate phụ thuộc thứ tự DB.

Khuyến nghị: sửa nutrition check, chọn top-K rồi weighted random, lưu seed/algorithm version cho debug và A/B test.

#### P2.7 Error handling mobile che mất lỗi thật

Random Flow tự động fallback sang legacy API khi BA-006 lỗi; Weekly Plan catch lỗi fetch nhưng chỉ log. Điều này khiến lỗi contract/backend khó được phát hiện và người dùng có thể nhận hành vi khác mà không biết.

Khuyến nghị: phân biệt network error, 4xx nghiệp vụ và 5xx; chỉ fallback với lỗi đã định nghĩa, đồng thời gửi telemetry.

#### P2.8 README backend vẫn là NestJS starter

`backend/README.md` chưa mô tả Mogu, biến môi trường, database migration, Redis optional mode, cách seed, kiến trúc module hay cách chạy mobile/admin cùng backend.

Khuyến nghị: viết root README và runbook local/dev/prod. Đây là việc nhỏ nhưng giảm đáng kể thời gian onboarding và lỗi môi trường.

## 4. Kiến trúc đích đề xuất

Nên gom logic eligibility thành một policy dùng chung:

```text
User input/profile
  -> normalize criteria
  -> HARD ELIGIBILITY
       allergen
       hard diet
       avoided ingredients
       published/data validity
  -> SOFT FILTERS (có thể nới với consent/rule rõ)
       meal slot
       budget preference nếu random một món
       distance/open now
       cuisine/need
  -> scorer
  -> picker (top-K weighted random)
  -> final validator
  -> persist snapshot + explanation
```

Đối với weekly plan, budget theo tài liệu BA-005 là hard constraint, vì vậy budget phải nằm trong `HARD ELIGIBILITY/final validator` của luồng đó, không dùng chung semantics mềm với random một món.

Các service nên dùng chung:

- `DishEligibilityService`: dựng Prisma predicate và validate một dish cụ thể.
- `DishScoringService`: scoring có version, không chứa hard filter.
- `DishPickerService`: seeded weighted random trong top-K.
- `WeeklyPlanValidatorService`: kiểm tra tổng budget, kcal, số slot, unique date/slot và mọi hard constraints trước `READY`.

## 5. Kế hoạch sửa theo giai đoạn

### Giai đoạn 0 — Chốt contract nghiệp vụ (0,5–1 ngày)

- Chốt hard/soft constraints cho random và weekly plan.
- Chốt price semantics: `priceMin`, average hay expected cost.
- Chốt nhiều hard diet là AND hay rule compatibility khác.
- Chốt behavior khi thiếu dữ liệu giá/nutrition/allergen.
- Chốt chỉnh config có tự tạo plan mới không.

Đầu ra: một ADR ngắn và acceptance matrix.

### Giai đoạn 1 — Safety hotfix (1–2 ngày)

- Không nới allergen, hard diet, avoided ingredients.
- Xóa `queryAnyPublishedDish()` khỏi đường sinh plan.
- Áp dụng cùng eligibility policy cho manual/auto swap.
- Khi thiếu món an toàn, trả no-candidate/failed có lý do rõ.
- Thêm test P0 trước khi refactor tiếp.

### Giai đoạn 2 — Budget và kcal correctness (2–4 ngày)

- Resolve effective kcal theo mode.
- Sửa candidate price rule và loại giá unknown khỏi hard-budget plan.
- Lập plan dựa trên remaining budget; thêm bounded retries/backtracking.
- Final validation trước `READY`.
- Sửa tolerance units và edge cases.

### Giai đoạn 3 — Đồng bộ UI/API (2–3 ngày)

- Wire hoặc ẩn các control chưa hoạt động.
- Sửa retry flow.
- Đồng bộ `mealsPerDay` và slots.
- Tách save config/regenerate.
- Cập nhật summary sau swap và hiển thị cảnh báo phù hợp.

### Giai đoạn 4 — Reliability và observability (2–3 ngày)

- Migration Prisma chuẩn cho weekly plan.
- Idempotent generation jobs.
- Structured error codes và telemetry cho fallback/no-candidate.
- Algorithm metrics: no-candidate rate, fallback rate, over-budget rate, repeat rate, selection rate.

### Giai đoạn 5 — Tối ưu cá nhân hóa (sau khi correctness ổn định)

- Versioned scoring và seeded top-K random.
- Dùng feedback events để điều chỉnh score.
- A/B test thay vì chỉnh weight cảm tính.
- Giảm PII trong AI explanation và dùng structured output qua abstraction công khai của `AiService`.

## 6. Bộ test tối thiểu cần có trước production

### Eligibility/safety

- Allergen `CONTAINS` không bao giờ xuất hiện ở random, weekly plan và swap.
- Hard diet không bị nới ở mọi fallback.
- Avoided ingredient được kiểm tra qua ingredient relation và alias.
- Manual `newDishId` vi phạm hard constraint bị từ chối.
- No-candidate trả đúng error, không lấy món bất kỳ.

### Budget/kcal

- Mọi plan `READY` có `projectedCostVnd <= budgetLimitVnd`.
- Giá null không được coi là 0.
- PROFILE dùng `profile.goalKcal`; CUSTOM dùng config.
- Tolerance 5%, 10%, 20%, 30% không bị đảo chiều.
- Swap cập nhật total đúng và tuân theo policy budget đã chốt.

### State/concurrency

- Generate lặp cùng idempotency key không tạo hai plan/job.
- Worker retry sau commit là no-op thành công.
- Không có hơn một ACTIVE và một GENERATING plan/user.
- Regenerate thất bại không làm mất plan đang dùng nếu policy yêu cầu rollback.

### Mobile contract

- Mỗi control hiển thị đều xuất hiện đúng trong request.
- Random lại gọi retry endpoint và loại món trước.
- `mealsPerDay` luôn bằng số slot hoặc không còn là field độc lập.
- Sau swap, summary budget/kcal khớp backend.

## 7. Trạng thái kiểm tra kỹ thuật ở lần review đầu

- `backend`: `tsc --noEmit` pass.
- `mobile`: `tsc --noEmit` pass.
- `admin`: lệnh root `tsc --noEmit` trả exit 0 nhưng `tsconfig.json` có `files: []` và project references, nên lần kiểm tra đó chưa đủ chứng minh source app pass. Lần đối chiếu bổ sung đã chạy trực tiếp cả `tsconfig.app.json` và `tsconfig.node.json`: đều pass.
- Jest: 17/23 test suites pass; 76/82 tests pass.
- Một nhóm suite không chạy được do sandbox không cho Jest ghi transform cache vào thư mục Temp.
- `dish-review.service.spec.ts` thất bại thật vì test module chưa cung cấp `ConfigService` cho `DishReviewService`.
- Không có test trong `backend/src/weekly-plans`; đây là khoảng trống lớn so với độ quan trọng của tính năng.
- Lệnh `npm/npx` global của máy đang hỏng đường dẫn; review đã chạy binary trực tiếp từ `node_modules/.bin`.

## 8. Definition of Done đề xuất cho MVP

Luồng cốt lõi chỉ được coi là hoàn thành khi:

1. Không có đường code nào tự nới hard health constraints.
2. Mọi weekly plan `READY` nằm trong ngân sách theo price semantics đã chốt.
3. Tất cả control người dùng nhìn thấy có hiệu lực thật hoặc được ẩn.
4. PROFILE kcal dùng dữ liệu profile thật.
5. Random retry thực sự loại món vừa trả.
6. Weekly plan có unit/integration tests cho generator, calculator, swap và state transitions.
7. Database rỗng có thể dựng đầy đủ bằng một lệnh migration chuẩn.
8. Có metric để biết tỷ lệ no-candidate, fallback, over-budget và user select.

## 9. Thứ tự ticket đề xuất

1. `SAFETY-001`: Shared hard eligibility policy.
2. `SAFETY-002`: Remove unsafe weekly fallbacks.
3. `SAFETY-003`: Enforce eligibility on manual/auto swap.
4. `PLAN-001`: Final budget validator and price semantics.
5. `PLAN-002`: Remaining-budget generator with bounded retry.
6. `PLAN-003`: Effective kcal PROFILE/CUSTOM.
7. `MOBILE-001`: Wire/disable Random Flow controls.
8. `MOBILE-002`: Fix retry endpoint flow.
9. `MOBILE-003`: Align meal count, slots and swap summary.
10. `DATA-001`: Convert weekly raw script to Prisma migration.
11. `RELIABILITY-001`: Idempotent generation worker.
12. `TEST-001`: Weekly plan safety/budget/state test suite.
13. `PRIVACY-001`: Minimize AI explanation profile data.
14. `DOCS-001`: Replace starter README with Mogu runbook.

---

Ghi chú: review này không thay đổi code ứng dụng. Các file admin/ingredient đang có thay đổi cục bộ từ trước được giữ nguyên và không nằm trong phạm vi đánh giá chi tiết.

## 10. Đối chiếu bổ sung lần 2 — ngày 2026-09-11

Đã đọc lại tài liệu và các đường code generator, calculator, swap, lifecycle, randomization, màn cấu hình/kết quả/weekly plan, API client, Home, Nutrition và schema. Các vấn đề hard filter, ngân sách, PROFILE kcal, retry UI và migration ở lần đầu vẫn tồn tại trong code được đọc lần này.

Đây là đánh giá dựa trên source hiện tại; chưa chạy app tương tác, chưa truy vấn database thật và chưa đo tải. Các tình huống concurrency bên dưới là suy luận từ trình tự đọc/ghi trong code, chưa phải kết quả stress test. Không kết luận dữ liệu production đã bị sai hoặc constraint DB chắc chắn chưa được cài.

Các điểm cần sửa trong chính review cũ:

- **Mức độ:** P0 ở mục 3 nghĩa là cần xử lý trước khi phát hành luồng có cam kết về dị ứng; chưa phải xác nhận sự cố production. Chế độ ăn sở thích và nguyên liệu không thích không tự động đồng nghĩa với nguy cơ sức khỏe; cần tách khỏi dị ứng thực sự.
- **Budget swap:** đã sửa khuyến nghị tự mâu thuẫn với BA-005. Sinh plan và swap phải cùng giữ budget hard limit.
- **Top-K:** weighted random trên toàn bộ tập hợp hợp lệ không tự nó là bug. Top-K là lựa chọn sản phẩm cần đánh đổi độ đa dạng; không mặc định top-5 luôn tốt hơn.
- **Giá:** `priceMin` chỉ là giá thấp nhất trong dữ liệu, chưa chứng minh là chi phí tự nấu hoặc giá người dùng thực trả. Cam kết ngân sách nên nói rõ là dự toán theo nguồn giá nào.
- **Allergen:** randomization chỉ loại `CONTAINS`, còn weekly query loại mọi level phù hợp code. Cần chốt policy cho `MAY_CONTAIN` và dữ liệu chưa xác minh; không coi “không có tag” là chứng nhận an toàn.
- **Migration:** có script tạo partial unique indexes và check constraints trong `backend/scripts/migrate-weekly-plan.ts`; thiếu trong migration chuẩn không chứng minh database đang chạy thiếu chúng.
- **Verification:** Jest ở mục 7 là kết quả lần trước, chưa chạy lại trong lần này. Admin được kiểm tra lại đúng hai project cấu hình, đều exit 0. Không dùng TypeScript pass làm bằng chứng logic đúng vì nhiều mapper đang dùng `any`.
- **Ước lượng:** số ngày ở mục 5 chỉ là dự toán sơ bộ, chưa tính sửa data cũ, chuyển migration và integration test trên DB biệt lập.

## 11. Các lỗi bổ sung có bằng chứng trong code

Mỗi mã R2 bên dưới là một đầu việc mới, không đánh số lại findings cũ. Tham chiếu dùng đường dẫn repository và tên hàm để vẫn tìm được khi số dòng thay đổi.

### R2-01 · P1 · Version chưa được kiểm tra nguyên tử khi ghi

**Bằng chứng:** `weekly-plans.service.ts` tại `startPlan`, `lockSlot`, `completeSlot`, `skipSlot` đọc version, so sánh trong JavaScript rồi update bằng `where: { id }`. `weekly-plan-swap.service.ts::swap` làm tương tự; tổng các slot khác được đọc trước transaction.

**Tình huống:** hai request cùng version đều vượt qua kiểm tra. Hai swap khác slot cũng có thể ghi tổng plan được tính từ dữ liệu cũ; có transaction vẫn chưa loại được race này.

**Cải thiện:** compare-and-set bằng điều kiện `id + version + trạng thái hợp lệ` ngay tại update, xử lý số row thay đổi thành 409. Serialize thay đổi theo plan bằng khóa row hoặc transaction isolation phù hợp; tính tổng sau thay đổi trong cùng transaction. Không giữ transaction trong lúc gọi AI/network.

**Nghiệm thu:** hai request cùng slot/version chỉ một request thành công; đổi hai slot đồng thời xong thì projected totals bằng tổng snapshot trong DB. Constraint một ACTIVE/user phải được giữ ở DB, không chỉ kiểm tra bằng `findFirst`.

### R2-02 · P1 · Có snapshot nhưng generator đọc config đang thay đổi

**Bằng chứng:** `weekly-plans.service.ts::generate` lưu `configSnapshot`, budget limit, target và end date; `weekly-plan-generator.service.ts::run` lại lấy `plan.config`.

**Tình huống:** enqueue plan 7 ngày/500K, sau đó config đổi 14 ngày/1 triệu trước khi worker chạy. Worker có thể tạo 14 ngày slot trong plan vẫn mang end date và budget cũ.

**Cải thiện:** dùng immutable effective config của chính generation attempt, có schema version. Capture profile lúc yêu cầu; nếu profile an toàn thay đổi trước publish/start, revalidate hoặc yêu cầu tạo lại thay vì trộn hai thời điểm.

**Nghiệm thu:** sửa config khi job đang chờ không đổi số ngày/budget/kcal của job đó; metadata và số slot luôn khớp.

### R2-03 · P1 · Lifecycle có thể kẹt hoặc cho sửa kế hoạch đã lưu trữ

**Bằng chứng:** `weekly-plans.service.ts::skipSlot` không gọi `checkPlanCompletion`; `findSlotForUser` chỉ kiểm tra ownership. `completeSlot`, `skipSlot` và `swap` không kiểm tra parent plan còn cho phép thao tác. `regeneratePlan` archive bản cũ trước khi tạo bản mới. Worker không kiểm tra plan đã ARCHIVED trước khi set READY.

**Tác động:** bỏ qua bữa cuối khiến ACTIVE không tự hoàn thành; API có thể đổi bữa còn PLANNED trong plan đã archive; worker cũ có thể làm sống lại plan đã archive. Tạo lại thất bại khiến kế hoạch cũ không còn hiện ở current dù dữ liệu vẫn tồn tại.

**Cải thiện:** định nghĩa transition cho từng command, thực thi trong điều kiện ghi. Chạy completion check sau cả complete và skip trong cùng transaction. Chỉ thay thế bản cũ khi bản mới sẵn sàng theo policy; worker phải tôn trọng trạng thái hủy/archive.

**Nghiệm thu:** slot cuối SKIPPED kết thúc ACTIVE; command trái trạng thái bị từ chối; job hoàn thành muộn không hồi sinh plan cũ.

### R2-04 · P1 · Plan có thể mắc ở GENERATING, UI không theo dõi đúng job

**Bằng chứng:** `generate` tạo row trước `queue.add` nhưng không xử lý enqueue thất bại. Nhánh chạy đồng bộ trả `plan.status` lấy trước khi generator chạy. Lỗi query trước transaction trong generator không đi qua `failPlan`; processor chỉ rethrow để retry. `getCurrent` ưu tiên ACTIVE/READY hơn GENERATING và không trả FAILED. Mobile bỏ qua `planId` vừa tạo, chỉ gọi current sau timeout 3 giây.

**Cải thiện:** trạng thái job terminal phải được ghi dù lỗi xảy ra giai đoạn nào; có cơ chế reconcile job mắc kẹt. Theo dõi `getById(planId)` tới READY/FAILED với backoff, timeout, cleanup khi rời màn và khả năng tiếp tục theo dõi sau reload.

**Nghiệm thu:** Redis lỗi, worker lỗi query và job chạy hơn 3 giây đều có UI/trạng thái cuối rõ; khi đã có ACTIVE, người dùng vẫn xem được bản mới vừa tạo.

### R2-05 · P1 · Macro sai tên trường và đơn vị dinh dưỡng chưa được chuẩn hóa

**Bằng chứng:** `schema.prisma::DishNutrition` dùng `proteinG`, `carbsG`, `fatG`. Generator và swap đọc `protein`, `carbs`, `fat`, nên snapshot không lấy được macro đúng. Schema còn cho phép `PER_SERVING`, `PER_100G`, `WHOLE_RECIPE`; generator dùng thẳng `calories` làm kcal một bữa, không chuyển theo basis/servings/servingG. Trong `randomization.service.ts::generateAiExplanation`, nutrition bị coi là array và đọc `[0].kcal` dù query trả object với `calories`.

**Cải thiện:** một mapper typed chuyển dữ liệu về khẩu phần kế hoạch, dùng đúng field, phân biệt null và số 0. Với PER_100G cần khối lượng khẩu phần; WHOLE_RECIPE cần số khẩu phần; thiếu mẫu số thì trả unknown. Không lấp dữ liệu thiếu bằng kcal 500 hoặc macro món cũ khi swap.

**Nghiệm thu:** recipe 1.200 kcal/4 suất cho ra 300 kcal/suất; PER_100G 100 kcal với suất 250g cho ra 250 kcal; macro có giá trị 0 được giữ; thiếu basis/khối lượng cần thiết không được trình bày là số đã xác minh.

### R2-06 · P1 · No-candidate vẫn có thể hiện món mẫu và thông tin giả định

**Bằng chứng:** `RandomFlowScreen::fetchRandom` luôn chuyển sang `detailPage='result'`. Khi không có dish, `currentDishForResult` trả món trong mảng mẫu. `FoodDetailFlowScreen::ResultPage` hiển thị cố định `420 kcal`; màn recipe có ba bước/thời lượng mặc định khi thiếu dữ liệu. Các block quán ăn/review còn chứa tên, giá và khoảng cách tĩnh.

**Cải thiện:** tách trạng thái loading/error/empty/success; chỉ render kết quả có dish thật, không cho chọn món khi thiếu ID. Kcal lấy từ dữ liệu có đơn vị rõ; recipe/quán chưa có dữ liệu hiển thị trạng thái trống. Mẫu thiết kế cần nằm riêng khỏi luồng người dùng thật.

**Nghiệm thu:** API trả `dish:null` không hiện Phở bò hoặc nút chọn món; đổi món bất kỳ không còn mặc định 420 kcal; thông tin nhà hàng không được hiển thị như kết quả tìm kiếm thực.

### R2-07 · P1 · Tổng chi tiêu trộn dự toán và thực tế

**Bằng chứng:** `WeeklyPlanScreen` dùng `Math.max(actualSpentVnd, projectedCostVnd)` để tính còn lại; `EditPlanScreen` dùng tương tự. `completeSlot` chỉ cập nhật actuals, dự toán vẫn là tổng các slot ban đầu.

**Ví dụ:** hai bữa dự toán 50K mỗi bữa, bữa đầu thực trả 80K, bữa sau chưa ăn. Tổng dự kiến cuối kỳ là 130K; công thức hiện tại trả max(80K,100K)=100K.

**Cải thiện:** hiển thị riêng đã chi, dự toán còn lại và dự kiến cuối kỳ. Nếu chính sách là bữa SKIPPED không còn phải chi: `forecast = actual completed + estimate PLANNED`; `remainingCash = budget - actual`; `remainingAfterPlan = budget - forecast`. Xử lý chi phí bữa bỏ nhưng vẫn đã mua nguyên liệu bằng nghiệp vụ riêng.

**Nghiệm thu:** fixture ví dụ trả forecast 130K; complete/skip/swap đều cập nhật đúng các chỉ số và tên nhãn.

### R2-08 · P1 · Luồng “đã ăn” chưa nối tới dashboard dinh dưỡng

**Bằng chứng:** `completeSlot` chỉ ghi `WeeklyPlanSlot` và plan totals, không ghi `MealLog`; `HomeService::getNutritionSummary` và `NutritionService` đọc `MealLog`. `markSelected` nhận DTO có `createMealLog/plannedAt` nhưng không sử dụng. Các hàm mobile `completeSlot/skipSlot/lockSlot` hiện chỉ tìm thấy ở file API wrapper, chưa có caller trong source mobile.

**Cải thiện:** tách rõ “đã chọn”, “đã lên lịch”, “đã ăn”. Chọn một nguồn ghi nhận ăn thực tế; nếu đồng bộ slot sang MealLog, thêm khóa nguồn duy nhất để retry không ghi trùng. Bổ sung thao tác đánh dấu đã ăn/bỏ qua/khóa trên UI.

**Nghiệm thu:** complete một bữa cập nhật đúng dashboard ngày đó đúng một lần; SELECT không tự coi là đã ăn; retry complete không nhân đôi log.

### R2-09 · P2 · Ngày Việt Nam bị lấy bằng ngày UTC

**Bằng chứng:** `EditPlanScreen::getNextStartDate` và WeeklyPlanScreen dùng `toISOString().split('T')[0]` cho “hôm nay”; backend randomization dùng `new Date().getHours()` theo timezone server.

**Ví dụ:** 01:00 ngày 11/09 tại Việt Nam là 18:00 UTC ngày 10/09; mobile có thể gửi startDate của hôm trước. Server chạy UTC có thể suy ra sai bữa.

**Cải thiện:** quy ước date-only theo timezone người dùng (MVP Việt Nam: Asia/Ho_Chi_Minh); instant lưu UTC. Dùng cùng helper cho UI, meal inference và ngày nhật ký; quy định endDate là exclusive.

**Nghiệm thu:** kiểm tra quanh 00:00–07:00, cuối tháng/năm và server TZ khác nhau; ngày bắt đầu và bữa gợi ý không lệch.

### R2-10 · P2 · Cá nhân hóa và lời giải thích không cùng tiêu chí

**Bằng chứng:** `randomization.service.ts::randomize` lấy `goalCodes` chỉ từ DTO, default rỗng, trong khi AI explanation đọc goals từ profile. `budgetMode` được lưu nhưng không resolve ECONOMY_PROFILE/PROFILE_DEFAULT thành khoảng tiền. `buildReason` khẳng định phù hợp mục tiêu nếu có goalCodes, phù hợp bữa nếu có mealSlot, không kiểm tra kết quả sau relaxation. `profileVersion` trong context được tính bằng tuổi của updatedAt thay vì trường version.

**Cải thiện:** resolve effective criteria một lần, có nguồn profile/runtime, dùng chung cho filter, score và giải thích. Chỉ sinh lý do từ các điều kiện thực sự pass, truyền thông tin nới tiêu chí vào phần trình bày. Dùng profileVersion thực, có invalidation khi cập nhật sở thích.

**Nghiệm thu:** không gửi override thì score vẫn dùng mục tiêu hồ sơ; mode ngân sách có hiệu lực; món sau nới meal filter không được khẳng định là khớp bữa ban đầu.

### R2-11 · P2 · Ghi SELECT hai lần và cursor lịch sử không khớp thứ tự

**Bằng chứng:** mobile `RandomFlowScreen::onFinish` gọi cả select endpoint và event SELECT; backend `markSelected` tự tạo SELECT event. `getHistory` lọc `id < cursor` nhưng sort `createdAt desc`; UUID không phản ánh thời gian tạo.

**Cải thiện:** server sở hữu một SELECT nghiệp vụ có idempotency, phân biệt click event nếu cần đo UX. Cursor dùng cặp `(createdAt,id)` và cùng thứ tự trong query.

**Nghiệm thu:** một lần chọn và các retry mạng chỉ tạo một SELECT nghiệp vụ; phân trang hết fixture UUID ngẫu nhiên không mất/trùng record.

### R2-12 · P2 · Lỗi nghiệp vụ bị mất code ở client và refresh chưa đồng nhất

**Bằng chứng:** `GlobalExceptionFilter` gửi `{error:{code}}` cho nhiều lỗi weekly plan nhưng `mobile/src/services/api/client.ts::parseResponse` chỉ đọc `error?.code` trên object chọn từ body/message, không bóc `body.error`. Nhánh proactive refresh có mutex; nhánh reactive 401 gọi `refreshSession` trực tiếp. Proactive catch xóa session cả khi lỗi mạng tạm thời.

**Cải thiện:** chuẩn hóa error envelope và parser; dùng cùng single-flight refresh cho mọi nhánh. Phân biệt token invalid với network error; xử lý đăng nhập lại bằng trạng thái rõ thay vì biến mất session khi mất mạng.

**Nghiệm thu:** SLOT_LOCKED/PLAN_VERSION_CONFLICT hiện đúng thông báo; nhiều request 401 dùng một refresh; offline không xóa phiên còn có khả năng khôi phục.

### R2-13 · P1 · Giới hạn kcal cuối plan chưa thực sự được kiểm tra

**Bằng chứng:** `weekly-plan-generator.service.ts::run` tính `avgDailyKcal`, `lo`, `hi`, nhưng không dùng `lo/hi` để từ chối hoặc điều chỉnh plan. Khi fallback bỏ nutrition filter, các số cuối chỉ được lưu/log. Kiểm tra trung bình tuần, kể cả khi được bổ sung, cũng không phát hiện một ngày quá thấp và ngày khác quá cao bù nhau.

**Cải thiện:** validate tổng kcal từng ngày theo phạm vi bữa được lập kế hoạch, sau đó kiểm tra tổng kỳ. Quy định rõ mức dung sai được chấp nhận và lưu mức đã dùng; thiếu dữ liệu không được đánh đồng với đạt mục tiêu.

**Nghiệm thu:** fixture có hai ngày lệch ngược chiều nhưng trung bình đúng không vượt validator ngày; đáp ứng budget không được tự động coi là đạt kcal.

### R2-14 · P2 · Slot trùng được API chấp nhận và chỉ lỗi lúc tạo dữ liệu

**Bằng chứng:** `UpsertWeeklyPlanConfigDto.enabledSlots` có `IsArray/IsEnum/ArrayMinSize` nhưng không có uniqueness. `getSlotWeights` cộng trọng số của mọi phần tử, còn generator lặp toàn bộ mảng. Payload `[LUNCH,LUNCH]` làm lệch phân bổ và tạo hai slot cùng `(planId,date,mealSlot)`, đụng unique constraint.

**Cải thiện:** bắt lỗi đầu vào với ArrayUnique, giới hạn tối đa 4 slot và derive mealsPerDay từ số slot hợp lệ. Validate cả effective config sau merge, không chỉ field gửi lên.

**Nghiệm thu:** duplicate slot trả lỗi validation ngay ở config API, không lưu config lỗi và không enqueue job.

### R2-15 · P2 · Home recommendations có policy khác random và weekly plan

**Bằng chứng:** `backend/src/home/home.service.ts::getDashboard/getTopRecommendations` chỉ lấy allergen và goals; không đọc hard diet hoặc avoided ingredients. Vì vậy chỉ sửa policy trong random/generator/swap vẫn để một điểm gợi ý cá nhân hóa bỏ qua sở thích bắt buộc.

**Cải thiện:** áp shared eligibility cho các bề mặt được trình bày là gợi ý phù hợp người dùng, bao gồm Home. Catalog khám phá công khai có thể có policy khác nhưng cần nhãn rõ, không tự gắn lời khẳng định phù hợp cá nhân.

**Nghiệm thu:** cùng một profile và món xung đột hard diet bị loại ở Home, random và weekly plan; không chỉ test một endpoint.

## 12. Những quyết định sản phẩm còn chưa hợp lý hoặc chưa được định nghĩa

Các mục sau là đề xuất cần chốt nghiệp vụ, không khẳng định tất cả là bug.

### Ngân sách cho tuần hay cho toàn kỳ 3/5/7/14 ngày?

`EditPlanScreen` ghi “Ngân sách tuần”, nhưng calculator chia `budgetVnd / durationDays`. Chọn 14 ngày nghĩa là cùng số tiền bị chia cho hai tuần. Nên đổi nhãn thành “Ngân sách cho N ngày” hoặc lưu weekly budget và quy đổi minh bạch; luôn hiện tiền/ngày và số bữa được tài trợ.

### Một slot là một món hay một bữa ăn hoàn chỉnh?

`WeeklyPlanSlot` chỉ chứa một dish và mặc định một serving. Với món cơm phần/phở có thể phù hợp; với món canh/món phụ thì một dish không chắc tạo thành bữa. Cần giới hạn catalog của MVP vào món dùng như bữa hoàn chỉnh, hoặc thiết kế meal gồm nhiều dish với khẩu phần. Nếu người dùng chỉ chọn bữa trưa, không mặc định toàn bộ kcal/ngày dồn vào bữa đó trừ khi đó thực sự là ý định được chọn.

### Chi phí tự nấu và ăn ngoài phải có nguồn giá riêng

Giá nguyên liệu mua theo gói, lượng tồn kho và nấu nhiều suất khác với giá một phần ăn ngoài. MVP nên chọn rõ một ngữ cảnh hoặc ghi “ước tính một suất”, nguồn/địa điểm/ngày cập nhật giá. Tăng số khẩu phần phải nhân đúng lượng, chi phí và dinh dưỡng. Chưa nên hứa tiết kiệm tiền thực tế chỉ bằng `priceMin`.

### Tránh lặp nên có mức độ và định nghĩa lịch sử

Generator hiện dùng thời điểm tạo slot trong 7 ngày gần nhất, không lọc trạng thái đã ăn. Plan nháp/đã archive cũng có thể ảnh hưởng. Fallback khi có dưới 3 candidate xóa exclusions, ngay cả khi còn 1–2 món hợp lệ; điều kiện thiếu lựa chọn đang bị đánh đồng với không thể tạo plan.

Nên tách món vừa xem, đã chọn, thực sự đã ăn và đã có trong plan. Cho phép lặp có kiểm soát khi kho món ít, ghi lý do và giới hạn lặp theo món/nguyên liệu chính. Dùng candidate hợp lệ còn lại trước khi nới; không buộc luôn đủ 3.

### Chỉnh kế hoạch cần giữ phần người dùng đã hoàn thành/khóa

UI EditPlanScreen nói “cân đối lại các bữa chưa khóa”, nhưng `handleSave` tạo một plan hoàn toàn mới và không chuyển các slot khóa/đã ăn sang. Cần chọn một trong hai hành vi rõ: chỉnh phần tương lai giữ nguyên lịch sử, hoặc tạo bản kế hoạch mới với thông báo đúng. API và copy giao diện phải cùng một cam kết.

## 13. Tối ưu nên thực hiện ở đâu và đo bằng gì

### Generator: giảm truy vấn lặp, giữ tập dữ liệu nhỏ

**Vị trí:** `WeeklyPlanGeneratorService::run/queryCandidates`. Với 14 ngày × 4 slot, có 56 lượt chọn; mỗi lượt có thể chạy đến 5 lần query candidate trong trường hợp fallback xấu nhất, sau đó 56 lệnh create trong transaction. Đây là số lượt gọi theo code, không phải benchmark latency thực tế.

**Đề xuất:** prefetch candidate metadata theo các slot đang bật trong phạm vi một job, áp hard constraints trước; thay đổi exclusions/scoring trong bộ nhớ. Chỉ tải trường cần cho ranking; dùng bulk insert cho slots khi giữ được tính nguyên tử. Không cache kết quả cá nhân hóa giữa người dùng mà thiếu profile/criteria version.

**Đo:** query count/job, số candidate, thời gian transaction, p50/p95 generation, tỷ lệ tạo được plan hợp lệ. Chỉ thêm index sau khi có EXPLAIN trên DB thử nghiệm; không đề xuất index hàng loạt chỉ từ tên cột.

### Random: tải chi tiết món sau khi đã chọn và tách thời gian chờ AI

**Vị trí:** `randomization.service.ts::fetchCandidates/randomize`. Mỗi lần query có thể tải 500 món kèm ingredients, recipe, media; sau đó `await generateAiExplanation` trước khi lưu history/trả kết quả, trái với comment “không block DB write”. Mobile còn chờ 2,8 giây animation rồi mới gọi API.

**Đề xuất:** ranking query nhẹ, sau khi chọn mới tải chi tiết một món. Cho API chạy cùng animation. Phần giải thích có thời hạn ngắn và fallback rule rõ, hoặc cập nhật riêng sau khi món đã hiện; eligibility không phụ thuộc AI.

**Đo:** payload DB, p95 thời gian chọn món, p95 explanation, tỷ lệ timeout/fallback và số request AI mỗi lần chọn. Chưa cần migrate model để sửa các lỗi dữ liệu/logic này.

### Type safety: ưu tiên sửa mapper và boundary

**Vị trí:** generator, swap, randomization và mobile API DTO. `as any` đang che cả lỗi macro và nutrition object/array. Dùng Prisma payload type và mapper chung, chuyển Decimal sang number tại boundary có chủ ý, giữ null có nghĩa. Không cần refactor toàn bộ giao diện trước khi sửa mapper cốt lõi.

### Thuật toán: đo chất lượng trước khi tăng độ phức tạp

Tạo bộ dữ liệu thử có ngân sách thấp, catalog ít món, nhiều ràng buộc, giá null, món trùng nguyên liệu và nhiều nutrition basis. So sánh tỷ lệ plan hợp lệ, độ lặp và thời gian chạy giữa greedy cải tiến và bounded search. Seed phục vụ tái hiện; không làm tính ngẫu nhiên trở thành cùng một món cho mọi người. Không áp machine learning hoặc A/B test trước khi event SELECT hết ghi trùng.

## 14. Bổ sung backlog và nghiệm thu theo thứ tự phụ thuộc

1. **Data correctness:** R2-05 và R2-06 — thống nhất khẩu phần/macro, loại thông tin mẫu khỏi kết quả thật. Test fixture dữ liệu null/zero/basis khác nhau.
2. **Plan consistency:** R2-01, R2-02, R2-03 — snapshot bất biến, conditional update và state transitions. Dùng integration test với PostgreSQL biệt lập cho race; mock Prisma đơn thuần không chứng minh atomicity.
3. **Job lifecycle:** R2-04 — enqueue failure, worker retry/terminal failure, theo dõi planId trên UI. Test job lỗi trước transaction, sau commit và sau khi plan bị archive.
4. **Tracking:** R2-07, R2-08 — công thức forecast, đánh dấu đã ăn, liên kết MealLog idempotent. Test chênh lệch dự toán/thực chi và bỏ bữa cuối.
5. **Contracts:** R2-09 đến R2-12 — timezone, effective criteria, event/cursor, error/refresh. Test UTC khác Việt Nam và request đồng thời.
6. **Performance:** đo baseline rồi thực hiện mục 13; kiểm tra kết quả hợp lệ không đổi ngoài thay đổi thuật toán được phê duyệt trong nghiệp vụ.

Các ticket này bổ sung cho 14 ticket ở mục 9; có thể gộp R2-05 vào PLAN-003/mapper và R2-04 vào RELIABILITY-001 để tránh làm hai lần. Ưu tiên hoàn thành một lát cắt end-to-end: chọn tiêu chí → plan đúng → đổi món đúng → ghi đã ăn → số tiền/dinh dưỡng đúng, trước khi mở rộng cộng đồng hoặc nội dung khám phá.

R2-13 gộp vào PLAN-001/final validation; R2-14 vào validation config; R2-15 mở rộng SAFETY-001 sang Home. Tổng cộng lần đối chiếu bổ sung ghi nhận 15 nhóm vấn đề có vị trí code và tiêu chí kiểm tra.

## 15. Quy tắc nghiệp vụ đề xuất để triển khai nhất quán

Phần này là phương án đề xuất từ review, không mô tả hành vi đã có và không thay thế quyết định của chủ sản phẩm.

### BR-01 — Phạm vi dự toán

Ngân sách nhập vào áp dụng cho toàn bộ số ngày và bữa được chọn, một người/một khẩu phần mặc định trong MVP. Giao diện ghi rõ “Ngân sách cho N ngày, M bữa”. Khi đổi số ngày, giữ nguyên tổng tiền và cập nhật tiền/ngày để người dùng thấy tác động; không tự tăng số tiền.

Giá dự toán phải có quy tắc thống nhất và nguồn rõ. Điều kiện READY bảo đảm tổng **dự toán** không vượt ngân sách; không hứa giá thanh toán thực tế sẽ luôn bằng dự toán. Chi tiêu thực tế vượt mức vẫn phải được ghi nhận đúng, sau đó cảnh báo và đề xuất cân đối phần còn lại.

### BR-02 — Cấu hình và dữ liệu thiếu

Chỉ một nguồn thật cho số bữa: danh sách slot duy nhất. PROFILE kcal lấy từ hồ sơ và hiển thị giá trị hiệu lực; thiếu mục tiêu hồ sơ phải hiển thị rằng đang dùng giá trị mặc định/chưa đặt. Không trình bày một con số mặc định là cá nhân hóa đã tính toán.

Giá, kcal và allergen thiếu phải được phân biệt với 0 hoặc “không có”. Chỉ đưa món vào kế hoạch có ràng buộc khi đủ dữ liệu để xác minh ràng buộc đó; trả thiếu dữ liệu có nguyên nhân khi không thể tạo.

### BR-03 — Không tìm đủ món

Trước tiên dùng 1–2 ứng viên hợp lệ nếu còn; số lượng ít không phải lý do bỏ ràng buộc. Tránh lặp là ưu tiên có thể nới theo policy công khai. Thay đổi ngân sách hoặc hard diet không được thực hiện ngầm. Kết quả thiếu ứng viên nên cho biết bữa nào thiếu, tiêu chí nào gây thiếu và lựa chọn điều chỉnh có thể áp dụng; không tự khẳng định tăng ngân sách sẽ giải quyết nếu chưa kiểm tra.

### BR-04 — Kế hoạch đang dùng và bản mới

Cho phép tạo bản nháp mới trong khi giữ ACTIVE hiện tại. Người dùng nhìn thấy bản vừa yêu cầu bằng planId riêng. Chỉ đổi bản đang dùng sau khi bản mới READY và người dùng chọn chuyển; lịch sử đã ăn không bị ghi lại thành bữa tương lai.

Chỉnh phần tương lai phải giữ slot đã hoàn thành và slot khóa, hoặc báo không thể thỏa cấu hình mới với các slot đó. Không tự mở khóa để tối ưu. Quy tắc sửa READY/ACTIVE/ARCHIVED cần áp ở server, không chỉ disable nút mobile.

### BR-05 — Đã chọn khác đã ăn

SELECT ghi nhận ý định. COMPLETE ghi nhận ăn thực tế và là nguồn của chi tiêu/dinh dưỡng đã tiêu thụ. Nếu người dùng không nhập tiền/kcal thực tế, có thể dùng estimate nhưng lưu thêm nguồn `ESTIMATED` để phân biệt với `USER_ENTERED`.

SKIP không tạo consumption log. Nếu đã tốn tiền mua nguyên liệu nhưng không ăn, khoản đó cần được ghi bằng nghiệp vụ chi tiêu riêng hoặc được làm rõ ngoài phạm vi MVP; không suy ra mọi bữa bỏ qua có chi phí bằng 0 trong thực tế.

## 16. Kịch bản nghiệm thu ưu tiên

Các kịch bản dưới đây là test cần triển khai, chưa phải test đã chạy thành công. Fixture nên dùng dữ liệu nhân tạo và DB riêng, không sửa dữ liệu người dùng đang dùng.

### AC-01 — Luồng chính với ngân sách khả thi

**Cho trước:** 7 ngày, 3 slot/ngày, đủ món có giá và nutrition theo một suất, budget đủ, profile có hard constraints.

**Thực hiện:** tạo → theo dõi planId → xem READY → bắt đầu → đổi một món → đánh dấu đã ăn.

**Đạt khi:** đúng 21 slot duy nhất; không món vi phạm; dự toán nằm trong budget; summary thay đổi đúng sau swap; MealLog và actuals cập nhật một lần sau complete.

### AC-02 — Không thể thỏa ngân sách

**Cho trước:** tổng chi phí tối thiểu của các bữa bắt buộc lớn hơn budget.

**Thực hiện:** tạo kế hoạch.

**Đạt khi:** không trả READY sai; trả nguyên nhân cụ thể và đề xuất có căn cứ. Không nới dị ứng/chế độ ăn và không chèn món 0đ để lấp chỗ trống.

### AC-03 — Có ít món nhưng vẫn hợp lệ

**Cho trước:** một loại bữa chỉ có 1–2 món đủ điều kiện.

**Đạt khi:** dùng các món đó theo quy tắc lặp; không chuyển sang query bỏ toàn bộ filter chỉ vì ít hơn MIN_CANDIDATES.

### AC-04 — Dữ liệu dinh dưỡng khác đơn vị

**Cho trước:** một món PER_SERVING, một PER_100G có servingG, một WHOLE_RECIPE có số suất, một món thiếu mẫu số chuyển đổi.

**Đạt khi:** ba món đủ dữ liệu được tính trên cùng khẩu phần; món thiếu dữ liệu không hiển thị kcal giả định. Macro 0 giữ nguyên, null không bị thay bằng macro của món cũ.

### AC-05 — Chỉnh cấu hình trong khi job chờ

**Thực hiện:** enqueue 7 ngày/500K → đổi config sang 14 ngày/1 triệu → chạy job đầu.

**Đạt khi:** job đầu vẫn dùng snapshot 7 ngày/500K, endDate/số slot/target đồng nhất; config mới chỉ ảnh hưởng lần yêu cầu mới.

### AC-06 — Hai thiết bị đổi cùng một bữa

**Thực hiện:** gửi hai swap cùng slot/version đồng thời, sau đó hai swap khác slot cùng plan.

**Đạt khi:** cặp đầu chỉ một request thành công, request còn lại nhận conflict; cặp sau không làm mất cập nhật total. Audit phản ánh đúng thứ tự thay đổi được commit.

### AC-07 — Lỗi và hủy job

**Thực hiện:** giả lập enqueue lỗi, query worker lỗi, worker nhận lại job sau commit, archive khi worker đang chạy.

**Đạt khi:** không mắc GENERATING vô hạn; retry sau commit không phá READY; archive không bị ghi đè bởi kết quả đến muộn; UI hiển thị trạng thái của đúng planId.

### AC-08 — Hoàn thành/bỏ qua bữa cuối

**Thực hiện:** lần lượt thử complete và skip ở slot cuối cùng; thử sửa slot của plan archive.

**Đạt khi:** ACTIVE thành COMPLETED ở cả hai trường hợp cuối; không sửa được trạng thái không hợp lệ; actuals chỉ đếm bữa đã ăn.

### AC-09 — Kết quả rỗng và thông tin giao diện

**Thực hiện:** API trả dish:null, network error, món không có ảnh, món không có recipe, món có kcal khác 420.

**Đạt khi:** error/empty không hiện món mẫu để chọn; ảnh thiếu dùng placeholder trung tính; thiếu recipe không sinh thời lượng nấu mẫu; kcal hiển thị từ dữ liệu món thực.

### AC-10 — Lịch sử và phiên đăng nhập

**Thực hiện:** SELECT có retry mạng, phân trang dataset UUID không theo thời gian, nhiều request hết token và mất mạng tạm thời.

**Đạt khi:** không nhân đôi SELECT; lịch sử không mất/trùng phần tử; refresh chỉ chạy một lần cho một đợt; mã lỗi nghiệp vụ còn nguyên tới UI.

## 17. Giới hạn và bước kiểm chứng sau tài liệu

- Chưa kiểm tra trực tiếp UI trên Android/iOS; nhận định về UI dựa trên component và callback trong source.
- Chưa chạy database migration, truy vấn production, EXPLAIN hoặc stress test; chưa khẳng định mức độ phổ biến của dữ liệu thiếu giá/nutrition/allergen.
- Chưa audit toàn bộ auth, admin, import, media và cộng đồng. Những module này chỉ được đọc khi liên quan trực tiếp tới luồng đang review; tài liệu không phải chứng nhận toàn bộ hệ thống.
- Kết quả TypeScript pass không thay thế các AC ở mục 16. Kiểm tra admin bổ sung đã chạy `tsc --noEmit -p tsconfig.app.json` và `tsc --noEmit -p tsconfig.node.json`, cả hai exit 0.
- Khi bắt đầu sửa, nên lấy baseline dữ liệu thử, viết regression test cho lỗi xác nhận, rồi sửa theo các nhóm phụ thuộc ở mục 14. Mỗi ticket ghi rõ finding liên quan, test đã chạy và phần chưa kiểm chứng; chỉ đóng khi hành vi end-to-end đạt yêu cầu.
