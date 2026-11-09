import { useEffect, useState } from 'preact/hooks';
import { Logo } from '../logo';
import { ConnectButton } from './ConnectButton';
import { ApiRequestError, api, type MerchantOrder, type MerchantRewards } from '../../lib/api';
import { COUNTRY_NAMES, RAIL_NAMES, formatDate, formatFiat, formatNumber } from '../../lib/catalog';
import { useWallet } from '../../lib/wallet';

const sideLabel = { buy: 'On-ramp', sell: 'Off-ramp' } as const;
const card = 'rounded-3xl border border-deep-line bg-deep-2 p-6';
const label = 'font-mono text-[11px] uppercase tracking-[0.14em] text-deep-muted';

/** Merchant (liquidity provider) dashboard island: Freighter SEP-10 sign-in, assigned orders and the reward vault. */
export default function MerchantDashboard() {
  const wallet = useWallet();
  const { account, merchantId, token, error, disconnect } = wallet;
  const [orders, setOrders] = useState<MerchantOrder[] | null>(null);
  const [rewards, setRewards] = useState<MerchantRewards | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setOrders(null);
      setRewards(null);
      return;
    }
    setLoadError(null);
    Promise.all([api.merchant.orders(token), api.merchant.rewards(token)])
      .then(([o, r]) => {
        setOrders(o.orders);
        setRewards(r);
      })
      .catch((e) => {
        // An expired or rotated session token: sign out so the merchant can sign in again.
        if (e instanceof ApiRequestError && e.status === 401) return disconnect();
        setLoadError(e instanceof Error ? e.message : 'Could not load your data');
      });
  }, [token, disconnect]);

  const now = Date.now();

  return (
    <div class="min-h-svh">
      <header class="border-b border-deep-line">
        <div class="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <a href="/" aria-label="Kalea home">
            <Logo />
          </a>
          <ConnectButton wallet={wallet} />
        </div>
      </header>
      <main class="mx-auto max-w-5xl space-y-8 px-4 py-16">
        {!account ? (
          <div class="mx-auto max-w-md rounded-3xl border border-deep-line bg-deep-2 p-8 text-center">
            <h1 class="text-2xl font-bold">Merchant sign-in</h1>
            <p class="mt-2 text-deep-soft">
              Sign a SEP-10 challenge with Freighter using your registered merchant account. No
              transaction is submitted.
            </p>
            <ConnectButton wallet={wallet} class="mt-6" />
            {error && <p class="mt-4 text-sm text-error-on-dark">{error}</p>}
          </div>
        ) : (
          <>
            <div>
              <p class={label}>Merchant · {merchantId}</p>
              <h1 class="mt-2 text-3xl font-bold">Liquidity dashboard</h1>
            </div>
            {loadError && (
              <p class="rounded-xl border border-dashed border-error-on-dark/50 p-3 text-sm text-error-on-dark">
                {loadError}
              </p>
            )}

            <section class="grid gap-4 sm:grid-cols-2">
              <div class={card}>
                <p class={label}>Locked rewards</p>
                <p class="mt-2 text-3xl font-bold tabular-nums">
                  {rewards ? formatNumber(rewards.lockedUsdc) : '—'}{' '}
                  <span class="text-base text-deep-soft">USDC</span>
                </p>
              </div>
              <div class={card}>
                <p class={label}>Unlocked rewards</p>
                <p class="mt-2 text-3xl font-bold tabular-nums text-apricot">
                  {rewards ? formatNumber(rewards.unlockedUsdc) : '—'}{' '}
                  <span class="text-base text-deep-soft">USDC</span>
                </p>
              </div>
            </section>

            <section>
              <h2 class="text-xl font-semibold">Reward vault</h2>
              <p class="mt-1 text-sm text-deep-soft">
                Each released order credits a reward that unlocks after a 7-day cycle.
              </p>
              <div class="mt-4 rounded-3xl border border-deep-line">
                {rewards?.rewards.length === 0 && <p class="p-6 text-deep-soft">No rewards yet.</p>}
                {rewards?.rewards.map((r) => {
                  const locked = Date.parse(r.unlockAt) > now;
                  return (
                    <div
                      key={r.orderId}
                      class="grid grid-cols-3 gap-2 border-b border-deep-line p-4 text-sm last:border-0"
                    >
                      <span class="font-mono">{r.orderId.slice(0, 12)}</span>
                      <span>Earned {formatNumber(r.amountUsdc)} USDC</span>
                      <span class={`font-mono ${locked ? 'text-deep-soft' : 'text-apricot'}`}>
                        {locked ? `Unlocks ${formatDate(r.unlockAt)}` : 'Unlocked'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 class="text-xl font-semibold">Assigned orders</h2>
              <div class="mt-4 rounded-3xl border border-deep-line">
                {orders === null && !loadError && <p class="p-6 text-deep-soft">Loading…</p>}
                {orders?.length === 0 && <p class="p-6 text-deep-soft">No orders assigned yet.</p>}
                {orders?.map((o) => (
                  <div
                    key={o.id}
                    class="grid gap-2 border-b border-deep-line p-4 text-sm last:border-0 sm:grid-cols-5"
                  >
                    <span class="font-mono">{o.id.slice(0, 12)}</span>
                    <span>
                      {sideLabel[o.side]}
                      {o.kind === 'qr_payment' ? ' · QR' : ''} · {COUNTRY_NAMES[o.country]} ·{' '}
                      {RAIL_NAMES[o.rail]}
                    </span>
                    <span>
                      {formatFiat(o.fiatAmount, o.fiatCurrency)} ↔ {formatNumber(o.usdcAmount)} USDC
                    </span>
                    <span class="text-deep-soft">
                      Earned {formatNumber(o.merchantRewardUsdc)} USDC
                    </span>
                    <span class="font-mono text-apricot">{o.status}</span>
                  </div>
                ))}
              </div>
            </section>

            <p class="rounded-xl border border-deep-line p-4 text-sm text-deep-soft">
              Integrator dashboard (balance, fee statements and API keys) is coming soon.
              Integrators use the <code class="font-mono">/v1</code> API with their key today.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
