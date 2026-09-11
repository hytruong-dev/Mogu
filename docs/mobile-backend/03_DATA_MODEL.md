# Mô hình dữ liệu đích

## 1. Nguyên tắc thiết kế

1. `Dish` là món/công thức chuẩn; `Ingredient` là nguyên liệu; `MealLog` là sự kiện người dùng đã ăn. Không dùng chung một bảng cho ba khái niệm.
2. Giá và dinh dưỡng thay đổi theo thời gian/basis nên không chỉ lưu vài số trực tiếp trên `Dish`.
3. Log lịch sử giữ snapshot bất biến. Khi admin sửa món, bữa đã ghi và kế hoạch cũ không thay đổi theo.
4. Dữ liệu tính toán có `method`, `formulaVersion`, `source`, `confidence`, `calculatedAt`.
5. Field sức khỏe và quyền riêng tư tối thiểu hóa, mã hóa ở tầng phù hợp, không đưa vào analytics/log.
6. Counter có thể denormalize để đọc nhanh nhưng nguồn thật vẫn là event/resource; phải có job reconcile.

## 2. Phần schema hiện có nên giữ

- `Account`, `RefreshSession`, `Profile`, `OnboardingSession`, `UserConsent`, `AuthAuditLog`.
- Catalog: `Goal`, `DietaryPreference`, `Allergen`, `Region`, `Province`, `DishCategory`, `MealTypeTag`, `DietType`, `Ingredient`.
- Dish domain: `Dish`, link taxonomy, `DishIngredient`, `DishAllergen`, `DishNutrition`, `DishSource`, `RecipeStep`, `DishMedia`, `Review`.
- Personalization: `UserGoal`, `UserDietaryPreference`, `UserAllergen`, `UserAvoidedIngredient`, `UserDietType`, `SavedDish`.
- Random domain: `RandomHistory`, `RandomCandidate`, `RecommendationEvent`.
- Weekly domain: config, plan, slot, swap.
- Content: topic, article, tags, community post, like, comment.
- Notification và admin import/review audit.

Các model trên cần migration/index/constraint chính thức, không chỉ một script chạy tay.

## 3. Phần nên hợp nhất hoặc ngừng dùng

Schema hiện có cả `Food/Meal/MealItem/MealLog` legacy và `Dish/Ingredient` mới. `MealLog` legacy chỉ có `mealId`, `totalKcal`, `note`, không đủ cho Health UI và gây hai nguồn sự thật.

Quyết định đề xuất:

- `Dish` + `Ingredient` là catalog chính.
- Thay `Meal/MealItem/MealLog` legacy bằng meal log aggregate mới ở mục 8.
- Viết migration backfill snapshot từ legacy, chạy dual-read có thời hạn, sau đó khóa write legacy và xóa ở migration sau.
- Không tạo thêm `Food` công khai thứ ba. “Custom food” là dữ liệu private của user.

## 4. User, profile và session

### `Account`

Giữ identity/credential/status. Bổ sung khi cần:

- `emailNormalized`, `usernameNormalized` unique dạng case-insensitive.
- `emailVerifiedAt`.
- `passwordChangedAt`, `failedLoginCount`, `lockedUntil` nếu chưa có.
- Không lưu OAuth access token nếu chỉ cần identity; nếu phải lưu thì mã hóa và quản lý rotation.

### `RefreshSession`

Cần `tokenHash`, `tokenFamilyId`, `parentTokenId`, `installationId`, `platform`, `userAgentSummary`, `lastSeenAt`, `expiresAt`, `revokedAt`, `revokeReason`. Chỉ lưu hash refresh token.

Index:

- `(accountId, revokedAt, expiresAt)`.
- unique `tokenHash`.
- `(tokenFamilyId)` để revoke khi phát hiện reuse.

### `Profile`

Giữ `version` tăng đơn điệu. Bổ sung/chuẩn hóa `username`, `bio`, `avatarMediaId`, `regionId`, `timezone`, `locale` nếu thực sự thuộc profile. `dateOfBirth` và health fields không xuất hiện trong public profile DTO.

`ProfileMeasurement` mới:

- `id`, `userId`, `type` (`HEIGHT_CM`, `WEIGHT_KG`, optional body metrics).
- `valueDecimal`, `unit`, `measuredAt`, `source`, `createdAt`, `deletedAt`.
- Index `(userId,type,measuredAt desc,id desc)`.

Profile có thể giữ latest denormalized measurement để đọc nhanh, nhưng measurement history mới là nguồn thật.

### `UserSetting`

- `userId` unique, `language`, `theme`, notification channel booleans, privacy flags, `version`, timestamps.
- Cột rõ ràng cho field thường query; JSON chỉ dành cho preference ít ổn định và vẫn phải schema validate.
- Marketing consent không đồng nhất với notification setting; consent là append-only.

## 5. Catalog món và chất lượng dữ liệu

### `Ingredient`

Bổ sung/chuẩn hóa:

- `canonicalName`, `normalizedName`, `synonyms`, `foodGroupCode`.
- `defaultEdiblePortionFactor` nếu có nguồn.
- Relation đến reference food, allergen mappings.

Không dùng `ingredientName` free text để kiểm hard allergy. `DishIngredient` phải có `ingredientId`; hàng chưa resolve không được publish nếu liên quan safety.

### `DishIngredient`

Cần:

- `amount`, `unitCode`, `gramEquivalent`.
- `preparation`, `isOptional`, `substitutionGroup`.
- `resolutionMethod`, `resolutionConfidence`, `reviewedAt`, `reviewedBy`.
- Check `amount > 0`, `gramEquivalent > 0` khi nutrition/serving calculation cần.

### `DishNutrition`

Giữ concept hiện tại nhưng chuẩn hóa field:

- `caloriesKcal`, `proteinG`, `carbsAvailableG`, `fatG`, `fiberG`, `sugarG`, `saturatedFatG`, `sodiumMg`.
- `basis`: `PER_100G`, `PER_SERVING`, `WHOLE_RECIPE`.
- `servingSizeG`, `servingsPerRecipe`.
- `method`: `SOURCE_VERIFIED`, `INGREDIENT_CALCULATED`, `AI_ESTIMATED`, `USER_DECLARED`.
- `sourceId`, `formulaVersion`, `coverage`, `confidence`, `calculatedAt`, `reviewedAt`.
- `isDefault` unique partial theo dish.

Không đổi tên qua lại `carbG`, `carbsG`, `protein` và `proteinG`. Chọn tên canonical trong DB/DTO và tạo mapper rõ ràng.

### `FoodReference` và `FoodNutrient` — Mới

Đây là lớp raw/canonical cho nguồn dinh dưỡng, tách khỏi món Mogu:

`FoodReference`:

- `id`, `sourceSystem` (`VN_FCT_2017`, `USDA_FDC`, `ASEAN_FCT`, `MANUAL_VERIFIED`).
- `externalId`, `nameOriginal`, `nameVi`, `description`, `foodState`, `ediblePortionFactor`.
- `sourceVersion`, `sourceUrl`, `licenseCode`, `attribution`, `publishedAt`, `importedAt`.
- `qualityGrade`, `reviewStatus`, raw checksum.
- Unique `(sourceSystem,externalId,sourceVersion)`.

`FoodNutrient`:

- `foodReferenceId`, `nutrientCode` theo internal vocabulary/INFOODS tag mapping.
- `value`, `unit`, `basisAmountG` mặc định 100 g edible portion.
- `valueType` (`ANALYTICAL`, `CALCULATED`, `IMPUTED`, `LABEL`, `UNKNOWN`).
- `min`, `max`, `sampleCount`, `methodNote` khi nguồn có.
- Unique `(foodReferenceId,nutrientCode)`.

`IngredientFoodReferenceLink`:

- `ingredientId`, `foodReferenceId`, `matchMethod`, `confidence`, `reviewStatus`, `reviewedBy/At`.
- Chỉ link APPROVED mới dùng cho published nutrition.

### `NutrientDefinition`

- Internal code, INFOODS tag, external nutrient IDs, canonical unit, conversion rule, display precision.
- Không map chỉ bằng tên text vì “carbohydrate” có thể là available/by-difference/total tùy nguồn.

### `DishSource`

Giữ nhưng reliability không nên là con số tự do duy nhất. Bổ sung source authority, evidence type, license/usage, accessedAt, content checksum, validFrom/validTo và reviewer. URL chết không làm nutrition biến mất nhưng đánh dấu stale.

## 6. Giá và ngân sách

`priceMin/priceMax` trên Dish chỉ nên là cache derived để list nhanh.

### `DishPriceObservation` — Mới

- `id`, `dishId`, optional `placeId/regionId/provinceId`.
- `priceVnd`, `servingDescriptor`, `sourceType` (`ADMIN`, `MENU_PROVIDER`, `USER_REPORT`, `RETAIL_ESTIMATE`).
- `sourceUrl`, `observedAt`, `expiresAt`, `confidence`, `verifiedAt`, `createdBy`.
- Index `(dishId,regionId,observedAt desc)` và expiry.

### `DishPriceEstimate` — Mới hoặc materialized

- `dishId`, geography scope, `lowVnd`, `expectedVnd`, `highVnd`, `sampleCount`, `confidence`, `calculatedAt`, `validUntil`, `algorithmVersion`.
- Check `0 <= low <= expected <= high`.

Weekly/random phải dùng expected/high theo risk policy, không coi null = 0. Nếu price unknown và budget là hard constraint thì ứng viên không đủ điều kiện hoặc cần budget risk approval rõ từ user.

## 7. Randomization

`RandomHistory` là aggregate root:

- Immutable request snapshot gồm resolved meal slot, budget, goals, hard/soft diets, allergens/avoid list hash, context, profileVersion.
- `algorithmVersion`, random seed/trace identifier, status/error code, selectedAt.
- Không lưu chi tiết sức khỏe không cần thiết.

`RandomCandidate`:

- Dish ID + dish version, rank, eligible flag.
- Score breakdown JSON đã schema hóa `{code,weight,rawScore,weightedScore,evidence}`.
- Snapshot price/nutrition/safety dùng lúc chọn.

`RecommendationEvent`:

- unique `(randomizationId,eventType,eventId)`.
- Selection là một state/action duy nhất; analytics click không tạo thêm selection nghiệp vụ.

Index lịch sử `(userId,createdAt desc,id desc)`; không dùng so sánh thứ tự UUID.

## 8. Meal log và Health

### `MealLog` mới

- `id`, `userId`, `mealSlot`, `occurredAt`, `localDate`, `timezone`.
- `sourceType`, optional source IDs (`randomizationId`, `weeklyPlanSlotId`).
- `note`, calculated totals, `nutritionCoverage`, `version`, timestamps, `deletedAt`.
- Unique partial trên `weeklyPlanSlotId` để complete retry không sinh log trùng.
- Index `(userId,localDate,occurredAt,id)` và `(userId,occurredAt desc,id desc)`.

### `MealLogItem`

- `mealLogId`, `referenceType` (`DISH`, `INGREDIENT`, `CUSTOM_FOOD`).
- `referenceId`, reference version, display-name snapshot.
- `quantity`, `unitCode`, `gramEquivalent`.
- Snapshot: calories, macro/micro fields, nutrition basis/method/confidence/source.
- `sortOrder`.

Totals của MealLog được tính từ item trong transaction; client không ghi đè totals.

### `CustomFood`

- Owner user ID, name, serving amount/unit/gram, nutrition, source USER_DECLARED, version, archivedAt.
- Index private theo `(userId,normalizedName)`.
- Không relation vào public Dish recommendation.

### `WaterLog`

- `id`, `userId`, `amountMl`, `occurredAt`, `localDate`, `timezone`, `source`, timestamps.
- Index `(userId,localDate,occurredAt)`.

### `ActivityBucket`

- `id`, `userId`, provider, type, startAt/endAt, localDate/timezone, value/unit.
- `dedupeKey`, source origin hash set, syncedAt.
- Unique `(userId,provider,type,startAt,endAt,dedupeKey)`.
- Không lưu raw sample nếu dashboard chỉ cần aggregate và policy không yêu cầu.

### `HealthTarget`

- `userId`, energy/macro/water/steps targets.
- `mode`, `method`, `formulaVersion`, `inputsSnapshot`, `requiresProfessionalReview`, `validFrom`, `version`.
- Lưu lịch sử version hoặc audit vì target thay đổi ảnh hưởng cách đọc progress cũ.

### `HealthDayAggregate`

Có thể là view/cache, không phải nguồn thật. Key `(userId,localDate,timezone,targetVersion)`, gồm totals, coverage, updatedAt. Invalidated khi log/water/activity/target đổi.

## 9. Weekly plan

Giữ models hiện có, bổ sung các yêu cầu sau:

### `WeeklyPlanConfig`

- `version`, currency, budget reserve, enabledSlots unique.
- Check duration `[3,5,7,14]`, tolerance range, positive budget.
- `mealsPerDay` là derived hoặc constraint khớp enabledSlots trong thời gian deprecation.

### `WeeklyPlan`

- Immutable `configSnapshot`, `profileConstraintSnapshot`, `catalogVersion`.
- `algorithmVersion`, `generationJobId`, failure code/detail sanitized, `safetyStatus`.
- Summary gồm projected/actual/forecast tách riêng; không ghi đè projected bằng actual.
- `version`; state timestamps.

### `WeeklyPlanSlot`

- Snapshot dish identity/version, price low/expected/high, nutrition per serving, serving factor.
- `status`, `isLocked`, `version`, actual cost/nutrition, completion source.
- Unique `(planId,localDate,mealSlot)`.
- Check action state; completed và skipped timestamps không đồng thời.

### `WeeklyPlanSlotSwap`

Lưu old/new dish snapshot IDs, reason, before/after plan forecast, algorithm version, actor, createdAt. Đây là audit, không sửa lại.

### `OutboxEvent`

Generate/regenerate/complete cần transactional outbox:

- Transaction tạo/đổi state + outbox row.
- Worker publish queue và đánh dấu outbox.
- Consumer idempotent theo event ID.

Cách này tránh plan mắc `GENERATING` khi row đã commit nhưng enqueue thất bại.

## 10. Content, community và media

### Community

`CommunityPost` cần visibility, moderationStatus, publishedAt/deletedAt/version. `PostComment` bổ sung `parentCommentId`, depth (giới hạn 1 hoặc 2), moderation status. Like/save/follow là relation unique, không toggle event mơ hồ.

Index:

- Post feed `(status,publishedAt desc,id desc)`.
- User posts `(userId,status,updatedAt desc,id desc)`.
- Comments `(postId,parentCommentId,createdAt,id)`.
- Unique likes `(userId,postId)` và comment likes tương tự.

### `UserFollow`, `SavedArticle`, `SavedPost`

Mỗi bảng có composite unique owner-target, timestamps, cascade/restrict theo policy. Follow self bị check/validation cấm.

### Media

Dùng entity media chung hoặc các subtype nhất quán:

- `ownerType/ownerId`, storage key, MIME, bytes, dimensions/checksum.
- moderation status, scan status, attribution/license, retention class.
- Chỉ trả CDN/signed URL, không trả storage credential.

Camera food image có retention class ngắn và private; community/dish media có moderation/publication policy khác.

## 11. Place, reminder, notification và job

### `PlaceReference`

- Provider + providerPlaceId unique, coarse/canonical fields được phép lưu, geography `geography(Point,4326)` nếu PostGIS.
- Attribution payload/version, fetchedAt/expiresAt.
- Không giữ review/photo/provider fields vượt điều khoản cache.

### `MealReminder`

- `userId`, dishId, scheduledLocalDateTime, timezone, scheduledAtUtc, enabled, status, notificationId, version.
- Unique/idempotency key để retry không nhân đôi reminder.

### `PushInstallation`

- `userId`, installationId, token encrypted/hashed lookup strategy, platform, status, lastSeenAt, invalidatedAt.
- Receipt `DeviceNotRegistered` chuyển token thành invalid.

### `AsyncJob`

Dùng chung cho weekly generation, recognition, export:

- `id`, `type`, `ownerId`, `status`, progress, safe error code, attempts, created/started/finishedAt, expiresAt.
- Payload/result lớn để object storage, DB giữ pointer/checksum.
- Owner predicate trên mọi GET job.

## 12. Data quality và provenance

Mọi record nguồn dinh dưỡng cần ít nhất:

- Nguồn và phiên bản cụ thể, external ID, URL/citation, license.
- Raw/cooked state, edible portion, basis, unit.
- Analytical/calculated/imputed/label/user/AI method.
- Thời gian truy cập/import, checksum raw, reviewer và trạng thái duyệt.
- Coverage = tổng trọng số nutrient có dữ liệu / tổng trọng số nutrient cần cho use case.
- Confidence là output theo quy tắc có version, không là số do AI tự khai.

Quality grade đề xuất:

- `A`: nguồn phân tích chính thức, mô tả food state/basis đầy đủ.
- `B`: bảng thành phần chính thức/uy tín nhưng thiếu một phần metadata.
- `C`: tính từ ingredient đã duyệt với yield/retention phù hợp.
- `D`: nhãn hãng hoặc user-declared có phạm vi giới hạn.
- `E`: AI estimate/nguồn chưa duyệt; không dùng để khẳng định safety và không làm default public.

## 13. Transaction và concurrency

- Update version: `UPDATE ... SET ..., version=version+1 WHERE id=:id AND user_id=:user AND version=:expected RETURNING *`.
- Nếu 0 row, kiểm tra theo cách không làm lộ owner: trả `404` hoặc `409` cho object đã biết thuộc user.
- Swap/complete weekly cập nhật slot, totals, meal log và outbox trong một transaction.
- Like/save dùng insert `ON CONFLICT DO NOTHING`; unlike/delete idempotent.
- Idempotency record lưu owner, key, method/path, request hash, response/status, expiry. Key trùng nhưng request hash khác trả 409.

## 14. Retention, export và deletion

Retention phải được product/legal chốt và hiển thị trong Privacy UI. Baseline kỹ thuật:

- Access/security audit giữ theo policy bảo mật, không chứa secret.
- Recognition input image tự xóa sau thời gian ngắn nếu user không opt-in lưu.
- Signed export hết hạn nhanh và xóa object sau hạn.
- Account deletion có grace period, sau đó anonymize/delete theo legal obligations; revoke token ngay khi xác nhận.
- Backup có lịch purge riêng; tài liệu người dùng không được hứa xóa tức thì khỏi mọi backup.
- Event analytics dùng pseudonymous ID và TTL; consent withdrawal dừng thu thập mới.

## 15. Migration tối thiểu

1. Đóng băng schema hiện tại bằng migration baseline và kiểm tra constraint/index trên database thật.
2. Tạo nutrition source/reference/provenance và price observation/estimate.
3. Tạo meal log mới, custom food, water, activity, measurement, target.
4. Backfill legacy meal logs với `sourceType=LEGACY`, coverage phù hợp; không bịa macro thiếu.
5. Dual-read Health để so sánh, sau đó chuyển write hoàn toàn sang model mới.
6. Bổ sung settings/privacy/session/export/delete và community relations.
7. Bổ sung outbox/idempotency/async job, migrate weekly/random action.
8. Gỡ route/model legacy chỉ sau telemetry chứng minh không còn client dùng.

