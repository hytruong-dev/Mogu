import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import * as net from 'net';
import { Logger } from '@nestjs/common';

const logger = new Logger('RedisEnv');

let envLoaded = false;

/** Load .env files once (safe to call from multiple modules). */
export function loadBackendEnv(): void {
  if (envLoaded) return;
  loadEnv({ path: resolve(process.cwd(), '.env.local'), quiet: true });
  loadEnv({ path: resolve(process.cwd(), '.env'), quiet: true });
  envLoaded = true;
}

/**
 * Redis URL for BullMQ, or undefined when queues should stay off.
 * Honors REDIS_AVAILABLE=0 set by startup probe when Redis is down.
 */
export function getRedisUrl(): string | undefined {
  loadBackendEnv();
  if (process.env.REDIS_AVAILABLE === '0') return undefined;
  const url = process.env.REDIS_URL?.trim();
  return url || undefined;
}

function parseRedisHostPort(url: string): { host: string; port: number } {
  try {
    const u = new URL(url);
    return {
      host: u.hostname || '127.0.0.1',
      port: u.port ? Number(u.port) : 6379,
    };
  } catch {
    return { host: '127.0.0.1', port: 6379 };
  }
}

function tcpReachable(host: string, port: number, timeoutMs = 800): Promise<boolean> {
  return new Promise((resolveOk) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolveOk(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

/** Quick TCP probe — used before Nest boots BullMQ. */
export async function probeAndConfigureRedis(): Promise<boolean> {
  loadBackendEnv();
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    process.env.REDIS_AVAILABLE = '0';
    logger.log('REDIS_URL not set — BullMQ disabled (inline fallbacks).');
    return false;
  }

  const { host, port } = parseRedisHostPort(url);
  const ok = await tcpReachable(host, port);
  if (ok) {
    process.env.REDIS_AVAILABLE = '1';
    logger.log(`Redis OK at ${host}:${port} — BullMQ enabled.`);
    return true;
  }

  process.env.REDIS_AVAILABLE = '0';
  logger.warn(
    `Redis unreachable (${host}:${port}) — BullMQ disabled. ` +
    'Start Redis or remove REDIS_URL from .env to silence retries. Using inline fallbacks.',
  );
  return false;
}
