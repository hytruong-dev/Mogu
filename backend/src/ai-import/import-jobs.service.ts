import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import slugify from 'slugify';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from './ai.service';
import { ImportGateway } from './import.gateway';
import { ImportJobsStore } from './import-jobs.store';
import { CreateImportJobDto } from './dto/create-import-job.dto';
import { ImportJobDto, ImportJobLogDto, ImportJobStatus, WsJobProgress } from './dto/import-job.dto';
import { ConfigService } from '@nestjs/config';
import { ImportJobQueue } from './import-job.queue';
import { AiImportDraftPersistenceService } from './ai-import-draft-persistence.service';
import { TaxonomySnapshotService } from './taxonomy-snapshot.service';
import { IngredientParserService, IngredientResolverService } from './ingredient.service';
import { ClassificationRulesService } from './classification-rules.service';
import { CrossFieldValidatorService, RecipeValidatorService } from './validators.service';
import { TargetedRepairService } from './targeted-repair.service';
import {
  IngredientCandidate,
  DishExtractionV11,
  RecipeEvidence,
} from './ai-import.types';
import { DishExtractionV11Schema } from './dish-extraction.schema';
import {
  IngredientCatalogService,
  ResolveOrProvisionBatchResult,
  ResolveOrProvisionInput,
} from '../ingredients/ingredient-catalog.service';
import { IngredientCreatedVia, Prisma } from '@prisma/client';
import { DishOriginResolverService } from './origin/dish-origin-resolver.service';
import { NutritionCalculatorService } from './nutrition/nutrition-calculator.service';
import {
  RecipeDiscoveryResult,
  RecipeSourceDiscoveryService,
} from './sources/recipe-source-discovery.service';
import { StepImageService } from './media/step-image.service';
import { DishDraftAggregate } from '../dishes/services/dish-command.service';

const STEPS = [
  { index: 1, key: 'SEARCHING', name: 'Tìm nguồn', pct: 0 },
  { index: 2, key: 'EXTRACTING', name: 'Trích xuất AI', pct: 16 },
  { index: 3, key: 'NORMALIZING', name: 'Chuẩn hóa', pct: 32 },
  { index: 4, key: 'RECONCILING', name: 'Đối chiếu', pct: 50 },
  { index: 5, key: 'ENRICHING', name: 'Làm giàu dữ liệu', pct: 68 },
  { index: 6, key: 'DRAFTING', name: 'Tạo bản nháp', pct: 84 },
];

@Injectable()
export class ImportJobsService {
  private readonly logger = new Logger(ImportJobsService.name);
  private readonly eventSequences = new Map<string, number>();
  /** Track jobs đang chạy để có thể cancel */
  private running = new Set<string>();

  private readonly supabase: SupabaseClient;
  private readonly storageBucket = 'dish-images';

  constructor(
    private readonly ai: AiService,
    private readonly store: ImportJobsStore,
    private readonly gateway: ImportGateway,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly queue: ImportJobQueue,
    private readonly draftPersistence: AiImportDraftPersistenceService,
    private readonly taxonomy: TaxonomySnapshotService,
    private readonly ingredientParser: IngredientParserService,
    private readonly ingredientResolver: IngredientResolverService,
    private readonly classificationRules: ClassificationRulesService,
    private readonly recipeValidator: RecipeValidatorService,
    private readonly crossFieldValidator: CrossFieldValidatorService,
    private readonly targetedRepair: TargetedRepairService,
    private readonly ingredientCatalog: IngredientCatalogService,
    private readonly originResolver: DishOriginResolverService,
    private readonly nutritionCalculator: NutritionCalculatorService,
    private readonly sourceDiscovery: RecipeSourceDiscoveryService,
    private readonly stepImages: StepImageService,
  ) {
    this.supabase = createClient(
      this.config.getOrThrow('SUPABASE_URL'),
      this.config.getOrThrow('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }

  async create(dto: CreateImportJobDto, actorId: string): Promise<ImportJobDto> {
    const id = randomUUID();
    const job = await this.store.create({
      id,
      query: dto.query,
      sourceTypes: dto.sourceTypes ?? ['AI_GENERATED'],
      relatedKeywords: dto.relatedKeywords,
      regionHint: dto.regionHint,
      actorId,
    });

    const queued = await this.queue.enqueue({ jobId: id, actorId, request: dto });
    if (!queued) {
      this.runPipeline(id, dto, actorId).catch((err) => {
        this.logger.error(`Pipeline failed for job ${id}: ${err.message}`);
      });
    }

    return job;
  }

  findAll(limit = 20, cursor?: string) {
    return this.store.list(limit, cursor);
  }

  async findOne(id: string): Promise<ImportJobDto> {
    const job = await this.store.get(id);
    if (!job) throw new NotFoundException(`Import job ${id} không tồn tại`);
    return job;
  }

  async cancel(id: string): Promise<ImportJobDto> {
    const job = await this.store.cancel(id);
    if (!job) throw new NotFoundException(`Import job ${id} không tồn tại`);
    this.running.delete(id);
    await this.queue.cancel(id);
    this.emitProgress(job, 'Đã hủy job', job.status);
    return job;
  }

  async process(id: string, dto: CreateImportJobDto, actorId?: string): Promise<void> {
    if (await this.store.isCancellationRequested(id)) return;
    await this.runPipeline(id, dto, actorId);
  }

  // ─── Pipeline ────────────────────────────────────────────────────────────────

  private async runPipeline(
    id: string,
    dto: CreateImportJobDto,
    actorId?: string,
  ): Promise<void> {
    this.running.add(id);
    let pendingIngredientCount = 0;

    try {
      // ── Bước 1: Tìm nguồn ─────────────────────────────────────────────────
      if (!(await this.isRunning(id))) return;
      await this.startStep(id, 'SEARCHING', 1, `Đang tìm nguồn công thức uy tín cho món "${dto.query}"...`);
      const taxonomySnapshot = await this.taxonomy.load();
      this.log(id, 'SEARCHING', 1, `Đã nạp taxonomy snapshot ${taxonomySnapshot.version}`);
      const discovery = await this.discoverSources(id, dto.query);
      const evidence: RecipeEvidence | null = discovery.best?.evidence ?? null;

      // ── Bước 2: Trích xuất AI ─────────────────────────────────────────────
      if (!(await this.isRunning(id))) return;
      await this.startStep(
        id,
        'EXTRACTING',
        2,
        evidence
          ? `Đang gọi AI chuẩn hóa công thức theo nguồn ${discovery.best?.domain}...`
          : 'Đang gọi AI để sinh công thức và nguyên liệu...',
      );
      const regionName = dto.regionHint ? this.regionHintToName(dto.regionHint) : undefined;
      let extraction = await this.ai.extractDish({
        dishName: dto.query,
        regionName,
        relatedKeywords: dto.relatedKeywords,
        taxonomy: taxonomySnapshot,
        evidence,
      });
      this.log(id, 'EXTRACTING', 2,
        `AI đã sinh schema v1.1: ${extraction.ingredients.length} nguyên liệu, ${extraction.recipe.steps.length} bước nấu`,
        `Snapshot: ${taxonomySnapshot.version}${evidence ? ` | Bám theo nguồn: ${discovery.best?.url}` : ' | Không có nguồn, AI sinh công thức chuẩn'}`,
      );

      // ── Bước 3: Chuẩn hóa ─────────────────────────────────────────────────
      if (!(await this.isRunning(id))) return;
      await this.startStep(id, 'NORMALIZING', 3, 'Đang chuẩn hóa tên nguyên liệu và đơn vị...');
      extraction = {
        ...extraction,
        ingredients: extraction.ingredients.map((ingredient) => {
          const parsed = this.ingredientParser.parse(ingredient.rawText);
          // rawText là evidence để parser bổ sung dữ liệu, không được ghi đè
          // structured fields hợp lệ mà provider đã trả về.
          return {
            ...parsed,
            ...ingredient,
            name: ingredient.name || parsed.name,
            canonicalNameCandidate:
              ingredient.canonicalNameCandidate ?? parsed.canonicalNameCandidate,
            // Định lượng mặc định = 1 khi cả AI lẫn parser không có số.
            quantity: ingredient.quantity ?? parsed.quantity ?? 1,
            parseMetadata:
              ingredient.quantity == null && (parsed.quantity == null || parsed.parseMetadata?.quantityDefaulted)
                ? { quantityDefaulted: true }
                : ingredient.parseMetadata ?? null,
            quantityTo: ingredient.quantityTo ?? parsed.quantityTo,
            quantityText: ingredient.quantityText ?? parsed.quantityText,
            unitCode: ingredient.unitCode ?? parsed.unitCode,
            specification: ingredient.specification ?? parsed.specification,
            preparation: ingredient.preparation ?? parsed.preparation,
            normalizedWeightGram:
              ingredient.normalizedWeightGram ?? parsed.normalizedWeightGram,
            group: ingredient.group ?? parsed.group,
            optional: ingredient.optional || parsed.optional,
          };
        }),
        recipe: this.recipeValidator.sanitize(extraction.recipe, extraction.basic.name),
      };
      this.log(id, 'NORMALIZING', 3,
        `Đã parse ${extraction.ingredients.length} nguyên liệu`,
        'Giữ đơn vị tự nhiên; tách specification/preparation',
      );

      // ── Bước 4: Đối chiếu ─────────────────────────────────────────────────
      if (!(await this.isRunning(id))) return;
      await this.startStep(id, 'RECONCILING', 4, 'Đang kiểm tra trùng lặp với kho món ăn...');
      const ingredientDictionary: IngredientCandidate[] = await this.prisma.db.ingredient
        .findMany({
          where: { isActive: true },
          select: { id: true, name: true, synonyms: true },
        })
        .then((items) => items.map((item) => ({
          id: item.id,
          name: item.name,
          aliases: item.synonyms,
        })));
      const resolutions = extraction.ingredients.map((ingredient) =>
        this.ingredientResolver.resolve(ingredient, ingredientDictionary),
      );

      // ── 4a. Vùng miền / tỉnh (gazetteer -> AI -> hint) ─────────────────────
      const origin = this.originResolver.resolve({
        dishName: extraction.basic.name || dto.query,
        alternateNames: [dto.query, ...(extraction.basic.alternateNames ?? [])],
        aiOrigin: extraction.basic.origin,
        regionHint: dto.regionHint,
        snapshot: taxonomySnapshot,
      });
      extraction = {
        ...extraction,
        basic: { ...extraction.basic, origin: this.originResolver.toCandidate(origin) },
      };
      this.log(id, 'RECONCILING', 4,
        origin.source === 'NONE'
          ? 'Không xác định được vùng miền/tỉnh cụ thể'
          : `Xuất xứ: ${origin.originText ?? origin.regionCode} (nguồn ${origin.source}, ${origin.confidence}%)`,
        origin.notes.length ? origin.notes.join(' ') : undefined,
      );

      // ── 4b. Rule phân loại + loại món + giá ─────────────────────────────────
      const pricing = this.resolvePricing(extraction, Boolean(evidence));
      const rules = this.classificationRules.evaluate({
        candidate: extraction.classification,
        ingredients: resolutions,
        dictionary: ingredientDictionary,
        dishName: extraction.basic.name || dto.query,
        allowedCategoryCodes: taxonomySnapshot.categories.map((item) => item.code),
        allowedMealTypeCodes: taxonomySnapshot.mealTypes.map((item) => item.code),
        isRegionalSpecialty: origin.isRegionalSpecialty,
        priceEvidenceReliable: pricing.reliable,
      });
      extraction = {
        ...extraction,
        basic: {
          ...extraction.basic,
          priceMin: pricing.homeCook.min,
          priceMax: pricing.homeCook.max,
        },
        classification: {
          ...extraction.classification,
          categoryCodes: rules.categoryCodes,
          mealTypeCodes: rules.mealTypeCodes,
          goalCodes: rules.goalCodes,
          dietTypeCodes: rules.dietTypeCodes,
          flavorCodes: rules.flavorCodes,
          dishTypeCode: rules.dishType,
        },
      };
      this.log(id, 'RECONCILING', 4,
        `Phân loại: ${rules.categoryCodes.join(', ') || 'chưa có'} | Loại món: ${rules.dishType === 'WET' ? 'Món nước' : rules.dishType === 'DRY' ? 'Món khô' : 'Bất kỳ'}`,
        rules.categoryRule ? `Rule khớp "${rules.categoryRule.matchedPattern}" -> ${rules.categoryRule.categoryCode}` : undefined,
      );
      let warnings = [
        ...rules.warnings,
        ...this.crossFieldValidator.validate(extraction, taxonomySnapshot, resolutions),
      ];
      const invalidFields = warnings
        .filter((warning) => warning.severity !== 'WARNING')
        .map((warning) => ({ path: warning.fieldPath, reason: warning.code }));
      if (invalidFields.length) {
        const request = this.targetedRepair.buildRequest(id, extraction, invalidFields);
        if (request.invalidFields.length) {
          extraction = DishExtractionV11Schema.parse(
            this.targetedRepair.merge(
              extraction,
              await this.ai.repairFields(request),
              invalidFields,
            ),
          );
          extraction = {
            ...extraction,
            recipe: this.recipeValidator.sanitize(extraction.recipe, extraction.basic.name),
          };
          warnings = this.crossFieldValidator.validate(
            extraction,
            taxonomySnapshot,
            resolutions,
          );
        }
      }
      const blocking = warnings.filter((warning) => warning.severity === 'BLOCKING');
      if (blocking.length) {
        throw new Error(`AI_IMPORT_VALIDATION_FAILED: ${blocking.map((item) => item.code).join(',')}`);
      }
      const dishData = this.toLegacyDishData(extraction);
      const normalizedIngredients = dishData.ingredients;
      const slug = slugify(dishData.name, { lower: true, locale: 'vi', strict: true });
      const existing = await this.prisma.db.dish.findFirst({
        where: { slug, deletedAt: null },
        select: { id: true, name: true },
      });
      await this.delay(400);
      if (existing) {
        this.log(id, 'RECONCILING', 4,
          `Cảnh báo: Đã tìm thấy món tương tự trong DB`,
          `Slug "${slug}" đã tồn tại (id: ${existing.id}). Sẽ thêm suffix.`,
        );
      } else {
        this.log(id, 'RECONCILING', 4, 'Không tìm thấy trùng lặp — tiếp tục tạo mới');
      }

      // ── Bước 4b: Resolve/provision Ingredient (không tìm ảnh sync) ───────
      if (!(await this.isRunning(id))) return;
      this.log(id, 'RECONCILING', 4, `Đang đối chiếu ${normalizedIngredients.length} nguyên liệu với kho...`);

      const provisioned = await this.reconcileIngredients(
        id,
        dishData.name || dto.query,
        normalizedIngredients.map((ing, idx) => ({
          clientRef: `ai-${idx}`,
          rawName: ing.name,
          rawText: extraction.ingredients[idx]?.rawText ?? ing.name,
          unit: ing.unit || undefined,
        })),
      );
      const newCount = provisioned.createdIds.length;
      pendingIngredientCount = newCount;
      this.log(id, 'RECONCILING', 4,
        `Đã xử lý ${provisioned.items.length} nguyên liệu`,
        `Mới: ${newCount} (tự động tìm, cần duyệt) | Đã tồn tại: ${provisioned.items.length - newCount}`,
      );

      // ── Bước 5: Làm giàu dữ liệu (Nutrition + Image) ─────────────────────
      if (!(await this.isRunning(id))) return;
      await this.startStep(id, 'ENRICHING', 5, 'Đang tính dinh dưỡng (VFCT 2007 / USDA), tìm ảnh đại diện và ảnh từng bước...');
      const [nutrition, suggestedImageUrl, stepImages] = await Promise.all([
        this.nutritionCalculator.calculate({
          dishName: dishData.name,
          servings: dishData.servings,
          servingSize: extraction.basic.servingSize,
          ingredients: extraction.ingredients,
          sourceNutrition: evidence?.nutrition
            ? { url: evidence.sourceUrl, values: evidence.nutrition }
            : null,
          aiIngredientFallback: (items) => this.ai.estimateIngredientNutrition(items),
          aiDishFallback: () => this.ai.estimateNutrition(dishData.name, normalizedIngredients),
        }),
        this.resolveCoverImage(dishData.name, evidence),
        this.stepImages.attach({
          jobId: id,
          steps: extraction.recipe.steps,
          evidences: discovery.sources.map((source) => source.evidence),
        }).catch((error) => {
          this.logger.warn(`Step image attach failed: ${(error as Error).message}`);
          return { assignments: [], missingSteps: [], warnings: ['STEP_IMAGE_FAILED'] };
        }),
      ]);
      this.log(id, 'ENRICHING', 5,
        `Dinh dưỡng (${this.nutritionMethodLabel(nutrition.method)}, tin cậy ${nutrition.confidence}%): ${nutrition.perServing.calories} kcal, ${nutrition.perServing.proteinG}g đạm / phần`,
        `Coverage ${nutrition.provenance.coveragePct}% khối lượng | Nguồn: ${nutrition.provenance.references.map((r) => r.provider).join(', ') || 'AI'}${nutrition.provenance.uncovered.length ? ` | Chưa khớp: ${nutrition.provenance.uncovered.slice(0, 5).join(', ')}` : ''}`,
      );
      this.log(id, 'ENRICHING', 5,
        `Ảnh đại diện: ${suggestedImageUrl ? 'tìm được' : 'không có'} | Ảnh bước: ${stepImages.assignments.length}/${extraction.recipe.steps.length}`,
        stepImages.missingSteps.length ? `Bước thiếu ảnh: ${stepImages.missingSteps.join(', ')}` : undefined,
      );
      if (stepImages.missingSteps.length && discovery.sources.length) {
        warnings.push({
          code: 'STEP_IMAGE_MISSING',
          fieldPath: 'recipe.steps',
          message: `Các bước ${stepImages.missingSteps.join(', ')} chưa có ảnh từ nguồn.`,
          severity: 'WARNING',
        });
      }

      // ── Bước 6: Tạo bản nháp ──────────────────────────────────────────────
      if (!(await this.isRunning(id))) return;
      await this.startStep(id, 'DRAFTING', 6, 'Đang tạo bản nháp món ăn trong hệ thống...');
      const finalSlug = existing ? `${slug}-${Date.now()}` : slug;
      const regionId = origin.regionId ?? (await this.resolveRegionId(dto.regionHint));
      const storedImage = suggestedImageUrl
        ? await this.prepareDishMedia(
            suggestedImageUrl,
            dishData.name,
            evidence?.imageUrl === suggestedImageUrl
              ? `Ảnh từ ${discovery.best?.domain ?? 'nguồn công thức'}`
              : undefined,
          )
        : undefined;
      const stepImageByOrder = new Map(stepImages.assignments.map((item) => [item.step, item]));
      const sources = this.buildSources(discovery, nutrition.provenance.references);
      const persisted = await this.draftPersistence.persist({
        jobId: id,
        actorId: actorId ?? (await this.store.get(id))?.actorId,
        aggregate: {
          name: (dishData.name ?? '').substring(0, 148),
          slug: finalSlug.substring(0, 175),
          shortDescription: (dishData.shortDescription ?? '').substring(0, 298),
          difficulty: dishData.difficulty,
          prepMinutes: dishData.prepMinutes,
          cookMinutes: dishData.cookMinutes,
          servings: dishData.servings,
          priceMin: dishData.priceMin,
          priceMax: dishData.priceMax,
          dineOutPriceMin: pricing.dineOut.min,
          dineOutPriceMax: pricing.dineOut.max,
          dishType: rules.dishType,
          videoUrl: discovery.videoUrl,
          recipeTitle: extraction.recipe.title,
          flavorTags: extraction.classification.flavorCodes,
          regionId,
          provinceId: origin.provinceId,
          originText: origin.originText,
          alternateNames: extraction.basic.alternateNames,
          fullDescription: extraction.basic.fullDescription ?? null,
          sources,
          ingredients: extraction.ingredients.map((ing, idx) => {
            const resolution = resolutions[idx];
            const catalogHit = provisioned.byClientRef.get(`ai-${idx}`);
            // Kho (catalog) là nguồn sự thật; resolver in-memory chỉ bổ trợ.
            const linkedId =
              catalogHit?.ingredientId ??
              resolution?.matchedIngredientId ??
              null;
            const resolutionMethod =
              catalogHit?.outcome === 'EXISTING_EXACT'
                ? 'EXACT'
                : catalogHit?.outcome === 'EXISTING_SYNONYM'
                  ? 'ALIAS'
                  : catalogHit?.outcome === 'EXISTING_NORMALIZED'
                    ? 'NORMALIZED'
                    : catalogHit?.outcome === 'CREATED_PENDING'
                      ? 'NORMALIZED'
                      : resolution?.matchMethod ?? 'NONE';
            return {
              ingredientId: linkedId,
              rawText: ing.rawText.substring(0, 198),
              parsedName: ing.name.substring(0, 198),
              quantity: ing.quantity,
              quantityTo: ing.quantityTo,
              quantityText: ing.quantityText?.substring(0, 98) ?? null,
              unit: ing.unitCode?.substring(0, 48) ?? null,
              preparation: [ing.preparation, ing.specification]
                .filter(Boolean)
                .join('; ')
                .substring(0, 498) || null,
              specification: ing.specification?.substring(0, 198) ?? null,
              normalizedWeightG: ing.normalizedWeightGram,
              parseMetadata: ing.parseMetadata
                ? (ing.parseMetadata as unknown as Prisma.InputJsonValue)
                : undefined,
              groupLabel: ing.group?.substring(0, 98) ?? null,
              sortOrder: idx,
              isOptional: ing.optional,
              resolutionMethod,
              resolutionConfidence:
                linkedId != null
                  ? catalogHit?.isNew
                    ? 80
                    : (catalogHit?.confidence ?? Math.max(resolution?.confidence ?? 0, 90))
                  : Math.max(catalogHit?.confidence ?? 0, resolution?.confidence ?? 0),
              resolutionCandidates:
                catalogHit?.candidates?.length
                  ? (JSON.parse(JSON.stringify(catalogHit.candidates)) as object)
                  : resolution?.candidates,
              needsReview:
                !linkedId ||
                catalogHit?.outcome === 'CREATED_PENDING' ||
                (catalogHit?.confidence ?? resolution?.confidence ?? 0) < 90,
            };
          }),
          nutrition: {
            servingName: (nutrition.servingName ?? '').substring(0, 98),
            servingG: nutrition.servingG,
            calories: nutrition.perServing.calories,
            proteinG: nutrition.perServing.proteinG,
            carbsG: nutrition.perServing.carbsG,
            fatG: nutrition.perServing.fatG,
            fiberG: nutrition.perServing.fiberG,
            sodiumMg: nutrition.perServing.sodiumMg,
            basis: 'PER_SERVING',
            servings: dishData.servings,
            method: nutrition.method,
            confidence: nutrition.confidence,
            sourceUrl: nutrition.sourceUrl,
            provenance: JSON.parse(JSON.stringify({
              ...nutrition.provenance,
              wholeRecipe: nutrition.wholeRecipe,
            })) as Prisma.InputJsonValue,
          },
          recipeSteps: (dishData.steps ?? []).map((step: any) => ({
            stepOrder: step.stepNumber,
            instruction: [
              step.title ? `**${step.title}**` : '',
              step.description ?? '',
              step.tips ? `💡 Mẹo: ${step.tips}` : '',
            ]
              .filter(Boolean)
              .join('\n'),
            durationMin: step.durationMinutes ?? null,
            imageUrl: stepImageByOrder.get(step.stepNumber)?.imageUrl ?? null,
          })),
          media: storedImage ? [storedImage] : undefined,
          categoryIds: this.taxonomyIds(
            extraction.classification.categoryCodes,
            taxonomySnapshot.categories,
          ),
          mealTypeIds: this.taxonomyIds(
            extraction.classification.mealTypeCodes,
            taxonomySnapshot.mealTypes,
          ),
          dietTypeIds: this.taxonomyIds(
            extraction.classification.dietTypeCodes,
            taxonomySnapshot.dietTypes,
          ),
          goals: this.taxonomyIds(
            extraction.classification.goalCodes,
            taxonomySnapshot.goals,
          ).map((goalId) => ({ goalId, score: 50 })),
        },
        warnings,
        unresolvedFields: warnings
          .filter((warning) => warning.severity !== 'WARNING')
          .map((warning) => warning.fieldPath),
        taxonomySnapshotVersion: taxonomySnapshot.version,
        fieldMetadata: JSON.parse(JSON.stringify({
          schemaVersion: extraction.schemaVersion,
          originConfidence: origin.confidence,
          origin: {
            source: origin.source,
            regionCode: origin.regionCode,
            provinceCode: origin.provinceCode,
            originText: origin.originText,
            notes: origin.notes,
          },
          classificationConfidence: extraction.classification.confidenceByField,
          classificationRule: rules.categoryRule,
          dishType: rules.dishType,
          pricing: {
            homeCook: pricing.homeCook,
            dineOut: pricing.dineOut,
            note: pricing.note,
            reliable: pricing.reliable,
            source: pricing.source,
          },
          nutrition: {
            method: nutrition.method,
            confidence: nutrition.confidence,
            coveragePct: nutrition.provenance.coveragePct,
            references: nutrition.provenance.references,
          },
          stepImages: stepImages.assignments.map((item) => ({
            step: item.step,
            sourceUrl: item.sourceUrl,
            credit: item.credit,
            storageKey: item.storageKey,
            matchedBy: item.matchedBy,
          })),
          stepImagesMissing: stepImages.missingSteps,
          video: discovery.videoUrl
            ? { url: discovery.videoUrl, title: discovery.videoTitle, source: discovery.videoSource }
            : null,
          recipeSource: discovery.best
            ? {
                url: discovery.best.url,
                domain: discovery.best.domain,
                title: discovery.best.title,
                stepsWithImages: discovery.best.stepsWithImages,
                hasVideo: discovery.best.hasVideo,
              }
            : null,
          discoveryWarnings: discovery.warnings,
        })) as Prisma.InputJsonValue,
        auditMetadata: {
          sourceTypes: dto.sourceTypes ?? ['AI_GENERATED'],
          query: dto.query,
          suggestedImageUrl: suggestedImageUrl ?? null,
          sourceUrls: discovery.sources.map((source) => source.url),
        },
      });
      const dishId = persisted.dishId;
      this.log(id, 'DRAFTING', 6,
        `Đã tạo bản nháp thành công!`,
        `Dish ID: ${dishId} | Slug: ${finalSlug}`,
      );
      this.log(id, 'DRAFTING', 6,
        `Xuất xứ: ${origin.originText ?? 'chưa rõ'} | Loại: ${rules.dishType === 'WET' ? 'Món nước' : 'Món khô'} | Nấu nhà ${this.formatPrice(pricing.homeCook.min)}-${this.formatPrice(pricing.homeCook.max)} | Ăn ngoài ${this.formatPrice(pricing.dineOut.min)}-${this.formatPrice(pricing.dineOut.max)}/phần`,
        `${stepImages.assignments.length}/${extraction.recipe.steps.length} bước có ảnh | Video: ${discovery.videoUrl ? 'có' : 'không'} | ${sources.length} nguồn`,
      );

      // ── Hoàn thành ────────────────────────────────────────────────────────
      await this.store.update(id, {
        status: 'DONE',
        progress: 100,
        currentStep: 6,
        currentStepName: 'Hoàn tất',
        currentStepMessage: `Bản nháp "${dishData.name}" đã sẵn sàng để kiểm duyệt`,
        resultDishId: dishId,
        suggestedImageUrl: suggestedImageUrl ?? undefined,
        pendingIngredientCount,
        completedAt: new Date().toISOString(),
      });
      const job = (await this.store.get(id))!;
      this.emitProgress(job, `Hoàn tất! Bản nháp "${dishData.name}" đã được tạo.`, 'DONE');

    } catch (err: any) {
      if (await this.store.isCancellationRequested(id)) return;
      this.logger.error(`Pipeline error job ${id}: ${err.message}`);
      await this.store.update(id, {
        status: 'FAILED',
        errorMessage: err.message,
        completedAt: new Date().toISOString(),
      });
      const job = (await this.store.get(id))!;
      this.emitProgress(job, `Lỗi: ${err.message}`, 'FAILED');
    } finally {
      this.running.delete(id);
    }
  }

  private async startStep(
    id: string,
    status: ImportJobStatus,
    stepIndex: number,
    message: string,
  ): Promise<void> {
    const pct = STEPS[stepIndex - 1]?.pct ?? 0;
    const name = STEPS[stepIndex - 1]?.name ?? status;
    await this.store.update(id, {
      status,
      currentStep: stepIndex,
      currentStepName: name,
      currentStepMessage: message,
      progress: pct,
    });
    const job = (await this.store.get(id))!;
    this.emitProgress(job, message, status);
  }

  /** Bước SEARCHING: Tavily trusted domains -> fetch -> JSON-LD. Fail-soft. */
  private async discoverSources(id: string, dishName: string): Promise<RecipeDiscoveryResult> {
    const empty: RecipeDiscoveryResult = {
      candidates: [], sources: [], best: null, videoUrl: null, videoTitle: null, videoSource: null, warnings: [],
    };
    try {
      const discovery = await this.sourceDiscovery.discover(dishName, this.ai, { maxCandidates: 3 });
      if (discovery.warnings.includes('WEBSITE_JSONLD_DISABLED')) {
        this.log(id, 'SEARCHING', 1, 'Tìm nguồn công thức đang tắt (AI_IMPORT_ENABLE_WEBSITE_JSONLD=false)');
        return discovery;
      }
      if (discovery.best) {
        this.log(id, 'SEARCHING', 1,
          `Tìm thấy ${discovery.sources.length}/${discovery.candidates.length} nguồn có công thức, chọn ${discovery.best.domain} (${discovery.best.stepsWithImages}/${discovery.best.evidence.steps.length} bước có ảnh, video: ${discovery.videoUrl ? 'có' : 'không'})`,
          discovery.best.url,
        );
      } else {
        this.log(id, 'SEARCHING', 1,
          `Không tìm được nguồn công thức có JSON-LD (${discovery.candidates.length} ứng viên)`,
          discovery.warnings.join(', ') || undefined,
        );
      }
      if (discovery.videoUrl && discovery.videoSource === 'TAVILY_YOUTUBE') {
        this.log(id, 'SEARCHING', 1, `Video YouTube: ${discovery.videoTitle ?? discovery.videoUrl}`, discovery.videoUrl);
      }
      return discovery;
    } catch (error) {
      this.logger.warn(`Source discovery failed for "${dishName}": ${(error as Error).message}`);
      this.log(id, 'SEARCHING', 1, 'Tìm nguồn thất bại, tiếp tục với AI', (error as Error).message);
      return { ...empty, warnings: ['SOURCE_DISCOVERY_FAILED'] };
    }
  }

  /**
   * Đối chiếu nguyên liệu theo 4 lớp để KHÔNG sinh bản ghi trùng:
   *  L1 deterministic (identity / synonym / fold / canonical) → link ngay.
   *  L2 heuristic (core, containment, pg_trgm) → chỉ ra ứng viên.
   *  L3 AI phân xử 1 lần cho các item còn ứng viên → link + học synonym.
   *  L4 chỉ tạo PENDING khi AI xác nhận khác hoặc không có ứng viên nào.
   */
  private async reconcileIngredients(
    jobId: string,
    dishName: string,
    inputs: Array<{ clientRef: string; rawName: string; rawText: string; unit?: string }>,
  ): Promise<ResolveOrProvisionBatchResult> {
    const base = inputs.map(({ clientRef, rawName, unit }) => ({ clientRef, rawName, unit }));

    // Vòng 1: L1 + L2, không tạo mới gì cả.
    const pass1 = await this.ingredientCatalog.resolveOrProvisionBatch(base, {
      createMissing: false,
      enqueueImageEnrichment: false,
      createdVia: IngredientCreatedVia.AI_IMPORT,
    });
    const linked1 = pass1.items.filter((i) => i.ingredientId).length;
    this.log(jobId, 'RECONCILING', 4,
      `Khớp trực tiếp ${linked1}/${pass1.items.length} nguyên liệu với kho`,
      pass1.items
        .filter((i) => i.ingredientId && i.outcome !== 'EXISTING_EXACT')
        .map((i) => `"${inputs.find((x) => x.clientRef === i.clientRef)?.rawName}" → ${i.canonicalName} (${i.outcome})`)
        .join('; ') || undefined,
    );

    // Vòng 2: AI phân xử các item chưa link nhưng có ứng viên.
    const undecided = pass1.items.filter((i) => !i.ingredientId && i.candidates.length > 0);
    const decisionByRef = new Map<string, { matchId: string | null; confidence: number; synonyms: string[] }>();
    if (undecided.length) {
      const decisions = await this.ai.adjudicateIngredientMatches({
        dishName,
        allIngredientNames: inputs.map((i) => i.rawName),
        items: undecided.map((i) => {
          const input = inputs.find((x) => x.clientRef === i.clientRef)!;
          return {
            ref: i.clientRef,
            name: input.rawName,
            rawText: input.rawText,
            candidates: i.candidates.map((c) => ({
              id: c.id,
              name: c.name,
              synonyms: c.synonyms,
              score: c.score,
            })),
          };
        }),
      });
      for (const d of decisions) decisionByRef.set(d.ref, d);
      const merged = decisions.filter((d) => d.matchId && d.confidence >= 85);
      this.log(jobId, 'RECONCILING', 4,
        `AI phân xử ${undecided.length} nguyên liệu gần giống: gộp ${merged.length}, giữ riêng ${undecided.length - merged.length}`,
        merged
          .map((d) => {
            const input = inputs.find((x) => x.clientRef === d.ref);
            const target = undecided.find((u) => u.clientRef === d.ref)?.candidates.find((c) => c.id === d.matchId);
            return `"${input?.rawName}" = ${target?.name} (${d.confidence}%)`;
          })
          .join('; ') || undefined,
      );
    }

    // Vòng 3: link theo quyết định AI + tạo PENDING cho phần còn lại.
    const pass2Inputs: ResolveOrProvisionInput[] = inputs.map(({ clientRef, rawName, unit }) => {
      const first = pass1.byClientRef.get(clientRef);
      if (first?.ingredientId) {
        return {
          clientRef,
          rawName,
          unit,
          preResolvedIngredientId: first.ingredientId,
          preResolvedConfidence: first.confidence,
        };
      }
      const decision = decisionByRef.get(clientRef);
      if (decision?.matchId && decision.confidence >= 85) {
        return {
          clientRef,
          rawName,
          unit,
          preResolvedIngredientId: decision.matchId,
          preResolvedConfidence: decision.confidence,
        };
      }
      return { clientRef, rawName, unit };
    });

    const pass2 = await this.ingredientCatalog.resolveOrProvisionBatch(pass2Inputs, {
      createMissing: true,
      createAmbiguous: true, // đã qua AI phân xử → được phép tạo
      enqueueImageEnrichment: true,
      createdVia: IngredientCreatedVia.AI_IMPORT,
    });

    // Preserve outcome/candidates từ vòng 1 cho item được link lại ở vòng 3
    // (vòng 3 đánh dấu preResolved là EXISTING_SYNONYM).
    for (const item of pass2.items) {
      const first = pass1.byClientRef.get(item.clientRef);
      if (first?.ingredientId && item.ingredientId === first.ingredientId) {
        item.outcome = first.outcome;
        item.confidence = first.confidence;
      } else if (item.isNew && first?.candidates?.length) {
        item.candidates = first.candidates;
      }
    }
    pass2.byClientRef = new Map(
      pass2.items.map((i) => {
        const { imageStatus: _is, enrichmentQueued: _eq, ...rest } = i;
        return [i.clientRef, rest];
      }),
    );

    // Học synonyms AI gợi ý cho các nguyên liệu MỚI tạo (giúp lần sau khớp L1).
    const learn: Array<{ id: string; synonyms: string[] }> = [];
    for (const item of pass2.items) {
      if (!item.isNew || !item.ingredientId) continue;
      const d = decisionByRef.get(item.clientRef);
      if (d?.synonyms?.length) learn.push({ id: item.ingredientId, synonyms: d.synonyms });
    }
    if (learn.length) {
      await this.ingredientCatalog.learnSynonyms(learn).catch((err) =>
        this.logger.warn(`learnSynonyms failed: ${(err as Error).message}`),
      );
    }

    return pass2;
  }

  /** Tách giá nấu nhà (toàn công thức) và ăn ngoài (1 phần); fallback về priceMin/Max cũ. */
  private resolvePricing(extraction: DishExtractionV11, hasSource: boolean) {
    const pricing = extraction.basic.pricing;
    const clean = (value: number | null | undefined): number | null =>
      typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : null;
    let homeMin = clean(pricing?.homeCook?.min) ?? clean(extraction.basic.priceMin);
    let homeMax = clean(pricing?.homeCook?.max) ?? clean(extraction.basic.priceMax);
    if (homeMin && homeMax && homeMax < homeMin) [homeMin, homeMax] = [homeMax, homeMin];
    if (homeMin && !homeMax) homeMax = homeMin;
    if (!homeMin && homeMax) homeMin = homeMax;

    let dineMin = clean(pricing?.dineOut?.min);
    let dineMax = clean(pricing?.dineOut?.max);
    if (dineMin && dineMax && dineMax < dineMin) [dineMin, dineMax] = [dineMax, dineMin];
    if (dineMin && !dineMax) dineMax = dineMin;
    if (!dineMin && dineMax) dineMin = dineMax;
    // Fallback: nếu AI không tách giá ăn ngoài -> ước lượng từ giá nấu nhà / khẩu phần x hệ số quán (~2x).
    let source: 'AI_PRICING' | 'LEGACY' | 'DERIVED' = pricing?.dineOut ? 'AI_PRICING' : 'LEGACY';
    if (!dineMin && homeMin) {
      const servings = Math.max(1, extraction.basic.servings || 1);
      dineMin = Math.round((homeMin / servings) * 2 / 1000) * 1000;
      dineMax = Math.round(((homeMax ?? homeMin) / servings) * 2.5 / 1000) * 1000;
      source = 'DERIVED';
    }
    return {
      homeCook: { min: homeMin ?? 0, max: homeMax ?? 0, basis: 'WHOLE_RECIPE' as const },
      dineOut: { min: dineMin ?? null, max: dineMax ?? null, basis: 'PER_SERVING' as const },
      note: pricing?.note ?? null,
      reliable: hasSource && source === 'AI_PRICING',
      source,
    };
  }

  /** Ảnh đại diện: Recipe.image từ nguồn JSON-LD trước, sau đó pipeline tìm ảnh cũ. */
  private async resolveCoverImage(
    dishName: string,
    evidence: RecipeEvidence | null,
  ): Promise<string | null> {
    if (evidence?.imageUrl && /^https?:\/\//i.test(evidence.imageUrl)) return evidence.imageUrl;
    try {
      return await this.ai.searchDishImage(dishName);
    } catch (error) {
      this.logger.warn(`searchDishImage failed: ${(error as Error).message}`);
      return null;
    }
  }

  private buildSources(
    discovery: RecipeDiscoveryResult,
    nutritionReferences: Array<{ provider: string; title: string; url: string }>,
  ): NonNullable<DishDraftAggregate['sources']> {
    const sources: NonNullable<DishDraftAggregate['sources']> = [];
    const seen = new Set<string>();
    const push = (item: NonNullable<DishDraftAggregate['sources']>[number]) => {
      if (!item.url || seen.has(item.url)) return;
      seen.add(item.url);
      sources.push({
        ...item,
        url: item.url.substring(0, 2000),
        title: item.title?.substring(0, 298) ?? null,
        domain: item.domain?.substring(0, 198) ?? null,
      });
    };
    for (const source of discovery.sources) {
      push({
        url: source.url,
        title: source.title,
        domain: source.domain,
        sourceType: 'JSON_LD',
        reliability: source === discovery.best ? 85 : 75,
      });
    }
    if (discovery.videoUrl) {
      push({
        url: discovery.videoUrl,
        title: discovery.videoTitle ?? null,
        domain: 'youtube.com',
        sourceType: 'VIDEO',
        reliability: discovery.videoSource === 'JSON_LD' ? 85 : 80,
      });
    }
    for (const reference of nutritionReferences) {
      push({
        url: reference.url,
        title: reference.title,
        domain: this.safeDomain(reference.url),
        sourceType: 'NUTRITION',
        reliability: 90,
      });
    }
    return sources;
  }

  private safeDomain(url: string): string | null {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }

  private nutritionMethodLabel(method: string): string {
    switch (method) {
      case 'SOURCE_VERIFIED': return 'theo nguồn công thức';
      case 'INGREDIENT_CALCULATED': return 'tính từ nguyên liệu VFCT/USDA';
      default: return 'AI ước lượng';
    }
  }

  private formatPrice(value: number | null | undefined): string {
    if (!value) return '?';
    return `${Math.round(value / 1000)}k`;
  }

  private toLegacyDishData(extraction: DishExtractionV11) {
    return {
      name: extraction.basic.name,
      shortDescription: extraction.basic.shortDescription,
      difficulty: extraction.basic.difficulty,
      prepMinutes: extraction.basic.prepMinutes,
      cookMinutes: extraction.basic.cookMinutes,
      priceMin: extraction.basic.priceMin ?? 0,
      priceMax: extraction.basic.priceMax ?? 0,
      servings: extraction.basic.servings,
      servingSize: extraction.basic.servingSize ?? '1 phần',
      ingredients: extraction.ingredients.map((ingredient) => ({
        name: ingredient.name,
        quantity: ingredient.quantity ?? 1,
        unit: ingredient.unitCode ?? '',
        preparation: ingredient.preparation ?? undefined,
        group: ingredient.group ?? undefined,
      })),
      steps: extraction.recipe.steps.map((step) => ({
        stepNumber: step.stepNumber,
        title: step.title,
        description: step.description,
        durationMinutes: step.durationMinutes ?? 0,
        tips: step.tips ?? undefined,
      })),
      tips: extraction.generalTips ?? [],
      tags: [
        ...extraction.classification.categoryCodes,
        ...extraction.classification.mealTypeCodes,
      ],
    };
  }

  private async log(id: string, step: string, stepIndex: number, message: string, detail?: string): Promise<void> {
    const logEntry: ImportJobLogDto = {
      step,
      stepIndex,
      message,
      detail,
      timestamp: new Date().toISOString(),
    };
    await this.store.addLog(id, logEntry);
    this.logger.debug(`[Job ${id}] [${step}] ${message}`);
  }

  private emitProgress(job: ImportJobDto, message: string, status: ImportJobStatus): void {
    const sequence = (this.eventSequences.get(job.id) ?? 0) + 1;
    this.eventSequences.set(job.id, sequence);
    const payload: WsJobProgress = {
      eventId: `${job.id}:${sequence}`,
      sequence,
      occurredAt: new Date().toISOString(),
      jobId: job.id,
      status,
      step: job.currentStepName ?? status,
      stepIndex: job.currentStep,
      totalSteps: 6,
      progress: job.progress,
      message,
      resultDishId: job.resultDishId,
      suggestedImageUrl: (job as any).suggestedImageUrl,
      pendingIngredientCount: (job as any).pendingIngredientCount,
      errorMessage: job.errorMessage,
    };
    this.gateway.emitProgress(payload);
  }

  private async isRunning(id: string): Promise<boolean> {
    return this.running.has(id) && !(await this.store.isCancellationRequested(id));
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private normalizeIngredients(
    ingredients: Array<{ name: string; quantity: number; unit: string; preparation?: string }>,
  ) {
    const unitMap: Record<string, { factor: number; toUnit: string }> = {
      'chén': { factor: 240, toUnit: 'ml' },
      'ly': { factor: 240, toUnit: 'ml' },
      'muỗng canh': { factor: 15, toUnit: 'ml' },
      'muỗng cà phê': { factor: 5, toUnit: 'ml' },
      'tbsp': { factor: 15, toUnit: 'ml' },
      'tsp': { factor: 5, toUnit: 'ml' },
    };

    return ingredients.map((ing) => {
      const unitLower = (ing.unit ?? '').toLowerCase().trim();
      const map = unitMap[unitLower];
      if (map) {
        return { ...ing, quantity: ing.quantity * map.factor, unit: map.toUnit };
      }
      return ing;
    });
  }

  private regionHintToName(hint: string): string {
    const map: Record<string, string> = {
      north: 'Miền Bắc',
      south: 'Miền Nam',
      central: 'Miền Trung',
    };
    return map[hint.toLowerCase()] ?? hint;
  }

  private async resolveRegionId(regionHint?: string): Promise<string | undefined> {
    if (!regionHint) return undefined;
    const region = await this.prisma.db.region.findFirst({
      where: { code: regionHint.toLowerCase() },
      select: { id: true },
    });
    return region?.id;
  }

  private buildIngredientRawText(ingredient: any): string {
    return [
      ingredient.quantity,
      ingredient.unit,
      ingredient.name,
      ingredient.preparation ? `(${ingredient.preparation})` : undefined,
    ]
      .filter((part) => part !== undefined && part !== null && part !== '')
      .join(' ');
  }

  private taxonomyIds(
    codes: string[],
    items: Array<{ id: string; code: string }>,
  ): string[] {
    const wanted = new Set(codes);
    return items.filter((item) => wanted.has(item.code)).map((item) => item.id);
  }

  /**
   * Storage is external to PostgreSQL, so upload happens before the DB
   * transaction. The DishMedia row itself is still committed atomically with
   * the aggregate and remains PENDING moderation.
   */
  private async prepareDishMedia(imageUrl: string, dishName: string, credit?: string) {
    const storageKey = await this.uploadImageFromUrl(imageUrl, `ai-import/${randomUUID()}`);
    if (!storageKey) return undefined;
    return {
      storageKey,
      bucket: this.storageBucket,
      mimeType: this.mimeTypeFromStorageKey(storageKey),
      sizeBytes: 0,
      altText: dishName.substring(0, 298),
      credit: (credit ?? 'Nguồn ảnh gợi ý từ trang công thức/Wikipedia/Unsplash').substring(0, 298),
      sourceUrl: imageUrl,
      isPrimary: true,
      sortOrder: 0,
    };
  }

  private mimeTypeFromStorageKey(storageKey: string): string {
    if (storageKey.endsWith('.png')) return 'image/png';
    if (storageKey.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  }

  /** Download ảnh từ external URL và upload lên Supabase Storage → trả về storageKey */
  private async uploadImageFromUrl(imageUrl: string, dishId: string): Promise<string | null> {
    try {
      const res = await fetch(imageUrl);
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') ?? 'image/jpeg';
      const mimeType = contentType.split(';')[0].trim();
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return null;

      const buffer = Buffer.from(await res.arrayBuffer());
      const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
      const storageKey = `dishes/${dishId}/ai-cover-${Date.now()}.${ext}`;

      const { error } = await this.supabase.storage
        .from(this.storageBucket)
        .upload(storageKey, buffer, { contentType: mimeType, upsert: true });

      if (error) {
        this.logger.warn(`Upload ảnh AI thất bại: ${error.message}`);
        return null;
      }
      this.logger.debug(`Đã upload ảnh AI → ${storageKey}`);
      return storageKey;
    } catch (e: any) {
      this.logger.warn(`uploadImageFromUrl error: ${e.message}`);
      return null;
    }
  }

  private async createDishDraft(
    dto: CreateImportJobDto,
    dishData: any,
    ingredients: any[],
    nutrition: any,
    slug: string,
    ingredientIds: Array<{ name: string; id: string; isNew: boolean }> = [],
    suggestedImageUrl?: string,
  ): Promise<string> {
    // Tìm region nếu có hint
    let regionId: string | undefined;
    if (dto.regionHint) {
      const regionMap: Record<string, string> = { north: 'north', south: 'south', central: 'central' };
      const region = await this.prisma.db.region.findFirst({
        where: { code: regionMap[dto.regionHint.toLowerCase()] ?? dto.regionHint },
        select: { id: true },
      }).catch(() => null);
      regionId = region?.id;
    }

    // Truncate các trường text để tránh lỗi "value too long for column"
    // name: VarChar(150), slug: VarChar(180), shortDescription: VarChar(300)
    const safeName = (dishData.name ?? '').substring(0, 148);
    const safeShortDesc = (dishData.shortDescription ?? '').substring(0, 298);
    const safeSlug = slug.substring(0, 175);
    const searchText = [safeName, safeShortDesc].join(' ').toLowerCase().substring(0, 2000);

    const dish = await this.prisma.db.dish.create({
      data: {
        name: safeName,
        slug: safeSlug,
        searchText,
        shortDescription: safeShortDesc,
        difficulty: dishData.difficulty,
        prepMinutes: dishData.prepMinutes,
        cookMinutes: dishData.cookMinutes,
        servings: dishData.servings,
        priceMin: dishData.priceMin,
        priceMax: dishData.priceMax,
        status: 'DRAFT',
        regionId,
        // Nguyên liệu — link ingredientId nếu đã upsert được
        dishIngredients: {
          create: ingredients.map((ing: any, idx: number) => {
            // Tìm ingredientId đã upsert khớp tên
            const matched = ingredientIds.find(
              r => r.name.toLowerCase() === (ing.name ?? '').toLowerCase()
            );
            const rawText = `${ing.quantity} ${ing.unit} ${ing.name}${ing.preparation ? ` (${ing.preparation})` : ''}`;
            return {
              rawText: rawText.substring(0, 198),
              quantity: typeof ing.quantity === 'number' ? ing.quantity : parseFloat(ing.quantity) || 0,
              unit: (ing.unit ?? '').substring(0, 48),
              preparation: ing.preparation ? ing.preparation.substring(0, 98) : null,
              sortOrder: idx,
              ingredientId: matched?.id ?? null,
            };
          }),
        },
        // Dinh dưỡng (1-1 relation tên là "nutrition" trong schema)
        nutrition: {
          create: {
            servingName: (nutrition.servingName ?? '').substring(0, 98),
            servingG: nutrition.servingG,
            calories: nutrition.calories,
            proteinG: nutrition.proteinG,
            carbsG: nutrition.carbsG,
            fatG: nutrition.fatG,
            fiberG: nutrition.fiberG,
            sodiumMg: nutrition.sodiumMg,
          },
        },
        // Các bước nấu — lưu đầy đủ tiêu đề, nội dung, thời gian, mẹo
        recipeSteps: {
          create: (dishData.steps ?? []).map((s: any) => ({
            stepOrder: s.stepNumber,
            instruction: [
              s.title ? `**${s.title}**` : '',
              s.description ?? '',
              s.tips ? `💡 Mẹo: ${s.tips}` : '',
            ].filter(Boolean).join('\n'),
            durationMin: s.durationMinutes ?? null,
          })),
        },
      },
      select: { id: true },
    });

    // ── Upload ảnh AI vào Supabase Storage và tạo DishMedia record ────────────
    if (suggestedImageUrl) {
      const storageKey = await this.uploadImageFromUrl(suggestedImageUrl, dish.id);
      if (storageKey) {
        await this.prisma.db.dishMedia.create({
          data: {
            dishId: dish.id,
            type: 'IMAGE',
            storageKey,
            bucket: this.storageBucket,
            mimeType: 'image/jpeg',
            sizeBytes: 0,         // không biết chính xác khi upload từ URL
            altText: dishData.name,
            credit: 'AI Generated via Unsplash/Wikipedia',
            sourceUrl: suggestedImageUrl,
            isPrimary: true,
            moderationStatus: 'APPROVED', // AI import → auto-approve ảnh
            sortOrder: 0,
          },
        });
        this.logger.log(`DishMedia created for dish ${dish.id} → ${storageKey}`);
      }
    }

    return dish.id;
  }
}
