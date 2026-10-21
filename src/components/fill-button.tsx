import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FillCard } from "@/components/fill-card";
import { LiveQuote, useLiveQuote } from "@/components/live-quote";
import { connectPhantom } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { PAY, SOL, payAsset } from "@/lib/jup-sign";
import { liveMarks } from "@/lib/jup-tape";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

export function FillButton({
  mint,
  usd = 10,
  side = "buy",
  price,
  label,
  className,
  symbol = "",
}: {
  mint: string;
  usd?: number;
  side?: "buy" | "sell";
  price?: number;
  label: string;
  className?: string;
  symbol?: string;
}) {
  const wallet = useWallet();
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState("USDC");
  const [solUsd, setSolUsd] = useState(0);
  const [fill, setFill] = useState<{ sig: string; out: number } | null>(null);
  const live = useLiveQuote(side === "buy" ? mint : undefined, usd, pay, solUsd);
  const paying = payAsset(pay);
  useEffect(() => {
    let liveFx = true;
    liveMarks({ data: [SOL] })
      .then((marks) => liveFx && setSolUsd(marks[SOL]?.usd || 0))
      .catch(() => undefined);
    return () => {
      liveFx = false;
    };
  }, []);

  async function go() {
    if (mint.length < 32) {
      toast.error("That name has no on-chain mint.");
      return;
    }
    if (side === "buy" && !live.ready) {
      toast.error(live.why || "No route.");
      return;
    }
    setBusy(true);
    try {
      const existing = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      const owner = existing || (await connectPhantom());
      if (!existing) {
        const linked = wallet.linkChain(owner, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      const done = await runPrestock({ owner, mint, side, usd, price, symbol, pay, solUsd });
      setFill({ sig: done.signature, out: done.outUi });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The swap did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex w-full flex-col items-start gap-1">
      {fill ? (
        <FillCard
          title={side === "sell" ? `Sold ${symbol || "it"}` : `Bought ${symbol || "it"}`}
          symbol={symbol || "USDC"}
          amount={`$${usd}`}
          paid={side === "sell" ? symbol || "the token" : `$${usd} ${paying.symbol}`}
          received={side === "sell" ? `$${usd} ${paying.symbol}` : fill.out > 0 ? `${fill.out.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${symbol}` : symbol || "the token"}
          where="Phantom"
          when="Just now"
          sig={fill.sig}
          onDone={() => setFill(null)}
        />
      ) : null}
      {side === "buy" ? <LiveQuote quote={live.quote} why={live.why} symbol={symbol} usd={usd} pay={paying.symbol} /> : null}
      <span className="flex gap-1 overflow-x-auto">
        {PAY.map((row) => (
          <button key={row.symbol} type="button" onClick={() => setPay(row.symbol)} className={`min-h-8 shrink-0 rounded-full px-2.5 text-xs font-semibold ${pay === row.symbol ? "bg-white text-black" : "bg-[#2a2a2e] text-white/70"}`}>
            {row.symbol}
          </button>
        ))}
      </span>
      <button type="button" disabled={busy || (side === "buy" && !live.ready) || !(usd > 0)} onClick={() => void go()} className={className}>
        {busy ? "Waiting for the wallet…" : label}
      </button>
    </span>
  );
}

const SIZES = [0.01, 0.1, 1, 5, 25];

/** Typed size, then the same signed swap the ticket uses. */
export function TradePad({ mint, price, symbol }: { mint: string; price?: number; symbol: string }) {
  const [amt, setAmt] = useState("1");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const n = Number(amt);
  const usd = Number.isFinite(n) && n > 0 ? n : 0;
  return (
    <div className="mt-3 rounded-[22px] bg-[#101114] p-3">
      <label className="block">
        <span className="text-xs text-white/45">{side === "sell" ? "Sell about, dollars" : "You pay, dollars"}</span>
        <input
          inputMode="decimal"
          value={amt}
          onChange={(e) => {
            const next = e.target.value.replace(/[^0-9.]/g, "");
            if ((next.match(/\./g) || []).length > 1) return;
            setAmt(next);
          }}
          className="mt-1 w-full bg-transparent font-mono text-3xl tabular-nums outline-none"
        />
      </label>
      <div className="mt-2 flex gap-2 overflow-x-auto">
        {SIZES.map((chip) => (
          <button key={chip} type="button" onClick={() => setAmt(String(chip))} className={`grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold ${usd === chip ? "bg-white text-black" : "bg-[#2a2a2e]"}`}>
            ${chip < 1 ? chip : chip}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setSide("buy")} className={`min-h-11 rounded-full text-sm font-semibold ${side === "buy" ? "bg-[#d7e36a] text-black" : "border border-white/15"}`}>Buy</button>
        <button type="button" onClick={() => setSide("sell")} className={`min-h-11 rounded-full text-sm font-semibold ${side === "sell" ? "bg-white text-black" : "border border-white/15"}`}>Sell</button>
      </div>
      <FillButton
        mint={mint}
        usd={usd}
        side={side}
        price={price}
        symbol={symbol}
        label={usd > 0 ? `Sign ${side} $${usd} ${symbol}` : "Type a size"}
        className="mt-3 min-h-12 w-full rounded-full bg-[#d7e36a] text-sm font-semibold text-black disabled:opacity-40"
      />
    </div>
  );
}
