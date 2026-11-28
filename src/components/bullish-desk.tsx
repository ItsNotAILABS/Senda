import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BULLISH } from "@/lib/access-rails";
import { openLend, type LendRow } from "@/lib/stock-lend";

const FACTS = [
  ["Status", BULLISH.status],
  ["When", BULLISH.when],
  ["Where", BULLISH.where],
  ["Market", BULLISH.market],
  ["Asset", BULLISH.asset],
  ["Shape", BULLISH.shape],
  ["Who gets in", BULLISH.gate],
  ["Terms", BULLISH.terms],
  ["Transfer agent", BULLISH.agent],
] as const;

function pct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

export function BullishDesk() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<LendRow[]>([]);
  const [note, setNote] = useState("Asking Kamino which stock loans are actually open.");

  useEffect(() => {
    let live = true;
    openLend()
      .then((book) => {
        if (!live) return;
        setRows(book.stocks);
        setNote(book.answered ? book.note : "Kamino did not answer. The announced market is still not open.");
      })
      .catch(() => live && setNote("Kamino did not answer. The announced market is still not open."));
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-xl px-4 pt-4 pb-16">
      <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Bullish</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">The share, when the market opens.</h1>
      <p className="mt-2 text-sm leading-relaxed text-white/60">
        Jupiter and Bullish announced a permissioned lending market for BLSH issuer tokens. It is not open. There is no borrow on this page, and no mint is pasted into the wallet.
      </p>
      <button type="button" onClick={() => void navigate({ href: "/passport" })} className="mt-3 min-h-11 w-full rounded-full border border-white/10 px-4 text-left text-sm">
        <span className="block font-semibold">Passport does not clear this</span>
        <span className="mt-0.5 block text-xs text-white/50">Jupiter’s verified identity is the gate they described. This phone’s key is not that.</span>
      </button>

      <dl className="mt-4 space-y-2">
        {FACTS.map(([k, v]) => (
          <div key={k} className="rounded-[22px] border border-white/10 bg-[#10131c] px-4 py-3">
            <dt className="font-mono text-[10px] tracking-[0.14em] text-white/40 uppercase">{k}</dt>
            <dd className="mt-1 text-sm leading-relaxed">{v}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-4 rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <p className="text-sm font-semibold">Stock loans that are open</p>
        <p className="mt-1 text-sm leading-relaxed text-white/55">{note}</p>
        {rows.length ? (
          <ul className="mt-3 divide-y divide-white/10">
            {rows.map((row) => (
              <li key={row.symbol} className="flex items-baseline justify-between gap-3 py-2">
                <span className="text-sm font-semibold">{row.symbol}</span>
                <span className="text-right font-mono text-[11px] text-white/55">
                  LTV {(row.maxLtv * 100).toFixed(0)}% · borrow {pct(row.borrowApy)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-3 text-xs leading-relaxed text-white/45">Rates are Kamino’s xStock market. They are not BLSH terms, and this list does not sign.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => void navigate({ href: "/equities/borrow" })} className="min-h-11 rounded-full bg-white text-sm font-semibold text-black">
            Borrow desk
          </button>
          <button type="button" onClick={() => void navigate({ href: "/vault/loans" })} className="min-h-11 rounded-full bg-white/10 text-sm font-semibold">
            Loans
          </button>
          <button type="button" onClick={() => void navigate({ href: "/equities" })} className="min-h-11 rounded-full bg-white/10 text-sm font-semibold">
            Stocks
          </button>
          <button type="button" onClick={() => void navigate({ href: "/equities/liquidity" })} className="min-h-11 rounded-full bg-white/10 text-sm font-semibold">
            Liquidity
          </button>
        </div>
      </section>
    </div>
  );
}
