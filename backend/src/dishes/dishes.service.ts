import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaveDishResponseDto, UnsaveDishResponseDto } from './dto/dish.dto';

@Injectable()
export class DishesService {
  constructor(private readonly prisma: PrismaService) {}

  /** POST /dishes/:id/save — idempotent upsert */
  async saveDish(userId: string, dishId: string): Promise<SaveDishResponseDto> {
    // Validate dish tồn tại và published
    const dish = await this.prisma.db.dish.findFirst({
      where: { id: dishId, status: 'PUBLISHED', deletedAt: null },
      select: { id: true },
    });
    if (!dish) {
      throw new NotFoundException('Món ăn không tồn tại hoặc đã bị ẩn.');
    }

    const saved = await this.prisma.db.savedDish.upsert({
      where: { userId_dishId: { userId, dishId } },
      create: { userId, dishId },
      update: {}, // idempotent: không thay đổi nếu đã tồn tại
      select: { id: true, savedAt: true },
    });

    // Log click analytics (fire-and-forget)
    this.prisma.db.recommendationLog
      .create({
        data: { userId, dishId, event: 'save', position: null },
      })
      .catch(() => {});

    return {
      dishId,
      saved: true,
      savedAt: saved.savedAt.toISOString(),
    };
  }

  /** DELETE /dishes/:id/save — idempotent delete */
  async unsaveDish(userId: string, dishId: string): Promise<UnsaveDishResponseDto> {
    // Validate dish tồn tại (active hoặc không — user vẫn có thể bỏ lưu)
    const dish = await this.prisma.db.dish.findFirst({
      where: { id: dishId },
      select: { id: true },
    });
    if (!dish) {
      throw new NotFoundException('Món ăn không tồn tại.');
    }

    // Delete nếu tồn tại, bỏ qua nếu không (idempotent)
    await this.prisma.db.savedDish
      .delete({
        where: { userId_dishId: { userId, dishId } },
      })
      .catch(() => {}); // PrismaClientKnownRequestError P2025 — record not found — ignored

    return { dishId, saved: false };
  }
}

