import {
  Injectable,
  NotFoundException,
  ConflictException,
  PreconditionFailedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CustomFoodDto } from './custom-foods.controller';

@Injectable()
export class CustomFoodsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CustomFoodDto) {
    const food = await (this.prisma.db as any).customFood.create({
      data: {
        userId,
        name: dto.name.trim(),
        calories: dto.calories,
        proteinG: dto.proteinG ?? null,
        fatG: dto.fatG ?? null,
        carbsG: dto.carbsG ?? null,
        servingSize: dto.servingSize?.trim() ?? null,
      },
    });

    return {
      id: food.id,
      userId: food.userId,
      name: food.name,
      calories: Number(food.calories),
      proteinG: food.proteinG ? Number(food.proteinG) : null,
      fatG: food.fatG ? Number(food.fatG) : null,
      carbsG: food.carbsG ? Number(food.carbsG) : null,
      servingSize: food.servingSize,
      version: food.version,
      createdAt: food.createdAt.toISOString(),
    };
  }

  async list(userId: string) {
    const foods = await (this.prisma.db as any).customFood.findMany({
      where: { userId, archivedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: foods.map((f: any) => ({
        id: f.id,
        userId: f.userId,
        name: f.name,
        calories: Number(f.calories),
        proteinG: f.proteinG ? Number(f.proteinG) : null,
        fatG: f.fatG ? Number(f.fatG) : null,
        carbsG: f.carbsG ? Number(f.carbsG) : null,
        servingSize: f.servingSize,
        version: f.version,
        createdAt: f.createdAt.toISOString(),
      })),
    };
  }

  async update(
    userId: string,
    id: string,
    dto: Partial<CustomFoodDto>,
    ifMatch?: string,
  ) {
    if (!ifMatch) {
      throw new PreconditionFailedException({
        error: { code: 'PRECONDITION_REQUIRED', message: 'Thiếu header If-Match.' },
      });
    }

    const cleanVer = ifMatch.replace(/"/g, '').trim();
    const expectedVer = parseInt(cleanVer, 10);

    const existing = await (this.prisma.db as any).customFood.findFirst({
      where: { id, userId, archivedAt: null },
    });

    if (!existing) {
      throw new NotFoundException({
        error: { code: 'CUSTOM_FOOD_NOT_FOUND', message: 'Món ăn không tồn tại.' },
      });
    }

    if (isNaN(expectedVer) || existing.version !== expectedVer) {
      throw new ConflictException({
        error: {
          code: 'CUSTOM_FOOD_VERSION_CONFLICT',
          message: 'Món ăn đã được cập nhật ở nơi khác.',
          details: { expectedVersion: existing.version },
        },
      });
    }

    const updated = await (this.prisma.db as any).customFood.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.calories !== undefined ? { calories: dto.calories } : {}),
        ...(dto.proteinG !== undefined ? { proteinG: dto.proteinG } : {}),
        ...(dto.fatG !== undefined ? { fatG: dto.fatG } : {}),
        ...(dto.carbsG !== undefined ? { carbsG: dto.carbsG } : {}),
        ...(dto.servingSize !== undefined ? { servingSize: dto.servingSize.trim() } : {}),
        version: { increment: 1 },
      },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      name: updated.name,
      calories: Number(updated.calories),
      proteinG: updated.proteinG ? Number(updated.proteinG) : null,
      fatG: updated.fatG ? Number(updated.fatG) : null,
      carbsG: updated.carbsG ? Number(updated.carbsG) : null,
      servingSize: updated.servingSize,
      version: updated.version,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async remove(userId: string, id: string, ifMatch?: string) {
    if (!ifMatch) {
      throw new PreconditionFailedException({
        error: { code: 'PRECONDITION_REQUIRED', message: 'Thiếu header If-Match.' },
      });
    }

    const existing = await (this.prisma.db as any).customFood.findFirst({
      where: { id, userId, archivedAt: null },
    });

    if (!existing) {
      throw new NotFoundException({
        error: { code: 'CUSTOM_FOOD_NOT_FOUND', message: 'Món ăn không tồn tại.' },
      });
    }

    await (this.prisma.db as any).customFood.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    return { success: true };
  }
}
