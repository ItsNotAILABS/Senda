import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { connectPhantom, readChain, type ChainWallet } from "@/lib/phantom";
import { paySol, payUsdc } from "@/lib/solana-pay";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

function short(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function PhantomAccount() {
  const { w, linkChain } = useWallet();
  const linked = w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [owner, setOwner] = useState(linked);
  const [chain, setChain] = useState<ChainWallet | null>(null);
  const [asset, setAsset] = useState<"USDC" | "SOL">("USDC");
  const [amount, setAmount] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [sig, setSig] = useState("");

  useEffect(() => {
    if (linked) setOwner(linked);
  }, [linked]);

  useEffect(() => {
    if (!owner) {
      setChain(null);
      return;
    }
    let live = true;
    const pull = () => {
      readChain(owner)
        .then((row) => live && setChain(row))
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 15_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [owner]);

  const usdc = chain?.tokens.find((t) => t.symbol === "USDC")?.ui ?? null;
  const cash = chain?.tokens.find((t) => t.symbol === "CASH")?.ui ?? null;

  async function connect() {
    setBusy(true);
    try {
      const addr = await connectPhantom();
      const kept = linkChain(addr, "Phantom", "phantom");
      if (!kept.ok && kept.error !== "Already linked.") throw new Error(kept.error || "Could not keep Phantom.");
      setOwner(addr);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Phantom did not connect.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const n = Number(amount);
    if (!owner) return toast.error("Connect Phantom first.");
    if (!to.trim()) return toast.error("Enter the address first.");
    if (!(n > 0)) return toast.error("Enter an amount.");
    setBusy(true);
    try {
      const done = asset === "USDC" ? (await payUsdc({ owner, to, usd: n, memo: "Senda Phantom" })).signature : await paySol({ owner, to, sol: n });
      setSig(done);
      toast.success(done.slice(0, 8));
      setChain(await readChain(owner));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Phantom did not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <header>
        <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Phantom</p>
        <h1 className="mt-1 text-3xl tracking-tight">The Solana account.</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">This wallet signs SOL, USDC, PreStocks, and a long. The number is what this address holds. MetaMask does not sign these.</p>
      </header>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <p className="font-mono text-4xl tabular-nums">{owner ? (usdc == null ? "…" : `$${usdc.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) : "—"}</p>
        <p className="mt-1 font-mono text-sm text-muted">{owner ? short(owner) : "Not connected"}</p>
        <p className="mt-2 text-sm text-muted">
          {chain ? `${chain.sol.toLocaleString("en-US", { maximumFractionDigits: 4 })} SOL` : "SOL not read yet"}
          {usdc != null ? ` · ${usdc.toFixed(2)} USDC` : ""}
          {cash != null ? ` · ${cash.toFixed(2)} CASH` : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void connect()} className="min-h-10 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">
            {busy ? "…" : owner ? "Phantom" : "Connect Phantom"}
          </button>
          {owner ? (
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(owner).then(() => toast.success("Copied."))}
              className="min-h-10 rounded-full border border-white/15 px-4 text-sm font-semibold"
            >
              Copy
            </button>
          ) : null}
          <Link to="/wallet" className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 text-sm font-semibold">
            Swap
          </Link>
          <Link to="/cards" search={{ spend: 0 }} className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 text-sm font-semibold">
            Pay
          </Link>
        </div>
      </section>
      {chain && chain.tokens.length ? (
        <ul className="divide-y divide-white/10 rounded-[22px] border border-white/10 bg-[#10131c] px-4">
          {chain.tokens.map((t) => (
            <li key={t.mint} className="flex items-center justify-between py-3 text-sm">
              <span>{t.symbol}</span>
              <span className="font-mono tabular-nums">{t.ui.toLocaleString("en-US", { maximumFractionDigits: 4 })}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <h2 className="text-lg font-semibold">Send from this Phantom</h2>
        <div className="mt-3 flex gap-1">
          {(["USDC", "SOL"] as const).map((id) => (
            <button key={id} type="button" onClick={() => setAsset(id)} className={id === asset ? "min-h-9 rounded-full bg-white px-3 text-sm font-semibold text-black" : "min-h-9 rounded-full px-3 text-sm text-white/60"}>
              {id}
            </button>
          ))}
        </div>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={asset} className="mt-3 min-h-11 w-full rounded-full bg-black/40 px-4 font-mono outline-none" />
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Address" className="mt-2 min-h-11 w-full rounded-full bg-black/40 px-4 font-mono text-sm outline-none" />
        <p className="mt-2 text-xs text-muted">{asset === "USDC" ? "Phantom signs a USDC transfer." : "Phantom signs a SOL transfer."} Nothing leaves until you approve it in Phantom.</p>
        <button type="button" disabled={busy || !owner} onClick={() => void send()} className="mt-3 min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">
          {owner ? `Send ${asset}` : "Connect Phantom first"}
        </button>
        {sig ? (
          <a href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer" className="mt-2 block font-mono text-xs text-accent">
            {sig.slice(0, 12)}…
          </a>
        ) : null}
      </section>
      {chain && chain.txs.length ? (
        <section>
          <h2 className="px-1 text-sm font-semibold">Recent</h2>
          <ul className="mt-1 divide-y divide-white/10">
            {chain.txs.slice(0, 6).map((tx) => (
              <li key={tx.signature} className="flex items-center justify-between py-2 font-mono text-xs">
                <a href={`https://solscan.io/tx/${tx.signature}`} target="_blank" rel="noreferrer">
                  {tx.signature.slice(0, 16)}…
                </a>
                <span className="text-muted">{tx.err ? "failed" : "ok"}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
