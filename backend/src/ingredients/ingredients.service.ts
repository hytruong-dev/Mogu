import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { IngredientQueryDto } from './dto/ingredient-query.dto';
import { CreateIngredientDto, UpdateIngredientDto } from './dto/create-ingredient.dto';

@Injectable()
export class IngredientsService {
  private readonly supabaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.supabaseUrl = this.config.get<string>('SUPABASE_URL', '');
  }

  buildPublicUrl(storageKey: string): string {
    return `${this.supabaseUrl}/storage/v1/object/public/ingredient-images/${storageKey}`;
  }

  // ── Public: tìm kiếm từ điển ──────────────────────────────────────────

  async search(query: IngredientQueryDto) {
    const { q, allergenCode, limit = 20 } = query;

    const items = await this.prisma.db.ingredient.findMany({
      where: {
        isActive: true,
        ...(allergenCode ? { allergenCode } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { code: { contains: q, mode: 'insensitive' } },
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

  // ── Admin: CRUD ───────────────────────────────────────────────────────

  async adminList(query: { q?: string; allergenCode?: string; isActive?: boolean; page?: number; limit?: number }) {
    const { q, allergenCode, isActive, page = 1, limit = 20 } = query;
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;

    const where: any = {
      ...(allergenCode ? { allergenCode } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
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
      }),
    ]);

    return {
      data: items,
      pagination: { page, limit: take, total, totalPages: Math.ceil(total / take) },
    };
  }

  async create(dto: CreateIngredientDto) {
    const existing = await this.prisma.db.ingredient.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException({ error: { code: 'INGREDIENT_CODE_EXISTS', message: 'Mã nguyên liệu đã tồn tại.' } });
    }

    return this.prisma.db.ingredient.create({
      data: {
        code: dto.code,
        name: dto.name,
        synonyms: dto.synonyms ?? [],
        unit: dto.unit,
        allergenCode: dto.allergenCode,
        imageUrl: dto.imageUrl,
        imageKey: dto.imageKey,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateIngredientDto) {
    const existing = await this.prisma.db.ingredient.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ error: { code: 'INGREDIENT_NOT_FOUND', message: 'Không tìm thấy nguyên liệu.' } });
    }

    return this.prisma.db.ingredient.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.synonyms !== undefined ? { synonyms: dto.synonyms } : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
        ...(dto.allergenCode !== undefined ? { allergenCode: dto.allergenCode } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.imageKey !== undefined ? { imageKey: dto.imageKey } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async softDelete(id: string) {
    const existing = await this.prisma.db.ingredient.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ error: { code: 'INGREDIENT_NOT_FOUND', message: 'Không tìm thấy nguyên liệu.' } });
    }

    // Soft delete = deactivate
    return this.prisma.db.ingredient.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /** Tạo signed upload URL cho ảnh nguyên liệu */
  async presignIngredientImage(ingredientId: string): Promise<{ signedUrl: string; token: string; path: string }> {
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
