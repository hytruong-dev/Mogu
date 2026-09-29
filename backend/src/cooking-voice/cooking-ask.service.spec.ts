import { ConfigService } from '@nestjs/config';
import { validate } from 'class-validator';
import { CookingAskService, validateAnswer } from './cooking-ask.service';
import { CookingScriptService } from './cooking-script.service';
import { AskDto } from './dto/cooking-voice.dto';
import { VoiceCacheService } from './voice-cache.service';
import { CookingVoiceRateLimiter } from './cooking-voice.controller';
describe('cooking ask validation', () => {
  afterEach(() => jest.restoreAllMocks());
  it.each([
    { answer: 'ok', action: { type: 'GOTO', stepIndex: -1 } },
    { answer: 'ok', action: { type: 'GOTO', stepIndex: 3 } },
    { answer: 'ok', action: { type: 'GOTO', stepIndex: 1.5 } },
    { answer: 'ok', action: { type: 'SET_TIMER', seconds: 0 } },
    { answer: 'ok', action: { type: 'SET_TIMER', seconds: 86401 } },
    { answer: 'ok', action: { type: 'SET_TIMER' } },
    { answer: 'ok', action: { type: 'NEXT', seconds: 3 } },
    { answer: 'ok', action: { type: 'EXECUTE' } },
    { answer: 'ok', payload: {} },
    { answer: '', action: null },
  ])('rejects unsafe or non-strict output %j', (value) => {
    expect(() => validateAnswer(value, 3, 1)).toThrow(
      'COOKING_ASK_INVALID_OUTPUT',
    );
  });
  it('validates zero-based navigation boundaries and timer ranges', () => {
    expect(
      validateAnswer(
        { answer: 'Gợi ý', action: { type: 'GOTO', stepIndex: 0 } },
        3,
        1,
      ).action?.stepIndex,
    ).toBe(0);
    expect(
      validateAnswer(
        { answer: 'Gợi ý', action: { type: 'SET_TIMER', seconds: 60 } },
        3,
        1,
      ).action?.seconds,
    ).toBe(60);
    expect(() =>
      validateAnswer({ answer: 'ok', action: { type: 'PREV' } }, 3, 0),
    ).toThrow();
    expect(() =>
      validateAnswer({ answer: 'ok', action: { type: 'NEXT' } }, 3, 2),
    ).toThrow();
  });
  it('validates input current step and optional numbers', async () => {
    const dto = Object.assign(new AskDto(), {
      dishId: 'bad',
      question: 'a'.repeat(1001),
      currentStep: -1,
      servings: 0,
      timerRemainingSec: -1,
    });
    expect((await validate(dto)).length).toBe(5);
  });
  it('grounds provider context, labels substitution/allergy safety, never publicly stores answers', async () => {
    const recipe = jest.fn(async () => ({
      name: 'Canh',
      servings: 2,
      dishIngredients: [{ rawText: 'nước', quantity: 200, unit: 'ml' }],
      recipeSteps: [{ instruction: 'Nấu', durationMin: 10 }],
      dishAllergens: [],
    }));
    const privateSpeech = jest.fn(async () => ({
      audioUrl: 'data:audio/mpeg;base64,AA==',
    }));
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '{"answer":"Chưa đủ dữ liệu xác nhận dị ứng."}',
              },
            },
          ],
        }),
      ),
    );
    const service = new CookingAskService(
      new ConfigService({ COOKING_OPENAI_API_KEY: 'key' }),
      { recipe } as unknown as CookingScriptService,
      { privateSpeech } as unknown as VoiceCacheService,
    );
    const result = await service.ask({
      dishId: 'dish',
      question: 'Có an toàn không?',
      currentStep: 0,
    });
    expect(result.audioUrl).toMatch(/^data:/);
    expect(privateSpeech).toHaveBeenCalledWith(result.answer);
    const request = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(request.messages[0].content).toContain('CHƯA BIẾT');
    expect(request.messages[0].content).toContain('GỢI Ý');
    expect(request.messages[1].content).toContain('200 ml nước');
    await expect(
      service.ask({ dishId: 'dish', question: 'hi', currentStep: 1 }),
    ).rejects.toThrow('COOKING_INVALID_CURRENT_STEP');
  });
  it('fails unconfigured ask clearly without startup failure', async () => {
    const service = new CookingAskService(
      new ConfigService(),
      {} as CookingScriptService,
      {} as VoiceCacheService,
    );
    await expect(
      service.ask({ dishId: 'dish', question: 'hi', currentStep: 0 }),
    ).rejects.toThrow('COOKING_ASK_NOT_CONFIGURED');
  });
  it('enforces per-user in-flight and minute rate limits with released slots', () => {
    const limiter = new CookingVoiceRateLimiter();
    const release = limiter.acquire('user');
    expect(() => limiter.acquire('user')).toThrow('COOKING_VOICE_RATE_LIMITED');
    release();
    for (let i = 1; i < 20; i++) limiter.acquire('user')();
    expect(() => limiter.acquire('user')).toThrow('COOKING_VOICE_RATE_LIMITED');
  });
});
