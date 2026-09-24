import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';

const BANNED_WORDS = [
  'casino',
  'crypto pump',
  'make money fast',
  'viagra',
  'click here now',
  'free $$$',
  // Tiếng Việt: cờ bạc / cá độ / game đổi thưởng
  'cờ bạc',
  'đánh bạc',
  'cá độ',
  'tài xỉu',
  'lô đề',
  'soi cầu',
  'kubet',
  'thabet',
  'sunwin',
  'b52 club',
  // Tiếng Việt: tín dụng đen / lừa đảo tài chính
  'vay tiền nhanh',
  'vay nóng',
  'lãi suất thấp',
  'giải ngân ngay',
  'tín dụng đen',
  'việc nhẹ lương cao',
  'hoa hồng cao',
  'tuyển ctv online',
  // Spam dịch vụ mạng xã hội
  'tăng follow',
  'tăng like',
  'hack like',
  'mua follow',
];

const URL_RE = /https?:\/\/|www\./gi;
const PHONE_RE = /(?:0|\+84)(?:3|5|7|8|9)\d{8}/g;

/** In-memory like rate limit: max 30 likes per user per minute. */
const likeBuckets = new Map<string, number[]>();

export function assertContentNotSpam(content: string, label = 'Nội dung') {
  const text = (content ?? '').trim();
  if (!text) return;

  const urls = text.match(URL_RE) ?? [];
  if (urls.length > 3) {
    throw new BadRequestException(`${label} chứa quá nhiều liên kết`);
  }

  const phones = text.match(PHONE_RE) ?? [];
  if (phones.length >= 3) {
    throw new BadRequestException(`${label} chứa nhiều số điện thoại lặp lại bất thường`);
  }

  // Kiểm tra tỷ lệ chữ in hoa bất thường (CAPS LOCK spam) trên văn bản dài
  if (text.length > 40) {
    const letters = text.replace(/[^\p{L}]/gu, '');
    if (letters.length > 20) {
      const uppers = text.replace(/[^\p{Lu}]/gu, '');
      if (uppers.length / letters.length > 0.85) {
        throw new BadRequestException(`${label} chứa quá nhiều ký tự in hoa`);
      }
    }
  }

  const lower = text.toLowerCase();
  for (const w of BANNED_WORDS) {
    if (lower.includes(w)) {
      throw new BadRequestException(`${label} chứa từ ngữ vi phạm chính sách cộng đồng`);
    }
  }
}

export function assertLikeRateLimit(userId: string) {
  const now = Date.now();
  const windowMs = 60_000;
  const max = 30;

  // Dọn dẹp cache nếu kích thước map quá lớn để chống rò rỉ bộ nhớ
  if (likeBuckets.size > 5000) {
    for (const [uid, timestamps] of likeBuckets.entries()) {
      if (timestamps.every((t) => now - t >= windowMs)) {
        likeBuckets.delete(uid);
      }
    }
  }

  const prev = (likeBuckets.get(userId) ?? []).filter((t) => now - t < windowMs);
  if (prev.length >= max) {
    throw new HttpException('Quá nhiều lượt thích, thử lại sau', HttpStatus.TOO_MANY_REQUESTS);
  }
  prev.push(now);
  likeBuckets.set(userId, prev);
}

export function parseHashtags(content: string, max = 10): string[] {
  const matches = content.match(/#([\p{L}\p{N}_]{2,64})/gu) ?? [];
  const tags = matches
    .map((m) => m.slice(1).toLowerCase())
    .filter((t) => t.length >= 2 && t.length <= 64);
  return [...new Set(tags)].slice(0, max);
}
