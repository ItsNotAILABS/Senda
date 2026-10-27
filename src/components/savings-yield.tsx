import { useEffect, useState } from "react";
import { toast } from "sonner";
import { USDC } from "@/lib/jup-exec";
import { SOL, signRoute } from "@/lib/jup-sign";
import { connectPhantom, readChain } from "@/lib/phantom";
import { onTrades } from "@/lib/trade-log";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

const USDY = "A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6";
const JITO = "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn";

/** Savings is a yield token or liquid stake. Moving money swaps into it. The wallet signs. */
export function SavingsYield({ owner }: { owner: string }) {
  const wallet = useWallet();
  const [usdy, setUsdy] = useState(0);
  const [jito, setJito] = useState(0);
  const [usd, setUsd] = useState("10");
  const [sol, setSol] = useState("0.05");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!owner) return;
    let live = true;
    const pull = () => {
      void readChain(owner).then((chain) => {
        if (!live) return;
        setUsdy(chain.tokens.find((t) => t.mint === USDY)?.ui || 0);
        setJito(chain.tokens.find((t) => t.mint === JITO)?.ui || 0);
      }).catch(() => undefined);
    };
    pull();
    const stop = onTrades(pull);
    return () => {
      live = false;
      stop();
    };
  }, [owner]);

  async function who() {
    const addr = owner || (await connectPhantom());
    if (!owner) {
      const linked = wallet.linkChain(addr, "Phantom", "phantom");
      if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Phantom did not stay.");
    }
    return addr;
  }

  async function toYield() {
    const n = Number(usd);
    if (!(n > 0)) return toast.error("Enter the dollars.");
    setBusy("usd");
    try {
      const addr = await who();
      const done = await signRoute({ owner: addr, inputMint: USDC, outputMint: USDY, amountRaw: Math.round(n * 1e6), outDecimals: 6, usd: n });
      toast.success(`${done.outUi.toFixed(2)} USDY is in this wallet.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The yield move did not sign.");
    } finally {
      setBusy("");
    }
  }

  async function toStake() {
    const n = Number(sol);
    if (!(n > 0)) return toast.error("Enter the SOL.");
    setBusy("sol");
    try {
      const addr = await who();
      const done = await signRoute({ owner: addr, inputMint: SOL, outputMint: JITO, amountRaw: Math.round(n * 1e9), outDecimals: 9, usd: n });
      toast.success(`${done.outUi.toFixed(4)} JitoSOL is in this wallet.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The stake move did not sign.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="rounded-[28px] bg-[#141824] p-4">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">Savings</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-black/30 px-3 py-3">
          <p className="text-xs text-subtle">Yield dollar</p>
          <p className="mt-1 font-mono text-2xl tabular-nums">{usdy.toFixed(2)}</p>
          <p className="text-[11px] text-subtle">USDY</p>
        </div>
        <div className="rounded-2xl bg-black/30 px-3 py-3">
          <p className="text-xs text-subtle">Staked SOL</p>
          <p className="mt-1 font-mono text-2xl tabular-nums">{jito.toFixed(4)}</p>
          <p className="text-[11px] text-subtle">JitoSOL</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-2xl bg-black/20 p-3">
          <input value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal" aria-label="USDC" className="w-full bg-transparent font-mono text-3xl outline-none" />
          <button type="button" disabled={busy !== ""} onClick={() => void toYield()} className="mt-2 min-h-11 w-full rounded-full bg-[#d7e36a] text-sm font-semibold text-black disabled:opacity-40">
            {busy === "usd" ? "Waiting" : "Move USDC to yield"}
          </button>
        </div>
        <div className="rounded-2xl bg-black/20 p-3">
          <input value={sol} onChange={(e) => setSol(e.target.value)} inputMode="decimal" aria-label="SOL" className="w-full bg-transparent font-mono text-3xl outline-none" />
          <button type="button" disabled={busy !== ""} onClick={() => void toStake()} className="mt-2 min-h-11 w-full rounded-full bg-white text-sm font-semibold text-black disabled:opacity-40">
            {busy === "sol" ? "Waiting" : "Move SOL to stake"}
          </button>
        </div>
      </div>
    </section>
  );
}
