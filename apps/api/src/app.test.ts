import { describe, expect, it } from 'vitest';
import { KEYS, buyBo, sellBo, setup } from './test-helpers';

describe('GET /health', () => {
  it('returns ok with the network', async () => {
    const res = await setup().call('/health');
    expect(await res.json()).toEqual({ ok: true, network: 'testnet' });
  });
});

describe('integrator API key auth', () => {
  it('rejects a request without a key', async () => {
    const res = await setup().call('/v1/corridors');
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('missing_api_key');
  });

  it('returns the same response for any invalid key', async () => {
    const { call } = setup();
    const short = await call('/v1/balance', { key: 'x' });
    const nearMiss = await call('/v1/balance', { key: KEYS.wallet.slice(0, -1) + '0' });
    expect(short.status).toBe(401);
    expect(nearMiss.status).toBe(401);
    expect(await short.json()).toEqual(await nearMiss.json());
  });

  it('accepts a valid key via X-API-Key or Bearer', async () => {
    const { app, call } = setup();
    expect((await call('/v1/balance', { key: KEYS.wallet })).status).toBe(200);
    const bearer = await app.request('/v1/balance', {
      headers: { Authorization: `Bearer ${KEYS.wallet}` },
    });
    expect((await bearer.json()).integratorId).toBe('int_wallet');
  });
});

describe('GET /v1/corridors', () => {
  it('lists configured countries with currency and rails, without internal pricing', async () => {
    const { corridors } = await (await setup().call('/v1/corridors', { key: KEYS.wallet })).json();
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

describe('POST /v1/quotes', () => {
  it('returns an end-user quote exposing only the integrator fee', async () => {
    const res = await setup().call('/v1/quotes', { key: KEYS.wallet, body: buyBo });
    const { quote } = await res.json();
    expect(res.status).toBe(200);
    expect(quote).toEqual({
      side: 'buy',
      country: 'BO',
      fiatCurrency: 'BOB',
      rail: 'qr_simple',
      kind: 'transfer',
      rate: 9.792,
      fiatAmount: 979.2,
      usdcAmount: 100,
      integratorFeeUsdc: 0.3,
      expiresAt: '2026-11-08T12:05:00.000Z',
    });
  });

  it('maps QuoteError to a 400 with its code', async () => {
    const { call } = setup();
    const rail = await call('/v1/quotes', { key: KEYS.wallet, body: { ...buyBo, rail: 'pix' } });
    expect(rail.status).toBe(400);
    expect((await rail.json()).error).toEqual({
      code: 'unsupported_rail',
      message: 'Rail pix is not available in BO',
    });
    const amount = await call('/v1/quotes', { key: KEYS.wallet, body: { ...buyBo, amount: -5 } });
    expect((await amount.json()).error.code).toBe('invalid_amount');
  });

  it('rejects countries without pricing, invalid bodies and malformed JSON', async () => {
    const { app, call } = setup();
    const country = await call('/v1/quotes', {
      key: KEYS.wallet,
      body: { ...buyBo, country: 'CL' },
    });
    expect((await country.json()).error.code).toBe('unsupported_country');
    const invalid = await call('/v1/quotes', {
      key: KEYS.wallet,
      body: { ...buyBo, side: 'swap' },
    });
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error.code).toBe('invalid_request');
    const malformed = await app.request('/v1/quotes', {
      method: 'POST',
      headers: { 'X-API-Key': KEYS.wallet },
      body: '{',
    });
    expect((await malformed.json()).error.code).toBe('invalid_json');
  });
});

describe('POST /v1/orders', () => {
  const order = (body: object) => ({ key: KEYS.wallet, body: { endUserRef: 'user-42', ...body } });

  it('creates an order matched to the best merchant for the corridor', async () => {
    const { call } = setup();
    const res = await call('/v1/orders', order(buyBo));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.order).toMatchObject({
      status: 'created',
      merchantId: 'mer_andes',
      endUserRef: 'user-42',
      integratorFeeUsdc: 0.3,
    });
    expect(body.order.breakdown).toBeUndefined();
    const br = await (
      await call('/v1/orders', order({ ...buyBo, country: 'BR', rail: 'pix' }))
    ).json();
    expect(br.order.merchantId).toBe('mer_rio');
  });

  it('requires a QR payee only for sell qr_payment orders', async () => {
    const { call } = setup();
    const missing = await call('/v1/orders', order({ ...sellBo, kind: 'qr_payment' }));
    expect((await missing.json()).error.code).toBe('invalid_request');
    const ok = await call(
      '/v1/orders',
      order({ ...sellBo, kind: 'qr_payment', payee: { qrPayload: '000201...' } }),
    );
    expect((await ok.json()).order).toMatchObject({
      kind: 'qr_payment',
      payee: { qrPayload: '000201...' },
    });
    const buyQr = await call(
      '/v1/orders',
      order({ ...buyBo, kind: 'qr_payment', payee: { qrPayload: '000201...' } }),
    );
    expect((await buyQr.json()).error.code).toBe('unsupported_order_kind');
    const transferPayee = await call(
      '/v1/orders',
      order({ ...sellBo, payee: { qrPayload: '000201...' } }),
    );
    expect((await transferPayee.json()).error.code).toBe('invalid_request');
  });

  it('returns 409 no_merchant_capacity when no merchant can commit the amount', async () => {
    const { call } = setup();
    const res = await call('/v1/orders', order({ ...buyBo, amount: 50_000 }));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('no_merchant_capacity');
  });

  it('counts open orders against merchant capacity', async () => {
    const { call } = setup();
    expect((await call('/v1/orders', order({ ...buyBo, amount: 15_000 }))).status).toBe(201);
    expect((await call('/v1/orders', order({ ...buyBo, amount: 10_000 }))).status).toBe(409);
  });

  it('returns 402 insufficient_balance when the prefunded balance cannot cover the fee', async () => {
    const { call } = setup({
      integrators: [
        { id: 'int_wallet', name: 'Demo Wallet', feeBps: 30, prefundedBalanceUsdc: 0.2 },
      ],
    });
    const res = await call('/v1/orders', order(buyBo));
    expect(res.status).toBe(402);
    expect((await res.json()).error.code).toBe('insufficient_balance');
  });
});

describe('integrator scoping', () => {
  it("lists and reads only the caller's orders", async () => {
    const { call } = setup();
    const { order } = await (
      await call('/v1/orders', { key: KEYS.wallet, body: { ...buyBo, endUserRef: 'u1' } })
    ).json();
    expect((await call(`/v1/orders/${order.id}`, { key: KEYS.wallet })).status).toBe(200);
    const other = await call(`/v1/orders/${order.id}`, { key: KEYS.payments });
    expect(other.status).toBe(404);
    expect((await other.json()).error.code).toBe('order_not_found');
    expect((await (await call('/v1/orders', { key: KEYS.payments })).json()).orders).toEqual([]);
    const mine = await (await call('/v1/orders', { key: KEYS.wallet })).json();
    expect(mine.orders.map((o: { id: string }) => o.id)).toEqual([order.id]);
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await setup().call('/quotes');
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('not_found');
  });
});
