# Thuật toán, công thức và nguồn dữ liệu

## 1. Phân loại mức độ tin cậy

Mọi con số hiển thị cần phân biệt:

- **Measured/verified**: nguồn phân tích hoặc dữ liệu chính thức đã review, mô tả đúng food state và basis.
- **Calculated**: tính từ thành phần đã match, lượng gram, yield và retention.
- **Estimated**: suy ra từ range/heuristic/AI; luôn có confidence và cảnh báo.
- **User-declared**: người dùng tự nhập; chỉ dùng cho họ.
- **Unknown**: thiếu dữ liệu; trả `null`, không thay bằng 0 hay món mẫu.

AI không được nâng dữ liệu `estimated` thành `verified`. Câu giải thích từ AI phải được dựng từ evidence có cấu trúc và không được tự khẳng định “không gây dị ứng”.

## 2. Nguồn dữ liệu dinh dưỡng

### Thứ tự ưu tiên cho Mogu

1. **Bảng thành phần thực phẩm Việt Nam 2017** cho nguyên liệu/món địa phương khi có quyền sử dụng, bản dữ liệu và metadata rõ. FAO/INFOODS liệt kê bản 2007, 2013 và 2017 trong thư mục quốc tế, nhưng cũng nói rõ việc được liệt kê không đồng nghĩa được FAO chứng thực. Vì vậy phải xác minh license, publisher, version và từng field trước khi import: [FAO/INFOODS directory](https://www.fao.org/food-composition/tables-and-databases/16/en).
2. **Vietnam/ASEAN food composition** cho thực phẩm khu vực còn thiếu, qua quy trình matching/review. Trang quốc gia và thư mục của INFOODS là điểm tra cứu, không tự cấp license dữ liệu: [INFOODS Vietnam](https://www.fao.org/infoods/infoods/tables-and-databases/vietnam/en/) và [INFOODS tables and databases](https://www.fao.org/infoods/infoods/tables-and-databases/en/).
3. **USDA FoodData Central Foundation/FNDDS** để bổ sung nguyên liệu và portion reference. Foundation Foods có metadata mẫu/phân tích và giá trị thường theo 100 g edible portion; các data type có cách mô tả portion khác nhau: [Foundation Foods documentation](https://fdc.nal.usda.gov/Foundation_Foods_Documentation/).
4. **Branded data** chỉ dùng cho sản phẩm đóng gói/nhãn cụ thể, không dùng thay món Việt nấu tại quán. Provider của branded data chịu trách nhiệm nội dung nhãn, nên quality flag khác nguồn phân tích: [USDA Global Branded Foods documentation](https://fdc.nal.usda.gov/GBFPD_Documentation/).
5. Nguồn admin/manual đã kiểm chứng. AI estimate chỉ là hàng chờ review, không publish làm nguồn mặc định.

FoodData Central cho phép search và detail qua API, cần data.gov API key và phải giữ key phía server: [USDA FDC API guide](https://fdc.nal.usda.gov/api-guide/). Nếu đồng bộ bulk, lưu release/version/checksum; USDA cung cấp JSON/CSV và release date: [FDC downloadable data](https://fdc.nal.usda.gov/download-datasets/).

### Quy trình nhập và matching

1. Ingest raw bất biến: source, version, external ID, checksum, license.
2. Map nutrient name/ID sang internal nutrient code và INFOODS tag; không map chỉ bằng chuỗi hiển thị.
3. Chuẩn hóa unit về canonical unit nhưng giữ raw unit/value.
4. Match đúng species/product, raw/cooked state, edible portion, fortified state và preparation.
5. Chấm quality/coverage bằng rule có version; người review duyệt link Ingredient–FoodReference.
6. Chạy validation range, energy cross-check, duplicate và missing sentinel.
7. Chỉ record APPROVED mới tham gia dish calculation/random/weekly production.

FAO/INFOODS khuyến nghị đánh giá chất lượng bảng thành phần thay vì chỉ chọn vì có sẵn; dùng framework/data-quality guidance làm checklist: [FAO/INFOODS data quality](https://www.fao.org/infoods/infoods/standards-guidelines/data-quality/en/).

## 3. Chuẩn hóa khẩu phần và dinh dưỡng

### 3.1 Từ per 100 g sang khẩu phần

Với nutrient `n100` trên 100 g edible portion và khẩu phần `g` gram:

```text
nutrientServing = n100 × g / 100
```

Nếu lượng nhập gồm phần không ăn được và nguồn có edible portion factor `e` trong `[0,1]`:

```text
edibleGram = purchasedGram × e
nutrient = n100 × edibleGram / 100
```

Không đổi “1 bát”, “1 miếng”, “1 thìa” sang gram nếu chưa có portion conversion đúng với food reference đó. Portion của các data type USDA không đồng nhất, nên conversion phải có source riêng.

### 3.2 Công thức món từ nguyên liệu

Với nguyên liệu `i`, lượng edible raw gram `g_i`, giá trị nutrient per 100 g `n_i` và retention factor `r_i`:

```text
retainedNutrientRecipe = Σ (g_i / 100 × n_i × r_i)
nutrientPerServing = retainedNutrientRecipe / servings
nutrientPer100gCooked = retainedNutrientRecipe / cookedYieldGram × 100
```

Yield xử lý thay đổi khối lượng do mất/hấp thụ nước/mỡ; retention xử lý phần nutrient còn lại. USDA nêu rõ khi ước lượng đồ nấu từ đồ sống phải xét cả yield và retention: [USDA procedures for estimating nutrient values](https://www.ars.usda.gov/ARSUserFiles/80400525/Articles/jfca10_102-114.pdf) và [USDA nutrient retention factors](https://www.ars.usda.gov/northeast-area/beltsville-md-bhnrc/beltsville-human-nutrition-research-center/methods-and-application-of-food-composition-laboratory/mafcl-site-pages/nutrient-retention-factors/).

Quy tắc:

- Nếu nguồn đã là cooked form đúng phương pháp, dùng trực tiếp, không áp retention lần hai.
- Nếu thiếu cooked yield, nutrition là PARTIAL/ESTIMATED; không giả định yield = 100% mà không gắn cờ.
- Salt/sauce/oil dùng lượng thực sự vào món và phần bị loại/drain nếu có.
- Servings phải lớn hơn 0; servingSizeG × servings nên gần cookedYieldGram trong tolerance có cấu hình.

### 3.3 Kiểm tra năng lượng

Cross-check bằng modified Atwater như một validation, không ghi đè nguồn đã duyệt:

```text
estimatedKcal = 4 × proteinG
              + 9 × fatG
              + 4 × availableCarbsG
              + 2 × fibreG
              + 7 × alcoholG
```

FAO dùng các hệ số này cho nutrient conversion table: [FAO technical notes](https://files-faostat.fao.org/production/HCES/Technical%20notes.pdf). Với Mogu không theo dõi alcohol/fibre đầy đủ, bản rút gọn `4P + 4C + 9F` chỉ là kiểm tra gần đúng.

Đặt warning nếu chênh tuyệt đối và tương đối cùng vượt ngưỡng cấu hình, ví dụ `>100 kcal` và `>20%`. Không tự sửa vì nguồn có thể dùng specific Atwater factors hoặc định nghĩa carbohydrate khác.

### 3.4 Coverage và confidence

```text
coverage = Σ requiredWeight_n × present_n / Σ requiredWeight_n
```

Ví dụ use case macro đặt trọng số calories/protein/carbs/fat cao; safety không dùng coverage này mà yêu cầu ingredient/allergen mapping riêng.

Confidence đề xuất, phải version hóa:

```text
confidence = sourceQuality
           × matchConfidence
           × basisCompleteness
           × freshnessFactor
```

Mỗi thành phần `[0,1]`, không cho AI tự đưa ra. Lưu cả breakdown để audit.

## 4. BMI, năng lượng và macro target

### 4.1 BMI

```text
heightM = heightCm / 100
BMI = weightKg / heightM²
```

CDC mô tả BMI là phép sàng lọc chứ không phải chẩn đoán; ngưỡng người lớn áp dụng từ 20 tuổi, trẻ 2–19 tuổi cần percentile theo tuổi/giới: [CDC adult BMI](https://www.cdc.gov/bmi/adult-calculator/index.html) và [CDC BMI calculation](https://www.cdc.gov/growth-chart-training/hcp/using-bmi/calculating-bmi.html).

API trả raw BMI làm tròn 1 chữ số, method/version và disclaimer. Không gắn nhãn người lớn cho trẻ, thai kỳ hoặc bối cảnh không phù hợp.

### 4.2 Resting energy estimate

Nếu sản phẩm chọn Mifflin–St Jeor cho người trưởng thành:

```text
REE_male   = 10 × weightKg + 6.25 × heightCm - 5 × ageYears + 5
REE_female = 10 × weightKg + 6.25 × heightCm - 5 × ageYears - 161
```

Đây là bản làm tròn của phương trình dự báo resting energy, không phải nhu cầu năng lượng chính xác hay TDEE. Nghiên cứu gốc xây từ người trưởng thành khỏe mạnh và có sai số cá nhân: [Mifflin et al., PubMed](https://pubmed.ncbi.nlm.nih.gov/2305711/).

```text
estimatedTDEE = REE × activityFactor
```

`activityFactor` là policy/config của sản phẩm, không ghi cứng rải rác trong code. Response phải cho biết factor nào dùng. Không tự tạo calorie deficit/aggressive target. Công cụ NIDDK Body Weight Planner chỉ dành cho người từ 18 tuổi và loại trừ thai/cho con bú; điều đó củng cố việc phải có eligibility gate: [NIDDK Body Weight Planner](https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner).

Khi thiếu age/sex/height/weight/activity hoặc user thuộc nhóm cần chuyên môn:

- Trả `requiresProfessionalReview=true`.
- Cho phép target do user/professional đặt trong phạm vi sản phẩm an toàn.
- Không fallback im lặng về 2.000 kcal hay 800 kcal.

### 4.3 Macro target

Nếu target năng lượng `K` và tỷ lệ năng lượng protein/carbs/fat lần lượt `p,c,f`:

```text
proteinTargetG = K × p / 4
carbTargetG    = K × c / 4
fatTargetG     = K × f / 9
```

Tỷ lệ phải có tổng hợp lệ, method và audience. WHO 2026 nêu nguyên tắc adequacy/balance/moderation/diversity và khoảng chung cho phần lớn người: carbohydrate khoảng 45–75% năng lượng, fat ở người lớn tối thiểu 15% và thường giới hạn khoảng 30%, protein thường 10–15%; nhu cầu thực tế thay đổi theo tuổi, tình trạng và hoạt động: [WHO Healthy diet](https://www.who.int/news-room/fact-sheets/detail/healthy-diet).

Không dùng một macro split duy nhất cho mọi goal. Cấu hình target phải được chuyên gia sản phẩm review và version hóa; UI chỉ diễn giải “ước tính”.

## 5. Ước lượng giá món

### 5.1 Chuẩn hóa observation

- Chỉ nhận VND, serving tương đương và khu vực/thời gian rõ.
- Loại invalid/duplicate; không xem price null là 0.
- Trọng số observation:

```text
w_i = sourceQuality_i × geoSimilarity_i × exp(-ageDays_i / halfLifeDays)
```

`halfLifeDays` khác nhau cho menu quán và chi phí nấu. Đây là thiết kế sản phẩm, không phải giá thị trường chính thức.

### 5.2 Range robust

- `expectedVnd`: weighted median.
- `lowVnd`: weighted percentile 20.
- `highVnd`: weighted percentile 80.
- Với ít mẫu, mở rộng range theo uncertainty và hạ confidence.

```text
effectiveN = (Σw)² / Σ(w²)
freshness = exp(-weightedAgeDays / halfLifeDays)
confidence = sourceCoverage × min(1, sqrt(effectiveN / 5)) × freshness
```

Giữ algorithmVersion và observed window. Admin có thể override nhưng override cũng phải có reason, actor và expiry.

### 5.3 Xác suất nằm trong ngân sách

Nếu chỉ có low `L`, expected/mode `E`, high `H`, có thể dùng phân phối tam giác để ước lượng `P(price ≤ B)`:

```text
B < L:                 0
L ≤ B ≤ E:             (B-L)² / ((H-L)(E-L))
E < B < H:             1 - (H-B)² / ((H-L)(H-E))
B ≥ H:                 1
```

Đây là uncertainty heuristic, không phải cam kết giá. Nếu `L=E` hoặc `E=H`, dùng CDF đoạn đều/empirical phù hợp và chống chia 0.

## 6. Random món

### 6.1 Pipeline

1. Resolve request với profile snapshot, catalog version và timezone.
2. Hard-filter ở DB: published, meal slot, hard allergen/diet, avoided ingredient, explicit exclusions, required known-price policy.
3. Tính soft features cho candidates còn lại.
4. Chuẩn hóa score theo active weights.
5. Lấy mẫu có trọng số, không chỉ chọn top 1 lặp đi lặp lại.
6. Lưu request/candidate/score snapshot rồi trả explainability từ evidence thật.

### 6.2 Hard constraints

Dish bị loại nếu:

- Chứa/possibly contains allergen mà user đánh dấu hard theo policy.
- Không thỏa hard diet.
- Có ingredient nằm trong hard avoid list đã resolve.
- Không PUBLISHED hoặc dữ liệu safety chưa đạt mức yêu cầu.
- Nằm trong exclusions của request/retry.

Không được khôi phục toàn bộ tập ứng viên khi filter cho ra rỗng. `UNKNOWN` về allergen không đồng nghĩa safe; policy nghiêm ngặt phải loại hoặc cảnh báo và yêu cầu người dùng quyết định ngoài random.

### 6.3 Match score

Mỗi soft criterion `j` có score `s_j ∈ [0,1]` và weight `w_j > 0`:

```text
matchScore = round(100 × Σ(w_j × s_j) / Σ(w_j active))
```

Chỉ đưa criterion có dữ liệu vào denominator; nếu thiếu price thì không được cho điểm budget hoàn hảo. `scoreBreakdown` trả weight/rawScore/evidence.

Feature đề xuất:

- Meal slot/category compatibility.
- Budget compliance probability ở trên.
- Goal/nutrition fit theo coverage.
- Taste/preferred cuisine.
- Prep-time fit.
- Novelty penalty dựa trên recent exposure/selection.
- Weather/context chỉ là soft, tắt được.

### 6.4 Lấy mẫu

Với utility chuẩn hóa `z_d`, temperature `T > 0`:

```text
P(d) = exp(z_d / T) / Σ exp(z_k / T)
```

Sample categorical hoặc Gumbel-max. `T` thấp thiên về món điểm cao; `T` cao đa dạng hơn. Seed/algorithmVersion lưu để debug nhưng không lộ dữ liệu nhạy cảm.

Retry kế thừa nguyên request snapshot và thêm món vừa thấy vào exclusions. Nếu hết candidates, trả structured no-candidate; không dùng sample Phở/Bún/Cháo.

### 6.5 Nới soft constraint

Thứ tự đề xuất, mỗi bước phải được log và reason hiển thị:

1. Tăng novelty/repeat tolerance.
2. Nới prep-time.
3. Nới taste/goal soft preference.
4. Nới calorie soft range trong ngưỡng cấu hình.
5. Đề nghị user tăng budget; không tự vượt hard budget.

Hard allergen, hard diet và hard avoid không bao giờ nới.

## 7. Lập kế hoạch tuần

### 7.1 Phân bổ ngân sách

Với tổng budget `B`, reserve ratio `r`, số ngày `D`, cost weight của enabled slot `q_s`:

```text
usableBudget = floor(B × (1-r))
dailyBudget = usableBudget / D
slotBudget_s = dailyBudget × q_s / Σ(q_k for enabled slots)
```

Budget chỉ bao phủ các slot đã bật nên cost weights được normalize trên enabled slots. Reserve dùng cho biến động giá, không hiển thị là “đã chi”.

Forecast:

```text
actualSpent = Σ actualCost(completed slots)
expectedPending = Σ expectedPrice(planned slots)
highPending = Σ highPrice(planned slots)
forecastExpected = actualSpent + expectedPending
forecastHigh = actualSpent + highPending
```

Hiển thị spent, expected forecast và risk range riêng; không dùng `max(actualSpent, originalProjected)`.

### 7.2 Phân bổ calorie cho partial plan

Cost và calorie không xử lý giống nhau. Nếu user chỉ lập bữa trưa, plan không được dồn toàn bộ calorie ngày vào bữa trưa.

Đặt canonical energy share `a_s` theo cấu hình đã được nutrition/product review:

```text
slotKcalTarget_s = dailyKcalTarget × a_s
plannedDailyKcalTarget = dailyKcalTarget × Σ(a_s for enabled slots)
```

Không normalize `a_s` về 100% cho partial plan. Nếu sản phẩm định nghĩa plan là full-day thay thế, phải bắt buộc một cấu hình slot có tổng share 100%.

### 7.3 Mô hình CP-SAT/MILP

Đặt binary `x[d,s] = 1` nếu dish `d` được chọn cho slot `s`. Chỉ tạo biến cho cặp đã qua hard filter.

Ràng buộc:

```text
∀s: Σ_d x[d,s] = 1
Σ_s,d riskAdjustedCost[d,s] × x[d,s] ≤ usableBudget
∀day with full coverage:
  kcalLower ≤ Σ_s,d kcal[d] × x[d,s] ≤ kcalUpper
∀dish d: Σ_s x[d,s] ≤ repeatLimit[d]
locked slot: x[lockedDish,slot] = 1
```

Với CP-SAT, scale decimal protein/score thành integer có độ chính xác xác định. Google mô tả CP-SAT làm việc trên integer constraints, phù hợp cho biến chọn rời rạc: [OR-Tools CP-SAT](https://developers.google.com/optimization/cp/cp_solver). Bài toán diet cổ điển cũng minh họa tối ưu chi phí dưới ràng buộc nutrient bằng linear optimization: [OR-Tools Stigler diet](https://developers.google.com/optimization/lp/stigler_diet).

Risk-adjusted cost:

```text
riskAdjustedCost = expectedVnd + λrisk × (highVnd - expectedVnd)
```

`λrisk ∈ [0,1]` theo policy; hard budget nghiêm có thể dùng highVnd, nhưng phải chấp nhận nhiều trường hợp infeasible.

Objective minimize:

```text
λ1 × calorieDeviation
+ λ2 × totalRiskAdjustedCost / usableBudget
+ λ3 × repetitionPenalty
+ λ4 × nutritionCoveragePenalty
+ λ5 × prepTimePenalty
- λ6 × preferenceUtility
- λ7 × diversityUtility
```

Không thưởng việc tiêu sát trần ngân sách. Tất cả objective term normalize về thang tương đương; lưu weights với algorithmVersion.

### 7.4 Giải bài toán infeasible

Solver trả nguyên nhân/rule trace. Nới theo tầng và chạy lại:

1. Giảm novelty/diversity requirement.
2. Nới home-cook/prep-time preference.
3. Nới goal/macronutrient soft target.
4. Nới calorie tolerance đến hard maximum đã cấu hình.
5. Trả `NO_FEASIBLE_PLAN` và đề nghị user tăng budget/đổi slot/thời lượng.

Không bỏ exclusion/allergen/diet, không biến unknown price thành 0, không chọn “bất kỳ món published nào”. Nếu locked slots đã khiến budget infeasible, trả chính xác phần budget bị khóa chiếm bao nhiêu và yêu cầu user quyết định.

### 7.5 Generate/swap/regenerate

- Generate dùng snapshot config/profile, idempotency + outbox.
- Swap re-optimize phần chưa hoàn thành, giữ locked/completed; cập nhật totals atomically.
- Regenerate tạo candidate plan mới song song; chỉ archive plan cũ sau khi plan mới READY và user/flow chuyển thành công.
- Worker kiểm status/version trước commit để không “hồi sinh” plan đã archive/cancel.

## 8. Health aggregate

### Meal totals

```text
itemNutrient = snapshotPerBasis × servingFactor
mealTotal = Σ itemNutrient
dayTotal = Σ nonDeleted mealTotal within local-day boundary
```

Biên ngày lấy theo timezone IANA rồi convert sang UTC query range. Không dùng `toISOString().slice(0,10)` để đại diện ngày Việt Nam.

### Progress

```text
ratio = target > 0 ? consumed / target : null
displayRatio = min(max(ratio,0),1)
overTarget = max(consumed-target,0)
remaining = max(target-consumed,0)
```

Giữ raw ratio/overTarget để UI không che việc vượt target.

### Streak

Phải có định nghĩa sản phẩm duy nhất. Đề xuất “valid day” khi có ít nhất một meal log hợp lệ hoặc một weekly slot completed; không tính mở app/random đơn thuần.

```text
currentStreak = số localDate liên tiếp lùi từ hôm nay
                (hoặc từ hôm qua nếu hôm nay chưa kết thúc)
                có validDay=true
```

Timezone tại thời điểm event được lưu; đổi timezone không được viết lại toàn bộ lịch sử âm thầm. Job reconcile có test DST/timezone travel.

### Step sync

Đối với cumulative records như steps, mobile dùng aggregate API thay vì đọc rồi cộng raw records từ nhiều nguồn để tránh double counting. Android Health Connect chính thức khuyến nghị `aggregate()` cho `StepsRecord`: [Health Connect get started](https://developer.android.com/health-and-fitness/health-connect/get-started) và giải thích aggregate có dedupe cho activity/sleep: [Health Connect aggregate data](https://developer.android.com/health-and-fitness/health-connect/aggregate-data).

BE upsert bucket theo dedupe key, không cộng lại cùng interval/provider.

### Health tips

Tip là rule engine deterministic:

- Input coverage dưới threshold → không phát tip định lượng.
- Rule có `code`, version, eligibility, severity, template và evidence.
- Không chẩn đoán hoặc gợi ý điều trị.
- Nếu dữ liệu là estimated, message phải dùng ngôn ngữ ước tính.

## 9. Nearby place

Nếu lưu PostgreSQL PostGIS geography:

```sql
WHERE ST_DWithin(place.geog, userPoint, :radiusMeters)
ORDER BY ST_Distance(place.geog, userPoint)
```

`ST_DWithin` trên geography dùng mét và có thể tận dụng spatial index: [PostGIS ST_DWithin](https://postgis.net/docs/ST_DWithin.html). Tạo GiST index trên geography.

Provider place data có chính sách caching/attribution. Với Google Places, phải tuân attribution và giới hạn lưu/caching; Place ID có quy tắc riêng: [Google Places policies](https://developers.google.com/maps/documentation/places/web-service/policies). Tạo provider adapter để có thể thay nhà cung cấp.

Khoảng cách gần không chứng minh nhà hàng có món. Chỉ đặt `dishAvailability=CONFIRMED` khi có menu item source đang còn hạn.

## 10. Notification delivery

Pipeline:

1. Business transaction tạo Notification + outbox.
2. Worker kiểm user setting/consent/timezone và installation token còn active.
3. Gửi push, lưu ticket ID.
4. Worker lấy receipt và update delivery status.
5. Receipt `DeviceNotRegistered` invalidate token, không retry vô hạn.

Expo yêu cầu kiểm push receipts và dừng gửi token không còn đăng ký: [Expo push notification sending](https://docs.expo.dev/push-notifications/sending-notifications/).

## 11. API safety, idempotency và concurrency

### Ownership

Mọi query object người dùng:

```text
find/update where id = :id AND userId = token.sub
```

Không nhận userId từ body. OWASP xếp Broken Object Level Authorization là rủi ro API hàng đầu; test với ít nhất hai identity cho mọi endpoint có `:id`: [OWASP API1:2023 BOLA](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/).

### Optimistic locking

```sql
UPDATE resource
SET ..., version = version + 1
WHERE id = :id AND user_id = :userId AND version = :expectedVersion
RETURNING *;
```

Không đọc version rồi update `WHERE id` vì có race. Slot totals/meal log/outbox ở cùng transaction.

### Idempotency

Key scope theo user + method + route. Lưu request hash và response. Retry cùng key/body trả response trước; cùng key/body khác trả conflict. TTL dài hơn retry window/job duration.

Các action bắt buộc: register có cân nhắc, create random, select random, generate/regenerate/swap/complete, create meal/water/reminder, recognition và export.

### Cache

- Cache key có user/version/timezone/date.
- Mutation invalidates tag liên quan.
- Không cache response sức khỏe cá nhân ở shared/public cache.
- Cache miss/provider error trả status rõ, không lấy sample data.

## 12. Bộ test thuật toán bắt buộc

- Property: hard allergen/diet/avoid không bao giờ xuất hiện sau random, generate, swap, regenerate.
- Property: total risk-adjusted cost không vượt usable budget khi budget là hard.
- Property: exactly one dish mỗi slot và không duplicate slot.
- Golden test cho nutrition basis/yield/retention và serving conversion.
- Mutation test cho tên cột macro (`proteinG`, `carbsG`, `fatG`).
- Infeasible scenarios: budget quá thấp, all candidates excluded, locked slots vượt ngân sách, missing prices.
- Deterministic replay theo snapshot + algorithm version + seed.
- Concurrency: hai swap/complete cùng version chỉ một thành công.
- Idempotency: retry action không tăng counter/log/tổng hai lần.
- Timezone: UTC crossing, Asia/Ho_Chi_Minh, DST zone và đổi timezone.
- Confidence/coverage: null không trở thành 0; unknown allergen không trở thành safe.

