// Run: npx tsx --test src/screens/food-detail/voice/cooking-intents.test.ts
// @ts-ignore -- node:test is intentionally test-only; mobile does not need @types/node.
import { test } from 'node:test';
// @ts-ignore -- node assertions are provided by the test runner, not React Native.
import assert from 'node:assert/strict';
import { parseCookingIntent } from './cooking-intents';

test('requires the wake prefix outside the reply window', () => {
  assert.deepEqual(parseCookingIntent('bước tiếp'), { type: 'IGNORE' });
  assert.deepEqual(parseCookingIntent('bước tiếp', { replyWindow: true }), { type: 'NEXT' });
  assert.deepEqual(parseCookingIntent('NOAN, bước tiếp!'), { type: 'NEXT' });
  assert.deepEqual(parseCookingIntent('No An bước trước'), { type: 'PREV' });
  assert.deepEqual(parseCookingIntent('No Anh đọc lại'), { type: 'REPEAT' });
  assert.deepEqual(parseCookingIntent('noang bắt đầu'), { type: 'START' });
  assert.deepEqual(parseCookingIntent('loan bước tiếp'), { type: 'IGNORE' });
  assert.deepEqual(parseCookingIntent('noan là tên người bước tiếp'), {
    type: 'ASK',
    question: 'là tên người bước tiếp',
  });
});
test('anchors commands; embedded mentions and questions cannot execute', () => {
  for (const question of [
    'bước tiếp cần làm gì',
    'tôi có nên nói bước tiếp không',
    'hẹn giờ năm phút có đủ không',
    'đến bước 2 có cần thêm muối không',
    'đừng bước tiếp',
    'bước 3 là gì',
  ]) {
    assert.equal(parseCookingIntent(`NOAN ${question}`).type, 'ASK');
  }
});
test('supports exact cooking commands and confirmation', () => {
  const cases = [
    ['sẵn sàng', 'START'],
    ['ok noan', 'START'],
    ['xong rồi', 'NEXT'],
    ['quay lại', 'PREV'],
    ['nói lại', 'REPEAT'],
    ['cần chuẩn bị gì', 'READ_INGREDIENTS'],
    ['bấm giờ', 'START_TIMER'],
    ['dừng hẹn giờ', 'PAUSE_TIMER'],
    ['còn bao lâu', 'TIMER_STATUS'],
    ['khoan', 'PAUSE'],
    ['tiếp tục', 'RESUME'],
    ['nấu xong', 'FINISH'],
    ['đồng ý', 'YES'],
    ['không', 'NO'],
  ];
  for (const [text, type] of cases)
    assert.equal(parseCookingIntent(text, { replyWindow: true }).type, type);
});
test('parses bounded numeric and Vietnamese durations', () => {
  assert.deepEqual(parseCookingIntent('NOAN hẹn giờ năm phút'), {
    type: 'SET_TIMER',
    seconds: 300,
  });
  assert.deepEqual(parseCookingIntent('NOAN đặt hẹn giờ mười lăm giây'), {
    type: 'SET_TIMER',
    seconds: 15,
  });
  assert.deepEqual(parseCookingIntent('NOAN hẹn giờ hai mươi ba phút'), {
    type: 'SET_TIMER',
    seconds: 1380,
  });
  assert.deepEqual(parseCookingIntent('NOAN hẹn giờ 2 giờ'), { type: 'SET_TIMER', seconds: 7200 });
  for (const text of [
    'hẹn giờ 0 phút',
    'hẹn giờ 999 giờ',
    'hẹn giờ xyz phút',
    'hẹn giờ -2 phút',
    'hẹn giờ 1.5 phút',
  ])
    assert.equal(parseCookingIntent(`NOAN ${text}`).type, 'ASK');
});
test('maps human step numbers to zero-based indexes without accepting extra words', () => {
  assert.deepEqual(parseCookingIntent('NOAN bước 3'), { type: 'GOTO', stepIndex: 2 });
  assert.deepEqual(parseCookingIntent('NOAN chuyển đến bước hai'), { type: 'GOTO', stepIndex: 1 });
  assert.equal(parseCookingIntent('NOAN bước 0').type, 'ASK');
  assert.equal(parseCookingIntent('NOAN bước 101').type, 'ASK');
  assert.equal(parseCookingIntent('NOAN bước ba phút').type, 'ASK');
});
test('preserves accents in free questions and ignores an empty wake call', () => {
  assert.deepEqual(parseCookingIntent('NOAN, thay hành tây bằng gì?'), {
    type: 'ASK',
    question: 'thay hành tây bằng gì?',
  });
  assert.deepEqual(parseCookingIntent('NOAN'), { type: 'IGNORE' });
  assert.deepEqual(parseCookingIntent(''), { type: 'IGNORE' });
});
