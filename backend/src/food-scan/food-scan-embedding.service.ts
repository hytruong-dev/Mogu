import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';

export function normalizeVector(vec: Float32Array | number[]): number[] {
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) {
    sumSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(sumSq) || 1e-12;
  const result: number[] = new Array(vec.length);
  for (let i = 0; i < vec.length; i++) {
    result[i] = Number((vec[i] / norm).toFixed(6));
  }
  return result;
}

export async function computeImagePHash(imageBuffer: Buffer): Promise<string> {
  try {
    const { data } = await sharp(imageBuffer)
      .resize(32, 32, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    const avg = sum / data.length;

    let hash = '';
    let byte = 0;
    let bitCount = 0;

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const idx = y * 4 * 32 + x * 4;
        const bit = data[idx] > avg ? 1 : 0;
        byte = (byte << 1) | bit;
        bitCount++;
        if (bitCount === 8) {
          hash += byte.toString(16).padStart(2, '0');
          byte = 0;
          bitCount = 0;
        }
      }
    }
    return hash;
  } catch {
    return '';
  }
}

@Injectable()
export class FoodScanEmbeddingService implements OnModuleDestroy {
  private readonly logger = new Logger(FoodScanEmbeddingService.name);
  readonly modelId: string;
  private initPromise: Promise<boolean> | null = null;
  private tokenizer: any = null;
  private textModel: any = null;
  private processor: any = null;
  private visionModel: any = null;
  private RawImageClass: any = null;
  private isAvailable = false;

  constructor(config: ConfigService) {
    this.modelId =
      config.get<string>('FOOD_SCAN_EMBED_MODEL')?.trim() ||
      'Xenova/clip-vit-base-patch32';
  }

  private async ensureInitialized(): Promise<boolean> {
    if (this.isAvailable) return true;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        this.logger.log(`Initializing FoodScan embedding model: ${this.modelId}...`);
        const {
          AutoTokenizer,
          AutoProcessor,
          CLIPTextModelWithProjection,
          CLIPVisionModelWithProjection,
          RawImage,
        } = await import('@huggingface/transformers');

        this.RawImageClass = RawImage;
        const [tokenizer, textModel, processor, visionModel] =
          await Promise.all([
            AutoTokenizer.from_pretrained(this.modelId),
            CLIPTextModelWithProjection.from_pretrained(this.modelId),
            AutoProcessor.from_pretrained(this.modelId),
            CLIPVisionModelWithProjection.from_pretrained(this.modelId),
          ]);

        this.tokenizer = tokenizer;
        this.textModel = textModel;
        this.processor = processor;
        this.visionModel = visionModel;
        this.isAvailable = true;
        this.logger.log('FoodScan embedding models loaded successfully.');
        return true;
      } catch (error) {
        this.logger.warn(
          `FoodScan embedding initialization failed (will fallback to lexical matching): ${error instanceof Error ? error.message : String(error)}`,
        );
        this.isAvailable = false;
        return false;
      }
    })();

    return this.initPromise;
  }

  async embedText(text: string): Promise<number[] | null> {
    if (process.env.NODE_ENV === 'test') return null;
    if (!text || !text.trim()) return null;
    const ok = await this.ensureInitialized();
    if (!ok || !this.tokenizer || !this.textModel) return null;

    try {
      const inputs = this.tokenizer([text.trim().slice(0, 200)], {
        padding: true,
        truncation: true,
      });
      const { text_embeds } = await this.textModel(inputs);
      const data = text_embeds.data as Float32Array;
      return normalizeVector(data.subarray(0, 512));
    } catch (error) {
      this.logger.warn(
        `Failed to embed text "${text}": ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  async embedImage(imageBuffer: Buffer): Promise<number[] | null> {
    if (process.env.NODE_ENV === 'test') return null;
    if (!imageBuffer || !imageBuffer.length) return null;
    const ok = await this.ensureInitialized();
    if (!ok || !this.processor || !this.visionModel || !this.RawImageClass)
      return null;

    try {
      // Decode image to raw 224x224 RGB using sharp
      const { data, info } = await sharp(imageBuffer)
        .resize(224, 224, { fit: 'cover' })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const raw = new this.RawImageClass(
        new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
        info.width,
        info.height,
        info.channels,
      );

      const inputs = await this.processor(raw);
      const { image_embeds } = await this.visionModel(inputs);
      const embedData = image_embeds.data as Float32Array;
      return normalizeVector(embedData.subarray(0, 512));
    } catch (error) {
      this.logger.warn(
        `Failed to embed image: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  onModuleDestroy() {
    this.tokenizer = null;
    this.textModel = null;
    this.processor = null;
    this.visionModel = null;
    this.RawImageClass = null;
    this.isAvailable = false;
  }
}
