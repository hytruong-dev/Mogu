import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
  RequestTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface SafeSourceFetchResult {
  finalUrl: string;
  contentType?: string;
  body: string;
  redirects: number;
}

@Injectable()
export class SafeSourceFetcherService {
  constructor(private readonly config: ConfigService) {}

  async fetch(url: string): Promise<SafeSourceFetchResult> {
    const timeoutMs = this.numberConfig('AI_IMPORT_SOURCE_TIMEOUT_MS', 5_000);
    const maxBytes = this.numberConfig(
      'AI_IMPORT_SOURCE_MAX_RESPONSE_BYTES',
      1_000_000,
    );
    const maxRedirects = this.numberConfig(
      'AI_IMPORT_SOURCE_MAX_REDIRECTS',
      3,
    );
    let current = await this.validateUrl(url);

    for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
      // Revalidate DNS before every request and redirect. Redirect following is
      // manual so no unchecked target is contacted by the HTTP client.
      await this.assertPublicHostname(current.hostname);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await globalThis.fetch(current, {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            accept: 'text/html,application/xhtml+xml',
            'user-agent': 'Mogu-AI-Import-Source/1.1',
          },
        });
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          throw new RequestTimeoutException('Source fetch timed out');
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          throw new BadRequestException('Source redirect has no location');
        }
        if (redirects === maxRedirects) {
          throw new BadRequestException('Source redirect limit exceeded');
        }
        current = await this.validateUrl(new URL(location, current).toString());
        continue;
      }
      if (!response.ok) {
        throw new BadRequestException(
          `Source returned HTTP ${response.status}`,
        );
      }

      const declaredLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        await response.body?.cancel();
        throw new PayloadTooLargeException('Source response is too large');
      }
      const body = await this.readLimited(response, maxBytes);
      return {
        finalUrl: current.toString(),
        contentType: response.headers.get('content-type') ?? undefined,
        body,
        redirects,
      };
    }
    throw new BadRequestException('Source redirect limit exceeded');
  }

  private async readLimited(response: Response, maxBytes: number): Promise<string> {
    if (!response.body) return '';
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maxBytes) {
          await reader.cancel();
          throw new PayloadTooLargeException('Source response is too large');
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const merged = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(merged);
  }

  private async validateUrl(raw: string): Promise<URL> {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new BadRequestException('Invalid source URL');
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new BadRequestException('Only HTTP(S) source URLs are allowed');
    }
    if (url.username || url.password) {
      throw new BadRequestException('Source URL credentials are not allowed');
    }
    if (
      url.port &&
      !(
        (url.protocol === 'http:' && url.port === '80') ||
        (url.protocol === 'https:' && url.port === '443')
      )
    ) {
      throw new BadRequestException('Source URL port is not allowed');
    }
    await this.assertPublicHostname(url.hostname);
    return url;
  }

  private async assertPublicHostname(hostname: string): Promise<void> {
    const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (
      normalized === 'localhost' ||
      normalized.endsWith('.localhost') ||
      normalized.endsWith('.local')
    ) {
      throw new BadRequestException('Private source host is not allowed');
    }
    const addresses = isIP(normalized)
      ? [{ address: normalized }]
      : await lookup(normalized, { all: true, verbatim: true });
    if (
      addresses.length === 0 ||
      addresses.some(({ address }) => !this.isPublicAddress(address))
    ) {
      throw new BadRequestException('Private source address is not allowed');
    }
  }

  private isPublicAddress(address: string): boolean {
    if (address.includes(':')) {
      const value = address.toLowerCase();
      if (
        value === '::' ||
        value === '::1' ||
        value.startsWith('fc') ||
        value.startsWith('fd') ||
        /^fe[89ab]/.test(value) ||
        value.startsWith('2001:db8:') ||
        value.startsWith('::ffff:')
      ) {
        return false;
      }
      return true;
    }
    const parts = address.split('.').map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
      return false;
    }
    const [a, b] = parts;
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }

  private numberConfig(key: string, fallback: number): number {
    const parsed = Number(this.config.get<string | number>(key));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
