import {
  BadRequestException,
  Injectable,
  Logger,
  PayloadTooLargeException,
  RequestTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import sharp from 'sharp';

const ALLOWED_HOST_SUFFIXES = [
  'upload.wikimedia.org',
  'commons.wikimedia.org',
  'wikimedia.org',
  'openverse.org',
  'wordpress.com',
  'staticflickr.com',
  'flickr.com',
];

export interface SafeImageDownloadResult {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  checksumSha256: string;
  finalUrl: string;
}

@Injectable()
export class SafeImageDownloaderService {
  private readonly logger = new Logger(SafeImageDownloaderService.name);
  private readonly maxBytes = 5 * 1024 * 1024;
  private readonly timeoutMs = 10_000;

  constructor(private readonly config: ConfigService) {}

  async download(url: string): Promise<SafeImageDownloadResult> {
    let current = await this.validateUrl(url);
    let redirects = 0;
    const maxRedirects = 3;

    while (redirects <= maxRedirects) {
      await this.assertPublicHostname(current.hostname);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      let response: Response;
      try {
        response = await fetch(current, {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: { 'user-agent': 'Mogu-IngredientEnrichment/1.0' },
        });
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          throw new RequestTimeoutException('Image download timed out');
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw new BadRequestException('Redirect without location');
        if (redirects === maxRedirects) {
          throw new BadRequestException('Too many redirects');
        }
        current = await this.validateUrl(new URL(location, current).toString());
        redirects += 1;
        continue;
      }

      if (!response.ok) {
        throw new BadRequestException(`Image HTTP ${response.status}`);
      }

      const declared = Number(response.headers.get('content-length'));
      if (Number.isFinite(declared) && declared > this.maxBytes) {
        await response.body?.cancel();
        throw new PayloadTooLargeException('Image too large');
      }

      const contentType = (response.headers.get('content-type') || '').split(';')[0];
      const ab = await response.arrayBuffer();
      if (ab.byteLength > this.maxBytes) {
        throw new PayloadTooLargeException('Image too large');
      }
      const raw = Buffer.from(ab);
      const reencoded = await this.reencode(raw, contentType);
      return {
        ...reencoded,
        finalUrl: current.toString(),
      };
    }

    throw new BadRequestException('Image download failed');
  }

  private async reencode(
    raw: Buffer,
    declaredType: string,
  ): Promise<Omit<SafeImageDownloadResult, 'finalUrl'>> {
    const meta = await sharp(raw, { failOn: 'error' }).metadata();
    if (!meta.width || !meta.height) {
      throw new BadRequestException('Invalid image');
    }
    if (meta.width > 8000 || meta.height > 8000) {
      throw new BadRequestException('Image dimensions too large');
    }
    if (
      declaredType &&
      !/^image\/(jpeg|jpg|png|webp)$/i.test(declaredType) &&
      !['jpeg', 'png', 'webp', 'jpg'].includes(meta.format || '')
    ) {
      throw new BadRequestException('Unsupported image type');
    }

    const buffer = await sharp(raw)
      .rotate()
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    const outMeta = await sharp(buffer).metadata();
    return {
      buffer,
      mimeType: 'image/webp',
      width: outMeta.width ?? meta.width,
      height: outMeta.height ?? meta.height,
      checksumSha256: createHash('sha256').update(buffer).digest('hex'),
    };
  }

  private async validateUrl(raw: string): Promise<URL> {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new BadRequestException('Invalid image URL');
    }
    if (parsed.protocol !== 'https:') {
      throw new BadRequestException('Only HTTPS image URLs allowed');
    }
    const host = parsed.hostname.toLowerCase();
    const allowed = ALLOWED_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`),
    );
    if (!allowed) {
      this.logger.warn(`Blocked image host: ${host}`);
      throw new BadRequestException('Image host not allowlisted');
    }
    return parsed;
  }

  private async assertPublicHostname(hostname: string): Promise<void> {
    if (isIP(hostname)) {
      if (this.isPrivateIp(hostname)) {
        throw new BadRequestException('Private IP blocked');
      }
      return;
    }
    const records = await lookup(hostname, { all: true });
    for (const rec of records) {
      if (this.isPrivateIp(rec.address)) {
        throw new BadRequestException('Private IP blocked');
      }
    }
  }

  private isPrivateIp(ip: string): boolean {
    if (ip === '127.0.0.1' || ip === '::1') return true;
    if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('169.254.'))
      return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
    if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:')) return true;
    return false;
  }
}
