import { ConfigService } from '@nestjs/config';
import {
  AzureTtsProvider,
  CookingTtsService,
  escapeSsml,
  OpenAiTtsProvider,
  validateSpeech,
} from './tts.provider';

describe('cooking speech providers', () => {
  afterEach(() => jest.restoreAllMocks());
  it('escapes all XML syntax and validates length/rate/controls', () => {
    expect(escapeSsml('<x a="\'">&')).toBe(
      '&lt;x a=&quot;&apos;&quot;&gt;&amp;',
    );
    expect(() => validateSpeech('x'.repeat(4001))).toThrow();
    expect(() => validateSpeech('hello', 2)).toThrow();
    expect(() => validateSpeech('\u0000')).toThrow();
  });
  it('posts escaped SSML rather than allowing injected tags', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
    await new AzureTtsProvider(
      'key',
      'eastus',
      'vi-VN-HoaiMyNeural',
    ).synthesize('<break/> & "x"', 0.95);
    const init = fetchMock.mock.calls[0][1]!;
    expect(init.body).toContain('&lt;break/&gt; &amp; &quot;x&quot;');
    expect(init.body).toContain('rate="-5%"');
  });
  it('adds sentence pauses without allowing recipe SSML injection', async () => {
    const mock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(new Uint8Array([1])));
    await new AzureTtsProvider(
      'key',
      'eastus',
      'vi-VN-HoaiMyNeural',
    ).synthesize('Bước một. <voice>Đun nước</voice>', 0.95);
    expect(mock.mock.calls[0][1]?.body).toContain(
      'Bước một.<break time="250ms"/>&lt;voice&gt;',
    );
  });
  it('uses explicit OpenAI fallback, never inherits text gateway credentials', () => {
    const noConfig = new CookingTtsService(
      new ConfigService({
        XKIRO_API_KEY: 'secret',
        FOOD_SCAN_API_KEY: 'secret',
      }),
    );
    expect(() => noConfig.provider()).toThrow('COOKING_VOICE_NOT_CONFIGURED');
    expect(
      new CookingTtsService(
        new ConfigService({ COOKING_OPENAI_API_KEY: 'key' }),
      ).provider(),
    ).toBeInstanceOf(OpenAiTtsProvider);
    expect(
      new CookingTtsService(
        new ConfigService({
          AZURE_SPEECH_KEY: 'key',
          AZURE_SPEECH_REGION: 'eastus',
          COOKING_OPENAI_API_KEY: 'other',
        }),
      ).provider(),
    ).toBeInstanceOf(AzureTtsProvider);
  });
  it('fails provider requests clearly and releases concurrency slots', async () => {
    const service = new CookingTtsService(new ConfigService());
    const releases: ((value: Buffer) => void)[] = [];
    const synthesize = jest.fn(
      () =>
        new Promise<Buffer>((resolve) => {
          releases.push(resolve);
        }),
    );
    const provider = {
      identity: { provider: 'fake', model: 'm', voice: 'v' },
      synthesize,
    };
    const pending = Array.from({ length: 8 }, () =>
      service.synthesize(provider, 'hello', 1),
    );
    await expect(service.synthesize(provider, 'hello', 1)).rejects.toThrow(
      'COOKING_VOICE_BUSY',
    );
    releases.forEach((release) => release(Buffer.from('a')));
    await Promise.all(pending);
    synthesize.mockImplementation(() => Promise.resolve(Buffer.from('b')));
    await expect(service.synthesize(provider, 'hello', 1)).resolves.toEqual(
      Buffer.from('b'),
    );
  });
  it('aborts an unresponsive provider after a bounded timeout', async () => {
    jest.useFakeTimers();
    jest.spyOn(global, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('aborted')),
          );
        }),
    );
    const work = new OpenAiTtsProvider('key', 'model', 'voice').synthesize(
      'hello',
      1,
    );
    const assertion = expect(work).rejects.toThrow(
      'COOKING_VOICE_PROVIDER_UNAVAILABLE',
    );
    await jest.advanceTimersByTimeAsync(15_000);
    await assertion;
    jest.useRealTimers();
  });
  it('maps upstream errors to an unavailable response', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('failure', { status: 500 }));
    await expect(
      new OpenAiTtsProvider('key', 'model', 'voice').synthesize('hello', 1),
    ).rejects.toThrow('COOKING_VOICE_PROVIDER_UNAVAILABLE');
  });
});
