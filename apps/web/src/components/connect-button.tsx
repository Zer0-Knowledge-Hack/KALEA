"use client";

import { shortAddress, useWallet } from "@/lib/wallet";

const label = { idle: "Conectar wallet", connecting: "Conectando…", signing: "Firma en Freighter…", error: "Reintentar" } as const;

export function ConnectButton({ className = "" }: { className?: string }) {
  const { account, status, connect, disconnect } = useWallet();
  if (account) {
    return (
      <button onClick={disconnect} title="Cerrar sesión"
        className={`group flex items-center gap-2 rounded-full border border-line bg-ink-2 px-4 py-2 font-mono text-xs uppercase tracking-wider text-paper transition hover:border-coral ${className}`}>
        <span className="size-2 rounded-full bg-lime group-hover:bg-coral" />
        <span className="group-hover:hidden">{shortAddress(account)}</span>
        <span className="hidden group-hover:inline">Salir</span>
      </button>
    );
  }
  const busy = status === "connecting" || status === "signing";
  return (
    <button onClick={connect} disabled={busy}
      className={`rounded-full bg-lime px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-lime-ink transition hover:brightness-110 disabled:opacity-60 ${className}`}>
      {status === "idle" || status === "ready"
        ? <>Conectar<span className="hidden sm:inline"> wallet</span></>
        : label[status]}
    </button>
  );
}
