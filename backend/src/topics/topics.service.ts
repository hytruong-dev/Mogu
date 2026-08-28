import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';

@Injectable()
export class TopicsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllPublic() {
    return this.prisma.db.topic.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        coverImageUrl: true,
        displayOrder: true,
      },
    });
  }

  async findAllAdmin() {
    return this.prisma.db.topic.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: { select: { articles: true } },
      },
    });
  }

  async create(dto: CreateTopicDto) {
    const existing = await this.prisma.db.topic.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(`Slug "${dto.slug}" đã tồn tại`);
    }
    return this.prisma.db.topic.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        description: dto.description,
        coverImageUrl: dto.coverImageUrl,
        displayOrder: dto.displayOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateTopicDto) {
    await this.findOne(id);
    if (dto.slug) {
      const conflict = await this.prisma.db.topic.findFirst({
        where: { slug: dto.slug, NOT: { id } },
      });
      if (conflict) throw new ConflictException(`Slug "${dto.slug}" đã tồn tại`);
    }
    return this.prisma.db.topic.update({
      where: { id },
      data: {
        ...(dto.slug && { slug: dto.slug }),
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.coverImageUrl !== undefined && { coverImageUrl: dto.coverImageUrl }),
        ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.db.topic.delete({ where: { id } });
  }

  async findOne(id: string) {
    const topic = await this.prisma.db.topic.findUnique({ where: { id } });
    if (!topic) throw new NotFoundException(`Topic ${id} không tồn tại`);
    return topic;
  }
}
