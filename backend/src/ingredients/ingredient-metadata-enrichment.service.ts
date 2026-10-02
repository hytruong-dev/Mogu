import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import type { ResolvedIngredientEntity } from './ingredient-entity/ingredient-entity-resolver.service';

export interface IngredientMetadataResult {
  nameEn?: string;
  description?: string;
  synonyms?: string[];
  groupLabel?: string;
  defaultUnit?: string;
  entity?: Record<string, any>;
}

@Injectable()
export class IngredientMetadataEnrichmentService {
  private readonly logger = new Logger(IngredientMetadataEnrichmentService.name);
  private readonly client: OpenAI | null = null;
  private readonly model: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const apiKey =
      this.config.get<string>('XKIRO_API_KEY') ||
      this.config.get<string>('OPENAI_API_KEY') ||
      '';
    const baseURL =
      this.config.get<string>('XKIRO_BASE_URL') ||
      this.config.get<string>('OPENAI_BASE_URL') ||
      'https://api.xkiro.com/v1';

    if (apiKey) {
      this.client = new OpenAI({ baseURL, apiKey });
    } else {
      this.logger.warn('AI API key not found. Metadata enrichment will fall back to entity resolver.');
    }
    this.model =
      this.config.get<string>('XKIRO_MODEL') ||
      this.config.get<string>('OPENAI_MODEL') ||
      'deepseek/deepseek-chat-v3.1';
  }

  /**
   * Sinh metadata bổ sung (nameEn, mô tả, synonyms, nhóm nguyên liệu, đơn vị)
   * kết hợp thực thể đã nhận diện (Wikipedia, Wikidata, Open Food Facts) và AI.
   */
  async enrichMetadata(
    ingredientId: string,
    ingredientName: string,
    entity?: ResolvedIngredientEntity,
  ): Promise<IngredientMetadataResult | null> {
    const existing = await this.prisma.db.ingredient.findUnique({
      where: { id: ingredientId },
      select: {
        id: true,
        name: true,
        nameEn: true,
        description: true,
        groupLabel: true,
        synonyms: true,
        unit: true,
        enrichment: true,
        enrichedAt: true,
      },
    });

    if (!existing) return null;

    const existingEnrichment =
      existing.enrichment && typeof existing.enrichment === 'object'
        ? (existing.enrichment as Record<string, any>)
        : {};

    const entityPayload = entity
      ? {
          wikidataId: entity.wikidataId,
          viTitle: entity.viTitle,
          enTitle: entity.enTitle,
          descriptionVi: entity.descriptionVi,
          commonsCategory: entity.commonsCategory,
          offTag: entity.offTag,
          offParents: entity.offParents,
          sources: entity.sources,
          resolvedAt: new Date().toISOString(),
        }
      : undefined;

    // Nếu đã có metadata chuẩn (nameEn + enrichedAt):
    if (existing.enrichedAt && existing.nameEn) {
      // Cập nhật bổ sung thông tin entity nếu trước đó chưa có
      if (entityPayload && !existingEnrichment.entity) {
        await this.prisma.db.ingredient.update({
          where: { id: ingredientId },
          data: {
            enrichment: {
              ...existingEnrichment,
              entity: entityPayload,
              sources: entity?.sources ?? [],
            },
          },
        });
      }

      return {
        nameEn: existing.nameEn,
        description: existing.description ?? undefined,
        synonyms: existing.synonyms ?? [],
        groupLabel: existing.groupLabel ?? undefined,
        defaultUnit: existing.unit ?? undefined,
        entity: entityPayload,
      };
    }

    // Nếu không có client AI, dùng trực tiếp thông tin từ entity nếu có
    if (!this.client) {
      if (entity) {
        const nameEn = entity.enTitle || existing.nameEn || undefined;
        const description =
          entity.descriptionVi ||
          (entity.extractVi ? entity.extractVi.substring(0, 498) : undefined) ||
          existing.description ||
          undefined;
        const mergedSynonyms = Array.from(
          new Set([...(existing.synonyms ?? []), ...(entity.aliasesVi ?? [])]),
        );

        const enrichmentData = {
          ...existingEnrichment,
          nameEn,
          description,
          entity: entityPayload,
          sources: entity.sources ?? [],
          generatedAt: new Date().toISOString(),
        };

        await this.prisma.db.ingredient.update({
          where: { id: ingredientId },
          data: {
            nameEn: nameEn ?? existing.nameEn,
            description: description ?? existing.description,
            synonyms: mergedSynonyms,
            enrichment: enrichmentData,
            enrichedAt: new Date(),
          },
        });

        return {
          nameEn,
          description,
          synonyms: mergedSynonyms,
          groupLabel: existing.groupLabel ?? undefined,
          defaultUnit: existing.unit ?? undefined,
          entity: entityPayload,
        };
      }
      return null;
    }

    try {
      const contextLines: string[] = [];
      if (entity?.enTitle) {
        contextLines.push(`- Tên tiếng Anh tham chiếu từ Wikidata/OFF: "${entity.enTitle}"`);
      }
      if (entity?.extractVi) {
        contextLines.push(`- Tóm lược bách khoa: "${entity.extractVi.substring(0, 250)}"`);
      }
      if (entity?.aliasesVi?.length) {
        contextLines.push(`- Tên gọi khác tiếng Việt: ${entity.aliasesVi.slice(0, 5).join(', ')}`);
      }

      const contextPrompt = contextLines.length
        ? `\nDữ liệu tham chiếu đã xác minh:\n${contextLines.join('\n')}\n`
        : '';

      const prompt = `Bạn là chuyên gia ẩm thực và từ điển nguyên liệu Việt Nam. Hãy bổ sung thông tin chuẩn hóa cho nguyên liệu nấu ăn sau:
Nguyên liệu: "${ingredientName}"
${contextPrompt}
Chỉ trả về DUY NHẤT một JSON object hợp lệ, không markdown, không giải thích.
Cấu trúc JSON bắt buộc:
{
  "nameEn": "tên tiếng Anh phổ biến nhất của nguyên liệu thực phẩm này (ví dụ: beef, pork belly, lemongrass, fish sauce, tofu)",
  "description": "mô tả súc tích về đặc điểm/công dụng trong ẩm thực (tối đa 200 ký tự tiếng Việt)",
  "synonyms": ["tên gọi khác tiếng Việt", "tên địa phương nếu có"],
  "groupLabel": "một nhóm phù hợp trong: Thịt, Thủy hải sản, Rau củ, Trái cây, Nấm, Đậu phụ & sản phẩm từ đậu, Tinh bột & ngũ cốc, Trứng & sữa, Gia vị & nước chấm, Dầu ăn & mỡ, Thảo mộc & rau thơm, Khác",
  "defaultUnit": "g hoặc ml hoặc quả hoặc củ hoặc tép hoặc cây hoặc muỗng canh..."
}`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content?.trim()) return null;

      const parsed = JSON.parse(content) as Record<string, unknown>;

      const nameEn =
        (typeof parsed.nameEn === 'string' && parsed.nameEn.trim()
          ? parsed.nameEn.trim().substring(0, 198)
          : undefined) || entity?.enTitle;

      const fallbackDesc =
        entity?.descriptionVi ||
        (entity?.extractVi ? entity.extractVi.substring(0, 498) : undefined);

      const description =
        (typeof parsed.description === 'string' && parsed.description.trim()
          ? parsed.description.trim().substring(0, 498)
          : undefined) || fallbackDesc;

      const groupLabel =
        typeof parsed.groupLabel === 'string' && parsed.groupLabel.trim()
          ? parsed.groupLabel.trim().substring(0, 98)
          : undefined;

      const defaultUnit =
        typeof parsed.defaultUnit === 'string' && parsed.defaultUnit.trim()
          ? parsed.defaultUnit.trim().substring(0, 48)
          : undefined;

      const rawSynonyms = Array.isArray(parsed.synonyms)
        ? parsed.synonyms
            .filter((s): s is string => typeof s === 'string' && Boolean(s.trim()))
            .map((s) => s.trim().substring(0, 98))
        : [];

      const mergedSynonyms = Array.from(
        new Set([
          ...(existing.synonyms ?? []),
          ...(entity?.aliasesVi ?? []),
          ...rawSynonyms,
        ]),
      );

      const enrichmentData = {
        ...existingEnrichment,
        nameEn,
        description,
        groupLabel,
        defaultUnit,
        suggestedSynonyms: rawSynonyms,
        entity: entityPayload,
        sources: entity?.sources ?? [],
        model: this.model,
        generatedAt: new Date().toISOString(),
      };

      await this.prisma.db.ingredient.update({
        where: { id: ingredientId },
        data: {
          nameEn: nameEn ?? existing.nameEn,
          description: description ?? existing.description,
          groupLabel: groupLabel ?? existing.groupLabel,
          synonyms: mergedSynonyms,
          unit: existing.unit || defaultUnit || null,
          enrichment: enrichmentData,
          enrichedAt: new Date(),
        },
      });

      this.logger.log(
        `Enriched metadata for ingredient ${ingredientId} ("${ingredientName}") -> EN: "${nameEn}"`,
      );

      return {
        nameEn,
        description,
        synonyms: mergedSynonyms,
        groupLabel,
        defaultUnit,
        entity: entityPayload,
      };
    } catch (err) {
      this.logger.warn(
        `Metadata enrichment failed for "${ingredientName}": ${(err as Error).message}`,
      );
      return null;
    }
  }
}
