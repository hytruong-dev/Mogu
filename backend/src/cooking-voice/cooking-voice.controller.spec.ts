import {
  CookingVoiceController,
  CookingVoiceRateLimiter,
} from './cooking-voice.controller';
import { VoiceCacheService } from './voice-cache.service';
import { CookingScriptService } from './cooking-script.service';
import { CookingAskService } from './cooking-ask.service';

describe('Cooking voice admission limits', () => {
  it('requires an authenticated identity', () => {
    expect(() => new CookingVoiceRateLimiter().acquire('')).toThrow();
  });
  it('rejects overlapping work for a user and releases the slot', () => {
    const limiter = new CookingVoiceRateLimiter();
    const release = limiter.acquire('user');
    expect(() => limiter.acquire('user')).toThrow('COOKING_VOICE_RATE_LIMITED');
    release();
    expect(() => limiter.acquire('user')).not.toThrow();
  });
  it('limits provider concurrency across users', () => {
    const limiter = new CookingVoiceRateLimiter();
    const releases = Array.from({ length: 12 }, (_, i) =>
      limiter.acquire(`user-${i}`),
    );
    expect(() => limiter.acquire('overflow')).toThrow(
      'COOKING_VOICE_RATE_LIMITED',
    );
    releases[0]();
    expect(() => limiter.acquire('overflow')).not.toThrow();
  });
  it('bounds repeated requests and resets after one minute', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
    try {
      const limiter = new CookingVoiceRateLimiter();
      for (let i = 0; i < 20; i++) limiter.acquire('user')();
      expect(() => limiter.acquire('user')).toThrow(
        'COOKING_VOICE_RATE_LIMITED',
      );
      now.mockReturnValue(61000);
      expect(() => limiter.acquire('user')).not.toThrow();
    } finally {
      now.mockRestore();
    }
  });
  it('releases capacity when a provider fails', async () => {
    const limiter = new CookingVoiceRateLimiter();
    const privateSpeech = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ text: 'Xin chào', audioUrl: null });
    const controller = new CookingVoiceController(
      { privateSpeech } as unknown as VoiceCacheService,
      {} as CookingScriptService,
      {} as CookingAskService,
      limiter,
    );
    await expect(
      controller.tts({ user: { sub: 'user' } }, { text: 'Xin chào' }),
    ).rejects.toThrow('offline');
    await expect(
      controller.tts({ user: { sub: 'user' } }, { text: 'Xin chào' }),
    ).resolves.toEqual({ text: 'Xin chào', audioUrl: null });
  });
});
