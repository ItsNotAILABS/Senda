import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { HoldingCards, type HoldingRow } from "@/components/holding-cards";
import { SignCall } from "@/components/sign-call";
import { BACKPACK } from "@/lib/backpack";
import { loadHoldTape, type HoldMove } from "@/lib/hold-tape";
import { invalidateChain, readChain, type ChainWallet } from "@/lib/phantom";
import { shortPk } from "@/lib/senda-keys";
import { paySol, payUsdc } from "@/lib/solana-pay";
import { connectWallet } from "@/lib/wallets";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

/** Backpack the extension. Securities this address holds are marked from the Backpack book. */
export function BackpackWallet() {
  const wallet = useWallet();
  const link = wallet.w.links.find((l) => l.label === "Backpack" && (l.kind === "solana" || l.kind === "phantom"));
  const owner = link?.address ?? "";
  const [chain, setChain] = useState<ChainWallet | null>(null);
  const [moves, setMoves] = useState<Record<string, HoldMove>>({});
  const [busy, setBusy] = useState(false);
  const [asset, setAsset] = useState<"USDC" | "SOL">("USDC");
  const [amount, setAmount] = useState("1");
  const [to, setTo] = useState("");
  const [sig, setSig] = useState("");
  const [call, setCall] = useState(false);

  useEffect(() => {
    if (!owner) {
      setChain(null);
      return;
    }
    let live = true;
    const pull = () => {
      void readChain(owner)
        .then((row) => {
          if (!live) return;
          setChain(row);
          const mints = row.tokens.map((token) => token.mint).slice(0, 30);
          if (!mints.length) return;
          void loadHoldTape({ data: { mints } })
            .then((tape) => {
              if (!live) return;
              const next: Record<string, HoldMove> = {};
              for (const move of tape) next[move.mint] = move;
              setMoves(next);
            })
            .catch(() => undefined);
        })
        .catch(() => {
          if (live) setChain(null);
        });
    };
    pull();
    const id = window.setInterval(pull, 20_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [owner]);

  const rows = useMemo(() => {
    if (!chain) return [] as HoldingRow[];
    const out: HoldingRow[] = [];
    if (chain.sol > 0) {
      out.push({ mint: "So11111111111111111111111111111111111111112", symbol: "SOL", name: "Solana", qty: chain.sol, value: 0, where: "coin" });
    }
    for (const token of chain.tokens) {
      if (!(token.ui > 0)) continue;
      const share = BACKPACK.find((row) => row.mint === token.mint);
      const stable = token.symbol === "USDC" || token.symbol === "CASH";
      out.push({
        mint: token.mint,
        symbol: share?.symbol || token.symbol,
        name: share ? `${share.name} · Backpack Securities` : token.symbol,
        qty: token.ui,
        value: stable ? token.ui : 0,
        where: share ? "share" : stable ? "cash" : "coin",
      });
    }
    out.sort((a, b) => Number(b.where === "share") - Number(a.where === "share") || b.qty - a.qty);
    return out;
  }, [chain]);

  const shares = rows.filter((row) => row.where === "share");

  async function connect() {
    setBusy(true);
    try {
      const got = await connectWallet("backpack");
      const linked = wallet.linkChain(got.address, "Backpack", "solana");
      if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep Backpack.");
      invalidateChain(got.address);
      toast.success("Backpack is connected.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Backpack did not connect.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!owner) return;
    const n = Number(amount);
    if (!(n > 0)) return toast.error("Enter an amount.");
    setBusy(true);
    setSig("");
    try {
      const signature = asset === "USDC"
        ? (await payUsdc({ owner, to, usd: n, memo: "Backpack wallet", deskFee: true })).signature
        : await paySol({ owner, to, sol: n });
      setSig(signature);
      setCall(false);
      invalidateChain(owner);
      toast.success("Sent.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The send did not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <header>
        <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Backpack</p>
        <h1 className="mt-1 text-3xl tracking-tight">The Backpack account.</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">This page reads the Backpack address. A share it holds is a Backpack Securities mint. Phantom is a different account.</p>
      </header>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <p className="font-mono text-4xl tabular-nums">{shares.length}</p>
        <p className="mt-1 text-sm text-muted">{owner ? shortPk(owner) : "Not connected"} · {shares.length} securities in this wallet</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void connect()} className="min-h-10 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40">
            {busy ? "Waiting" : owner ? "Reconnect Backpack" : "Connect Backpack"}
          </button>
          <Link to="/equities" className="inline-flex min-h-10 items-center rounded-full bg-white px-4 text-sm font-semibold text-black">Share book</Link>
        </div>
        <HoldingCards rows={rows} moves={moves} />
        {owner && chain && rows.length === 0 ? <p className="mt-3 text-sm text-muted">This Backpack address is empty.</p> : null}
      </section>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Send from this Backpack</p>
        <div className="mt-3 flex gap-1">
          {(["USDC", "SOL"] as const).map((id) => (
            <button key={id} type="button" onClick={() => setAsset(id)} className={`min-h-9 rounded-full px-3 text-xs font-semibold ${asset === id ? "bg-white text-black" : "bg-white/10"}`}>{id}</button>
          ))}
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm" />
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Solana address" className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm" />
        </div>
        <button type="button" disabled={busy || !owner} onClick={() => setCall(true)} className="mt-3 min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40">
          {owner ? `Sign ${amount} ${asset}` : "Connect Backpack first"}
        </button>
        {sig ? <a href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer" className="mt-2 block font-mono text-xs text-accent">{sig.slice(0, 12)}… on Solscan</a> : null}
      </section>
      <SignCall
        open={call}
        wallet="Backpack"
        title={`Send ${amount || "0"} ${asset}`}
        account={owner}
        waiting={busy}
        lines={["The Backpack extension signs this.", "Nothing leaves until you approve it there."]}
        onReject={() => { if (!busy) setCall(false); }}
        onSign={() => {
          if (!to.trim()) return toast.error("Enter the address first.");
          void send();
        }}
      />
    </div>
  );
}
