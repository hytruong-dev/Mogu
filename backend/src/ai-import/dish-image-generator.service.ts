import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import OpenAI from 'openai';
import { DishExtractionV11 } from './ai-import.types';

export interface GeneratedDishImage {
  imageUrl?: string;
  imageBuffer?: Buffer;
  mimeType: string;
  credit: string;
  prompt: string;
  provider: 'OPENAI_DALLE3' | 'GOOGLE_GEMINI' | 'CUSTOM' | 'NONE';
}

@Injectable()
export class DishImageGeneratorService {
  private readonly logger = new Logger(DishImageGeneratorService.name);
  private openaiClient: OpenAI | null = null;
  private geminiApiKey: string | null = null;
  private customGenUrl: string | null = null;
  private customGenKey: string | null = null;

  constructor(private readonly config: ConfigService) {
    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    if (openaiKey && openaiKey.startsWith('sk-')) {
      this.openaiClient = new OpenAI({ apiKey: openaiKey });
      this.logger.log('DishImageGeneratorService: OpenAI DALL-E 3 initialized');
    }

    this.geminiApiKey = this.config.get<string>('GEMINI_IMAGE_API_KEY') || this.config.get<string>('GEMINI_API_KEY') || null;
    this.customGenUrl = this.config.get<string>('CUSTOM_IMAGE_GEN_URL') || null;
    this.customGenKey = this.config.get<string>('CUSTOM_IMAGE_GEN_KEY') || null;
  }

  /**
   * Tạo prompt nhiếp ảnh ẩm thực studio chuyên nghiệp theo chuẩn Hình 1 (Bánh canh ghẹ):
   * - Góc chụp cận nghiêng 45 độ
   * - Bát/đĩa gốm mộc mạc hoặc mẹt tre lá chuối trên bàn gỗ tối màu
   * - Ánh sáng tự nhiên, khói bốc nhẹ, màu sắc tươi ngon, có kèm rau thơm và chanh ớt
   * - Độ phân giải 4K/8K, phong cách tạp chí ẩm thực
   */
  buildCulinaryPrompt(dishName: string, extraction?: DishExtractionV11): string {
    const ingredientNames = extraction?.ingredients
      ?.slice(0, 5)
      .map((i) => i.name)
      .filter(Boolean)
      .join(', ');

    const ingredientsContext = ingredientNames ? ` featuring authentic ingredients like ${ingredientNames}` : '';

    return (
      `Professional, appetizing close-up culinary food photography of authentic Vietnamese dish: ${dishName}${ingredientsContext}. ` +
      `Served in an artisanal rustic ceramic stoneware bowl or on a traditional woven bamboo tray lined with fresh banana leaf, ` +
      `placed on a textured dark rustic wooden table. Accompanying side dish with fresh herbs (mint, perilla, culantro), ` +
      `sliced fresh red bird's eye chilies, and juicy lime wedges. ` +
      `Soft natural directional side lighting, subtle rising steam, glistening appetizing textures, shallow depth of field, ` +
      `8k resolution, editorial food magazine style, mouth-watering gourmet presentation.`
    );
  }

  /**
   * Tự động sinh ảnh món ăn bằng AI:
   * 1. Thử qua OpenAI DALL-E 3 (nếu có key)
   * 2. Thử qua Google Gemini Image (nếu có key)
   * 3. Thử qua Custom Endpoint (nếu có)
   * 4. Trả về null nếu không có provider khả dụng (để fallback sang tìm kiếm)
   */
  async generateDishImage(
    dishName: string,
    extraction?: DishExtractionV11,
  ): Promise<GeneratedDishImage | null> {
    const prompt = this.buildCulinaryPrompt(dishName, extraction);

    // 1️⃣ Thử với OpenAI DALL-E 3
    if (this.openaiClient) {
      try {
        this.logger.log(`[DALL-E 3] Đang sinh ảnh cho món "${dishName}"...`);
        const response = await this.openaiClient.images.generate({
          model: 'dall-e-3',
          prompt,
          n: 1,
          size: '1024x1024',
          quality: 'standard',
          response_format: 'url',
        });

        const url = response.data?.[0]?.url;
        if (url) {
          this.logger.log(`[DALL-E 3] ✅ Sinh ảnh thành công cho món "${dishName}"`);
          return {
            imageUrl: url,
            mimeType: 'image/png',
            credit: 'AI Generated Studio Culinary Photography by Mogu (DALL-E 3)',
            prompt,
            provider: 'OPENAI_DALLE3',
          };
        }
      } catch (err: any) {
        this.logger.warn(`[DALL-E 3] Lỗi sinh ảnh cho "${dishName}": ${err.message}`);
      }
    }

    // 2️⃣ Thử với Google Gemini Image Models (gemini-2.5-flash-image / gemini-3.1-flash-image)
    if (this.geminiApiKey) {
      try {
        this.logger.log(`[Gemini Image] Đang sinh ảnh cho món "${dishName}"...`);
        const geminiModels = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image'];

        for (const model of geminiModels) {
          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiApiKey}`;
            const res = await axios.post(
              url,
              {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  responseModalities: ['IMAGE'],
                },
              },
              { timeout: 35000 },
            );

            const candidate = res.data?.candidates?.[0]?.content?.parts?.[0];
            if (candidate?.inlineData?.data) {
              const base64Data = candidate.inlineData.data;
              const mimeType = candidate.inlineData.mimeType || 'image/jpeg';
              const buffer = Buffer.from(base64Data, 'base64');

              this.logger.log(`[Gemini Image] ✅ Sinh ảnh thành công (${model}) cho món "${dishName}"`);
              return {
                imageBuffer: buffer,
                mimeType,
                credit: `AI Generated Studio Culinary Photography by Mogu (${model})`,
                prompt,
                provider: 'GOOGLE_GEMINI',
              };
            }
          } catch (modelErr: any) {
            this.logger.warn(`[Gemini Image] Thử model ${model} thất bại: ${modelErr.message}`);
          }
        }
      } catch (err: any) {
        this.logger.warn(`[Gemini Image] Lỗi tổng thể cho "${dishName}": ${err.message}`);
      }
    }

    // 3️⃣ Thử với Custom Endpoint (nếu người dùng cấu hình server vẽ ảnh riêng)
    if (this.customGenUrl) {
      try {
        this.logger.log(`[Custom Image Gen] Đang gửi yêu cầu sinh ảnh "${dishName}" tới ${this.customGenUrl}...`);
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (this.customGenKey) {
          headers['Authorization'] = `Bearer ${this.customGenKey}`;
        }

        const res = await axios.post(
          this.customGenUrl,
          { prompt, dishName, width: 1024, height: 768 },
          { headers, timeout: 45000 },
        );

        const url = res.data?.url || res.data?.imageUrl;
        if (url) {
          return {
            imageUrl: url,
            mimeType: 'image/jpeg',
            credit: 'AI Generated Studio Culinary Photography by Mogu',
            prompt,
            provider: 'CUSTOM',
          };
        }
      } catch (err: any) {
        this.logger.warn(`[Custom Image Gen] Lỗi: ${err.message}`);
      }
    }

    this.logger.warn(`Không có AI Image Provider nào khả dụng cho "${dishName}". Chuyển sang fallback.`);
    return null;
  }
}
