import { useEffect, useState } from "react";
import { toast } from "sonner";
import { USDC } from "@/lib/jup-exec";
import { signRoute } from "@/lib/jup-sign";
import { connectPhantom, readChain } from "@/lib/phantom";
import { payToken } from "@/lib/solana-pay";
import { onTrades } from "@/lib/trade-log";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const POCKETS = [
  { symbol: "USDC", name: "Dollars", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
  { symbol: "EURC", name: "Euros", mint: "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr" },
  { symbol: "MXNe", name: "Pesos", mint: "6zYgzrT7X2wi9a9NeMtUvUWLLmf2a8vBsbYkocYdB9wa" },
  { symbol: "USDT", name: "Tether", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" },
  { symbol: "PYUSD", name: "PayPal", mint: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo" },
] as const;

/** Prepaid pockets are the stables this wallet already holds. Load swaps USDC in. Spend sends the token. */
export function PrepaidCard({ owner }: { owner: string }) {
  const wallet = useWallet();
  const [held, setHeld] = useState<Record<string, number>>({});
  const [pick, setPick] = useState<(typeof POCKETS)[number]>(POCKETS[0]);
  const [amount, setAmount] = useState("5");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!owner) return;
    let live = true;
    const pull = () => {
      void readChain(owner).then((chain) => {
        if (!live) return;
        const next: Record<string, number> = {};
        for (const token of chain.tokens) next[token.mint] = token.ui;
        setHeld(next);
      }).catch(() => undefined);
    };
    pull();
    const stop = onTrades(pull);
    return () => {
      live = false;
      stop();
    };
  }, [owner]);

  async function who(): Promise<string> {
    const addr = owner || (await connectPhantom());
    if (!owner) {
      const linked = wallet.linkChain(addr, "Phantom", "phantom");
      if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Phantom did not stay.");
    }
    return addr;
  }

  async function load() {
    const n = Number(amount);
    if (!(n > 0)) return toast.error("Enter an amount.");
    if (pick.symbol === "USDC") return toast.error("USDC is already the dollar pocket. Load a euro or a peso.");
    setBusy("load");
    try {
      const addr = await who();
      const done = await signRoute({
        owner: addr,
        inputMint: USDC,
        outputMint: pick.mint,
        amountRaw: Math.round(n * 1e6),
        outDecimals: 6,
        usd: n,
      });
      toast.success(`${done.outUi.toFixed(2)} ${pick.symbol} is in this wallet.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The load did not sign.");
    } finally {
      setBusy("");
    }
  }

  async function spend() {
    const n = Number(amount);
    if (!(n > 0)) return toast.error("Enter an amount.");
    if (!to.trim()) return toast.error("Paste the address that should receive it.");
    setBusy("spend");
    try {
      const addr = await who();
      const done = await payToken({ owner: addr, to: to.trim(), mint: pick.mint, symbol: pick.symbol, amount: n });
      toast.success(`Sent ${pick.symbol}. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The send did not sign.");
    } finally {
      setBusy("");
    }
  }

  const balance = held[pick.mint] || 0;

  return (
    <section className="overflow-hidden rounded-[28px] bg-[#141824]">
      <div className="bg-[#d7e36a] px-5 pt-5 pb-4 text-black">
        <p className="text-[11px] font-semibold tracking-[0.16em] uppercase">Prepaid</p>
        <p className="mt-1 font-mono text-4xl tabular-nums">{balance.toLocaleString("en-US", { maximumFractionDigits: 2 })}</p>
        <p className="text-sm font-semibold">{pick.symbol}</p>
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        {POCKETS.map((row) => {
          const n = held[row.mint] || 0;
          const on = row.mint === pick.mint;
          return (
            <button key={row.mint} type="button" onClick={() => setPick(row)} className={cn("min-w-[92px] shrink-0 rounded-2xl px-3 py-2 text-left", on ? "bg-white text-black" : "bg-black/30")}>
              <span className="block text-xs font-semibold">{row.symbol}</span>
              <span className={cn("block font-mono text-[11px]", on ? "text-black/60" : "text-white/50")}>{n.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
            </button>
          );
        })}
      </div>
      <div className="space-y-2 px-4 pb-4">
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" aria-label="Amount" className="min-h-12 w-full rounded-2xl bg-black/30 px-3 font-mono text-2xl outline-none" />
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Send to a Solana address" className="min-h-11 w-full rounded-2xl bg-black/30 px-3 text-sm outline-none" />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy !== ""} onClick={() => void load()} className="min-h-12 rounded-full bg-[#d7e36a] text-sm font-semibold text-black disabled:opacity-40">
            {busy === "load" ? "Waiting" : `Load ${pick.symbol}`}
          </button>
          <button type="button" disabled={busy !== ""} onClick={() => void spend()} className="min-h-12 rounded-full bg-white text-sm font-semibold text-black disabled:opacity-40">
            {busy === "spend" ? "Waiting" : "Send"}
          </button>
        </div>
      </div>
    </section>
  );
}
