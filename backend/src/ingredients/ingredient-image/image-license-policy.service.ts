import { Injectable } from '@nestjs/common';

const ALLOWED_LICENSE_PATTERNS = [
  /^cc0$/i,
  /^cc-?by/i,
  /^public domain$/i,
  /^pd$/i,
  /^cc by/i,
];

@Injectable()
export class ImageLicensePolicyService {
  isAcceptable(licenseCode: string | undefined | null): boolean {
    if (!licenseCode || licenseCode.toUpperCase() === 'UNKNOWN') return false;
    const normalized = licenseCode.trim();
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
