import {
  BadRequestException,
  PayloadTooLargeException,
  RequestTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SafeSourceFetcherService } from './safe-source-fetcher.service';

describe('SafeSourceFetcherService', () => {
  const config = (values: Record<string, string | number> = {}) =>
    new ConfigService(values);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    'http://127.0.0.1/recipe',
    'http://10.0.0.1/recipe',
    'http://169.254.169.254/latest/meta-data',
    'file:///etc/passwd',
    'https://user:pass@8.8.8.8/recipe',
    'https://8.8.8.8:8443/recipe',
  ])('blocks unsafe URL %s before fetching', async (url) => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    await expect(
      new SafeSourceFetcherService(config()).fetch(url),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('revalidates and blocks a private redirect target', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: 'http://127.0.0.1/private' },
      }),
    );

    await expect(
      new SafeSourceFetcherService(config()).fetch(
        'https://8.8.8.8/recipe',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects oversized declared and streamed responses', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response('small', { headers: { 'content-length': '100' } }),
      )
      .mockResolvedValueOnce(new Response('123456789'));
    const service = new SafeSourceFetcherService(
      config({ AI_IMPORT_SOURCE_MAX_RESPONSE_BYTES: 5 }),
    );

    await expect(service.fetch('https://8.8.8.8/a')).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
    await expect(service.fetch('https://8.8.8.8/b')).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('aborts requests after the configured timeout', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );

    await expect(
      new SafeSourceFetcherService(
        config({ AI_IMPORT_SOURCE_TIMEOUT_MS: 5 }),
      ).fetch('https://8.8.8.8/slow'),
    ).rejects.toBeInstanceOf(RequestTimeoutException);
  });
});
