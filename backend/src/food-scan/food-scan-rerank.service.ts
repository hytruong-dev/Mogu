import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface RerankCandidateInput {
  index: number;
  dishId: string;
  name: string;
  alternateNames: string[];
  categoryName?: string | null;
  keyIngredients: string[];
}

export interface RerankResult {
  bestIndex: number | null;
  confidence: number;
  reason: string;
  /**
   * true when the model actually answered. Distinguishes "model looked and said
   * none of the candidates match" (ran && bestIndex === null) from disabled/failed.
   */
  ran: boolean;
}

const RERANK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['bestIndex', 'confidence', 'reason'],
  properties: {
    bestIndex: {
      anyOf: [{ type: 'integer', minimum: 1, maximum: 10 }, { type: 'null' }],
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    reason: { type: 'string', maxLength: 300 },
  },
};

@Injectable()
export class FoodScanRerankService {
  private readonly logger = new Logger(FoodScanRerankService.name);
  readonly model: string;
  private readonly client: OpenAI | null;
  private readonly enabled: boolean;

  constructor(config: ConfigService) {
    const ownKey = config.get<string>('FOOD_SCAN_API_KEY')?.trim();
    const apiKey = ownKey || config.get<string>('XKIRO_API_KEY')?.trim();
    const baseURL =
      config.get<string>('FOOD_SCAN_BASE_URL')?.trim() ||
      (!ownKey ? config.get<string>('XKIRO_BASE_URL')?.trim() : undefined) ||
      (ownKey ? 'https://api.openai.com/v1' : undefined);
    const defaultModel = baseURL?.includes('xkiro')
      ? 'qwen/qwen3-vl-plus:free'
      : 'gpt-4o-mini';

    this.model =
      config.get<string>('FOOD_SCAN_RERANK_MODEL')?.trim() ||
      config.get<string>('FOOD_SCAN_MODEL')?.trim() ||
      defaultModel;

    this.enabled = config.get<string>('FOOD_SCAN_ENABLE_RERANK') !== 'false';

    this.client =
      apiKey && baseURL
        ? new OpenAI({ apiKey, baseURL, timeout: 10_000, maxRetries: 0 })
        : null;
  }

  async rerank(
    image: Buffer,
    candidates: RerankCandidateInput[],
  ): Promise<RerankResult> {
    if (!this.enabled || !this.client || !candidates.length) {
      return { bestIndex: null, confidence: 0, reason: 'RERANK_DISABLED_OR_SKIPPED', ran: false };
    }

    const candidateDescriptions = candidates
      .map((c) => {
        const parts = [`[${c.index}] Name: "${c.name}"`];
        if (c.alternateNames.length) {
          parts.push(`Aliases: ${c.alternateNames.join(', ')}`);
        }
        if (c.categoryName) {
          parts.push(`Category: ${c.categoryName}`);
        }
        if (c.keyIngredients.length) {
          parts.push(`Ingredients: ${c.keyIngredients.slice(0, 5).join(', ')}`);
        }
        return parts.join(' | ');
      })
      .join('\n');

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 300,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'rerank_result',
            strict: true,
            schema: RERANK_SCHEMA,
          },
        },
        messages: [
          {
            role: 'system',
            content:
              'You are a visual culinary expert for Vietnamese and Asian food. Look at the photo and decide whether it shows one of the numbered candidate dishes.\n' +
              'Return only valid JSON matching the schema.\n' +
              'If one candidate is the SAME dish as in the photo (same dish identity, not just a similar-looking dish), set bestIndex to its 1-based number and confidence between 0.5 and 1.0.\n' +
              'If the photo shows a DIFFERENT dish than every candidate - even if it belongs to the same family (another soup, another noodle dish, another rice dish) - set bestIndex=null and confidence=0. ' +
              'Example: a photo of "don Quảng Ngãi" (tiny clam soup) must NOT be matched to "canh cua" (crab soup).\n' +
              'Being wrong is worse than saying none match. Put a short reason (what dish you think it is) in reason.\n' +
              'Do not hallucinate dishes outside the numbered list.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Candidate dishes:\n${candidateDescriptions}\nWhich candidate number matches this dish?`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${image.toString('base64')}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
      });

      const content = response.choices[0]?.message.content;
      if (!content) {
        return { bestIndex: null, confidence: 0, reason: 'EMPTY_RERANK_RESPONSE', ran: false };
      }

      const parsed = JSON.parse(content) as {
        bestIndex?: unknown;
        confidence?: unknown;
        reason?: unknown;
      };

      const rawIndex =
        typeof parsed.bestIndex === 'number' && Number.isInteger(parsed.bestIndex)
          ? parsed.bestIndex
          : null;

      // Validate index is strictly inside candidates range
      const validIndex =
        rawIndex !== null && rawIndex >= 1 && rawIndex <= candidates.length
          ? rawIndex
          : null;

      const rawConf =
        typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0;

      // An out-of-range index is a hallucination, not a considered "none" answer.
      const hallucinated = rawIndex !== null && validIndex === null;
      return {
        bestIndex: validIndex,
        confidence: validIndex !== null ? rawConf : 0,
        reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 300) : '',
        ran: !hallucinated,
      };
    } catch (error) {
      this.logger.warn(
        `Closed-set rerank failed or timed out: ${error instanceof Error ? error.message : String(error)}. Falling back to RRF order.`,
      );
      return {
        bestIndex: null,
        confidence: 0,
        reason: 'RERANK_FALLBACK',
        ran: false,
      };
    }
  }
}
