import { Injectable } from '@nestjs/common';

/**
 * Các giấy phép cho phép sử dụng thương mại + chỉnh sửa (đủ để hiển thị thumbnail
 * nguyên liệu trong app, có ghi nguồn/tác giả trên trang admin).
 *
 * Openverse trả về mã ngắn: "cc0", "by", "by-sa", "pdm" (Public Domain Mark).
 * Wikimedia trả về: "CC BY-SA 4.0", "CC0", "Public domain", "cc-by-sa-3.0"...
 */
const ALLOWED_LICENSE_PATTERNS = [
  /^cc0(\s|$|-)/i,
  /^cc0$/i,
  /^cc[\s-]?by(\s|$|-)/i, // CC BY, CC BY-SA, cc-by-4.0, cc-by-sa-3.0 (không gồm -nc / -nd, lọc bên dưới)
  /^by$/i,
  /^by-sa$/i,
  /^pdm$/i,
  /^public domain/i,
  /^pd(\s|$|-)/i,
  /^pd$/i,
  /^pixabay license$/i,
  /^gfdl/i,
];

const DENIED_LICENSE_PATTERNS = [/-nc(\b|-)/i, /-nd(\b|-)/i, /noncommercial/i, /no derivatives/i];

@Injectable()
export class ImageLicensePolicyService {
  isAcceptable(licenseCode: string | undefined | null): boolean {
    if (!licenseCode || licenseCode.toUpperCase() === 'UNKNOWN') return false;
    const normalized = licenseCode.trim();
    if (DENIED_LICENSE_PATTERNS.some((re) => re.test(normalized))) return false;
    return ALLOWED_LICENSE_PATTERNS.some((re) => re.test(normalized));
  }

  filter<T extends { licenseCode: string; sourcePageUrl?: string }>(
    hits: T[],
  ): T[] {
    return hits.filter(
      (h) => this.isAcceptable(h.licenseCode) && Boolean(h.sourcePageUrl),
    );
  }
}
