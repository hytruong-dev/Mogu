export type CookingAction =
  | {
      type:
        | 'START'
        | 'NEXT'
        | 'PREV'
        | 'REPEAT'
        | 'READ_INGREDIENTS'
        | 'START_TIMER'
        | 'PAUSE_TIMER'
        | 'TIMER_STATUS'
        | 'PAUSE'
        | 'RESUME'
        | 'FINISH'
        | 'YES'
        | 'NO';
    }
  | { type: 'GOTO'; stepIndex: number }
  | { type: 'SET_TIMER'; seconds: number };
export type CookingIntent = CookingAction | { type: 'ASK'; question: string } | { type: 'IGNORE' };

export function normalizeCookingSpeech(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[.,!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const digits: Record<string, number> = {
  khong: 0,
  mot: 1,
  hai: 2,
  ba: 3,
  bon: 4,
  tu: 4,
  nam: 5,
  lam: 5,
  sau: 6,
  bay: 7,
  tam: 8,
  chin: 9,
  muoi: 10,
};
function number(text: string): number | null {
  if (/^\d+$/.test(text)) return Number(text);
  if (text in digits) return digits[text];
  const parts = text.split(' ');
  if (parts[0] === 'muoi' && parts.length === 2 && parts[1] in digits) return 10 + digits[parts[1]];
  if (
    parts.length >= 2 &&
    parts.length <= 3 &&
    parts[1] === 'muoi' &&
    parts[0] in digits &&
    digits[parts[0]] >= 2
  ) {
    if (parts.length === 3 && !(parts[2] in digits)) return null;
    return digits[parts[0]] * 10 + (parts.length === 3 ? digits[parts[2]] : 0);
  }
  return null;
}
/** Anchored commands only: a question mentioning a command is never that command. */
export function parseCookingIntent(
  text: string,
  options: { replyWindow?: boolean } = {},
): CookingIntent {
  let input = normalizeCookingSpeech(text);
  // Deliberately narrow wake-name aliases, not arbitrary fuzzy matching.
  const wake = /^(?:noan|no an|no anh|noang)(?:\s+|$)/.exec(input);
  if (!wake && !options.replyWindow) return { type: 'IGNORE' };
  if (wake) input = input.slice(wake[0].length).trim();
  if (!input) return { type: 'IGNORE' };
  const commands: [RegExp, CookingAction['type']][] = [
    [/^(bat dau|san sang|ok|ok noan)$/, 'START'],
    [/^(buoc tiep|tiep theo|xong roi|tiep di|buoc tiep theo)$/, 'NEXT'],
    [/^(quay lai|buoc truoc|buoc truoc do)$/, 'PREV'],
    [/^(doc lai|noi lai|nhac lai)$/, 'REPEAT'],
    [/^(nguyen lieu|doc nguyen lieu|can chuan bi gi)$/, 'READ_INGREDIENTS'],
    [/^(bam gio|bat dau hen gio|bat dau bam gio)$/, 'START_TIMER'],
    [/^(dung hen gio|tam dung hen gio)$/, 'PAUSE_TIMER'],
    [/^(con bao lau|con may phut)$/, 'TIMER_STATUS'],
    [/^(dung|dung lai|doi chut|khoan|tam dung)$/, 'PAUSE'],
    [/^(tiep tuc|nghe tiep)$/, 'RESUME'],
    [/^(hoan tat|ket thuc|nau xong|hoan thanh)$/, 'FINISH'],
    [/^(co|vang|u|dong y|dung roi|yes)$/, 'YES'],
    [/^(khong|khong dong y|huy|thoi|no)$/, 'NO'],
  ];
  for (const [pattern, type] of commands) if (pattern.test(input)) return { type } as CookingAction;
  const goto = /^(?:den |chuyen den |quay ve )?buoc (.+)$/.exec(input);
  if (goto) {
    const n = number(goto[1]);
    if (n !== null && n >= 1 && n <= 100) return { type: 'GOTO', stepIndex: n - 1 };
  }
  const timer = /^(?:hen gio|dat hen gio|bam gio) (.+?) (phut|giay|gio)$/.exec(input);
  if (timer) {
    const n = number(timer[1]);
    const seconds = n === null ? 0 : n * (timer[2] === 'gio' ? 3600 : timer[2] === 'phut' ? 60 : 1);
    if (seconds > 0 && seconds <= 86400) return { type: 'SET_TIMER', seconds };
  }
  // Preserve Vietnamese in the backend question, removing only the wake prefix.
  const question = text
    .trim()
    .replace(/^(?:noan|no\s+an|no\s+anh|noang)[\s,.:!?]+/i, '')
    .trim();
  return { type: 'ASK', question };
}

export function validateCookingAction(
  action: { type: string; stepIndex?: number | null; seconds?: number | null },
  count: number,
): CookingAction | null {
  if (action.type === 'GOTO')
    return Number.isInteger(action.stepIndex) && action.stepIndex! >= 0 && action.stepIndex! < count
      ? { type: 'GOTO', stepIndex: action.stepIndex! }
      : null;
  if (action.type === 'SET_TIMER')
    return Number.isInteger(action.seconds) && action.seconds! > 0 && action.seconds! <= 86400
      ? { type: 'SET_TIMER', seconds: action.seconds! }
      : null;
  if (
    ['NEXT', 'PREV', 'START_TIMER', 'PAUSE_TIMER', 'READ_INGREDIENTS', 'REPEAT'].includes(
      action.type,
    )
  )
    return { type: action.type } as CookingAction;
  return null;
}

