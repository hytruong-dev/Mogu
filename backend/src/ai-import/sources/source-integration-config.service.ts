import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_SOURCE_INTEGRATION_FLAGS,
  SourceIntegrationFlags,
} from './source-adapter';

@Injectable()
export class SourceIntegrationConfigService {
  constructor(private readonly config: ConfigService) {}

  flags(): Readonly<SourceIntegrationFlags> {
    return Object.freeze({
      websiteJsonLd: this.boolean(
        'AI_IMPORT_ENABLE_WEBSITE_JSONLD',
        DEFAULT_SOURCE_INTEGRATION_FLAGS.websiteJsonLd,
      ),
      nutritionDatabases: this.boolean(
        'AI_IMPORT_ENABLE_NUTRITION_DATABASES',
        DEFAULT_SOURCE_INTEGRATION_FLAGS.nutritionDatabases,
      ),
    });
  }

  websiteJsonLdEnabled(): boolean {
    return this.flags().websiteJsonLd;
  }

  nutritionDatabasesEnabled(): boolean {
    return this.flags().nutritionDatabases;
  }

  private boolean(key: string, fallback: boolean): boolean {
    const value = this.config.get<string | boolean>(key);
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  }
}
