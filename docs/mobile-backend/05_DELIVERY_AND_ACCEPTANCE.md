# Lộ trình triển khai và tiêu chí nghiệm thu

## 1. Mục tiêu phát hành

Một release được coi là hoàn thiện khi:

- Mọi nút có ý nghĩa nghiệp vụ trên mobile gọi API thật hoặc được ẩn/đánh dấu chưa khả dụng.
- Không còn số liệu mẫu trên Home, Health, Profile, Food detail, location và history.
- Random/weekly không vi phạm hard constraints và không vượt hard budget theo policy.
- Dữ liệu dinh dưỡng/giá có basis, provenance, confidence và thời điểm.
- Action retry không tạo dữ liệu trùng; concurrent edit không làm mất cập nhật.
- OpenAPI, SDK types, backend implementation và mobile integration cùng một contract.

## 2. P0 — sửa nền tảng và an toàn trước khi mở rộng

### P0.1 Chuẩn hóa contract/API client

Thực hiện:

- Một success/error envelope; `error.code` ổn định.
- Một cursor format; một saved-dish route.
- `If-Match` cho versioned resource; `Idempotency-Key` cho write/job.
- Client refresh single-flight: chỉ một refresh đang chạy, request khác chờ; chỉ logout khi refresh token thực sự bị từ chối, không xóa session do network timeout.
- Sinh mobile types từ OpenAPI hoặc contract package; bỏ `Record<string, unknown>` ở profile write.

Nghiệm thu:

- Contract test cho 2xx/4xx/409/422/429/503.
- Hai request 401 đồng thời chỉ tạo một refresh.
- Body lỗi `{ error: { code } }` hiển thị message đúng.
- Cursor không skip/duplicate khi nhiều row cùng timestamp.

### P0.2 Khóa lỗ hổng random/weekly

Thực hiện toàn bộ finding P0 trong review trước:

- Dùng profile/config snapshot thật.
- Hard allergy/diet/avoid là AND exclusions và không fallback bỏ constraint.
- Sửa mapping `proteinG/carbsG/fatG`.
- Price unknown không là 0; budget được enforce.
- Match score denominator đúng và reason dựa trên evidence.
- Retry kế thừa request snapshot.
- Weekly state/version update nguyên tử; worker không hồi sinh archived/cancelled plan.
- Transactional outbox cho generation; idempotency cho select/swap/complete.
- Mobile poll theo `planId`, xử lý FAILED/NO_CANDIDATE thật.

Nghiệm thu:

- Bộ property/infeasible/concurrency test ở tài liệu thuật toán chạy trong CI.
- Không code path nào trả “any published dish” sau khi hard filter rỗng.
- Không sample dish khi API lỗi.
- Plan vượt budget/hard safety không thể chuyển READY/ACTIVE.

### P0.3 Xóa dữ liệu mẫu có thể gây hiểu nhầm

- Health/Profile trả skeleton/no-data cho tới khi API có thật.
- Burned calories, calorie/macro, steps, water, streak, badge, monthly counts không hard-code.
- Food detail không dùng kcal/ingredient/restaurant mẫu khi ID không hợp lệ.
- Explore detail bắt buộc truyền resource ID.

Nghiệm thu bằng E2E:

- User mới không có log thấy trạng thái chưa có dữ liệu.
- Mở hai dish/article/post khác nhau cho đúng ID và dữ liệu khác nhau.
- Network offline không hiển thị sample như dữ liệu server.

## 3. P1 — Health và Profile hoàn chỉnh

### P1.1 Meal log vertical slice

Thứ tự:

1. Migration MealLog/MealLogItem mới và food lookup.
2. Create/list/detail/edit/delete.
3. Nutrition snapshot + day aggregate.
4. Health day BFF, calendar và diary dùng chung domain.
5. Complete weekly slot → optional meal log, unique link.
6. Random choose → confirm meal/log flow.

Nghiệm thu:

- Add nhiều item/quantity cho ra totals đúng theo snapshot.
- Sửa/xóa cập nhật Health/Home/Diary cùng kết quả sau invalidation.
- Dish được admin sửa không làm meal log cũ thay đổi.
- Complete cùng slot hai lần chỉ có một meal log.
- localDate đúng cho thời điểm gần nửa đêm ở timezone user.

### P1.2 Water, measurement, target

- Water entry CRUD và aggregate.
- Measurement history; profile hiển thị latest.
- BMI có method/disclaimer/eligibility.
- Health target versioned, phân biệt system estimate/user/professional.

Nghiệm thu:

- `+250 ml` retry không cộng hai lần.
- Xóa entry giảm đúng tổng ngày.
- Thiếu input trả target null/review required, không fallback số mẫu.
- Người dưới 18 hoặc trạng thái ngoại lệ không nhận adult weight-loss target tự động.

### P1.3 Settings/privacy/session

- Settings GET/PATCH.
- List/revoke session, password change/reset.
- Export job, clear history/health, account deletion grace period.
- Avatar/media pipeline.

Nghiệm thu:

- User A không đọc/revoke/export object của user B.
- Revoke session làm refresh token đó hết hiệu lực.
- Export chỉ tải được qua signed URL ngắn hạn sau re-auth.
- Delete/clear có audit và UI báo trạng thái async rõ.
- Avatar chưa scan/moderate không public.

## 4. P1 — Explore, community và notification

### P1.4 Detail và saved state

- Dish default nutrition/basis, recipe, ingredient/allergen, price/provenance.
- Article bookmark nếu giữ UI.
- Post detail/comments/reply/follow/save.
- Like/save APIs idempotent, không toggle.

Nghiệm thu:

- Retry `PUT like/save` không đảo trạng thái.
- Counter cuối khớp relation sau job reconcile.
- Content bị ẩn/xóa không còn trên public feed và deep link xử lý 404 hợp lệ.
- Nutrition serving selector tính đúng PER_100G/PER_SERVING/WHOLE_RECIPE.

### P1.5 Push notification

- Installation token register/unregister.
- Preference/consent gate.
- Outbox → push ticket → receipt.
- Deep-link allowlist.

Nghiệm thu:

- Token `DeviceNotRegistered` bị invalidate.
- Notification disabled không gửi push nhưng in-app record tùy policy vẫn đúng.
- Duplicate worker delivery không tạo hai notification cùng event.

## 5. P2 — Data/optimizer nâng cao và tích hợp ngoài

### P2.1 Nutrition data pipeline

- Xác minh quyền dùng Vietnamese Food Composition Table 2017.
- Tạo raw import, nutrient mapping, matching review và version.
- Đồng bộ USDA/ASEAN theo nhu cầu, không trộn nguồn không provenance.
- Recipe yield/retention calculation và quality dashboard.

Nghiệm thu:

- Mỗi default DishNutrition truy ngược được ingredient/source/formula.
- Import source version mới không ghi đè im lặng bản đã dùng trong snapshot.
- Admin thấy missing mapping, conflict, outlier, energy discrepancy.
- AI_ESTIMATED không được publish mặc định nếu chưa review.

### P2.2 CP-SAT weekly optimizer

- Xây candidate matrix một lần, không N query/slot.
- Solver hard constraints/objective/relaxation trace.
- Replay test theo snapshot/version/seed.
- Benchmark 3/5/7/14 ngày và candidate volume thực tế.

Nghiệm thu:

- P95 generation dưới mục tiêu đã chốt hoặc chuyển async/push hợp lý.
- Mọi plan có solver trace không chứa PII.
- Không feasible trả 422/actionable reason, không fallback unsafe.
- Regenerate giữ locked/completed slots.

### P2.3 Camera recognition

- Private presigned upload, scan, recognition job, candidate review, retention purge.
- User xác nhận món/portion trước log.

Nghiệm thu:

- Confidence thấp không auto-select.
- Job timeout/error retry an toàn.
- Ảnh hết retention bị purge và URL không còn dùng được.
- Recognition của user A không thể đọc bởi user B.

### P2.4 Health Connect/HealthKit

- Permission UI local, aggregate sync, dedupe, revoke.
- Provider-specific adapter và source metadata.

Nghiệm thu:

- Cùng steps từ nhiều source không bị cộng đôi.
- Sync cùng bucket nhiều lần là upsert.
- Thu hồi quyền không làm mất dữ liệu lịch sử trái policy nhưng dừng sync mới.

### P2.5 Nearby places

- Chọn provider sau khi duyệt giá/terms/license.
- PostGIS geospatial cache/reference, attribution và TTL.
- Chỉ directions deep-link local.

Nghiệm thu:

- Distance test bằng tọa độ chuẩn.
- Attribution hiện đầy đủ.
- Dữ liệu hết TTL được refresh/đánh dấu stale.
- Không claim menu/dish availability khi provider không có bằng chứng.

## 6. Cấu trúc module backend đề xuất

Giữ NestJS module hiện có và bổ sung theo bounded context:

```text
backend/src/
  auth/
  profiles/
  settings/
  dishes/
  nutrition-data/
  meal-logs/
  health/
  activity-sync/
  randomization/
  weekly-plans/
  content/
  community/
  notifications/
  media/
  recognitions/
  places/
  jobs/
  common/
    idempotency/
    outbox/
    pagination/
    errors/
```

Không bắt buộc đổi tên module đang có ngay. Mục tiêu là tránh đặt logic meal log vào `nutrition` controller hoặc settings vào profile JSON không kiểm soát.

## 7. OpenAPI và contract workflow

1. DTO dùng class-validator + Swagger schema đầy đủ; enum/code không dùng free string.
2. CI export `openapi.json` từ app test bootstrap.
3. Lint OpenAPI: operationId unique, auth rõ, error schemas, cursor/header.
4. Generate client types; không viết types mobile trùng tay.
5. Consumer contract test chạy trên BE PR.
6. Breaking change cần `/v2` hoặc deprecation window + telemetry.

Mỗi endpoint phải có:

- Purpose và owner/role.
- Request headers/path/query/body.
- Success response và mọi error code nghiệp vụ.
- Idempotency/version behavior.
- Side effects/outbox/cache invalidation.
- Rate-limit class.
- Audit/PII classification.

## 8. Kiểm thử

### Unit

- Formula nutrition, price range/confidence, match score, forecast, streak/timezone.
- DTO validation và state machine.
- Permission policy và error mapping.

### Integration với PostgreSQL thật

- Constraints, partial/composite indexes, transaction rollback.
- Optimistic update, ownership predicate, cursor pagination.
- Outbox/idempotency/job retry.
- Không thay SQLite/mock cho hành vi Postgres-specific.

### Contract

- OpenAPI response validate cho success/error.
- Mobile generated type compile.
- Snapshot contract chỉ dùng để phát hiện change, không thay semantic assertion.

### E2E mobile–BE

- Auth/onboarding resume.
- Explore card → đúng detail ID.
- Random → retry → select → optional meal log.
- Weekly generate async → start → lock/swap/complete → Home/Health update.
- Health log/edit/delete/water/calendar.
- Profile settings/privacy/session/export/delete.
- Offline/retry/401/concurrent edit.

### Security

- Ma trận hai user cho mọi `:id`.
- Mass assignment/unknown property rejection.
- Rate limit/brute force/reset enumeration.
- Upload MIME spoof/oversize/malware path.
- Deep-link injection, stored content sanitization.
- Sensitive log/trace scan.

## 9. SLO và observability ban đầu

Mục tiêu cần đo lại bằng load test, baseline đề xuất:

- Read DB/BFF không provider: p95 < 400 ms, p99 < 1 s.
- Search/explore: p95 < 700 ms.
- Random sync không AI: p95 < 1.5 s.
- Weekly generate/recognition/export: async; create job p95 < 500 ms, progress nhìn thấy trong 2 s.
- Availability API chính: 99.9% theo tháng sau khi production ổn định.
- Error rate 5xx < 0.5%; theo dõi riêng provider timeout.

Metrics/traces:

- Latency/error/cache hit theo operationId.
- Random candidate count, no-candidate rate, relaxation tier, selection rate.
- Weekly feasible rate, solver duration, budget/safety violations phải bằng 0.
- Nutrition coverage/quality grade, stale price ratio.
- Meal log write/idempotency conflict, health sync dedupe.
- Queue lag/job age/outbox unpublished count.
- Push ticket/receipt failures và invalid token.

Không gắn raw birthday, exact health values, precise location, content hoặc token vào metric labels.

## 10. Definition of Done cho từng API

Một endpoint chưa “done” nếu chỉ trả được happy path. DoD:

- DTO/OpenAPI/generated type hoàn chỉnh.
- Auth + object ownership + field allowlist.
- Validation unit/date/money/timezone.
- Success/error/idempotency/version documented và tested.
- Transaction/outbox/cache invalidation đúng.
- Audit/PII/retention đã phân loại.
- Unit + integration + consumer contract test.
- Mobile có loading/empty/error/retry/offline state.
- Dashboard/alert/log correlation theo requestId.
- Không TODO fallback/sample data trong production path.

## 11. Danh sách quyết định sản phẩm cần khóa trước P1

Các câu hỏi này không chặn P0, nhưng cần quyết định có version:

- Mogu phục vụ tối thiểu bao nhiêu tuổi; có hỗ trợ thai/cho con bú/bệnh nền không.
- Budget là hard cap hay có thể vượt sau khi user xác nhận; risk level dùng expected hay high price.
- Weekly plan là full-day hay partial slots; energy share từng slot.
- “Một ngày hợp lệ” cho streak là gì.
- Dữ liệu community/profile mặc định private/public và độ sâu reply.
- Có giữ social login, article/post bookmark, cooking sync, camera và places trong MVP không.
- Provider weather/place/push/health và policy/chi phí.
- Retention cho ảnh recognition, health log, analytics, export và backup.
- Ai có quyền review nutrition/allergen; tiêu chuẩn nào để publish.

Ghi quyết định vào config/policy version, không hard-code trong nhiều service.

## 12. Checklist bàn giao cho đội BE

- Đọc bộ tài liệu này và review logic hiện tại trong `PROJECT_REVIEW_RANDOM_MEAL_WEEKLY_BUDGET.md`.
- Tạo issue theo từng P0/P1/P2, mỗi issue gắn screen + endpoint + model + acceptance criteria.
- Chốt schema/error/cursor/idempotency trước khi viết thêm service.
- Viết migrations reversible, backup và rehearsal trên staging data.
- Dựng test fixtures có provenance; không dùng sample UI làm ground truth.
- Triển khai feature flag theo vertical slice, quan sát metrics rồi mới bỏ route legacy.

