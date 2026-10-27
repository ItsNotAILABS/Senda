import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { signStockSwap } from "@/lib/jup-sign";
import { connectPhantom } from "@/lib/phantom";
import { rememberTrade } from "@/lib/trade-log";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

type Alert = { id: string; mint: string; symbol: string; side: "above" | "below"; price: number };

const KEY = "senda.alerts.v1";

function loadAlerts(): Alert[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) || "[]") as Alert[];
    return Array.isArray(rows) ? rows.filter((row) => row.mint && row.price > 0) : [];
  } catch {
    return [];
  }
}

function saveAlerts(rows: Alert[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

/** The numbers on the ticket, a price alert, and a one-dollar buy of the token. The alert only fires while this tab is open. */
export function TradeTools({
  symbol,
  mint,
  price,
  change,
  liquidity,
  premium,
}: {
  symbol: string;
  mint: string;
  price: number;
  change?: number | null;
  liquidity?: number;
  premium?: number | null;
}) {
  const wallet = useWallet();
  const [alerts, setAlerts] = useState<Alert[]>(loadAlerts);
  const [side, setSide] = useState<"above" | "below">("below");
  const [at, setAt] = useState("");
  const [busy, setBusy] = useState(false);
  const thin = liquidity != null && liquidity > 0 && liquidity < 50_000;
  const mine = alerts.filter((row) => row.mint === mint);

  useEffect(() => {
    if (!alerts.length) return;
    let on = true;
    const pull = () => {
      const ids = [...new Set(alerts.map((row) => row.mint))].slice(0, 40).join(",");
      void fetch(`https://lite-api.jup.ag/price/v3?ids=${ids}`, { headers: { accept: "application/json" } })
        .then((res) => res.json())
        .then((body: Record<string, { usdPrice?: number }>) => {
          if (!on) return;
          const left: Alert[] = [];
          for (const row of alerts) {
            const px = Number(body?.[row.mint]?.usdPrice) || 0;
            const hit = row.side === "above" ? px >= row.price : px > 0 && px <= row.price;
            if (hit) toast.message(`${row.symbol} is ${row.side} ${row.price}. The print is ${px}.`);
            else left.push(row);
          }
          if (left.length !== alerts.length) {
            saveAlerts(left);
            setAlerts(left);
          }
        })
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 20_000);
    return () => {
      on = false;
      window.clearInterval(id);
    };
  }, [alerts]);

  function arm() {
    const priceAt = Number(at);
    if (!(priceAt > 0) || !mint) {
      toast.error("Set a price.");
      return;
    }
    const next = [{ id: `${mint}:${side}:${priceAt}`, mint, symbol, side, price: priceAt }, ...alerts.filter((row) => row.id !== `${mint}:${side}:${priceAt}`)].slice(0, 20);
    saveAlerts(next);
    setAlerts(next);
    toast.success(`${symbol} ${side} ${priceAt}. This tab has to stay open.`);
  }

  async function buy() {
    setBusy(true);
    try {
      const have = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      const who = have || (await connectPhantom());
      const done = await signStockSwap({ owner: who, mint, side: "buy", usd: 1, symbol, refPrice: price });
      rememberTrade({ symbol, side: "buy", usd: 1, mint, signature: done.signature });
      toast.success(`Bought ${symbol}. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The buy did not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3">
      <p className="text-xs leading-relaxed text-white/55">
        This is a price, not a share, a vote, or a dividend.
        {change == null ? " No 24h change on this print." : ` 24h ${change >= 0 ? "+" : ""}${change.toFixed(2)}%.`}
        {premium != null ? ` Versus the mark ${(premium * 100).toFixed(1)}%.` : ""}
        {thin ? " The pool is under $50k. A small order can move it." : ""}
        {liquidity != null && liquidity >= 50_000 ? ` Pool about $${Math.round(liquidity).toLocaleString("en-US")}.` : ""}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setSide("below")} className={`h-9 rounded-full px-3 text-xs font-semibold ${side === "below" ? "bg-white text-black" : "bg-white/10"}`}>Below</button>
        <button type="button" onClick={() => setSide("above")} className={`h-9 rounded-full px-3 text-xs font-semibold ${side === "above" ? "bg-white text-black" : "bg-white/10"}`}>Above</button>
        <input value={at} onChange={(e) => setAt(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="Alert price" className="h-9 w-28 rounded-full border border-white/10 bg-black/40 px-3 font-mono text-xs outline-none" />
        <button type="button" onClick={arm} className="h-9 rounded-full border border-white/15 px-3 text-xs font-semibold">Set alert</button>
        <button type="button" disabled={busy || !mint} onClick={() => void buy()} className="h-9 rounded-full bg-accent px-3 text-xs font-semibold text-accent-fg disabled:opacity-40">{busy ? "Signing" : "Buy $1"}</button>
        <Link to="/orders" className="h-9 rounded-full border border-white/15 px-3 text-xs font-semibold leading-9">Limit</Link>
      </div>
      {mine.length ? <p className="font-mono text-[11px] text-white/40">{mine.map((row) => `${row.side} ${row.price}`).join(" · ")}</p> : null}
    </div>
  );
}
