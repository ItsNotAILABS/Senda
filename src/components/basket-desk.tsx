import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PACKS } from "@/lib/basket";
import { getWeightBook } from "@/lib/jup-exec";
import { connectPhantom } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { formatUsd, type HouseListing } from "@/lib/sol-house";
import { spendCap } from "@/lib/spend-cap";
import type { WeightLeg } from "@/lib/jup-fill.mjs";

type Book = { level: number | null; legs: WeightLeg[] };

function targets(packSymbols: readonly string[], pre: HouseListing[]) {
  const legs = packSymbols
    .map((symbol) => pre.find((row) => row.symbol.toUpperCase().includes(symbol) || row.name.toUpperCase().includes(symbol)))
    .filter((row): row is HouseListing => Boolean(row && row.mint && row.mark > 0));
  const valuation = legs.reduce((sum, leg) => sum + (leg.valuation > 0 ? leg.valuation : 0), 0);
  return legs.map((leg) => ({
    symbol: leg.symbol,
    mint: leg.mint,
    mark: leg.mark > 0 ? leg.mark : leg.last,
    target: valuation > 0 && leg.valuation > 0 ? leg.valuation : 1,
  }));
}

export function BasketDesk({ house }: { house: HouseListing[] }) {
  const [raw, setRaw] = useState("100");
  const [packId, setPackId] = useState<(typeof PACKS)[number]["id"]>("pre8");
  const [book, setBook] = useState<Book | null>(null);
  const [busy, setBusy] = useState(false);
  const pre = house.filter((row) => row.venue === "prestocks");
  const spend = Number(raw) || 0;
  const bookKey = pre.map((row) => `${row.mint}:${row.mark}:${row.valuation}`).join("|");

  useEffect(() => {
    const pack = PACKS.find((row) => row.id === packId);
    const legs = pack ? targets(pack.symbols, pre) : [];
    if (legs.length < 2 || !(spend > 0)) {
      setBook(null);
      return;
    }
    let live = true;
    void getWeightBook({ data: { spendUsd: spend, legs } })
      .then((next) => {
        if (live) setBook(next);
      })
      .catch(() => {
        if (live) setBook(null);
      });
    return () => {
      live = false;
    };
    // bookKey is the listing identity. `pre` is a fresh array each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packId, spend, bookKey]);

  async function sign() {
    const legs = (book?.legs ?? []).filter((leg) => leg.filled && leg.filledWeight > 0);
    if (legs.length < 2) {
      toast.error("Jupiter cannot fill enough legs at 100 bps.");
      return;
    }
    setBusy(true);
    try {
      const owner = await connectPhantom();
      for (const leg of legs) {
        const usd = Math.round(spend * leg.filledWeight * 100) / 100;
        if (usd > spendCap()) throw new Error(`${leg.symbol} is $${usd}. The cap is $${spendCap()}.`);
        await runPrestock({ owner, mint: leg.mint, side: "buy", usd, price: leg.exec });
      }
      toast.success("The wallet signed the filled legs.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The basket stopped.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 pb-8">
      <p className="pt-3 text-sm text-muted">
        Pick a theme and an amount. Jupiter quotes every leg from that amount in one pass. The wallet then signs each filled leg. The target weight is the share before the quote. The filled weight is what remains after a leg that cannot fill at 100 bps is dropped. The level is 1000 when the executable price matches the mark.
      </p>
      <input
        inputMode="decimal"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="Dollars"
        className="mt-4 min-h-12 w-full rounded-2xl bg-elevated px-4 font-mono text-lg outline-none"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {PACKS.map((pack) => (
          <button
            key={pack.id}
            type="button"
            onClick={() => setPackId(pack.id)}
            className={pack.id === packId ? "min-h-10 rounded-full bg-fg px-3 text-sm font-semibold text-bg" : "min-h-10 rounded-full bg-elevated px-3 text-sm text-muted"}
          >
            {pack.name}
          </button>
        ))}
      </div>
      <p className="mt-4 font-mono text-sm">{book?.level != null ? `Level ${book.level.toFixed(1)}` : "Waiting on Jupiter."}</p>
      <ul className="mt-3 space-y-2">
        {(book?.legs ?? []).map((leg) => (
          <li key={leg.mint} className="rounded-2xl bg-elevated px-4 py-3 text-sm">
            <p className="font-semibold">{leg.symbol}</p>
            <p className="mt-1 font-mono text-xs text-muted">
              target {(leg.targetWeight * 100).toFixed(1)}% · filled {(leg.filledWeight * 100).toFixed(1)}% · {leg.filled ? formatUsd(leg.exec) : "no fill"}
              {leg.impactBps != null ? ` · ${leg.impactBps.toFixed(0)} bps` : ""}
            </p>
          </li>
        ))}
      </ul>
      <button type="button" disabled={busy} onClick={() => void sign()} className="mt-4 min-h-11 w-full rounded-full bg-fg text-sm font-semibold text-bg disabled:opacity-40">
        Route this amount
      </button>
    </div>
  );
}
