"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { ConnectButton } from "@/components/connect-button";
import { ApiRequestError, api, type MerchantOrder, type MerchantRewards } from "@/lib/api";
import { COUNTRY_NAMES, RAIL_NAMES, formatDate, formatFiat, formatNumber } from "@/lib/catalog";
import { useWallet } from "@/lib/wallet";

const sideLabel = { buy: "On-ramp", sell: "Off-ramp" } as const;
const card = "rounded-3xl border border-line bg-ink-2 p-6";
const label = "font-mono text-[11px] uppercase tracking-[0.14em] text-mute";

/** Merchant (liquidity provider) dashboard: assigned orders and the reward vault. */
export default function MerchantDashboard() {
  const { account, merchantId, token, error, disconnect } = useWallet();
  const [orders, setOrders] = useState<MerchantOrder[] | null>(null);
  const [rewards, setRewards] = useState<MerchantRewards | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoadError(null);
    Promise.all([api.merchant.orders(token), api.merchant.rewards(token)])
      .then(([o, r]) => { setOrders(o.orders); setRewards(r); })
      .catch((e) => {
        // An expired or rotated session token: sign out so the merchant can sign in again.
        if (e instanceof ApiRequestError && e.status === 401) return disconnect();
        setLoadError(e instanceof Error ? e.message : "Could not load your data");
      });
  }, [token, disconnect]);

  const now = Date.now();

  return (
    <div className="min-h-svh">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link href="/"><Logo /></Link>
          <ConnectButton />
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-16">
        {!account ? (
          <div className="mx-auto max-w-md rounded-3xl border border-line bg-ink-2 p-8 text-center">
            <h1 className="text-2xl font-bold">Merchant sign-in</h1>
            <p className="mt-2 text-soft">Sign a SEP-10 challenge with Freighter using your registered merchant account. No transaction is submitted.</p>
            <ConnectButton className="mt-6" />
            {error && <p className="mt-4 text-sm text-coral">{error}</p>}
          </div>
        ) : (
          <>
            <div>
              <p className={label}>Merchant · {merchantId}</p>
              <h1 className="mt-2 text-3xl font-bold">Liquidity dashboard</h1>
            </div>
            {loadError && <p className="rounded-xl border border-dashed border-coral/50 p-3 text-sm text-coral">{loadError}</p>}

            <section className="grid gap-4 sm:grid-cols-2">
              <div className={card}>
                <p className={label}>Locked rewards</p>
                <p className="mt-2 text-3xl font-bold">{rewards ? formatNumber(rewards.lockedUsdc) : "—"} <span className="text-base text-soft">USDC</span></p>
              </div>
              <div className={card}>
                <p className={label}>Unlocked rewards</p>
                <p className="mt-2 text-3xl font-bold text-lime">{rewards ? formatNumber(rewards.unlockedUsdc) : "—"} <span className="text-base text-soft">USDC</span></p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold">Reward vault</h2>
              <p className="mt-1 text-sm text-soft">Each released order credits a reward that unlocks after a 7-day cycle.</p>
              <div className="mt-4 rounded-3xl border border-line">
                {rewards?.rewards.length === 0 && <p className="p-6 text-soft">No rewards yet.</p>}
                {rewards?.rewards.map((r) => {
                  const locked = Date.parse(r.unlockAt) > now;
                  return (
                    <div key={r.orderId} className="grid grid-cols-3 gap-2 border-b border-line p-4 text-sm last:border-0">
                      <span className="font-mono">{r.orderId.slice(0, 12)}</span>
                      <span>Earned {formatNumber(r.amountUsdc)} USDC</span>
                      <span className={`font-mono ${locked ? "text-soft" : "text-lime"}`}>{locked ? `Unlocks ${formatDate(r.unlockAt)}` : "Unlocked"}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold">Assigned orders</h2>
              <div className="mt-4 rounded-3xl border border-line">
                {orders === null && !loadError && <p className="p-6 text-soft">Loading…</p>}
                {orders?.length === 0 && <p className="p-6 text-soft">No orders assigned yet.</p>}
                {orders?.map((o) => (
                  <div key={o.id} className="grid gap-2 border-b border-line p-4 text-sm last:border-0 sm:grid-cols-5">
                    <span className="font-mono">{o.id.slice(0, 12)}</span>
                    <span>{sideLabel[o.side]}{o.kind === "qr_payment" ? " · QR" : ""} · {COUNTRY_NAMES[o.country]} · {RAIL_NAMES[o.rail]}</span>
                    <span>{formatFiat(o.fiatAmount, o.fiatCurrency)} ↔ {formatNumber(o.usdcAmount)} USDC</span>
                    <span className="text-soft">Earned {formatNumber(o.merchantRewardUsdc)} USDC</span>
                    <span className="font-mono text-lime">{o.status}</span>
                  </div>
                ))}
              </div>
            </section>

            <p className="rounded-xl border border-line p-4 text-sm text-soft">
              Integrator dashboard (balance, fee statements and API keys) is coming soon. Integrators use the <code className="font-mono">/v1</code> API with their key today.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
