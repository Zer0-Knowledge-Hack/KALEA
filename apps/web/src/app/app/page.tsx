"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Order } from "@kalea/shared";
import { Logo } from "@/components/logo";
import { ConnectButton } from "@/components/connect-button";
import { api } from "@/lib/api";
import { useWallet } from "@/lib/wallet";

export default function AppHome() {
  const { account, token, error } = useWallet();
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    if (!token) return;
    api.orders(token).then((r) => setOrders(r.orders)).catch(() => setOrders([]));
  }, [token]);

  return (
    <div className="min-h-svh">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link href="/"><Logo /></Link>
          <ConnectButton />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-16">
        {!account ? (
          <div className="mx-auto max-w-md rounded-3xl border border-line bg-ink-2 p-8 text-center">
            <h1 className="text-2xl font-bold">Inicia sesión con tu wallet</h1>
            <p className="mt-2 text-soft">Firmarás un reto SEP-10 con Freighter. No se envía ninguna transacción.</p>
            <ConnectButton className="mt-6" />
            {error && <p className="mt-4 text-sm text-coral">{error}</p>}
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold">Mis órdenes</h1>
            <div className="mt-8 rounded-3xl border border-line">
              {orders === null && <p className="p-6 text-soft">Cargando…</p>}
              {orders?.length === 0 && <p className="p-6 text-soft">Aún no tienes órdenes. <Link href="/#cotizar" className="text-lime">Cotiza una</Link>.</p>}
              {orders?.map((o) => (
                <div key={o.id} className="grid grid-cols-4 border-b border-line p-4 text-sm last:border-0">
                  <span className="font-mono">{o.id.slice(0, 8)}</span>
                  <span>{o.side === "buy" ? "Compra" : "Venta"}</span>
                  <span>{o.amountBob} BOB → {o.amountUsdc} USDC</span>
                  <span className="font-mono text-lime">{o.status}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
