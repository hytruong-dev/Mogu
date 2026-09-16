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
import { DishExtractionV11, IngredientCandidate } from './ai-import.types';
import { DishExtractionV11Schema } from './dish-extraction.schema';
import { IngredientCatalogService } from '../ingredients/ingredient-catalog.service';

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

    try {
      // ── Bước 1: Tìm nguồn ─────────────────────────────────────────────────
      if (!(await this.isRunning(id))) return;
      await this.startStep(id, 'SEARCHING', 1, `Đang phân tích yêu cầu cho món "${dto.query}"...`);
      const taxonomySnapshot = await this.taxonomy.load();
      this.log(id, 'SEARCHING', 1, `Đã nạp taxonomy snapshot ${taxonomySnapshot.version}`);

      // ── Bước 2: Trích xuất AI ─────────────────────────────────────────────
      if (!(await this.isRunning(id))) return;
      await this.startStep(id, 'EXTRACTING', 2, 'Đang gọi AI để sinh công thức và nguyên liệu...');
      const regionName = dto.regionHint ? this.regionHintToName(dto.regionHint) : undefined;
      let extraction = await this.ai.extractDish({
        dishName: dto.query,
        regionName,
        relatedKeywords: dto.relatedKeywords,
        taxonomy: taxonomySnapshot,
      });
      this.log(id, 'EXTRACTING', 2,
        `AI đã sinh schema v1.1: ${extraction.ingredients.length} nguyên liệu, ${extraction.recipe.steps.length} bước nấu`,
        `Snapshot: ${taxonomySnapshot.version}`,
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
            quantity: ingredient.quantity ?? parsed.quantity,
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
      const rules = this.classificationRules.evaluate({
        candidate: extraction.classification,
        ingredients: resolutions,
        dictionary: ingredientDictionary,
        isRegionalSpecialty: extraction.basic.origin.isRegionalSpecialty,
        priceEvidenceReliable: false,
      });
      extraction = {
        ...extraction,
        classification: {
          ...extraction.classification,
          categoryCodes: rules.categoryCodes,
          mealTypeCodes: rules.mealTypeCodes,
          goalCodes: rules.goalCodes,
          dietTypeCodes: rules.dietTypeCodes,
          flavorCodes: rules.flavorCodes,
        },
      };
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
      this.log(id, 'RECONCILING', 4, `Đang upsert ${normalizedIngredients.length} nguyên liệu vào kho...`);

      const provisioned = await this.ingredientCatalog.resolveOrProvisionBatch(
        normalizedIngredients.map((ing, idx) => ({
          clientRef: `ai-${idx}`,
          rawName: ing.name,
          unit: ing.unit || undefined,
        })),
        { createMissing: true, enqueueImageEnrichment: true },
      );
      const newCount = provisioned.createdIds.length;
      this.log(id, 'RECONCILING', 4,
        `Đã xử lý ${provisioned.items.length} nguyên liệu`,
        `Mới: ${newCount} | Đã tồn tại: ${provisioned.items.length - newCount}`,
      );

      // ── Bước 5: Làm giàu dữ liệu (Nutrition + Image) ─────────────────────
      if (!(await this.isRunning(id))) return;
      await this.startStep(id, 'ENRICHING', 5, 'Đang ước tính dinh dưỡng và tìm ảnh đại diện...');
      const [nutrition, suggestedImageUrl] = await Promise.all([
        this.ai.estimateNutrition(dishData.name, normalizedIngredients),
        this.ai.searchDishImage(dishData.name),
      ]);
      this.log(id, 'ENRICHING', 5,
        `Dinh dưỡng: ${nutrition.calories} kcal, ${nutrition.proteinG}g đạm`,
        `Carbs: ${nutrition.carbsG}g | Fat: ${nutrition.fatG}g${suggestedImageUrl ? ' | Ảnh: tìm được' : ''}`,
      );

      // ── Bước 6: Tạo bản nháp ──────────────────────────────────────────────
      if (!(await this.isRunning(id))) return;
      await this.startStep(id, 'DRAFTING', 6, 'Đang tạo bản nháp món ăn trong hệ thống...');
      const finalSlug = existing ? `${slug}-${Date.now()}` : slug;
      const regionId = await this.resolveRegionId(dto.regionHint);
      const storedImage = suggestedImageUrl
        ? await this.prepareDishMedia(suggestedImageUrl, dishData.name)
        : undefined;
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
          recipeTitle: extraction.recipe.title,
          flavorTags: extraction.classification.flavorCodes,
          regionId,
          ingredients: extraction.ingredients.map((ing, idx) => {
            const resolution = resolutions[idx];
            const catalogHit = provisioned.byClientRef.get(`ai-${idx}`);
            const linkedId =
              resolution?.matchedIngredientId ??
              catalogHit?.ingredientId ??
              null;
            const resolutionMethod =
              catalogHit?.outcome === 'EXISTING_EXACT'
                ? 'EXACT'
                : catalogHit?.outcome === 'EXISTING_SYNONYM'
                  ? 'ALIAS'
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
              groupLabel: ing.group?.substring(0, 98) ?? null,
              sortOrder: idx,
              isOptional: ing.optional,
              resolutionMethod,
              resolutionConfidence:
                linkedId != null
                  ? catalogHit?.isNew
                    ? 80
                    : Math.max(resolution?.confidence ?? 0, 90)
                  : resolution?.confidence ?? 0,
              resolutionCandidates:
                catalogHit?.candidates?.length
                  ? (JSON.parse(JSON.stringify(catalogHit.candidates)) as object)
                  : resolution?.candidates,
              needsReview:
                !linkedId ||
                catalogHit?.outcome === 'CREATED_PENDING' ||
                (resolution?.confidence ?? 0) < 90,
            };
          }),
          nutrition: {
            servingName: (nutrition.servingName ?? '').substring(0, 98),
            servingG: nutrition.servingG,
            calories: nutrition.calories,
            proteinG: nutrition.proteinG,
            carbsG: nutrition.carbsG,
            fatG: nutrition.fatG,
            fiberG: nutrition.fiberG,
            sodiumMg: nutrition.sodiumMg,
            basis: 'PER_SERVING',
            servings: dishData.servings,
            method: 'AI_ESTIMATED',
            confidence: 50,
            sourceUrl: null,
            provenance: {
              generatedBy: 'AI',
              sourceVerified: false,
              pipelineVersion: '1.1',
              servingBasis: 'PER_SERVING',
            },
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
        fieldMetadata: {
          schemaVersion: extraction.schemaVersion,
          originConfidence: extraction.basic.origin.confidence,
          classificationConfidence: extraction.classification.confidenceByField,
        },
        auditMetadata: {
          sourceTypes: dto.sourceTypes ?? ['AI_GENERATED'],
          query: dto.query,
          suggestedImageUrl: suggestedImageUrl ?? null,
        },
      });
      const dishId = persisted.dishId;
      this.log(id, 'DRAFTING', 6,
        `Đã tạo bản nháp thành công!`,
        `Dish ID: ${dishId} | Slug: ${finalSlug}`,
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
        quantity: ingredient.quantity ?? 0,
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
  private async prepareDishMedia(imageUrl: string, dishName: string) {
    const storageKey = await this.uploadImageFromUrl(imageUrl, `ai-import/${randomUUID()}`);
    if (!storageKey) return undefined;
    return {
      storageKey,
      bucket: this.storageBucket,
      mimeType: this.mimeTypeFromStorageKey(storageKey),
      sizeBytes: 0,
      altText: dishName.substring(0, 298),
      credit: 'Nguồn ảnh gợi ý từ Wikipedia/Unsplash',
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
