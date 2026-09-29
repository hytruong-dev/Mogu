import { ConfigService } from '@nestjs/config';
import {
  FoodScanEmbeddingService,
  normalizeVector,
  computeImagePHash,
} from './food-scan-embedding.service';
import sharp from 'sharp';

describe('FoodScanEmbeddingService', () => {
  it('normalizes vector to unit length', () => {
    const vec = [3, 4];
    const norm = normalizeVector(vec);
    expect(norm[0]).toBeCloseTo(0.6);
    expect(norm[1]).toBeCloseTo(0.8);
  });

  it('computes consistent pHash for image buffer', async () => {
    // Create a 100x100 white PNG buffer
    const img1 = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    const hash1 = await computeImagePHash(img1);
    expect(hash1).toBeDefined();
    expect(hash1.length).toBe(16); // 8 bytes hex = 16 chars

    // Same image should give same hash
    const hash2 = await computeImagePHash(img1);
    expect(hash2).toBe(hash1);
  });

  it('instantiates service with default model', () => {
    const service = new FoodScanEmbeddingService(new ConfigService({}));
    expect(service.modelId).toBe('Xenova/clip-vit-base-patch32');
  });
});
