import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import multipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  FoodScanController,
  FoodScanRateLimiter,
  FOOD_SCAN_MAX_BYTES,
  validateFoodScanImage,
} from './food-scan.controller';
import { FoodScanVisionService } from './food-scan-vision.service';
import { FoodScanMatcherService } from './food-scan-matcher.service';

const multipartBody = (bytes: Buffer, mime = 'image/png', field = 'file') =>
  Buffer.concat([
    Buffer.from(
      `--scan-boundary\r\nContent-Disposition: form-data; name="${field}"; filename="image.png"\r\nContent-Type: ${mime}\r\n\r\n`,
    ),
    bytes,
    Buffer.from('\r\n--scan-boundary--\r\n'),
  ]);

describe('FoodScan uploads and authentication', () => {
  let app: NestFastifyApplication;
  const vision = {
    model: 'vision',
    recognize: jest.fn().mockResolvedValue({ isFood: false }),
  };
  const matcher = {
    match: jest
      .fn()
      .mockResolvedValue({
        status: 'NOT_FOOD',
        recognizedName: null,
        candidates: [],
        model: 'vision',
      }),
    recordFeedback: jest.fn().mockResolvedValue({ success: true, scanId: '00000000-0000-0000-0000-000000000001' }),
    reportMissing: jest.fn().mockImplementation((scanId: string) =>
      Promise.resolve({ success: true, scanId, reportId: 'report-1' }),
    ),
  };

  async function setup(authenticated: boolean) {
    const builder = Test.createTestingModule({
      controllers: [FoodScanController],
      providers: [
        FoodScanRateLimiter,
        Reflector,
        { provide: ConfigService, useValue: new ConfigService({}) },
        { provide: FoodScanVisionService, useValue: vision },
        { provide: FoodScanMatcherService, useValue: matcher },
      ],
    });
    if (authenticated)
      builder.overrideGuard(JwtAuthGuard).useValue({
        canActivate: (ctx: {
          switchToHttp: () => { getRequest: () => { user: unknown } };
        }) => {
          ctx.switchToHttp().getRequest().user = { sub: 'test-user' };
          return true;
        },
      });
    const module = await builder.compile();
    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await (
      app.getHttpAdapter().getInstance() as unknown as FastifyInstance
    ).register(multipart);
    await app.init();
    await (
      app.getHttpAdapter().getInstance() as unknown as FastifyInstance
    ).ready();
  }

  afterEach(async () => {
    await app?.close();
    jest.clearAllMocks();
  });

  it('rejects unauthenticated requests before invoking vision', async () => {
    await setup(false);
    const response = await app.inject({
      method: 'POST',
      url: '/food-scan/recognize',
      payload: {},
    });
    expect(response.statusCode).toBe(401);
    expect(vision.recognize).not.toHaveBeenCalled();
  });
  it('accepts decoded PNG and sends sanitized JPEG bytes to vision', async () => {
    await setup(true);
    const image = await sharp({
      create: { width: 4, height: 4, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer();
    const response = await app.inject({
      method: 'POST',
      url: '/food-scan/recognize',
      headers: {
        'content-type': 'multipart/form-data; boundary=scan-boundary',
      },
      payload: multipartBody(image),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('NOT_FOOD');
    expect(
      (await sharp(vision.recognize.mock.calls[0][0] as Buffer).metadata())
        .format,
    ).toBe('jpeg');
  });
  it.each([
    ['corrupt', Buffer.from('not an image'), 'image/png', 'file', 400],
    ['unsupported', Buffer.from('test'), 'image/gif', 'file', 400],
    [
      'URL field',
      Buffer.from('https://127.0.0.1/private'),
      'image/png',
      'url',
      400,
    ],
    [
      'oversized',
      Buffer.alloc(FOOD_SCAN_MAX_BYTES + 1),
      'image/png',
      'file',
      413,
    ],
  ])(
    'rejects %s without calling the provider',
    async (_label, bytes, mime, field, status) => {
      await setup(true);
      const response = await app.inject({
        method: 'POST',
        url: '/food-scan/recognize',
        headers: {
          'content-type': 'multipart/form-data; boundary=scan-boundary',
        },
        payload: multipartBody(bytes, mime, field),
      });
      expect(response.statusCode).toBe(status);
      expect(vision.recognize).not.toHaveBeenCalled();
    },
  );
  it('rejects arbitrary URL JSON instead of fetching it', async () => {
    await setup(true);
    const response = await app.inject({
      method: 'POST',
      url: '/food-scan/recognize',
      payload: { url: 'http://localhost/private' },
    });
    expect(response.statusCode).toBe(400);
    expect(vision.recognize).not.toHaveBeenCalled();
  });
  it('rejects MIME/decoded-byte mismatches', async () => {
    const jpeg = await sharp({
      create: { width: 4, height: 4, channels: 3, background: '#fff' },
    })
      .jpeg()
      .toBuffer();
    await expect(validateFoodScanImage(jpeg, 'image/png')).rejects.toThrow(
      'FOOD_SCAN_INVALID_IMAGE_BYTES',
    );
  });
  it('rate limits concurrent and repeated calls per user', () => {
    const limiter = new FoodScanRateLimiter();
    const release = limiter.acquire('user');
    expect(() => limiter.acquire('user')).toThrow('FOOD_SCAN_RATE_LIMITED');
    release();
    for (let i = 0; i < 4; i++) limiter.acquire('user')();
    expect(() => limiter.acquire('user')).toThrow('FOOD_SCAN_RATE_LIMITED');
  });

  it('submits feedback for a food scan successfully', async () => {
    await setup(true);
    const scanId = '00000000-0000-0000-0000-000000000001';
    const response = await app.inject({
      method: 'POST',
      url: `/food-scan/${scanId}/feedback`,
      headers: { 'content-type': 'application/json' },
      payload: {
        dishId: '11111111-1111-1111-1111-111111111111',
        correct: true,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, scanId });
    expect(matcher.recordFeedback).toHaveBeenCalledWith(
      scanId,
      'test-user',
      {
        dishId: '11111111-1111-1111-1111-111111111111',
        correct: true,
      },
    );
  });

  it('reports a missing dish with the photo', async () => {
    await setup(true);
    const scanId = '00000000-0000-0000-0000-000000000002';
    const image = await sharp({
      create: { width: 4, height: 4, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer();
    const response = await app.inject({
      method: 'POST',
      url: `/food-scan/${scanId}/report-missing`,
      headers: {
        'content-type': 'multipart/form-data; boundary=scan-boundary',
      },
      payload: multipartBody(image),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().reportId).toBe('report-1');
    const [id, user, buffer] = matcher.reportMissing.mock.calls[0];
    expect(id).toBe(scanId);
    expect(user).toBe('test-user');
    expect((await sharp(buffer as Buffer).metadata()).format).toBe('jpeg');
  });

  it('reports a missing dish without a photo', async () => {
    await setup(true);
    const scanId = '00000000-0000-0000-0000-000000000003';
    const response = await app.inject({
      method: 'POST',
      url: `/food-scan/${scanId}/report-missing`,
      headers: { 'content-type': 'application/json' },
      payload: {},
    });
    expect(response.statusCode).toBe(200);
    expect(matcher.reportMissing).toHaveBeenCalledWith(scanId, 'test-user', null);
  });
});
