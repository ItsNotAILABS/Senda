import { useEffect, useState } from "react";
import { toast } from "sonner";
import { coinPx, useCoins } from "@/components/coin-ticker";
import { PrintChart } from "@/components/print-chart";
import { executeTicket } from "@/lib/ticket-trade";
import { connectPhantom, liveSolAddress, splHolding } from "@/lib/phantom";
import { getHouse, type HouseListing } from "@/lib/sol-house";
import { getStockFlow, type FlowName } from "@/lib/stock-flow";
import { listTrades, rememberTrade, type TradeFill } from "@/lib/trade-log";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const SIZES = [1, 5, 25, 100] as const;

export function NameTicket({ mint, onClose }: { mint: string; onClose: () => void }) {
  const wallet = useWallet();
  const coins = useCoins();
  const [house, setHouse] = useState<HouseListing[]>([]);
  const [stocks, setStocks] = useState<FlowName[]>([]);
  const [usd, setUsd] = useState(5);
  const [raw, setRaw] = useState("5");
  const [held, setHeld] = useState<number | null>(null);
  const [busy, setBusy] = useState("");
  const [order, setOrder] = useState("");
  const [fills, setFills] = useState<TradeFill[]>([]);

  useEffect(() => {
    void getHouse().then((rows) => setHouse(rows.filter((n) => n.venue === "prestocks"))).catch(() => undefined);
    void getStockFlow().then(setStocks).catch(() => undefined);
  }, []);

  const coin = coins.find((c) => c.id === mint);
  const pre = house.find((n) => n.mint === mint);
  const stock = stocks.find((s) => s.mint === mint);
  const symbol = pre?.symbol || stock?.symbol || coin?.symbol || `${mint.slice(0, 4)}…`;
  const name = pre?.name || stock?.name || coin?.name || "On Jupiter";
  const price = pre?.last || stock?.price || coin?.price || 0;
  const change = pre?.change24h != null && pre.change24h !== -1 ? pre.change24h * 100 : stock?.change ?? coin?.change ?? null;
  const decimals = coin?.decimals || stock?.decimals || 6;
  const book = pre ? "PreStock" : stock ? "xStock" : "Spot";
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";

  useEffect(() => {
    if (!owner) {
      setHeld(null);
      return;
    }
    let live = true;
    void splHolding(owner, mint)
      .then((h) => live && setHeld(h.ui))
      .catch(() => live && setHeld(0));
    return () => {
      live = false;
    };
  }, [owner, mint, busy]);

  useEffect(() => {
    const pull = () => setFills(listTrades().filter((row) => row.mint === mint).slice(0, 5));
    pull();
    window.addEventListener("senda-trade", pull);
    return () => window.removeEventListener("senda-trade", pull);
  }, [mint]);

  function sizeFrom(next: string) {
    setRaw(next);
    const n = Number(next);
    if (n > 0) setUsd(n);
  }

  async function signer(): Promise<string> {
    const who = liveSolAddress() || owner || (await connectPhantom());
    if (who !== owner) {
      const linked = wallet.linkChain(who, "Phantom", "phantom");
      if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep the wallet.");
    }
    return who;
  }

  async function go(side: "buy" | "sell") {
    const n = Number(raw);
    if (!(n >= 1)) {
      toast.error("A trade is at least $1.");
      return;
    }
    setBusy(side);
    try {
      const who = await signer();
      const done = await executeTicket({ owner: who, mint, side, usd: n, decimals, price });
      rememberTrade({ symbol, side, usd: n, mint, signature: done.signature });
      toast.success(`${side === "buy" ? "Bought" : "Sold"} ${symbol}. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not sign.");
    } finally {
      setBusy("");
    }
  }

  function applyOrder() {
    try {
      const body = JSON.parse(order) as { usd?: number; side?: string };
      if (body.usd && body.usd >= 1) {
        setUsd(body.usd);
        setRaw(String(body.usd));
      }
      if (body.side === "sell") void go("sell");
      else if (body.side === "buy") void go("buy");
      else toast.success("Size is set. Buy or sell when you want it signed.");
    } catch {
      toast.error("That is not an order.");
    }
  }

  const payload = JSON.stringify({ mint, symbol, book, side: "buy", usd: Number(raw) || usd });

  return (
    <section className="mx-3 mt-3 overflow-hidden rounded-[22px] border border-white/10 bg-[#0c0e14] lg:mx-5">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">{book}</p>
          <h2 className="truncate font-mono text-3xl">{symbol}</h2>
          <p className="truncate text-sm text-muted">{name}</p>
        </div>
        <button type="button" onClick={onClose} className="min-h-11 shrink-0 rounded-full border border-white/15 px-4 text-sm">Close</button>
      </div>
      <div className="border-b border-white/10 px-3 pb-3">
        <PrintChart mint={mint} symbol={symbol} className="h-[280px]" />
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="font-mono text-4xl tabular-nums">{price > 0 ? coinPx(price) : "No print"}</p>
          <p className={cn("mt-1 font-mono text-sm", (change ?? 0) < 0 ? "text-down" : "text-up")}>
            {change == null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`}
          </p>
          <p className="mt-3 font-mono text-sm text-muted">
            You hold {held == null ? "—" : held.toLocaleString("en-US", { maximumFractionDigits: 6 })} {symbol}
          </p>
          <p className="mt-1 break-all font-mono text-[11px] text-subtle">{mint}</p>
        </div>
        <div>
          <div className="flex flex-wrap gap-1">
            {SIZES.map((n) => (
              <button key={n} type="button" onClick={() => sizeFrom(String(n))} className={cn("min-h-10 rounded-full px-3 font-mono text-xs", Number(raw) === n ? "bg-white text-black" : "bg-white/10")}>
                ${n}
              </button>
            ))}
          </div>
          <input
            value={raw}
            onChange={(e) => sizeFrom(e.target.value)}
            inputMode="decimal"
            className="mt-3 min-h-14 w-full rounded-2xl border border-white/10 bg-black/40 px-4 font-mono text-2xl outline-none"
            aria-label="Dollars"
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" disabled={busy !== ""} onClick={() => void go("buy")} className="min-h-14 rounded-2xl bg-accent text-base font-semibold text-accent-fg disabled:opacity-40">
              {busy === "buy" ? "Waiting" : "Buy"}
            </button>
            <button type="button" disabled={busy !== ""} onClick={() => void go("sell")} className="min-h-14 rounded-2xl bg-white text-base font-semibold text-black disabled:opacity-40">
              {busy === "sell" ? "Waiting" : "Sell"}
            </button>
          </div>
          <p className="mt-2 text-xs text-subtle">Pays with USDC, or with the SOL on this wallet if the dollars are not there. Phantom signs once.</p>
          <p className="mt-3 break-all rounded-xl bg-black/40 p-3 font-mono text-[11px] text-muted">{payload}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(payload).then(() => toast.success("Order copied."), () => toast.error("Could not copy."))}
              className="min-h-11 flex-1 rounded-full border border-white/15 text-sm font-semibold"
            >
              Copy order
            </button>
          </div>
          <textarea
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            placeholder='{"mint":"…","side":"buy","usd":5}'
            className="mt-2 min-h-16 w-full rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-xs outline-none"
          />
          <button type="button" disabled={busy !== ""} onClick={applyOrder} className="mt-2 min-h-11 w-full rounded-full bg-white/10 text-sm font-semibold">
            Run the agent order
          </button>
          <div className="mt-2 flex gap-1">
            <button type="button" onClick={() => setOrder(JSON.stringify({ mint, symbol, side: "buy", usd: Number(raw) || usd }))} className="min-h-9 flex-1 rounded-full bg-white/10 text-[11px] font-semibold">Queue buy</button>
            <button type="button" onClick={() => setOrder(JSON.stringify({ mint, symbol, side: "sell", usd: Number(raw) || usd }))} className="min-h-9 flex-1 rounded-full bg-white/10 text-[11px] font-semibold">Queue sell</button>
          </div>
          {fills.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {fills.map((fill) => (
                <li key={fill.signature} className="rounded-xl bg-black/40 px-3 py-2">
                  <p className="text-sm font-semibold">{fill.side === "sell" ? "Sold" : fill.side === "send" ? "Sent" : "Bought"} ${fill.usd}</p>
                  <p className="font-mono text-[11px] text-white/45">{new Date(fill.at).toLocaleString()}</p>
                  <a href={`https://solscan.io/tx/${fill.signature}`} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-[#d7e36a]">{fill.signature.slice(0, 8)}…</a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-subtle">A fill shows here after this wallet signs it. Nothing is filled in before that.</p>
          )}
        </div>
      </div>
    </section>
  );
}
