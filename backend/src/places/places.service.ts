import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AdminListPlacesDto,
  AdminUpdatePlaceDto,
  ResolvePlaceDto,
  SearchPlacesDto,
} from './places.controller';

@Injectable()
export class PlacesService {
  constructor(private readonly prisma: PrismaService) {}

  private map(p: any) {
    return {
      id: p.id,
      provider: p.provider,
      providerPlaceId: p.providerPlaceId,
      name: p.name,
      addressShort: p.addressShort,
      lat: p.lat != null ? Number(p.lat) : null,
      lng: p.lng != null ? Number(p.lng) : null,
      distanceMeters: null as number | null,
      thumbnailUrl: p.thumbnailUrl,
    };
  }

  async search(dto: SearchPlacesDto) {
    const limit = Math.min(Number(dto.limit) || 20, 50);
    const q = dto.q?.trim();
    const items = await this.prisma.db.place.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { addressShort: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { updatedAt: 'desc' },
      take: limit + 1,
      ...(dto.cursor ? { cursor: { id: dto.cursor }, skip: 1 } : {}),
    });
    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    return {
      data: data.map((p) => this.map(p)),
      nextCursor: hasMore ? data[data.length - 1].id : null,
      hasMore,
    };
  }

  async resolve(dto: ResolvePlaceDto) {
    if (dto.providerPlaceId) {
      const existing = await this.prisma.db.place.findUnique({
        where: {
          provider_providerPlaceId: {
            provider: dto.provider,
            providerPlaceId: dto.providerPlaceId,
          },
        },
      });
      if (existing) return this.map(existing);
    }

    const created = await this.prisma.db.place.create({
      data: {
        provider: dto.provider || 'LOCAL',
        providerPlaceId: dto.providerPlaceId ?? null,
        name: dto.name.trim(),
        addressShort: dto.addressShort ?? null,
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
        thumbnailUrl: dto.thumbnailUrl ?? null,
        isVerified: Boolean(dto.providerPlaceId),
      },
    });
    return this.map(created);
  }

  async adminList(dto: AdminListPlacesDto) {
    const limit = Math.min(Number(dto.limit) || 20, 100);
    const offset = Math.max(Number(dto.offset) || 0, 0);
    const q = dto.q?.trim();

    const where: any = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { addressShort: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.db.place.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          _count: {
            select: { posts: true },
          },
        },
      }),
      this.prisma.db.place.count({ where }),
    ]);

    return {
      items: items.map((p) => ({
        ...this.map(p),
        isVerified: p.isVerified,
        postCount: p._count.posts,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
      total,
      hasMore: offset + items.length < total,
    };
  }

  async adminUpdate(id: string, dto: AdminUpdatePlaceDto) {
    const place = await this.prisma.db.place.findUnique({ where: { id } });
    if (!place) throw new NotFoundException('Không tìm thấy địa điểm');

    const updated = await this.prisma.db.place.update({
      where: { id },
      data: {
        name: dto.name?.trim() ?? place.name,
        addressShort: dto.addressShort !== undefined ? dto.addressShort?.trim() || null : place.addressShort,
        lat: dto.lat !== undefined ? dto.lat : place.lat,
        lng: dto.lng !== undefined ? dto.lng : place.lng,
        thumbnailUrl: dto.thumbnailUrl !== undefined ? dto.thumbnailUrl?.trim() || null : place.thumbnailUrl,
        isVerified: dto.isVerified !== undefined ? dto.isVerified : place.isVerified,
      },
      include: {
        _count: { select: { posts: true } },
      },
    });

    return {
      ...this.map(updated),
      isVerified: updated.isVerified,
      postCount: updated._count.posts,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async adminDelete(id: string, force = false) {
    const place = await this.prisma.db.place.findUnique({
      where: { id },
      include: { _count: { select: { posts: true } } },
    });
    if (!place) throw new NotFoundException('Không tìm thấy địa điểm');

    if (place._count.posts > 0) {
      if (!force) {
        throw new BadRequestException(
          `Địa điểm đang được gắn với ${place._count.posts} bài đăng cộng đồng. Vui lòng xác nhận xóa bắt buộc để gỡ khỏi bài đăng.`,
        );
      }
      await this.prisma.db.communityPost.updateMany({
        where: { placeId: id },
        data: { placeId: null },
      });
    }

    await this.prisma.db.place.delete({ where: { id } });
    return { success: true, id };
  }
}
