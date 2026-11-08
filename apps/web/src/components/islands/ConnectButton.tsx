import { shortAddress, type WalletState } from "../../lib/wallet";

const label = { idle: "Merchant sign-in", connecting: "Connecting…", signing: "Sign in Freighter…", error: "Try again" } as const;

/** Freighter sign-in / sign-out button; the wallet state is owned by the dashboard island. */
export function ConnectButton({ wallet, class: className = "" }: { wallet: WalletState; class?: string }) {
  const { account, status, connect, disconnect } = wallet;
  if (account) {
    return (
      <button onClick={disconnect} title="Sign out"
        class={`group flex items-center gap-2 rounded-full border border-deep-line bg-deep-2 px-4 py-2 font-mono text-xs uppercase tracking-wider text-surface transition hover:border-violet ${className}`}>
        <span class="size-2 rounded-full bg-apricot group-hover:bg-violet" />
        <span class="group-hover:hidden">{shortAddress(account)}</span>
        <span class="hidden group-hover:inline">Sign out</span>
      </button>
    );
  }
  const busy = status === "connecting" || status === "signing";
  return (
    <button onClick={connect} disabled={busy}
      class={`rounded-full bg-apricot px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-ink transition hover:brightness-110 disabled:opacity-60 ${className}`}>
      {status === "idle" || status === "ready"
        ? <>Sign in<span class="hidden sm:inline"> with Freighter</span></>
        : label[status]}
    </button>
  );
}
