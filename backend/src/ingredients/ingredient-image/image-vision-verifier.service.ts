import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface VisionVerificationResult {
  isIngredient: boolean;
  matchesName: boolean;
  isRawOrTypicalForm: boolean;
  confidence: number;
  reason?: string;
}

@Injectable()
export class ImageVisionVerifierService {
  private readonly logger = new Logger(ImageVisionVerifierService.name);
  private readonly client: OpenAI | null = null;
  private readonly model: string;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const isExplicitlyDisabled =
      this.config.get<string>('INGREDIENT_IMAGE_VISION_VERIFY') === 'false';

    const ownKey = this.config.get<string>('FOOD_SCAN_API_KEY')?.trim();
    const apiKey =
      ownKey ||
      this.config.get<string>('XKIRO_API_KEY')?.trim() ||
      this.config.get<string>('OPENAI_API_KEY')?.trim() ||
      '';

    const baseURL =
      this.config.get<string>('FOOD_SCAN_BASE_URL')?.trim() ||
      (!ownKey
        ? this.config.get<string>('XKIRO_BASE_URL')?.trim() ||
          this.config.get<string>('OPENAI_BASE_URL')?.trim()
        : undefined) ||
      (ownKey ? 'https://api.openai.com/v1' : undefined) ||
      'https://api.openai.com/v1';

    const defaultModel =
      baseURL && !baseURL.includes('openai.com')
        ? 'qwen/qwen3-vl-plus:free'
        : 'gpt-4o-mini';

    this.model =
      this.config.get<string>('FOOD_SCAN_MODEL')?.trim() || defaultModel;

    this.enabled = !isExplicitlyDisabled && Boolean(apiKey);

    if (this.enabled) {
      this.client = new OpenAI({
        apiKey,
        baseURL,
        timeout: 15_000,
        maxRetries: 1,
      });
      this.logger.log(
        `ImageVisionVerifier initialized with model ${this.model} at ${baseURL}`,
      );
    } else {
      this.logger.debug(
        'ImageVisionVerifier disabled (no vision credentials or INGREDIENT_IMAGE_VISION_VERIFY=false)',
      );
    }
  }

  /**
   * Xác minh hình ảnh ứng viên bằng mô hình AI vision.
   * imageInput: có thể là URL công khai (previewUrl) hoặc data URI base64.
   */
  async verify(
    imageInput: string,
    ingredientName: string,
    nameEn?: string,
    descriptionVi?: string,
  ): Promise<VisionVerificationResult | null> {
    if (!this.enabled || !this.client) {
      return null;
    }

    try {
      const prompt = `Bạn là trợ lý thẩm định hình ảnh nguyên liệu nấu ăn.
Hãy kiểm tra xem hình ảnh này có đúng là nguyên liệu "${ingredientName}"${nameEn ? ` (tên tiếng Anh: "${nameEn}")` : ''} hay không.
${descriptionVi ? `Mô tả tham chiếu: "${descriptionVi}"` : ''}

Yêu cầu đánh giá khách quan:
1. isIngredient: true nếu là nguyên liệu/thực phẩm/gia vị/rau củ thịt cá nông sản, false nếu là món ăn đã nấu chín nhiều thành phần (ví dụ đĩa cơm sườn, bát bún chả), bao bì nhãn mác sản phẩm, ban nhạc, logo, con người, thú cưng, tranh vẽ hoạt hình.
2. matchesName: true nếu ảnh đúng là "${ingredientName}" / "${nameEn || ''}". Nếu là nguyên liệu khác hẳn (ví dụ tên là "ớt" mà ảnh là "yến mạch" hay "gạo") thì BẮT BUỘC là false.
3. isRawOrTypicalForm: true nếu ở dạng người nội trợ mua/dùng trong bếp (củ, quả, hạt, bột, lát thịt tươi, chai nước chấm, bó rau). BẮT BUỘC false nếu là ảnh kính hiển vi/SEM, ảnh cây đang mọc ngoài đồng hoặc ra hoa, hình minh họa thực vật học, sơ đồ hóa học, mỏ khoáng sản, cánh đồng/ruộng, hay động vật còn sống.
4. confidence: số thực từ 0.0 đến 1.0 thể hiện mức độ tự tin.
5. reason: nhận xét ngắn gọn (tối đa 120 ký tự).

Chỉ trả về DUY NHẤT một JSON object hợp lệ:
{
  "isIngredient": boolean,
  "matchesName": boolean,
  "isRawOrTypicalForm": boolean,
  "confidence": number,
  "reason": string
}`;

      const request = () =>
        this.client!.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageInput,
                    detail: 'low',
                  },
                },
              ],
            },
          ],
          max_tokens: 150,
          temperature: 0.1,
          response_format: { type: 'json_object' },
        });

      let response: Awaited<ReturnType<typeof request>>;
      try {
        response = await request();
      } catch (err) {
        const status = (err as { status?: number }).status;
        // Gateway trả 409 (duplicate in-flight) hoặc 429: chờ ngắn rồi thử lại 1 lần
        if (status === 409 || status === 429) {
          await new Promise((r) => setTimeout(r, 2_500));
          response = await request();
        } else {
          throw err;
        }
      }

      const content = response.choices[0]?.message?.content;
      if (!content) return null;

      const parsed = JSON.parse(content) as Record<string, any>;
      return {
        isIngredient: Boolean(parsed.isIngredient),
        matchesName: Boolean(parsed.matchesName),
        isRawOrTypicalForm: Boolean(parsed.isRawOrTypicalForm),
        confidence:
          typeof parsed.confidence === 'number'
            ? Math.max(0, Math.min(1, parsed.confidence))
            : 0.8,
        reason:
          typeof parsed.reason === 'string'
            ? parsed.reason.trim().substring(0, 150)
            : undefined,
      };
    } catch (err) {
      this.logger.warn(
        `Vision verification failed for "${ingredientName}": ${(err as Error).message}`,
      );
      return null;
    }
  }
}
