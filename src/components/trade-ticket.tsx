import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BookView } from "@/components/book-view";
import { ActivityTape } from "@/components/activity-tape";
import { recordFill, setIntent } from "@/lib/book";
import { localLine, usdRates } from "@/lib/fx";
import { connectPhantom, readChain } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { formatUsd, getHouse, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const SIZES = [0.5, 1, 5, 25];

/** The trade bucket. Same Jupiter swap as a long-term buy. It is labeled so the two do not mix. */
export function TradeTicket() {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [names, setNames] = useState<HouseListing[]>([]);
  const [symbol, setSymbol] = useState("");
  const [usd, setUsd] = useState(1);
  const [busy, setBusy] = useState(false);
  const [tokens, setTokens] = useState<Array<{ mint: string; ui: number }>>([]);
  const [line, setLine] = useState("");
  const pre = names.filter((n) => n.venue === "prestocks" && n.last > 0);
  const chosen = pre.find((n) => n.symbol === symbol) ?? pre[0];

  useEffect(() => {
    getHouse()
      .then((rows) => {
        setNames(rows);
        setSymbol((cur) => cur || rows.find((n) => n.venue === "prestocks")?.symbol || "");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!owner) return;
    let live = true;
    readChain(owner)
      .then((s) => live && setTokens(s.tokens.map((t) => ({ mint: t.mint, ui: t.ui }))))
      .catch(() => live && setTokens([]));
    return () => {
      live = false;
    };
  }, [owner, busy]);

  useEffect(() => {
    let live = true;
    usdRates().then((rates) => live && setLine(localLine(usd, rates)));
    return () => {
      live = false;
    };
  }, [usd]);

  async function go(side: "buy" | "sell") {
    if (!chosen) return;
    setBusy(true);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      setIntent("trade");
      const done = await runPrestock({ owner: who, mint: chosen.mint, side, usd, price: chosen.last });
      const qty = side === "buy" ? done.outUi : chosen.last > 0 ? usd / chosen.last : 0;
      recordFill({
        symbol: chosen.symbol,
        mint: chosen.mint,
        side,
        bucket: "trade",
        usd,
        qty,
        signature: done.signature,
      });
      const next = await readChain(who);
      setTokens(next.tokens.map((t) => ({ mint: t.mint, ui: t.ui })));
      toast.success(`${side === "buy" ? "Trade" : "Sold"} ${chosen.symbol}. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The trade did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[28px] border border-white/10 bg-[#10131c] p-4">
      <p className="text-[11px] tracking-[0.16em] text-accent">TRADE</p>
      <h2 className="mt-1 text-2xl tracking-tight">Same names. A separate book.</h2>
      <p className="mt-1 text-xs text-subtle">This does not add to Hold. Half a dollar is enough. Jupiter builds it. You sign.</p>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {pre.slice(0, 8).map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => setSymbol(n.symbol)}
            className={cn(
              "min-h-10 shrink-0 rounded-full px-3 text-xs font-semibold",
              chosen?.symbol === n.symbol ? "bg-white text-black" : "bg-black/40",
            )}
          >
            {n.symbol}
            <span className="ml-2 font-mono font-normal">{formatUsd(n.last)}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {SIZES.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setUsd(n)}
            className={cn("min-h-9 rounded-full px-3 font-mono text-xs", usd === n ? "bg-accent text-accent-fg" : "bg-black/40")}
          >
            ${n}
          </button>
        ))}
      </div>
      {line ? <p className="mt-2 text-[11px] text-subtle">{line}</p> : null}
      {usd < 1 ? <p className="mt-1 text-[11px] text-subtle">Under a dollar, the network fee is a bigger share of the ticket.</p> : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={busy || !chosen} onClick={() => void go("buy")} className="min-h-11 rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-50">
          {busy ? "Signing" : `Buy ${chosen?.symbol ?? ""}`}
        </button>
        <button type="button" disabled={busy || !chosen} onClick={() => void go("sell")} className="min-h-11 rounded-full border border-white/15 text-sm font-semibold disabled:opacity-50">
          Sell
        </button>
      </div>
      <BookView tokens={tokens} names={names} />
      <div className="mt-3">
        <ActivityTape />
      </div>
    </section>
  );
}
