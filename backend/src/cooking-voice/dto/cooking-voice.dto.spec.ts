import { validate } from 'class-validator';
import { AskDto, TtsDto } from './cooking-voice.dto';

describe('Cooking voice input validation', () => {
  it('bounds speech text and numeric playback rate', async () => {
    expect(
      await validate(
        Object.assign(new TtsDto(), { text: 'Xin chào', rate: 0.95 }),
      ),
    ).toHaveLength(0);
    for (const input of [
      { text: '' },
      { text: 'a'.repeat(4001) },
      { text: 'Xin chào', rate: 2 },
      { text: 'Xin chào', rate: '1' },
    ]) {
      expect(
        (await validate(Object.assign(new TtsDto(), input))).length,
      ).toBeGreaterThan(0);
    }
  });
  it('requires authoritative dish identity and bounds action context', async () => {
    const valid = {
      dishId: 'c628647a-8f5c-4b2c-8e96-dfbb1ed07e75',
      question: 'Cần chuẩn bị gì?',
      currentStep: 0,
      timerRemainingSec: 60,
      servings: 2,
    };
    expect(await validate(Object.assign(new AskDto(), valid))).toHaveLength(0);
    for (const override of [
      { dishId: 'bad' },
      { currentStep: -1 },
      { currentStep: 40 },
      { currentStep: 1.5 },
      { timerRemainingSec: -1 },
      { servings: 0 },
      { question: 'a'.repeat(1001) },
    ]) {
      expect(
        (await validate(Object.assign(new AskDto(), valid, override))).length,
      ).toBeGreaterThan(0);
    }
  });
});
