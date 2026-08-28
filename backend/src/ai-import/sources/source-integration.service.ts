import { BadRequestException, Injectable } from '@nestjs/common';
import { JsonLdWebsiteAdapter } from './json-ld-website.adapter';
import { SafeSourceFetcherService } from './safe-source-fetcher.service';
import { SourceExtraction } from './source-adapter';
import { SourceIntegrationConfigService } from './source-integration-config.service';

@Injectable()
export class SourceIntegrationService {
  constructor(
    private readonly config: SourceIntegrationConfigService,
    private readonly fetcher: SafeSourceFetcherService,
    private readonly jsonLd: JsonLdWebsiteAdapter,
  ) {}

  async extractWebsite(url: string): Promise<SourceExtraction> {
    if (!this.config.websiteJsonLdEnabled()) {
      throw new BadRequestException(
        'Website JSON-LD source integration is disabled',
      );
    }
    const fetched = await this.fetcher.fetch(url);
    const request = {
      uri: fetched.finalUrl,
      contentType: fetched.contentType,
      body: fetched.body,
    };
    if (!this.jsonLd.supports(request)) {
      throw new BadRequestException('Website has no supported Recipe JSON-LD');
    }
    return this.jsonLd.extract(request);
  }
}
