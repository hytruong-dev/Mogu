import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import {
  boundedRequest,
  CookingTtsService,
  SCRIPT_VERSION,
  TtsIdentity,
  validateSpeech,
} from './tts.provider';

export function speechCacheKey(
  identity: TtsIdentity,
  text: string,
  rate: number,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        ...identity,
        text,
        rate,
        scriptVersion: SCRIPT_VERSION,
      }),
    )
    .digest('hex');
}
export interface SpeechResult {
  text: string;
  audioUrl: string | null;
  durationMs: number | null;
}
@Injectable()
export class VoiceCacheService {
  private readonly urls = new Map<string, string>();
  private readonly pending = new Map<string, Promise<SpeechResult>>();
  constructor(
    private readonly config: ConfigService,
    private readonly tts: CookingTtsService,
  ) {}
  // This entry point accepts arbitrary text and NEVER uses public persistence or a shared cache.
  async privateSpeech(text: string, rate = 0.95): Promise<SpeechResult> {
    validateSpeech(text, rate);
    const bytes = await this.tts.synthesize(this.tts.provider(), text, rate);
    return {
      text,
      audioUrl: `data:audio/mpeg;base64,${bytes.toString('base64')}`,
      durationMs: null,
    };
  }
  // Only the authoritative published recipe builder may call this method.
  async publicRecipeSpeech(text: string, rate = 0.95): Promise<SpeechResult> {
    validateSpeech(text, rate);
    const provider = this.tts.provider();
    const key = speechCacheKey(provider.identity, text, rate);
    const cached = this.urls.get(key);
    if (cached) return { text, audioUrl: cached, durationMs: null };
    const existing = this.pending.get(key);
    if (existing) return existing;
    const work = (async () => {
      const storage = await this.publicStorage();
      const path = `${key}.mp3`;
      const url = storage
        ? `${storage.base}/object/public/${storage.bucket}/${path}`
        : null;
      if (url) {
        try {
          await boundedRequest(url, { method: 'GET' });
          this.remember(key, url);
          return { text, audioUrl: url, durationMs: null };
        } catch {
          /* Missing bucket/object is a supported offline-storage mode. */
        }
      }
      const bytes = await this.tts.synthesize(provider, text, rate);
      if (storage && url) {
        try {
          await boundedRequest(
            `${storage.base}/object/${storage.bucket}/${path}`,
            {
              method: 'POST',
              headers: {
                ...storage.headers,
                'Content-Type': 'audio/mpeg',
                'x-upsert': 'true',
              },
              body: new Uint8Array(bytes),
            },
          );
          this.remember(key, url);
          return { text, audioUrl: url, durationMs: null };
        } catch {
          /* No bucket creation or remote schema mutation. */
        }
      }
      return {
        text,
        audioUrl: `data:audio/mpeg;base64,${bytes.toString('base64')}`,
        durationMs: null,
      };
    })();
    this.pending.set(key, work);
    try {
      return await work;
    } finally {
      this.pending.delete(key);
    }
  }
  private remember(key: string, url: string) {
    if (this.urls.size >= 1000)
      this.urls.delete(this.urls.keys().next().value!);
    this.urls.set(key, url);
  }
  private async publicStorage() {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    const bucket =
      this.config.get<string>('COOKING_VOICE_BUCKET') || 'voice-cache';
    if (!url || !key || !/^[a-zA-Z0-9_-]+$/.test(bucket)) return null;
    const base = `${url.replace(/\/$/, '')}/storage/v1`;
    const headers = { Authorization: `Bearer ${key}`, apikey: key };
    try {
      const metadata = JSON.parse(
        (
          await boundedRequest(`${base}/bucket/${bucket}`, { headers }, 10_000)
        ).toString(),
      ) as { public?: boolean };
      return metadata.public === true ? { base, bucket, headers } : null;
    } catch {
      return null;
    }
  }
}
