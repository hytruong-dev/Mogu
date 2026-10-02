import {
  BadRequestException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NOAN_TTS_INSTRUCTIONS,
  NOAN_VOICE_PROFILE_VERSION,
} from './noan-voice-profile';

export const SCRIPT_VERSION = NOAN_VOICE_PROFILE_VERSION;
export const MAX_TEXT_LENGTH = 4000;
export function escapeSsml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[c]!,
  );
}
export function validateSpeech(text: string, rate = 0.95): void {
  if (
    typeof text !== 'string' ||
    !text.trim() ||
    text.length > MAX_TEXT_LENGTH ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(text)
  )
    throw new BadRequestException('COOKING_VOICE_INVALID_TEXT');
  if (!Number.isFinite(rate) || rate < 0.5 || rate > 1.5)
    throw new BadRequestException('COOKING_VOICE_INVALID_RATE');
}
export interface TtsIdentity {
  provider: string;
  model: string;
  voice: string;
}
export interface TtsProvider {
  identity: TtsIdentity;
  synthesize(text: string, rate: number): Promise<Buffer>;
}

// Timeout encompasses reading the body, not only receiving response headers.
export async function boundedRequest(
  url: string,
  init: RequestInit,
  maxBytes = 2_000_000,
): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok || !response.body) throw new Error('Upstream unavailable');
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > maxBytes) {
        await reader.cancel();
        throw new Error('Response too large');
      }
      chunks.push(Buffer.from(value));
    }
    if (!length) throw new Error('Empty response');
    return Buffer.concat(chunks);
  } catch {
    throw new ServiceUnavailableException('COOKING_VOICE_PROVIDER_UNAVAILABLE');
  } finally {
    clearTimeout(timeout);
  }
}

export class AzureTtsProvider implements TtsProvider {
  readonly identity: TtsIdentity;
  constructor(
    private key: string,
    private region: string,
    voice: string,
  ) {
    this.identity = { provider: 'azure', model: 'neural-mp3-24khz', voice };
  }
  synthesize(text: string, rate: number): Promise<Buffer> {
    validateSpeech(text, rate);
    // Insert pauses only after escaping user/recipe content, never accept raw SSML.
    const content = escapeSsml(text).replace(
      /([.!?])\s+|\n+/g,
      '$1<break time="250ms"/>',
    );
    const ssml = `<speak version="1.0" xml:lang="vi-VN"><voice name="${escapeSsml(this.identity.voice)}"><prosody rate="${Math.round((rate - 1) * 100)}%" pitch="+4%">${content}</prosody></voice></speak>`;
    return boundedRequest(
      `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.key,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        },
        body: ssml,
      },
    );
  }
}
export class OpenAiTtsProvider implements TtsProvider {
  readonly identity: TtsIdentity;
  constructor(
    private key: string,
    model: string,
    voice: string,
    private customVoiceId?: string,
  ) {
    this.identity = {
      provider: 'openai',
      model,
      voice: customVoiceId || voice,
    };
  }
  synthesize(text: string, rate: number): Promise<Buffer> {
    validateSpeech(text, rate);
    // Explicit OpenAI endpoint: OpenAI-compatible text gateways do not imply audio support.
    return boundedRequest('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.identity.model,
        voice: this.customVoiceId
          ? { id: this.customVoiceId }
          : this.identity.voice,
        input: text,
        speed: rate,
        response_format: 'mp3',
        ...(this.identity.model.startsWith('gpt-4o-mini-tts')
          ? { instructions: NOAN_TTS_INSTRUCTIONS }
          : {}),
      }),
    });
  }
}
@Injectable()
export class CookingTtsService {
  private active = 0;
  constructor(private readonly config: ConfigService) {}
  provider(): TtsProvider {
    const openAiKey = this.config.get<string>('COOKING_OPENAI_API_KEY');
    const customVoiceId = this.config.get<string>('COOKING_OPENAI_VOICE_ID');
    const openAiProvider = (apiKey: string) =>
      new OpenAiTtsProvider(
        apiKey,
        this.config.get<string>('COOKING_TTS_MODEL') || 'gpt-4o-mini-tts',
        this.config.get<string>('COOKING_OPENAI_VOICE') || 'coral',
        customVoiceId,
      );
    // An explicitly configured, consented custom voice wins over a generic Azure voice.
    if (openAiKey && customVoiceId) return openAiProvider(openAiKey);
    const key = this.config.get<string>('AZURE_SPEECH_KEY');
    const region = this.config.get<string>('AZURE_SPEECH_REGION');
    if (key && region && /^[a-z0-9-]+$/.test(region))
      return new AzureTtsProvider(
        key,
        region,
        this.config.get<string>('COOKING_VOICE_NAME') || 'vi-VN-HoaiMyNeural',
      );
    if (openAiKey) return openAiProvider(openAiKey);
    throw new ServiceUnavailableException('COOKING_VOICE_NOT_CONFIGURED');
  }
  async synthesize(
    provider: TtsProvider,
    text: string,
    rate: number,
  ): Promise<Buffer> {
    if (this.active >= 8) throw new HttpException('COOKING_VOICE_BUSY', 429);
    this.active++;
    try {
      return await provider.synthesize(text, rate);
    } finally {
      this.active--;
    }
  }
}
