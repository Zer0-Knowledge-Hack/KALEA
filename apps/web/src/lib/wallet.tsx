"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { isConnected, requestAccess, signTransaction } from "@stellar/freighter-api";
import { api } from "./api";

type Status = "idle" | "connecting" | "signing" | "ready" | "error";

interface WalletState {
  account: string | null;
  token: string | null;
  status: Status;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState | null>(null);
const STORAGE_KEY = "kalea.session";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (saved?.account && saved?.token) {
        setAccount(saved.account);
        setToken(saved.token);
        setStatus("ready");
      }
    } catch {}
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    try {
      setStatus("connecting");
      if (!(await isConnected()).isConnected) {
        throw new Error("Instala Freighter para continuar");
      }
      const access = await requestAccess();
      if (access.error) throw new Error(String(access.error.message ?? access.error));

      setStatus("signing");
      const { transaction, networkPassphrase } = await api.challenge(access.address);
      const signed = await signTransaction(transaction, { networkPassphrase, address: access.address });
      if (signed.error) throw new Error(String(signed.error.message ?? signed.error));

      const session = await api.token(signed.signedTxXdr);
      setAccount(session.account);
      setToken(session.token);
      setStatus("ready");
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch {}
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "No se pudo conectar");
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
    setToken(null);
    setStatus("idle");
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  return (
    <WalletContext.Provider value={{ account, token, status, error, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet fuera de WalletProvider");
  return ctx;
}

export const shortAddress = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
