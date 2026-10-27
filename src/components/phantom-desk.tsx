import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { SignCall } from "@/components/sign-call";
import { BACKPACK } from "@/lib/backpack";
import { VaultAccounts } from "@/components/vault-accounts";
import { buildPicture, quoteHeld } from "@/lib/money-picture";
import { connectPhantom, invalidateChain, pickOwner, readChain, type ChainWallet } from "@/lib/phantom";
import { shortPk } from "@/lib/senda-keys";
import { paySol, payUsdc } from "@/lib/solana-pay";
import { loadPulse } from "@/lib/universe";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

/** The Phantom that is already the Solana account. Balances and sends are this wallet. */
export function PhantomDesk() {
  const wallet = useWallet();
  const owner = pickOwner(wallet.w.links);
  const [chain, setChain] = useState<ChainWallet | null>(null);
  const [dollars, setDollars] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [asset, setAsset] = useState<"USDC" | "SOL">("USDC");
  const [amount, setAmount] = useState("1");
  const [to, setTo] = useState("");
  const [sig, setSig] = useState("");
  const [call, setCall] = useState(false);

  useEffect(() => {
    if (!owner) {
      setChain(null);
      setDollars(null);
      return;
    }
    let live = true;
    const pull = () => {
      void readChain(owner)
        .then(async (row) => {
          const pulse = await loadPulse().catch(() => ({ rows: [] }));
          const tape = await quoteHeld(row.tokens.map((token) => token.mint), pulse.rows).catch(() => pulse.rows);
          if (!live) return;
          setChain(row);
          setDollars(buildPicture({ owner, sol: row.sol, tokens: row.tokens, tape, cash: 0, house: null }).total);
        })
        .catch(() => {
          if (live) setChain(null);
        });
    };
    pull();
    const id = window.setInterval(pull, 15_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [owner]);

  async function connect() {
    setBusy(true);
    try {
      const addr = await connectPhantom();
      const linked = wallet.linkChain(addr, "Phantom", "phantom");
      if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep Phantom.");
      invalidateChain(addr);
      toast.success("Phantom is the Solana account.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Phantom did not connect.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!owner) return toast.error("Connect Phantom first.");
    const n = Number(amount);
    if (!(n > 0)) return toast.error("Enter an amount.");
    setBusy(true);
    setSig("");
    try {
      const signature = asset === "USDC"
        ? (await payUsdc({ owner, to, usd: n, memo: "Phantom desk" })).signature
        : await paySol({ owner, to, sol: n });
      setSig(signature);
      setCall(false);
      invalidateChain(owner);
      toast.success("Signed. It left this Phantom.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Phantom did not sign.");
    } finally {
      setBusy(false);
    }
  }

  const usdc = chain?.tokens.find((t) => t.symbol === "USDC")?.ui ?? null;
  const cash = chain?.tokens.find((t) => t.symbol === "CASH")?.ui ?? null;

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <header>
        <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Phantom</p>
        <h1 className="mt-1 text-3xl tracking-tight">The Solana account.</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">This wallet signs SOL, USDC, PreStocks, and a long. The number is what this address holds. MetaMask does not sign these.</p>
      </header>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <p className="font-mono text-4xl tabular-nums">{owner ? (dollars == null ? "…" : `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) : "—"}</p>
        <p className="mt-1 font-mono text-sm text-muted">{owner ? shortPk(owner) : "Not connected"}</p>
        <p className="mt-2 text-sm text-muted">
          {chain ? `${chain.sol.toLocaleString("en-US", { maximumFractionDigits: 4 })} SOL` : "SOL not read yet"}
          {usdc != null ? ` · ${usdc.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC` : ""}
          {cash != null && cash > 0 ? ` · ${cash.toLocaleString("en-US", { maximumFractionDigits: 2 })} CASH` : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void connect()} className="min-h-10 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40">{busy ? "Waiting" : owner ? "Reconnect" : "Connect Phantom"}</button>
          {owner ? <button type="button" onClick={() => void navigator.clipboard.writeText(owner)} className="min-h-10 rounded-full border border-white/15 px-4 text-sm font-semibold">Copy</button> : null}
          <Link to="/wallet" className="inline-flex min-h-10 items-center rounded-full bg-white px-4 text-sm font-semibold text-black">Swap</Link>
          <Link to="/cards" search={{ spend: 0 }} className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 text-sm font-semibold">Pay</Link>
        </div>
        {chain && chain.tokens.length ? (
          <ul className="mt-4 divide-y divide-white/10">
            {chain.tokens.map((token) => {
              const share = BACKPACK.find((row) => row.mint === token.mint);
              return (
                <li key={token.mint} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="text-sm font-semibold">{share ? `${share.symbol} · Backpack` : token.symbol}</span>
                  <span className="font-mono text-sm">{token.ui < 1 ? token.ui.toFixed(6) : token.ui.toLocaleString("en-US", { maximumFractionDigits: 4 })}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
      <VaultAccounts owner={owner} />
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Send from this Phantom</p>
        <div className="mt-3 flex gap-1">
          {(["USDC", "SOL"] as const).map((id) => (
            <button key={id} type="button" onClick={() => setAsset(id)} className={`min-h-9 rounded-full px-3 text-xs font-semibold ${asset === id ? "bg-white text-black" : "bg-white/10"}`}>{id}</button>
          ))}
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={asset} className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm" />
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Solana address" className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm" />
        </div>
        <button type="button" disabled={busy || !owner} onClick={() => setCall(true)} className="mt-3 min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40">
          {owner ? `Sign ${amount} ${asset}` : "Connect Phantom first"}
        </button>
        {sig ? <a href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer" className="mt-2 block font-mono text-xs text-accent">{sig.slice(0, 12)}… on Solscan</a> : null}
      </section>
      <SignCall
        open={call}
        wallet="Phantom"
        title={`Send ${amount || "0"} ${asset}`}
        account={owner}
        waiting={busy}
        lines={[
          `To ${to || "an address you still have to enter"}.`,
          asset === "USDC" ? "Phantom signs a USDC transfer." : "Phantom signs a SOL transfer.",
          "Nothing leaves until you approve it in Phantom.",
        ]}
        onReject={() => {
          if (!busy) setCall(false);
        }}
        onSign={() => {
          if (!to.trim()) {
            toast.error("Enter the address first.");
            return;
          }
          void send();
        }}
      />
      {chain?.txs.length ? (
        <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
          <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">Recent</p>
          <ul className="mt-2">
            {chain.txs.slice(0, 6).map((tx) => (
              <li key={tx.signature} className="border-b border-white/10 py-2 last:border-0">
                <a href={`https://solscan.io/tx/${tx.signature}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-accent">{tx.signature.slice(0, 16)}…</a>
                <span className="ml-2 text-[11px] text-subtle">{tx.err ? "Failed" : tx.time ? new Date(tx.time * 1000).toLocaleString() : "Confirmed"}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
