/** One version for the spoken persona and all public recipe audio. */
export const NOAN_VOICE_PROFILE_VERSION = 'noan-kitchen-vs-v1';

export interface CookingVoiceOption {
  id: string;
  name: string;
  gender: 'female' | 'male' | 'mascot';
  description: string;
  recommended?: boolean;
}

export const VOICESTUDIO_COOKING_VOICES: CookingVoiceOption[] = [
  {
    id: 'noan_female_cooking',
    name: 'NOAN Bếp Việt Nữ (Ấm áp)',
    gender: 'female',
    description: 'Giọng nữ nhẹ nhàng, ấm áp, truyền cảm, phát âm rõ ràng nguyên liệu và bước nấu.',
    recommended: true,
  },
  {
    id: 'noan_male_cooking',
    name: 'NOAN Bếp Việt Nam (Trầm ấm)',
    gender: 'male',
    description: 'Giọng nam ấm áp, tự nhiên, nhịp điệu từ tốn, bạn đồng hành nấu ăn gia đình.',
  },
  {
    id: 'noan_mascot',
    name: 'NOAN Mascot Vàng (Năng động)',
    gender: 'mascot',
    description: 'Giọng linh vật NOAN tươi vui, khích lệ, hướng dẫn từng bước nấu ăn.',
  },
];

/** Supported by gpt-4o-mini-tts; older TTS models must omit this field. */
export const NOAN_TTS_INSTRUCTIONS =
  'Speak natural Vietnamese (vi-VN) as NOAN, a friendly cooking companion. ' +
  'Sound warm, bright and gently playful, with a small smile; youthful but never childlike or cartoonish. ' +
  'Use a steady medium pace. Pause briefly between sentences and enunciate ingredients, quantities, temperatures, times and safety information especially clearly. ' +
  'Lift the energy slightly for greetings and congratulations; sound calm and precise for instructions or warnings. ' +
  'Do not sing, use sound effects, or add, skip, translate or change any spoken words or numbers.';

export const NOAN_ANSWER_VOICE_RULES =
  'Giọng NOAN ấm áp, sáng sủa và gần gũi; xưng mình, gọi bạn. ' +
  'Có thể vui nhẹ khi chào hoặc chúc mừng, nhưng ở bước nấu, số lượng, thời gian và cảnh báo phải ngắn, rõ, không pha trò hay lặp khẩu hiệu.';

export function noanCookingGreeting(dishName: string): string {
  return `NOAN đây! Hôm nay mình cùng nấu món ${dishName} nhé. Mình sẽ đọc từng bước thật rõ. Sẵn sàng thì nói bắt đầu nha.`;
}

