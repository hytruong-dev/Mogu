import { ConfigService } from '@nestjs/config';
import { CookingTtsService } from './tts.provider';
import { speechCacheKey, VoiceCacheService } from './voice-cache.service';
describe('voice cache privacy', () => {
  const identity = { provider: 'azure', model: 'neural', voice: 'vi' };
  const make = (values = {}) => {
    const synthesize = jest.fn(async () => Buffer.from('audio'));
    const tts = { provider: () => ({ identity }), synthesize };
    return {
      service: new VoiceCacheService(
        new ConfigService(values),
        tts as unknown as CookingTtsService,
      ),
      synthesize,
    };
  };
  afterEach(() => jest.restoreAllMocks());
  it('keys provider/model/voice/text/rate independently', () => {
    const original = speechCacheKey(identity, 'text', 1);
    for (const change of [
      { provider: 'openai' },
      { model: 'other' },
      { voice: 'other' },
    ])
      expect(speechCacheKey({ ...identity, ...change }, 'text', 1)).not.toBe(
        original,
      );
    expect(speechCacheKey(identity, 'other', 1)).not.toBe(original);
    expect(speechCacheKey(identity, 'text', 0.9)).not.toBe(original);
  });
  it('arbitrary speech never touches storage even when configured', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const { service } = make({
      SUPABASE_URL: 'https://storage.test',
      SUPABASE_SERVICE_ROLE_KEY: 'key',
    });
    expect(await service.privateSpeech('private allergy question')).toEqual({
      text: 'private allergy question',
      audioUrl: 'data:audio/mpeg;base64,YXVkaW8=',
      durationMs: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('deduplicates simultaneous public speech, gracefully handles missing storage', async () => {
    const { service, synthesize } = make();
    const [a, b] = await Promise.all([
      service.publicRecipeSpeech('hello'),
      service.publicRecipeSpeech('hello'),
    ]);
    expect(a).toEqual(b);
    expect(synthesize).toHaveBeenCalledTimes(1);
    expect(a.durationMs).toBeNull();
  });
  it('checks public bucket, uploads public recipes and reuses cache', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('{"public":true}'))
      .mockResolvedValueOnce(new Response('missing', { status: 404 }))
      .mockResolvedValueOnce(new Response('{"Key":"ok"}'));
    const { service, synthesize } = make({
      SUPABASE_URL: 'https://storage.test',
      SUPABASE_SERVICE_ROLE_KEY: 'key',
    });
    const result = await service.publicRecipeSpeech('public recipe');
    expect(result.audioUrl).toContain('/object/public/voice-cache/');
    await service.publicRecipeSpeech('public recipe');
    expect(synthesize).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it('never uploads to private buckets', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('{"public":false}'));
    const { service } = make({
      SUPABASE_URL: 'https://storage.test',
      SUPABASE_SERVICE_ROLE_KEY: 'key',
    });
    expect((await service.publicRecipeSpeech('hello')).audioUrl).toMatch(
      /^data:/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
