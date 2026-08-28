import { BadRequestException } from '@nestjs/common';
import { SourceIntegrationService } from './source-integration.service';

describe('SourceIntegrationService', () => {
  it('does not fetch while the website feature is disabled', async () => {
    const fetcher = { fetch: jest.fn() };
    const service = new SourceIntegrationService(
      {
        websiteJsonLdEnabled: () => false,
      } as never,
      fetcher as never,
      {} as never,
    );

    await expect(
      service.extractWebsite('https://example.com/recipe'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetcher.fetch).not.toHaveBeenCalled();
  });

  it('fetches safely and delegates enabled Recipe JSON-LD content', async () => {
    const fetcher = {
      fetch: jest.fn().mockResolvedValue({
        finalUrl: 'https://example.com/final',
        contentType: 'text/html',
        body: '<script type="application/ld+json">{}</script>',
      }),
    };
    const extraction = {
      source: {
        kind: 'WEBSITE',
        uri: 'https://example.com/final',
        retrievedAt: '2026-08-28T00:00:00.000Z',
      },
      claims: [],
      warnings: [],
    };
    const adapter = {
      supports: jest.fn().mockReturnValue(true),
      extract: jest.fn().mockResolvedValue(extraction),
    };
    const service = new SourceIntegrationService(
      {
        websiteJsonLdEnabled: () => true,
      } as never,
      fetcher as never,
      adapter as never,
    );

    await expect(
      service.extractWebsite('https://example.com/recipe'),
    ).resolves.toBe(extraction);
    expect(adapter.extract).toHaveBeenCalledWith(
      expect.objectContaining({ uri: 'https://example.com/final' }),
    );
  });
});
