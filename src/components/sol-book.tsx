import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FillButton } from "@/components/fill-button";
import { PrintChart } from "@/components/print-chart";
import { impactPct, outUi, quoteJup, type JupQuote } from "@/lib/jup-exec";
import { holdTrade, readBook, saveBook } from "@/lib/offline-rail";
import { spendCap } from "@/lib/spend-cap";
import { loadSolBook, type BookRow, type Shelf } from "@/lib/sol-book";
import { cn } from "@/lib/utils";

const SHELVES: { id: Shelf; label: string }[] = [
  { id: "all", label: "All" },
  { id: "majors", label: "Majors" },
  { id: "stocks", label: "Stocks" },
  { id: "rwa", label: "RWA" },
  { id: "meme", label: "Memes" },
  { id: "launch", label: "Launch" },
  { id: "stakes", label: "Stake" },
  { id: "companies", label: "PreStocks" },
  { id: "defi", label: "DeFi" },
  { id: "cash", label: "Cash" },
  { id: "crypto", label: "Other" },
];

function money(n: number): string {
  if (!(n > 0)) return "—";
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
  return `$${n.toPrecision(3)}`;
}

/** The whole verified Solana book, paged. A restricted fund is shown, not sold. */
export function SolBook() {
  const [shelf, setShelf] = useState<Shelf>("all");
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<BookRow[]>([]);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState("");
  const [pick, setPick] = useState<BookRow | null>(null);
  const [usd, setUsd] = useState(5);
  const [stale, setStale] = useState(false);
  const maxLiq = rows.reduce((max, row) => (row.liquidity > max ? row.liquidity : max), 0);

  useEffect(() => {
    let live = true;
    const handle = window.setTimeout(() => {
      loadSolBook({ data: { shelf, page, q } })
        .then((book) => {
          if (!live) return;
          setRows(book.rows);
          setPages(book.pages);
          setTotal(book.total);
          if (book.page !== page) setPage(book.page);
          setErr("");
          setStale(false);
          saveBook({ shelf, page: book.page, q, pages: book.pages, total: book.total, rows: book.rows });
        })
        .catch(() => {
          if (!live) return;
          const saved = readBook();
          const cached = (saved?.rows || []) as BookRow[];
          if (cached.length) {
            setRows(cached);
            setPages(saved?.pages || 1);
            setTotal(saved?.total || cached.length);
            setStale(true);
            setErr("");
          } else {
            setErr("The book did not load, and this phone has no saved page.");
          }
        });
    }, q ? 250 : 0);
    return () => {
      live = false;
      window.clearTimeout(handle);
    };
  }, [shelf, page, q]);

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c]">
      <div className="flex items-baseline justify-between gap-3 px-4 pt-4">
        <h2 className="font-display text-lg">The book</h2>
        <p className="font-mono text-xs tabular-nums text-white/55">{total.toLocaleString("en-US")}{stale ? " · saved" : ""}</p>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SHELVES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setShelf(s.id);
              setPage(0);
              setPick(null);
            }}
            className={cn(
              "min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold",
              shelf === s.id ? "bg-accent text-accent-fg" : "bg-white/[0.06] text-white/70",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      <label className="mt-3 block px-4">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          aria-label="Search the book"
          placeholder="Search the book"
          className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm outline-none placeholder:text-white/30"
        />
      </label>
      {stale ? <p className="px-4 pt-3 text-xs text-white/45">The network did not answer. This is the last page this phone saved. A buy from it still has to sign.</p> : null}
      {err ? <p className="px-4 pt-3 text-sm text-down">{err}</p> : null}
      <ul className="mt-3 divide-y divide-white/10 border-t border-white/10">
        {rows.map((row) => {
          const open = pick?.mint === row.mint;
          return (
            <li key={row.mint}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setPick(open ? null : row)}
                className={cn("flex min-h-16 w-full items-center gap-3 px-4 text-left", open ? "bg-white/[0.04]" : "")}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold">{row.symbol}</span>
                  <span className="block truncate text-xs text-white/45">{row.name}</span>
                  {row.liquidity > 0 && maxLiq > 0 ? (
                    <span className="mt-1.5 block h-0.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                      <span className="block h-0.5 rounded-full bg-accent" style={{ width: `${(row.liquidity / maxLiq) * 100}%` }} />
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-sm tabular-nums">{money(row.price)}</span>
                  <span className={cn("font-mono text-[11px] tabular-nums", row.change < 0 ? "text-down" : "text-up")}>
                    {row.change > 0 ? "+" : ""}
                    {row.change.toFixed(2)}%
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {rows.length === 0 && !err ? <li className="px-4 py-6 text-sm text-subtle">Reading this page.</li> : null}
      </ul>
      {pick ? (
        <div className="fixed inset-x-0 top-0 z-30 overflow-y-auto bg-[#07080d] bottom-[calc(5.5rem+env(safe-area-inset-bottom))]">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-[#07080d] px-4 py-3">
            <p className="font-display text-lg">{pick.symbol}</p>
            <button type="button" onClick={() => setPick(null)} className="min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-black">Close</button>
          </div>
          <Ticket row={pick} usd={usd} setUsd={setUsd} />
        </div>
      ) : null}
      <div className="flex items-center gap-2 border-t border-white/10 px-4 py-3">
        <button
          type="button"
          disabled={page <= 0}
          onClick={() => setPage((n) => Math.max(0, n - 1))}
          className="min-h-14 flex-1 rounded-2xl border border-white/15 text-sm font-semibold disabled:opacity-40"
        >
          Previous
        </button>
        <p className="w-[4.75rem] shrink-0 text-center font-mono text-[11px] leading-tight text-white/55">
          <span className="block tabular-nums">
            {page + 1} / {pages}
          </span>
          <span className="mt-0.5 block tabular-nums text-white/40">{total.toLocaleString("en-US")}</span>
        </p>
        <button
          type="button"
          disabled={page + 1 >= pages}
          onClick={() => setPage((n) => n + 1)}
          className="min-h-14 flex-1 rounded-2xl border border-white/15 text-sm font-semibold disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </section>
  );
}

function Ticket({ row, usd, setUsd }: { row: BookRow; usd: number; setUsd: (n: number) => void }) {
  const [quote, setQuote] = useState<JupQuote | { error: string } | null>(null);
  useEffect(() => {
    if (row.note || !(usd > 0)) {
      setQuote(null);
      return;
    }
    let live = true;
    setQuote(null);
    const t = window.setTimeout(() => {
      void quoteJup({ data: { mint: row.mint, usd, side: "buy", price: row.price, decimals: row.decimals } })
        .then((r) => live && setQuote(r))
        .catch(() => live && setQuote({ error: "Quote failed." }));
    }, 300);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [row.mint, row.price, row.decimals, row.note, usd]);

  const ok = quote && !("error" in quote) ? quote : null;
  const got = ok ? outUi(ok, row.decimals) : 0;
  const executed = got > 0 ? usd / got : 0;
  const gap = row.price > 0 && executed > 0 ? ((executed - row.price) / row.price) * 100 : 0;
  const cap = spendCap();

  return (
    <div className="w-full border-t border-white/10 px-4 py-4">
      {row.note ? null : <PrintChart mint={row.mint} symbol={row.symbol} className="h-[220px]" />}
      <p className="mt-3 text-sm font-semibold">{row.symbol}</p>
      <p className="mt-1 break-all font-mono text-[11px] text-white/40">{row.mint}</p>
      {row.note ? (
        <p className="mt-3 text-sm leading-relaxed text-white/70">{row.note}</p>
      ) : (
        <>
          <div className="mt-3 flex gap-2">
            {[1, 5, 25, 100].map((n) => (
              <button key={n} type="button" onClick={() => setUsd(n)} className={cn("min-h-11 flex-1 rounded-full text-sm font-semibold", usd === n ? "bg-white text-black" : "bg-white/10")}>
                ${n}
              </button>
            ))}
          </div>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-subtle">You pay</dt><dd className="font-mono">${usd.toFixed(2)} USDC</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-subtle">You receive</dt><dd className="font-mono">{ok ? `${got.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${row.symbol}` : "…"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-subtle">Executed price</dt><dd className="font-mono">{executed > 0 ? money(executed) : "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-subtle">Screen price</dt><dd className="font-mono">{money(row.price)}{executed > 0 ? ` · ${gap >= 0 ? "+" : ""}${gap.toFixed(2)}%` : ""}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-subtle">Slippage room</dt><dd className="font-mono">{ok ? `${(ok.slippageBps / 100).toFixed(1)}%` : "1.0%"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-subtle">Price impact</dt><dd className="font-mono">{ok ? `${impactPct(ok).toFixed(2)}%` : "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-subtle">Senda fee</dt><dd className="font-mono">0</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-subtle">Send cap</dt><dd className="font-mono">${cap}</dd></div>
          </dl>
          <p className="mt-2 text-xs leading-relaxed text-white/45">
            USDC pays for the token. SOL pays the network. The first buy of {row.symbol} may also open its token account, about 0.002 SOL, once. The receipt after you sign splits those two. Hold keeps the ticket on this phone if the quote cannot be fetched.
          </p>
          {quote && "error" in quote ? <p className="mt-2 text-sm text-down">{quote.error}</p> : null}
          <button
            type="button"
            onClick={() => {
              const held = holdTrade({
                kind: "spot",
                mint: row.mint,
                symbol: row.symbol,
                side: "buy",
                usd,
                sol: 0,
                pool: "auto",
                price: row.price,
                decimals: row.decimals,
              });
              toast.success("error" in held ? held.error : "Held on this phone. USDC moves only when you sign it.");
            }}
            className="mt-3 min-h-11 w-full rounded-full border border-white/15 text-sm font-semibold"
          >
            Hold this buy
          </button>
          <FillButton
            mint={row.mint}
            usd={usd}
            side="buy"
            price={row.price}
            symbol={row.symbol}
            label={ok ? `Buy ${got.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${row.symbol}` : `Buy $${usd} ${row.symbol}`}
            className="mt-2 flex min-h-12 w-full items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40"
          />
        </>
      )}
    </div>
  );
}
