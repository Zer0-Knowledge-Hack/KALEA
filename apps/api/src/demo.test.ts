import { describe, expect, it } from 'vitest';
import { buyBo, setup } from './test-helpers';

const demoQuote = (call: ReturnType<typeof setup>['call'], body: unknown, ip = '203.0.113.7') =>
  call('/v1/demo/quote', { body, headers: { 'X-Forwarded-For': `${ip}, 10.0.0.1` } });

describe('GET /v1/demo/corridors', () => {
  it('lists the demo corridors without an API key', async () => {
    const res = await setup().call('/v1/demo/corridors');
    expect(res.status).toBe(200);
    const { corridors } = await res.json();
    expect(corridors.map((c: { country: string }) => c.country)).toEqual(['BO', 'BR', 'PE', 'MX']);
    expect(corridors[0]).toEqual({
      country: 'BO',
      currency: 'BOB',
      fiatDecimals: 2,
      rails: ['qr_simple', 'bank_transfer'],
      sides: ['buy', 'sell'],
      orderKinds: { buy: ['transfer'], sell: ['transfer', 'qr_payment'] },
    });
  });
});

describe('POST /v1/demo/quote', () => {
  it('returns an end-user quote without fee or breakdown fields', async () => {
    const res = await demoQuote(setup().call, buyBo);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      demo: true,
      quote: {
        side: 'buy',
        country: 'BO',
        fiatCurrency: 'BOB',
        rail: 'qr_simple',
        kind: 'transfer',
        rate: 9.792,
        fiatAmount: 979.2,
        usdcAmount: 100,
        expiresAt: '2026-11-08T12:05:00.000Z',
      },
    });
  });

  it('maps an unsupported rail to a 400 unsupported_rail', async () => {
    const res = await demoQuote(setup().call, { ...buyBo, rail: 'pix' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toEqual({
      code: 'unsupported_rail',
      message: 'Rail pix is not available in BO',
    });
  });

  it('rejects an invalid body with a 400 invalid_request', async () => {
    const res = await demoQuote(setup().call, { ...buyBo, side: 'swap' });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('invalid_request');
  });
});

describe('demo rate limit', () => {
  it('returns 429 with Retry-After once the window is exhausted, then resets', async () => {
    const { call, clock } = setup({ demoRateLimit: { limit: 2, windowMs: 60_000 } });
    expect((await demoQuote(call, buyBo)).status).toBe(200);
    expect((await demoQuote(call, buyBo)).status).toBe(200);

    clock.now += 15_000;
    const limited = await demoQuote(call, buyBo);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBe('45');
    expect((await limited.json()).error.code).toBe('rate_limited');

    // Other clients keep their own budget.
    expect((await demoQuote(call, buyBo, '198.51.100.2')).status).toBe(200);

    clock.now += 45_000;
    expect((await demoQuote(call, buyBo)).status).toBe(200);
  });

  it('shares one budget across both demo routes', async () => {
    const { call } = setup({ demoRateLimit: { limit: 1, windowMs: 60_000 } });
    expect((await call('/v1/demo/corridors')).status).toBe(200);
    expect((await call('/v1/demo/corridors')).status).toBe(429);
  });
});

describe('authenticated routes', () => {
  it('still require an API key', async () => {
    const { call } = setup();
    expect((await call('/v1/corridors')).status).toBe(401);
    expect((await call('/v1/quotes', { body: buyBo })).status).toBe(401);
  });
});
