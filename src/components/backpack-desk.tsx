import { useEffect, useMemo, useState } from "react";
import { FillButton } from "@/components/fill-button";
import { getBackpackCard, loadBackpack, type BackpackCard, type BackpackRow } from "@/lib/backpack";
import { listTrades } from "@/lib/trade-log";
import { formatUsd, type HouseListing } from "@/lib/sol-house";

type Rank = "up" | "down" | "liq" | "vol" | "mcap";

const RANKS: { id: Rank; label: string }[] = [
  { id: "up", label: "Gainers" },
  { id: "down", label: "Losers" },
  { id: "liq", label: "Liquidity" },
  { id: "vol", label: "Volume" },
  { id: "mcap", label: "Cap" },
];

const SIZES = [25, 100, 250, 1000];

function usd(n: number): string {
  if (!(n > 0)) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function px(n: number): string {
  if (!(n > 0)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n < 1 ? 4 : 2 });
}

function tone(symbol: string): string {
  const tones = ["bg-[#1c2410] text-accent", "bg-[#24141a] text-down", "bg-[#141a28] text-white", "bg-[#221c10] text-[#f0d48a]"];
  let n = 0;
  for (const c of symbol) n += c.charCodeAt(0);
  return tones[n % tones.length];
}

export function BackpackDesk() {
  const [rows, setRows] = useState<BackpackRow[]>([]);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [rank, setRank] = useState<Rank>("up");
  const [mint, setMint] = useState("");
  const [usdSize, setUsdSize] = useState(25);
  const [card, setCard] = useState<BackpackCard | null>(null);
  const [cardErr, setCardErr] = useState("");

  useEffect(() => {
    let live = true;
    loadBackpack()
      .then((book) => live && setRows(book))
      .catch((e) => live && setErr(e instanceof Error ? e.message : "The book did not load."));
    const id = window.setInterval(() => {
      loadBackpack()
        .then((book) => live && setRows(book))
        .catch(() => undefined);
    }, 30_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    const pool = rows.filter((row) => !query || `${row.symbol} ${row.name}`.toLowerCase().includes(query));
    const copy = [...pool];
    if (rank === "down") copy.sort((a, b) => a.change - b.change);
    else if (rank === "liq") copy.sort((a, b) => b.liquidity - a.liquidity);
    else if (rank === "vol") copy.sort((a, b) => b.volume - a.volume);
    else if (rank === "mcap") copy.sort((a, b) => b.mcap - a.mcap);
    else copy.sort((a, b) => b.change - a.change);
    return copy;
  }, [rows, q, rank]);

  const picked = rows.find((row) => row.mint === mint) ?? null;
  const fills = picked ? listTrades().filter((row) => row.mint === picked.mint).length : 0;
  const span = Math.max(...shown.map((row) => Math.abs(row.change)), 1);

  useEffect(() => {
    if (!mint) {
      setCard(null);
      return;
    }
    let live = true;
    setCard(null);
    setCardErr("");
    getBackpackCard({ data: { mint } })
      .then((row) => {
        if (!live) return;
        if ("error" in row) setCardErr(row.error);
        else setCard(row);
      })
      .catch(() => live && setCardErr("The card did not load."));
    return () => {
      live = false;
    };
  }, [mint]);

  if (picked) {
    return (
      <Ticket
        row={picked}
        card={card}
        cardErr={cardErr}
        fills={fills}
        usdSize={usdSize}
        onUsd={setUsdSize}
        onClose={() => setMint("")}
      />
    );
  }

  return (
    <section className="px-3 pb-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.18em] text-accent uppercase">Backpack Securities</p>
          <h2 className="mt-1 font-display text-2xl">Issued shares</h2>
        </div>
        <p className="font-mono text-[11px] text-white/40">{shown.length} live</p>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-white/45">Verified by Jupiter, including AAPL. A same-ticker copy is not here. Redemption stays with Backpack.</p>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search AAPL, NVDA, Tesla…" className="mt-3 min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm outline-none placeholder:text-white/30" />
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
        {RANKS.map((item) => (
          <button key={item.id} type="button" onClick={() => setRank(item.id)} className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold ${rank === item.id ? "bg-accent text-accent-fg" : "bg-white/8 text-white/70"}`}>
            {item.label}
          </button>
        ))}
      </div>
      {err ? <p className="mt-3 text-sm text-down">{err}</p> : null}
      {!rows.length && !err ? (
        <ul className="mt-3 space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </ul>
      ) : null}
      <ul className="mt-2 space-y-1.5">
        {shown.map((row) => {
          const bar = Math.max(6, (Math.abs(row.change) / span) * 100);
          const extra = rank === "liq" ? usd(row.liquidity) : rank === "vol" ? usd(row.volume) : rank === "mcap" ? usd(row.mcap) : row.name;
          return (
            <li key={row.mint}>
              <button type="button" onClick={() => setMint(row.mint)} className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.03] px-3 py-2.5 text-left active:bg-white/8">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display text-sm font-semibold ${tone(row.symbol)}`}>{row.symbol.slice(0, 2)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{row.symbol}</span>
                    <span className="font-mono text-sm tabular-nums">{px(row.price)}</span>
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/8">
                      <span className={`block h-full rounded-full ${row.change < 0 ? "bg-down" : "bg-accent"}`} style={{ width: `${bar}%` }} />
                    </span>
                    <span className={`shrink-0 font-mono text-[11px] tabular-nums ${row.change < 0 ? "text-down" : "text-accent"}`}>
                      {row.change ? `${row.change > 0 ? "+" : ""}${row.change.toFixed(2)}%` : "—"}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-white/35">{extra}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Ticket({
  row,
  card,
  cardErr,
  fills,
  usdSize,
  onUsd,
  onClose,
}: {
  row: BackpackRow;
  card: BackpackCard | null;
  cardErr: string;
  fills: number;
  usdSize: number;
  onUsd: (n: number) => void;
  onClose: () => void;
}) {
  const stats: { k: string; v: string }[] = card
    ? [
        { k: "Pool", v: usd(card.liquidity) },
        { k: "Volume", v: usd(card.volume) },
        { k: "Buys", v: card.buys.toLocaleString("en-US") },
        { k: "Sells", v: card.sells.toLocaleString("en-US") },
        { k: "Traders", v: card.traders.toLocaleString("en-US") },
        { k: "Cap", v: usd(card.mcap) },
        { k: "Diluted", v: usd(card.fdv) },
        { k: "Holders", v: card.holders.toLocaleString("en-US") },
        { k: "Supply", v: card.supply.toLocaleString("en-US", { maximumFractionDigits: 2 }) },
        { k: "Organic", v: card.organic == null ? "—" : `${card.organic.toFixed(1)} ${card.organicLabel || ""}`.trim() },
        { k: "Top holders", v: card.topHolders == null ? "—" : `${(card.topHolders <= 1 ? card.topHolders * 100 : card.topHolders).toFixed(1)}%` },
        { k: "Opened", v: card.poolCreated ? card.poolCreated.slice(0, 10) : "—" },
      ]
    : [];
  return (
    <section className="px-3 pb-6">
      <button type="button" onClick={onClose} className="min-h-10 text-sm font-semibold text-white/70">‹ Book</button>
      <div className="mt-1 flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.16em] text-white/40 uppercase">{row.name}</p>
          <h2 className="font-display text-4xl tabular-nums">{px(row.price)}</h2>
        </div>
        <span className={`rounded-full px-3 py-1 font-mono text-sm tabular-nums ${row.change < 0 ? "bg-down/15 text-down" : "bg-accent/15 text-accent"}`}>
          {row.change ? `${row.change > 0 ? "+" : ""}${row.change.toFixed(2)}%` : "—"}
        </span>
      </div>
      <p className="mt-1 text-xs text-white/40">{fills ? `${fills} signed in this browser` : "No trades on this token yet. The first real one starts here."}</p>
      {card ? (
        <div className="mt-4 grid grid-cols-3 gap-1.5">
          {stats.map((item) => (
            <div key={item.k} className="rounded-xl bg-white/[0.04] px-2.5 py-2">
              <p className="text-[10px] tracking-wide text-white/35 uppercase">{item.k}</p>
              <p className="mt-0.5 truncate font-mono text-xs tabular-nums">{item.v}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-white/45">{cardErr || "Reading the card…"}</p>
      )}
      {card ? (
        <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
          <p className="truncate rounded-xl bg-white/[0.04] px-2.5 py-2 text-white/50">Mint authority <span className="mt-0.5 block truncate font-mono text-white/80">{card.mintAuthority}</span></p>
          <p className="truncate rounded-xl bg-white/[0.04] px-2.5 py-2 text-white/50">Freeze authority <span className="mt-0.5 block truncate font-mono text-white/80">{card.freezeAuthority}</span></p>
        </div>
      ) : null}
      <p className="mt-2 break-all font-mono text-[10px] leading-relaxed text-white/30">{row.mint}</p>
      <div className="mt-4 flex gap-1.5">
        {SIZES.map((n) => (
          <button key={n} type="button" onClick={() => onUsd(n)} className={`min-h-10 flex-1 rounded-full font-mono text-xs ${usdSize === n ? "bg-white text-black" : "bg-white/8 text-white/70"}`}>
            ${n}
          </button>
        ))}
      </div>
      <label className="mt-2 block">
        <input inputMode="decimal" value={usdSize} onChange={(e) => onUsd(Math.max(1, Number(e.target.value) || 0))} className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-center font-mono text-2xl outline-none" />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <FillButton mint={row.mint} usd={usdSize} price={row.price} symbol={row.symbol} side="buy" label={`Buy $${usdSize}`} className="min-h-12 rounded-2xl bg-accent text-base font-semibold text-accent-fg" />
        <FillButton mint={row.mint} usd={usdSize} price={row.price || card?.price} symbol={row.symbol} side="sell" label="Sell" className="min-h-12 rounded-2xl bg-down/15 text-base font-semibold text-down" />
      </div>
    </section>
  );
}

/** Trade opens here. Shares Jupiter verifies, plus the PreStock pool sorted by real depth. */
export function TradeTerminal({ names }: { names: HouseListing[] }) {
  const [lane, setLane] = useState<"shares" | "pre">("shares");
  const [preId, setPreId] = useState("");
  const [usdSize, setUsdSize] = useState(25);
  const pres = [...names].filter((n) => n.venue === "prestocks" && n.last > 0).sort((a, b) => b.liquidity - a.liquidity);
  const pre = pres.find((n) => n.id === preId) ?? null;
  const maxPool = Math.max(...pres.map((row) => row.liquidity), 1);
  return (
    <div className="bg-[radial-gradient(600px_180px_at_100%_0%,rgb(214_255_74/0.08),transparent_55%)]">
      <div className="grid grid-cols-2 gap-1 px-3 pt-3">
        <button type="button" onClick={() => setLane("shares")} className={`min-h-11 rounded-2xl text-sm font-semibold ${lane === "shares" ? "bg-accent text-accent-fg" : "bg-white/6 text-white/60"}`}>Shares</button>
        <button type="button" onClick={() => setLane("pre")} className={`min-h-11 rounded-2xl text-sm font-semibold ${lane === "pre" ? "bg-accent text-accent-fg" : "bg-white/6 text-white/60"}`}>PreStocks</button>
      </div>
      {lane === "shares" ? (
        <div className="pt-3">
          <BackpackDesk />
        </div>
      ) : pre ? (
        <section className="px-3 pt-4 pb-6">
          <button type="button" onClick={() => setPreId("")} className="min-h-10 text-sm font-semibold text-white/70">‹ Depth</button>
          <p className="font-mono text-[10px] tracking-[0.16em] text-white/40 uppercase">{pre.name}</p>
          <h2 className="font-display text-4xl tabular-nums">{formatUsd(pre.last)}</h2>
          <p className="mt-1 text-xs text-white/40">
            Mark {pre.mark > 0 ? formatUsd(pre.mark) : "—"} · pool {pre.liquidity > 0 ? usd(pre.liquidity) : "—"}
            {pre.change24h == null ? "" : ` · ${pre.change24h > 0 ? "+" : ""}${(pre.change24h * 100).toFixed(2)}%`}
          </p>
          <p className="mt-2 break-all font-mono text-[10px] text-white/30">{pre.mint}</p>
          <div className="mt-4 flex gap-1.5">
            {SIZES.map((n) => (
              <button key={n} type="button" onClick={() => setUsdSize(n)} className={`min-h-10 flex-1 rounded-full font-mono text-xs ${usdSize === n ? "bg-white text-black" : "bg-white/8 text-white/70"}`}>
                ${n}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <FillButton mint={pre.mint} usd={usdSize} price={pre.last} symbol={pre.symbol} side="buy" label={`Buy $${usdSize}`} className="min-h-12 rounded-2xl bg-accent text-base font-semibold text-accent-fg" />
            <FillButton mint={pre.mint} usd={usdSize} price={pre.last} symbol={pre.symbol} side="sell" label="Sell" className="min-h-12 rounded-2xl bg-down/15 text-base font-semibold text-down" />
          </div>
        </section>
      ) : (
        <section className="px-3 pt-4 pb-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="font-mono text-[10px] tracking-[0.18em] text-accent uppercase">Pool depth</p>
              <h2 className="mt-1 font-display text-2xl">PreStocks</h2>
            </div>
            <p className="font-mono text-[11px] text-white/40">{pres.length}</p>
          </div>
          <p className="mt-1 text-xs text-white/45">Sorted by the real pool. Mark, last, and that pool. Not a best ask.</p>
          <ul className="mt-3 space-y-1.5">
            {pres.map((row) => (
              <li key={row.mint}>
                <button type="button" onClick={() => setPreId(row.id)} className="w-full rounded-2xl bg-white/[0.03] px-3 py-2.5 text-left active:bg-white/8">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{row.symbol}</span>
                    <span className="font-mono text-sm tabular-nums">{formatUsd(row.last)}</span>
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/8">
                      <span className="block h-full rounded-full bg-accent/80" style={{ width: `${Math.max(4, (row.liquidity / maxPool) * 100)}%` }} />
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-white/55">{row.liquidity > 0 ? usd(row.liquidity) : "—"}</span>
                  </span>
                  <span className="mt-0.5 flex justify-between text-[11px] text-white/35">
                    <span>Mark {row.mark > 0 ? formatUsd(row.mark) : "—"}</span>
                    <span className={row.change24h != null && row.change24h < 0 ? "text-down" : "text-accent"}>
                      {row.change24h == null ? "—" : `${row.change24h > 0 ? "+" : ""}${(row.change24h * 100).toFixed(2)}%`}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
