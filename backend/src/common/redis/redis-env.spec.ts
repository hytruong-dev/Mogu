import { getRedisUrl } from './redis-env';

describe('getRedisUrl', () => {
  const prevAvailable = process.env.REDIS_AVAILABLE;
  const prevUrl = process.env.REDIS_URL;

  afterEach(() => {
    if (prevAvailable === undefined) delete process.env.REDIS_AVAILABLE;
    else process.env.REDIS_AVAILABLE = prevAvailable;
    if (prevUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = prevUrl;
  });

  it('returns undefined when REDIS_AVAILABLE=0 even if REDIS_URL is set', () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.REDIS_AVAILABLE = '0';
    expect(getRedisUrl()).toBeUndefined();
  });

  it('returns url when available', () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.REDIS_AVAILABLE = '1';
    expect(getRedisUrl()).toBe('redis://localhost:6379');
  });
});
