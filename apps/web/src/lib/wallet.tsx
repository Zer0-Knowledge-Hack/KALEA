"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { isConnected, requestAccess, signTransaction } from "@stellar/freighter-api";
import { api, type MerchantSession } from "./api";

type Status = "idle" | "connecting" | "signing" | "ready" | "error";

/** Merchant (liquidity provider) session obtained through SEP-10 with Freighter. */
interface WalletState {
  account: string | null;
  merchantId: string | null;
  token: string | null;
  status: Status;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState | null>(null);
const STORAGE_KEY = "kalea.merchant-session";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<MerchantSession | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as MerchantSession | null;
      if (saved?.account && saved?.token && saved?.merchantId) {
        setSession(saved);
        setStatus("ready");
      }
    } catch {}
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    try {
      setStatus("connecting");
      if (!(await isConnected()).isConnected) throw new Error("Install the Freighter wallet to continue");
      const access = await requestAccess();
      if (access.error) throw new Error(String(access.error.message ?? access.error));

      setStatus("signing");
      const { transaction, networkPassphrase } = await api.merchant.challenge(access.address);
      const signed = await signTransaction(transaction, { networkPassphrase, address: access.address });
      if (signed.error) throw new Error(String(signed.error.message ?? signed.error));

      const next = await api.merchant.token(signed.signedTxXdr);
      setSession(next);
      setStatus("ready");
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Could not sign in");
    }
  }, []);

  const disconnect = useCallback(() => {
    setSession(null);
    setStatus("idle");
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  return (
    <WalletContext.Provider
      value={{ account: session?.account ?? null, merchantId: session?.merchantId ?? null, token: session?.token ?? null, status, error, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}

export const shortAddress = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
