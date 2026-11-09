import { describe, expect, it } from 'vitest';
import {
  COUNTRIES,
  COUNTRY_CATALOG,
  DEMO_CORRIDOR_PRICING,
  DEMO_INTEGRATORS,
  DEMO_MERCHANTS,
  ORDER_STATUSES,
  QuoteError,
  canTransition,
  computeQuote,
  isOrderKindAllowed,
  isRailSupported,
  isTerminalStatus,
  railsFor,
  selectMerchant,
  type CorridorPricing,
  type Merchant,
  type OrderStatus,
} from './domain';

const NOW = Date.parse('2026-11-07T12:00:00.000Z');

const pricing: CorridorPricing = {
  country: 'BO',
  midRate: 10,
  buyMarkupBps: 200,
  sellDiscountBps: 150,
  merchantRewardBps: 150,
  insuranceBps: 10,
};
const integrator = { feeBps: 30 };

describe('country catalog', () => {
  it('maps every country to its ISO 4217 currency and rails', () => {
    expect(COUNTRY_CATALOG.BO.currency).toBe('BOB');
    expect(COUNTRY_CATALOG.BR.currency).toBe('BRL');
    expect(COUNTRY_CATALOG.EC.currency).toBe('USD');
    for (const country of COUNTRIES) expect(railsFor(country).length).toBeGreaterThan(0);
  });

  it('validates rails per country', () => {
    expect(isRailSupported('BO', 'qr_simple')).toBe(true);
    expect(isRailSupported('BR', 'pix')).toBe(true);
    expect(isRailSupported('PE', 'yape')).toBe(true);
    expect(isRailSupported('BR', 'qr_simple')).toBe(false);
    expect(isRailSupported('MX', 'pix')).toBe(false);
  });
});

describe('computeQuote: buy (on-ramp)', () => {
  const quote = computeQuote({
    pricing,
    integrator,
    side: 'buy',
    rail: 'qr_simple',
    amount: 1000,
    amountIn: 'fiat',
    now: NOW,
  });

  it('shows one all-in rate equal to mid plus markup', () => {
    expect(quote.rate).toBe(10.2);
    expect(quote.fiatCurrency).toBe('BOB');
  });

  it('delivers fiat / rate USDC, floored to 7 decimals', () => {
    expect(quote.fiatAmount).toBe(1000);
    expect(quote.usdcAmount).toBe(98.0392156);
  });

  it('splits merchant reward and insurance on top of the end-user amount in escrow', () => {
    expect(quote.breakdown.merchantRewardUsdc).toBe(1.4705882);
    expect(quote.breakdown.insuranceUsdc).toBe(0.0980392);
    expect(quote.breakdown.escrowUsdc).toBe(99.607843);
    expect(quote.breakdown.recipientUsdc).toBe(quote.usdcAmount);
  });

  it('charges the integrator fee to the integrator, never to the end-user amount', () => {
    expect(quote.breakdown.integratorFeeUsdc).toBe(0.2941176);
    const withoutFee = computeQuote({
      pricing,
      integrator: { feeBps: 0 },
      side: 'buy',
      rail: 'qr_simple',
      amount: 1000,
      amountIn: 'fiat',
      now: NOW,
    });
    expect(withoutFee.usdcAmount).toBe(quote.usdcAmount);
    expect(withoutFee.rate).toBe(quote.rate);
  });

  it('rounds the fiat to pay up when the end user asks for an exact USDC amount', () => {
    const q = computeQuote({
      pricing,
      integrator,
      side: 'buy',
      rail: 'qr_simple',
      amount: 33.333,
      amountIn: 'usdc',
      now: NOW,
    });
    expect(q.usdcAmount).toBe(33.333);
    expect(q.fiatAmount).toBe(340.0);
  });

  it('expires five minutes after now', () => {
    expect(quote.expiresAt).toBe('2026-11-07T12:05:00.000Z');
  });
});

describe('computeQuote: sell (off-ramp)', () => {
  const quote = computeQuote({
    pricing,
    integrator,
    side: 'sell',
    rail: 'bank_transfer',
    amount: 100,
    amountIn: 'usdc',
    now: NOW,
  });

  it('shows one all-in rate equal to mid minus discount', () => {
    expect(quote.rate).toBe(9.85);
  });

  it('pays usdc * rate fiat, floored to the currency decimals', () => {
    expect(quote.usdcAmount).toBe(100);
    expect(quote.fiatAmount).toBe(985);
  });

  it('takes reward and insurance out of the locked USDC; the merchant gets the rest', () => {
    expect(quote.breakdown.merchantRewardUsdc).toBe(1.5);
    expect(quote.breakdown.insuranceUsdc).toBe(0.1);
    expect(quote.breakdown.escrowUsdc).toBe(100);
    expect(quote.breakdown.recipientUsdc).toBe(98.4);
    expect(quote.breakdown.integratorFeeUsdc).toBe(0.3);
  });

  it('rounds the USDC to lock up when the end user asks for an exact fiat amount', () => {
    const q = computeQuote({
      pricing,
      integrator,
      side: 'sell',
      rail: 'bank_transfer',
      amount: 1000,
      amountIn: 'fiat',
      now: NOW,
    });
    expect(q.fiatAmount).toBe(1000);
    expect(q.usdcAmount).toBe(101.5228427);
  });

  it('uses zero fiat decimals for CLP', () => {
    const clp: CorridorPricing = { ...pricing, country: 'CL', midRate: 950 };
    const q = computeQuote({
      pricing: clp,
      integrator,
      side: 'sell',
      rail: 'bank_transfer',
      amount: 10.5,
      amountIn: 'usdc',
      now: NOW,
    });
    expect(q.fiatAmount).toBe(9825);
  });
});

describe('computeQuote: validation', () => {
  it('rejects a rail the country does not support', () => {
    expect(() =>
      computeQuote({
        pricing,
        integrator,
        side: 'buy',
        rail: 'pix',
        amount: 100,
        amountIn: 'fiat',
        now: NOW,
      }),
    ).toThrow(QuoteError);
  });

  it('rejects non-positive or non-finite amounts', () => {
    for (const amount of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        computeQuote({
          pricing,
          integrator,
          side: 'buy',
          rail: 'qr_simple',
          amount,
          amountIn: 'fiat',
          now: NOW,
        }),
      ).toThrow(QuoteError);
    }
  });
});

describe('order lifecycle', () => {
  const allowed: [OrderStatus, OrderStatus][] = [
    ['created', 'escrow_locked'],
    ['created', 'cancelled'],
    ['created', 'expired'],
    ['escrow_locked', 'fiat_sent'],
    ['escrow_locked', 'cancelled'],
    ['escrow_locked', 'expired'],
    ['fiat_sent', 'released'],
    ['fiat_sent', 'disputed'],
    ['disputed', 'released'],
    ['disputed', 'cancelled'],
  ];

  it('allows exactly the canonical transitions', () => {
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        const expected = allowed.some(([f, t]) => f === from && t === to);
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(expected);
      }
    }
  });

  it('forbids cancelling or expiring after fiat is sent', () => {
    expect(canTransition('fiat_sent', 'cancelled')).toBe(false);
    expect(canTransition('fiat_sent', 'expired')).toBe(false);
    expect(canTransition('created', 'fiat_sent')).toBe(false);
  });

  it('marks released, cancelled and expired as terminal', () => {
    expect(ORDER_STATUSES.filter(isTerminalStatus)).toEqual(['released', 'cancelled', 'expired']);
  });
});

describe('order kinds', () => {
  it('allows QR payments only as a sell variant', () => {
    expect(isOrderKindAllowed('sell', 'qr_payment')).toBe(true);
    expect(isOrderKindAllowed('buy', 'qr_payment')).toBe(false);
    expect(isOrderKindAllowed('buy', 'transfer')).toBe(true);
  });
});

describe('selectMerchant', () => {
  const merchants: Merchant[] = [
    {
      id: 'm_low',
      alias: 'Low',
      countries: ['BO'],
      rails: ['qr_simple'],
      rating: 4.2,
      capacityUsdc: 5000,
    },
    {
      id: 'm_top',
      alias: 'Top',
      countries: ['BO', 'PE'],
      rails: ['qr_simple', 'yape'],
      rating: 4.9,
      capacityUsdc: 200,
    },
    {
      id: 'm_bank',
      alias: 'Bank',
      countries: ['BO'],
      rails: ['bank_transfer'],
      rating: 5,
      capacityUsdc: 9000,
    },
  ];

  it('picks the best-rated merchant serving the country and rail with enough capacity', () => {
    expect(
      selectMerchant(merchants, { country: 'BO', rail: 'qr_simple', usdcAmount: 100 })?.id,
    ).toBe('m_top');
    expect(
      selectMerchant(merchants, { country: 'BO', rail: 'qr_simple', usdcAmount: 1000 })?.id,
    ).toBe('m_low');
  });

  it('returns undefined when nobody can serve the order', () => {
    expect(
      selectMerchant(merchants, { country: 'BR', rail: 'pix', usdcAmount: 10 }),
    ).toBeUndefined();
  });
});

describe('demo data', () => {
  it("only uses rails supported by each merchant's countries", () => {
    for (const m of DEMO_MERCHANTS) {
      for (const rail of m.rails)
        expect(
          m.countries.some((c) => isRailSupported(c, rail)),
          `${m.id}:${rail}`,
        ).toBe(true);
    }
  });

  it('uses the single 1.5% merchant reward by default', () => {
    expect(DEMO_CORRIDOR_PRICING.every((p) => p.merchantRewardBps === 150)).toBe(true);
  });

  it('prices several corridors and integrators', () => {
    expect(DEMO_CORRIDOR_PRICING.length).toBeGreaterThanOrEqual(3);
    expect(DEMO_INTEGRATORS.length).toBeGreaterThanOrEqual(2);
  });
});
