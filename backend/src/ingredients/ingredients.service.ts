import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IngredientImageStatus, IngredientStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IngredientQueryDto } from './dto/ingredient-query.dto';
import { CreateIngredientDto, UpdateIngredientDto } from './dto/create-ingredient.dto';
import { IngredientNormalizerService } from './ingredient-normalizer.service';

@Injectable()
export class IngredientsService {
  private readonly supabaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly normalizer: IngredientNormalizerService,
  ) {
    this.supabaseUrl = this.config.get<string>('SUPABASE_URL', '');
  }

  buildPublicUrl(storageKey: string): string {
    return `${this.supabaseUrl}/storage/v1/object/public/ingredient-images/${storageKey}`;
  }

  async search(query: IngredientQueryDto) {
    const { q, allergenCode, limit = 20 } = query;

    const items = await this.prisma.db.ingredient.findMany({
      where: {
        status: { in: [IngredientStatus.ACTIVE, IngredientStatus.PENDING_REVIEW] },
        ...(allergenCode ? { allergenCode } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { code: { contains: q, mode: 'insensitive' } },
                { identityNormalized: { contains: q.toLowerCase() } },
                { searchFolded: { contains: this.normalizer.searchFolded(q) } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        synonyms: true,
        unit: true,
        allergenCode: true,
        imageUrl: true,
        status: true,
        imageStatus: true,
        isActive: true,
      },
      take: Math.min(limit, 100),
      orderBy: { name: 'asc' },
    });

    return items;
  }

  async findById(id: string) {
    return this.prisma.db.ingredient.findUnique({ where: { id } });
  }

  async findByCode(code: string) {
    return this.prisma.db.ingredient.findUnique({ where: { code } });
  }

  async adminList(query: {
    q?: string;
    allergenCode?: string;
    isActive?: boolean;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const { q, allergenCode, isActive, status, page = 1, limit = 20 } = query;
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;

    const where: any = {
      ...(allergenCode ? { allergenCode } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(status ? { status: status as IngredientStatus } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { code: { contains: q, mode: 'insensitive' } },
              { synonyms: { has: q } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.db.ingredient.count({ where }),
      this.prisma.db.ingredient.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take,
        include: {
          _count: { select: { dishIngredients: true } },
        },
      }),
    ]);

    return {
      data: items.map(({ _count, ...item }) => ({
        ...item,
        dishCount: _count.dishIngredients,
      })),
      pagination: { page, limit: take, total, totalPages: Math.ceil(total / take) },
    };
  }

  async create(dto: CreateIngredientDto) {
    const existing = await this.prisma.db.ingredient.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException({
        error: {
          code: 'INGREDIENT_CODE_EXISTS',
          message: 'Mã nguyên liệu đã tồn tại.',
        },
      });
    }

    const identity = this.normalizer.identityKey(dto.name);
    const isActive = dto.isActive ?? false;
    return this.prisma.db.ingredient.create({
      data: {
        code: dto.code,
        name: dto.name,
        identityNormalized: identity,
        searchFolded: this.normalizer.searchFolded(dto.name),
        synonyms: dto.synonyms ?? [],
        unit: dto.unit,
        allergenCode: dto.allergenCode,
        imageUrl: dto.imageUrl,
        imageKey: dto.imageKey,
        isActive,
        status: isActive ? IngredientStatus.ACTIVE : IngredientStatus.PENDING_REVIEW,
        imageStatus: dto.imageUrl
          ? IngredientImageStatus.APPROVED
          : IngredientImageStatus.NOT_REQUESTED,
      },
    });
  }

  async update(id: string, dto: UpdateIngredientDto) {
    const existing = await this.prisma.db.ingredient.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        error: {
          code: 'INGREDIENT_NOT_FOUND',
          message: 'Không tìm thấy nguyên liệu.',
        },
      });
    }

    const name = dto.name ?? existing.name;
    return this.prisma.db.ingredient.update({
      where: { id },
      data: {
        ...(dto.name !== undefined
          ? {
              name: dto.name,
              identityNormalized: this.normalizer.identityKey(dto.name),
              searchFolded: this.normalizer.searchFolded(dto.name),
            }
          : {}),
        ...(dto.synonyms !== undefined ? { synonyms: dto.synonyms } : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
        ...(dto.allergenCode !== undefined ? { allergenCode: dto.allergenCode } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.imageKey !== undefined ? { imageKey: dto.imageKey } : {}),
        ...(dto.isActive !== undefined
          ? {
              isActive: dto.isActive,
              status: dto.isActive
                ? IngredientStatus.ACTIVE
                : IngredientStatus.INACTIVE,
            }
          : {}),
        version: { increment: 1 },
      },
    });
  }

  async softDelete(id: string) {
    const existing = await this.prisma.db.ingredient.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        error: {
          code: 'INGREDIENT_NOT_FOUND',
          message: 'Không tìm thấy nguyên liệu.',
        },
      });
    }

    return this.prisma.db.ingredient.update({
      where: { id },
      data: {
        isActive: false,
        status: IngredientStatus.INACTIVE,
        version: { increment: 1 },
      },
    });
  }

  async listImageCandidates(ingredientId: string) {
    const ingredient = await this.prisma.db.ingredient.findUnique({
      where: { id: ingredientId },
    });
    if (!ingredient) {
      throw new NotFoundException({
        error: {
          code: 'INGREDIENT_NOT_FOUND',
          message: 'Không tìm thấy nguyên liệu.',
        },
      });
    }

    const candidates = await this.prisma.db.ingredientImageCandidate.findMany({
      where: { ingredientId },
      orderBy: { score: 'desc' },
    });

    return {
      ingredient: {
        id: ingredient.id,
        name: ingredient.name,
        imageUrl: ingredient.imageUrl,
        imageKey: ingredient.imageKey,
        imageStatus: ingredient.imageStatus,
        status: ingredient.status,
      },
      candidates: candidates.map((c) => ({
        ...c,
        publicUrl: c.storageKey ? this.buildPublicUrl(c.storageKey) : null,
      })),
    };
  }

  async approveImage(
    ingredientId: string,
    body: { candidateId?: string; imageUrl?: string; imageKey?: string },
  ) {
    const ingredient = await this.prisma.db.ingredient.findUnique({
      where: { id: ingredientId },
    });
    if (!ingredient) {
      throw new NotFoundException({
        error: {
          code: 'INGREDIENT_NOT_FOUND',
          message: 'Không tìm thấy nguyên liệu.',
        },
      });
    }

    if (body.candidateId) {
      const candidate = await this.prisma.db.ingredientImageCandidate.findFirst({
        where: { id: body.candidateId, ingredientId },
      });
      if (!candidate) {
        throw new BadRequestException({
          error: {
            code: 'CANDIDATE_NOT_FOUND',
            message: 'Không tìm thấy image candidate.',
          },
        });
      }
      const imageKey = candidate.storageKey;
      const imageUrl = imageKey
        ? this.buildPublicUrl(imageKey)
        : candidate.previewUrl || candidate.originalUrl;

      return this.prisma.db.ingredient.update({
        where: { id: ingredientId },
        data: {
          imageKey,
          imageUrl,
          imageStatus: IngredientImageStatus.APPROVED,
          version: { increment: 1 },
        },
      });
    }

    if (!body.imageUrl && !body.imageKey) {
      throw new BadRequestException({
        error: {
          code: 'IMAGE_REQUIRED',
          message: 'Cần candidateId hoặc imageUrl/imageKey.',
        },
      });
    }

    return this.prisma.db.ingredient.update({
      where: { id: ingredientId },
      data: {
        imageUrl: body.imageUrl ?? ingredient.imageUrl,
        imageKey: body.imageKey ?? ingredient.imageKey,
        imageStatus: IngredientImageStatus.APPROVED,
        version: { increment: 1 },
      },
    });
  }

  async clearImage(ingredientId: string) {
    const ingredient = await this.prisma.db.ingredient.findUnique({
      where: { id: ingredientId },
    });
    if (!ingredient) {
      throw new NotFoundException({
        error: {
          code: 'INGREDIENT_NOT_FOUND',
          message: 'Không tìm thấy nguyên liệu.',
        },
      });
    }

    return this.prisma.db.ingredient.update({
      where: { id: ingredientId },
      data: {
        imageUrl: null,
        imageKey: null,
        imageStatus: IngredientImageStatus.NOT_REQUESTED,
        version: { increment: 1 },
      },
    });
  }

  async presignIngredientImage(
    ingredientId: string,
  ): Promise<{ signedUrl: string; token: string; path: string }> {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      this.config.get<string>('SUPABASE_URL', ''),
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY', ''),
    );

    const path = `${ingredientId}/${Date.now()}.jpg`;
    const { data, error } = await supabase.storage
      .from('ingredient-images')
      .createSignedUploadUrl(path);

    if (error || !data) {
      throw new Error(`Không thể tạo signed URL: ${error?.message}`);
    }

    return { signedUrl: data.signedUrl, token: data.token, path };
  }
}
