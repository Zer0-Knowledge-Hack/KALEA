import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context, MiddlewareHandler } from 'hono';

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

/** First `X-Forwarded-For` hop, else the Node socket address, else "unknown". */
export function clientIp(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    // Not running on the Node adapter (e.g. `app.request` in tests).
    return 'unknown';
  }
}

/**
 * Fixed-window, in-memory limiter keyed by client IP. State is per app instance and
 * not shared across processes; good enough for a public demo, not for abuse protection at scale.
 */
export function rateLimit(
  { limit, windowMs }: RateLimitConfig,
  now: () => number,
): MiddlewareHandler {
  const windows = new Map<string, { start: number; count: number }>();
  return async (c, next) => {
    const t = now();
    // Drop expired windows so the map cannot grow without bound.
    for (const [key, w] of windows) if (t - w.start >= windowMs) windows.delete(key);

    const key = clientIp(c);
    const w = windows.get(key) ?? { start: t, count: 0 };
    windows.set(key, w);
    if (w.count >= limit) {
      c.header('Retry-After', String(Math.max(1, Math.ceil((w.start + windowMs - t) / 1000))));
      return c.json(
        { error: { code: 'rate_limited', message: 'Too many demo requests, try again later' } },
        429,
      );
    }
    w.count += 1;
    await next();
  };
}
