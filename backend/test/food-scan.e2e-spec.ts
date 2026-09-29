import { Test } from '@nestjs/testing';
import { UnauthorizedException, VersioningType } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import multipart from '@fastify/multipart';
import sharp from 'sharp';
import type { FastifyInstance } from 'fastify';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import {
  FoodScanController,
  FoodScanRateLimiter,
} from '../src/food-scan/food-scan.controller';
import { FoodScanVisionService } from '../src/food-scan/food-scan-vision.service';
import { FoodScanMatcherService } from '../src/food-scan/food-scan-matcher.service';

// Exercise the actual Fastify multipart route without a remote DB, auth service or AI bill.
describe('Food scan HTTP contract', () => {
  let app: NestFastifyApplication;
  const vision = { model: 'test-vision', recognize: jest.fn() };
  const matcher = { match: jest.fn() };
  const extraction = {
    isFood: true,
    primaryName: 'Phở bò',
    alternateNames: [],
    visibleIngredients: [],
    quality: 'GOOD',
  };

  function payload(bytes: Buffer, field = 'file', mime = 'image/png') {
    const boundary = 'food-scan-test-boundary';
    return {
      headers: {
        authorization: 'Bearer test',
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="meal.png"\r\nContent-Type: ${mime}\r\n\r\n`,
        ),
        bytes,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]),
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    vision.recognize.mockResolvedValue(extraction);
    matcher.match.mockResolvedValue({
      status: 'NO_MATCH',
      recognizedName: 'Phở bò',
      candidates: [],
      model: vision.model,
    });
    const module = await Test.createTestingModule({
      controllers: [FoodScanController],
      providers: [
        FoodScanRateLimiter,
        { provide: FoodScanVisionService, useValue: vision },
        { provide: FoodScanMatcherService, useValue: matcher },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          if (req.headers.authorization !== 'Bearer test')
            throw new UnauthorizedException();
          req.user = { sub: 'test-user' };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    const uploadServer = app
      .getHttpAdapter()
      .getInstance() as unknown as FastifyInstance;
    await uploadServer.register(multipart, {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('requires authentication before calling vision', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/food-scan/recognize',
    });
    expect(response.statusCode).toBe(401);
    expect(vision.recognize).not.toHaveBeenCalled();
  });

  it('accepts a real PNG, re-encodes it and returns the matcher contract', async () => {
    const image = await sharp({
      create: { width: 24, height: 24, channels: 3, background: '#ffaa00' },
    })
      .png()
      .toBuffer();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/food-scan/recognize',
      ...payload(image),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'NO_MATCH',
      recognizedName: 'Phở bò',
      candidates: [],
    });
    expect(matcher.match).toHaveBeenCalledWith(extraction, 'test-vision');
    const uploaded = vision.recognize.mock.calls[0][0] as Buffer;
    expect((await sharp(uploaded).metadata()).format).toBe('jpeg');
  });

  it('rejects corrupted bytes before invoking AI', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/food-scan/recognize',
      ...payload(Buffer.from('not-an-image')),
    });
    expect(response.statusCode).toBe(400);
    expect(vision.recognize).not.toHaveBeenCalled();
  });

  it('rejects files over the size limit without an AI call', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/food-scan/recognize',
      ...payload(Buffer.alloc(5 * 1024 * 1024 + 1)),
    });
    expect(response.statusCode).toBe(413);
    expect(vision.recognize).not.toHaveBeenCalled();
  });

  it('rate-limits repeated requests before calling a paid provider', async () => {
    for (let i = 0; i < 5; i++) {
      await app.inject({
        method: 'POST',
        url: '/v1/food-scan/recognize',
        headers: { authorization: 'Bearer test' },
        payload: {},
      });
    }
    const response = await app.inject({
      method: 'POST',
      url: '/v1/food-scan/recognize',
      headers: { authorization: 'Bearer test' },
      payload: {},
    });
    expect(response.statusCode).toBe(429);
    expect(vision.recognize).not.toHaveBeenCalled();
  });

  it('rejects the wrong multipart field and JSON URL requests', async () => {
    const wrong = await app.inject({
      method: 'POST',
      url: '/v1/food-scan/recognize',
      ...payload(Buffer.from('unused'), 'image'),
    });
    expect(wrong.statusCode).toBe(400);
    const json = await app.inject({
      method: 'POST',
      url: '/v1/food-scan/recognize',
      headers: { authorization: 'Bearer test' },
      payload: { imageUrl: 'http://localhost/private' },
    });
    expect(json.statusCode).toBe(400);
    expect(vision.recognize).not.toHaveBeenCalled();
  });
});
