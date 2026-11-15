import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { kalshiPage, type KalshiRow } from "@/lib/kalshi-book";
import { outcomeForTicker, predictPage, signPrediction } from "@/lib/cash-predict";
import { CASH, signRoute } from "@/lib/jup-sign";
import { USDC } from "@/lib/jup-exec";
import { connectPhantom, liveSolAddress, splHolding } from "@/lib/phantom";
import { cn } from "@/lib/utils";

type Card = {
  id: string;
  title: string;
  category: string;
  close: string;
  vol: number;
  legs: KalshiRow[];
};

const SIZES = [5, 10, 25, 50, 100];
const PAYS = [
  { id: "CASH", mint: CASH, label: "Cash" },
  { id: "USDC", mint: USDC, label: "USDC" },
  { id: "USDT", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", label: "USDT" },
] as const;

function pct(n: number | null): number | null {
  if (n == null || !(n > 0) || n >= 1) return null;
  return Math.round(n * 100);
}

function yesPx(row: KalshiRow): number | null {
  return row.ask ?? row.last ?? row.bid;
}

function noPx(row: KalshiRow): number | null {
  if (row.noAsk != null) return row.noAsk;
  const yes = row.bid ?? row.last;
  return yes != null ? Math.round((1 - yes) * 100) / 100 : null;
}

function when(close: string): string {
  if (!close) return "";
  const day = new Date(`${close}T00:00:00`);
  if (Number.isNaN(day.getTime())) return close;
  if (day.toDateString() === new Date().toDateString()) return "Today";
  return day.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function sizeHedge(giveaway: number, price: number): { contracts: number; cost: number; payout: number } | null {
  if (!(giveaway > 0) || !(price > 0) || price >= 1) return null;
  const contracts = Math.ceil(giveaway);
  const cost = Math.ceil(contracts * price * 100) / 100;
  return { contracts, cost, payout: contracts };
}

function catLabel(id: string): string {
  if (id === "Science and Technology") return "Science";
  if (id === "Climate and Weather") return "Weather";
  if (id === "Entertainment") return "Culture";
  if (id === "Financials") return "Finance";
  if (id === "climate & science") return "Science";
  return id.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function vol(n: number): string {
  if (!(n > 0)) return "";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${Math.round(n)}`;
}

function Bar({ n }: { n: number | null }) {
  const w = n == null ? 0 : Math.max(4, Math.min(100, n));
  return (
    <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-border">
      <span className="block h-full rounded-full bg-up" style={{ width: `${w}%` }} />
    </span>
  );
}

function group(rows: KalshiRow[]): Card[] {
  const map = new Map<string, KalshiRow[]>();
  for (const row of rows) {
    const id = row.event || row.title;
    const list = map.get(id) ?? [];
    list.push(row);
    map.set(id, list);
  }
  return [...map.values()]
    .map((legs) => {
      const ranked = legs.slice().sort((a, b) => (yesPx(b) ?? 0) - (yesPx(a) ?? 0));
      return {
        id: ranked[0].event || ranked[0].ticker,
        title: ranked[0].title,
        category: ranked[0].category || "Markets",
        close: ranked.map((leg) => leg.close).filter(Boolean).sort()[0] || "",
        vol: Math.max(...ranked.map((leg) => leg.vol)),
        legs: ranked,
      };
    })
    .sort((a, b) => b.vol - a.vol);
}

export function KalshiTape() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [rows, setRows] = useState<KalshiRow[]>([]);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(false);
  const [cats, setCats] = useState<{ id: string; n: number }[]>([]);
  const [note, setNote] = useState("");
  const [eventId, setEventId] = useState<string | null>(null);
  const [pick, setPick] = useState<{ row: KalshiRow; side: "yes" | "no" } | null>(null);
  const [usd, setUsd] = useState(10);
  const [busy, setBusy] = useState(false);
  const [book, setBook] = useState<"cash" | "kalshi">("cash");
  const [sort, setSort] = useState<"hot" | "soon" | "chance">("hot");
  const [pageSize, setPageSize] = useState(60);
  const [tick, setTick] = useState(0);
  const [pay, setPay] = useState<(typeof PAYS)[number]["id"]>("CASH");
  const [payBal, setPayBal] = useState<number | null>(null);
  const [cover, setCover] = useState(false);
  const [coverRow, setCoverRow] = useState<KalshiRow | null>(null);
  const [coverSide, setCoverSide] = useState<"yes" | "no">("yes");
  const [give, setGive] = useState(100);
  const [promo, setPromo] = useState("");
  const [hedgeFor, setHedgeFor] = useState<{ give: number; promo: string } | null>(null);

  useEffect(() => {
    if (!pick) return;
    const owner = liveSolAddress();
    if (!owner) {
      setPayBal(null);
      return;
    }
    const mint = PAYS.find((row) => row.id === pay)?.mint ?? CASH;
    let live = true;
    splHolding(owner, mint).then((holding) => live && setPayBal(holding.ui)).catch(() => live && setPayBal(null));
    return () => {
      live = false;
    };
  }, [pick, pay]);

  useEffect(() => {
    if (done) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 3500);
    return () => window.clearInterval(id);
  }, [done, book]);

  useEffect(() => {
    let live = true;
    const handle = window.setTimeout(() => {
      const data = { q, category: cat, offset: 0, limit: pageSize };
      const pull = book === "cash" ? predictPage({ data }) : kalshiPage({ data });
      pull
        .then((page) => {
          if (!live) return;
          setRows(page.rows);
          setTotal(page.total);
          setDone(page.done);
          setCats(page.categories);
          setNote(page.rows.length ? "" : page.done ? "Nothing matched." : "");
        })
        .catch(() => live && setNote(book === "cash" ? "The book did not answer." : "Kalshi did not answer."));
    }, q ? 280 : 0);
    return () => {
      live = false;
      window.clearTimeout(handle);
    };
  }, [q, cat, book, pageSize, tick]);

  const cards = useMemo(() => group(rows), [rows]);
  const ordered = useMemo(() => {
    const list = cards.slice();
    if (sort === "soon") list.sort((a, b) => (a.close || "9999").localeCompare(b.close || "9999") || b.vol - a.vol);
    else if (sort === "chance") list.sort((a, b) => (pct(yesPx(b.legs[0])) ?? 0) - (pct(yesPx(a.legs[0])) ?? 0));
    return list;
  }, [cards, sort]);
  const open = ordered.find((card) => card.id === eventId) ?? cards.find((card) => card.id === eventId) ?? null;
  const featured = !q && !cat && sort === "hot" ? ordered.filter((card) => card.legs.length === 1).slice(0, 6) : [];
  const featuredIds = new Set(featured.map((card) => card.id));
  const rest = featured.length ? ordered.filter((card) => !featuredIds.has(card.id)) : ordered;
  const price = pick ? (pick.side === "yes" ? yesPx(pick.row) : noPx(pick.row)) : null;
  const cents = price != null ? Math.round(price * 100) : 0;
  const contracts = price && price > 0 ? Math.max(1, Math.floor(usd / price)) : 0;
  const payout = contracts;

  function choose(row: KalshiRow, side: "yes" | "no") {
    const px = side === "yes" ? yesPx(row) : noPx(row);
    if (px == null) {
      toast.error("No price on that side.");
      return;
    }
    setHedgeFor(null);
    setPick({ row, side });
    setEventId(null);
  }

  async function confirm() {
    if (!pick || !price || !(usd > 0)) return;
    setBusy(true);
    try {
      const owner = await connectPhantom();
      const payMint = PAYS.find((row) => row.id === pay)?.mint ?? CASH;
      if (book === "cash") {
        const signed = await signPrediction({
          owner,
          marketId: pick.row.ticker,
          isYes: pick.side === "yes",
          usd,
          mint: payMint,
        });
        toast.success(`Phantom signed. solscan.io/tx/${signed.signature}`);
        setPick(null);
        return;
      }
      const out = await outcomeForTicker(pick.row.event || pick.row.ticker, pick.row.ticker, pick.side);
      const signed = await signRoute({
        owner,
        inputMint: payMint,
        outputMint: out,
        amountRaw: Math.round(usd * 1e6),
        outDecimals: 6,
        usd,
      });
      toast.success(`Phantom signed. solscan.io/tx/${signed.signature}`);
      setPick(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The wallet did not sign.");
    } finally {
      setBusy(false);
    }
  }

  if (pick && price) {
    const name = pick.row.yes || pick.row.title;
    const yes = pick.side === "yes";
    return (
      <div className="flex min-h-[70vh] flex-col bg-bg px-4 pt-3 text-fg">
        <button type="button" onClick={() => { setPick(null); setHedgeFor(null); }} className="min-h-11 self-start text-sm text-muted">
          Back
        </button>
        <p className={cn("mt-8 text-center text-sm font-semibold", yes ? "text-up" : "text-down")}>{yes ? "Yes" : "No"}</p>
        <p className="mt-1 text-center font-display text-7xl tracking-tight">{cents}¢</p>
        <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-relaxed text-muted">{name}</p>
        <p className="mt-4 text-center text-base">
          {money(usd)} buys about <span className="text-up">{money(payout)}</span> if this hits
        </p>
        {hedgeFor ? (
          <p className="mx-auto mt-3 max-w-sm text-center text-sm text-subtle">
            Covers a {money(hedgeFor.give)} giveaway{hedgeFor.promo ? ` · ${hedgeFor.promo}` : ""}. If it misses, you do not give it away.
          </p>
        ) : null}
        <label className="mt-8 block">
          <span className="text-xs text-subtle">Spend</span>
          <input
            inputMode="decimal"
            aria-label="Dollars to spend"
            value={String(usd)}
            onChange={(e) => setUsd(Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0))}
            className="mt-1 min-h-12 w-full rounded-2xl bg-surface px-4 font-mono text-lg outline-none"
          />
        </label>
        <div className="mt-3 flex justify-center gap-2">
          {SIZES.map((n) => (
            <button key={n} type="button" onClick={() => setUsd(n)} className={cn("min-h-10 flex-1 rounded-full font-mono text-sm", usd === n ? "bg-fg text-bg" : "bg-elevated text-muted")}>
              ${n}
            </button>
          ))}
        </div>
        <div className="mt-auto space-y-3 pb-4">
          <p className="text-xs text-subtle">Pay with</p>
          <div className="flex gap-2">
            {PAYS.map((row) => (
              <button key={row.id} type="button" onClick={() => setPay(row.id)} className={cn("min-h-11 flex-1 rounded-full text-sm font-semibold", pay === row.id ? "bg-fg text-bg" : "bg-elevated text-muted")}>
                {row.label}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted">{payBal == null ? "Phantom shows the balance once it is connected." : `${payBal.toFixed(2)} ${pay} in this wallet`}</p>
          <p className="text-xs leading-relaxed text-subtle">Phantom signs this amount. Nothing moves until the signature lands.</p>
          <button type="button" disabled={busy || !(usd > 0)} onClick={() => void confirm()} className="min-h-12 w-full rounded-full bg-accent text-base font-semibold text-accent-fg disabled:opacity-50">
            {busy ? "Waiting for Phantom…" : `Buy ${yes ? "Yes" : "No"} · ${money(usd)}`}
          </button>
        </div>
      </div>
    );
  }

  const coverPx = coverRow ? (coverSide === "yes" ? yesPx(coverRow) : noPx(coverRow)) : null;
  const sized = coverPx != null ? sizeHedge(give, coverPx) : null;

  function armHedge() {
    if (!coverRow || !sized) {
      toast.error("That side has no price.");
      return;
    }
    setHedgeFor({ give, promo: promo.trim() });
    setUsd(sized.cost);
    setCover(false);
    setPick({ row: coverRow, side: coverSide });
  }

  if (cover) {
    return (
      <div className="bg-bg px-4 pt-4 pb-8 text-fg">
        <button type="button" onClick={() => { setCover(false); setCoverRow(null); }} className="min-h-11 text-sm text-muted">
          Back
        </button>
        <h1 className="mt-2 text-3xl">Cover a giveaway</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Buy the side that pays if you have to give the product away. You only spend the price of that side.
        </p>
        {!coverRow ? (
          <>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Eagles, a game, a city"
              aria-label="Search a market to cover"
              className="mt-4 min-h-11 w-full rounded-full bg-surface px-4 text-sm outline-none"
            />
            <ul className="mt-3 divide-y divide-border">
              {ordered.slice(0, 16).flatMap((card) => card.legs.slice(0, 3).map((leg) => (
                <li key={leg.ticker}>
                  <button type="button" onClick={() => { setCoverRow(leg); setCoverSide("yes"); }} className="flex min-h-14 w-full items-center justify-between gap-3 text-left">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{leg.yes || card.title}</span>
                      <span className="block truncate text-xs text-subtle">{card.title === (leg.yes || card.title) ? catLabel(card.category) : card.title}</span>
                    </span>
                    <span className="shrink-0 font-mono text-sm text-up">{pct(yesPx(leg)) == null ? "—" : `${pct(yesPx(leg))}¢`}</span>
                  </button>
                </li>
              )))}
              {ordered.length === 0 ? <li className="py-8 text-sm text-muted">{note || "No market matched."}</li> : null}
            </ul>
          </>
        ) : (
          <div className="mt-5">
            <button type="button" onClick={() => setCoverRow(null)} className="text-xs text-subtle">Change market</button>
            <h2 className="mt-1 text-xl leading-tight">{coverRow.title}</h2>
            <p className="mt-1 text-sm text-subtle">{coverRow.yes || "Yes"} · {catLabel(coverRow.category)}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(["yes", "no"] as const).map((side) => {
                const px = side === "yes" ? yesPx(coverRow) : noPx(coverRow);
                const on = coverSide === side;
                return (
                  <button key={side} type="button" onClick={() => setCoverSide(side)} className={cn("min-h-14 rounded-2xl px-3 text-left", on ? "bg-fg text-bg" : "bg-surface text-fg")}>
                    <span className="block text-xs uppercase tracking-wide opacity-60">{side}</span>
                    <span className="font-mono text-lg">{px == null ? "—" : `${Math.round(px * 100)}¢`}</span>
                  </button>
                );
              })}
            </div>
            <label className="mt-4 block">
              <span className="text-xs text-subtle">What the giveaway costs if this hits</span>
              <input
                inputMode="decimal"
                value={String(give)}
                onChange={(e) => setGive(Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, "")) || 0))}
                className="mt-1 min-h-12 w-full rounded-2xl bg-surface px-4 font-mono text-lg outline-none"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-xs text-subtle">What you’re giving away</span>
              <input
                value={promo}
                onChange={(e) => setPromo(e.target.value.slice(0, 80))}
                placeholder="Free hoagies"
                className="mt-1 min-h-11 w-full rounded-2xl bg-surface px-4 text-sm outline-none"
              />
            </label>
            <div className="mt-4 space-y-2 rounded-2xl bg-surface p-4 text-sm">
              <div className="flex justify-between gap-3"><span className="text-muted">You pay now</span><span className="font-mono">{sized ? money(sized.cost) : "—"}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted">Pays if it hits</span><span className="font-mono text-up">{sized ? money(sized.payout) : "—"}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted">If it misses</span><span className="text-right text-subtle">No giveaway. The hedge is spent.</span></div>
            </div>
            <button type="button" disabled={!sized} onClick={armHedge} className="mt-4 min-h-12 w-full rounded-full bg-accent text-base font-semibold text-accent-fg disabled:opacity-40">
              {sized ? `Hedge ${money(sized.cost)}` : "No price on that side"}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-bg text-fg">
      <div className="px-4 pt-4">
        <div className="flex items-end justify-between gap-3">
          <h1 className="text-3xl">Predict</h1>
          <button type="button" onClick={() => setCover(true)} className="mb-1 min-h-9 rounded-full bg-accent px-3 text-sm font-semibold text-accent-fg">
            Cover
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">Live prices. Phantom signs every buy.</p>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-surface p-1">
          {(["cash", "kalshi"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => { setBook(id); setEventId(null); setPick(null); setPageSize(60); setDone(false); setCat(""); }}
              className={cn("min-h-9 rounded-full text-sm font-semibold", book === id ? "bg-fg text-bg" : "text-muted")}
            >
              {id === "cash" ? "Solana" : "Kalshi"}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setEventId(null); }}
          placeholder="Search markets"
          aria-label="Search markets"
          className="mt-3 min-h-11 w-full rounded-full bg-surface px-4 text-sm outline-none"
        />
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-surface p-1">
          {(["hot", "soon", "chance"] as const).map((id) => (
            <button key={id} type="button" onClick={() => setSort(id)} className={cn("min-h-9 rounded-full text-sm font-semibold", sort === id ? "bg-fg text-bg" : "text-muted")}>
              {id === "soon" ? "Closing" : id === "chance" ? "Chance" : "Hot"}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          <button type="button" onClick={() => { setCat(""); setEventId(null); }} className={cn("min-h-9 shrink-0 rounded-full px-3 text-sm font-semibold", cat === "" ? "bg-fg text-bg" : "bg-surface text-muted")}>
            All
          </button>
          {cats.slice(0, 18).map((c) => (
            <button key={c.id} type="button" onClick={() => { setCat(c.id); setEventId(null); }} className={cn("min-h-9 shrink-0 rounded-full px-3 text-sm font-semibold", cat === c.id ? "bg-fg text-bg" : "bg-surface text-muted")}>
              {catLabel(c.id)}
            </button>
          ))}
        </div>
        {note || !done ? <p className="mt-2 text-xs text-subtle">{note || "Loading more markets"}</p> : null}
      </div>

      {open ? (
        <div className="px-4 pt-2 pb-8">
          <button type="button" onClick={() => setEventId(null)} className="min-h-11 text-sm text-muted">Back</button>
          <p className="mt-2 text-xs text-subtle">{catLabel(open.category)} · {when(open.close) || "Open"} · {vol(open.vol)}</p>
          <h2 className="mt-1 text-2xl leading-tight">{open.title}</h2>
          <ul className="mt-4 space-y-3">
            {open.legs.map((leg) => {
              const yes = pct(yesPx(leg));
              const no = pct(noPx(leg));
              return (
                <li key={leg.ticker} className="rounded-3xl bg-surface p-4">
                  <p className="text-sm font-semibold">{leg.yes || leg.title}</p>
                  <Bar n={yes} />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => choose(leg, "yes")} className="min-h-12 rounded-2xl bg-up text-sm font-semibold text-up-fg">
                      Yes {yes == null ? "" : `${yes}¢`}
                    </button>
                    <button type="button" onClick={() => choose(leg, "no")} className="min-h-12 rounded-2xl bg-down text-sm font-semibold text-down-fg">
                      No {no == null ? "" : `${no}¢`}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : rows.length === 0 && !note ? (
        <ul className="mt-4 space-y-3 px-4">
          {[0, 1, 2].map((i) => <li key={i} className="h-36 animate-pulse rounded-3xl bg-surface" />)}
        </ul>
      ) : (
        <>
          {featured.length ? (
            <div className="mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {featured.map((card) => {
                const yes = pct(yesPx(card.legs[0]));
                return (
                  <button key={card.id} type="button" onClick={() => setEventId(card.id)} className="w-40 shrink-0 rounded-3xl bg-surface p-3 text-left">
                    <span className="line-clamp-3 min-h-14 text-sm font-semibold leading-snug">{card.title}</span>
                    <span className="mt-3 block font-display text-3xl text-up">{yes == null ? "—" : `${yes}%`}</span>
                    <span className="text-xs text-subtle">{vol(card.vol) || "Open"}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
          <ul className="mt-4 space-y-3 px-4 pb-6">
            {rest.map((card) => {
              const binary = card.legs.length === 1 ? card.legs[0] : null;
              const yes = binary ? pct(yesPx(binary)) : null;
              const no = binary ? pct(noPx(binary)) : null;
              return (
                <li key={card.id} className="rounded-3xl bg-surface p-4">
                  <button type="button" onClick={() => setEventId(card.id)} className="w-full text-left">
                    <span className="flex items-center justify-between text-xs text-subtle">
                      <span>{catLabel(card.category)}</span>
                      <span>{[when(card.close), vol(card.vol)].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="mt-2 block text-base font-semibold leading-snug">{card.title}</span>
                    {binary ? <Bar n={yes} /> : null}
                  </button>
                  {binary ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => choose(binary, "yes")} className="min-h-12 rounded-2xl bg-up text-sm font-semibold text-up-fg">
                        Yes {yes == null ? "" : `${yes}¢`}
                      </button>
                      <button type="button" onClick={() => choose(binary, "no")} className="min-h-12 rounded-2xl bg-down text-sm font-semibold text-down-fg">
                        No {no == null ? "" : `${no}¢`}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {card.legs.slice(0, 3).map((leg) => {
                        const px = pct(yesPx(leg));
                        return (
                          <div key={leg.ticker} className="flex items-center gap-2">
                            <button type="button" onClick={() => setEventId(card.id)} className="min-w-0 flex-1 text-left">
                              <span className="block truncate text-sm">{leg.yes || leg.title}</span>
                              <Bar n={px} />
                            </button>
                            <button type="button" onClick={() => choose(leg, "yes")} className="min-h-11 shrink-0 rounded-full bg-up px-3 text-sm font-semibold text-up-fg">
                              {px == null ? "Yes" : `${px}¢`}
                            </button>
                          </div>
                        );
                      })}
                      {card.legs.length > 3 ? (
                        <button type="button" onClick={() => setEventId(card.id)} className="min-h-10 text-sm text-muted">
                          {card.legs.length} contracts
                        </button>
                      ) : null}
                    </div>
                  )}
                </li>
              );
            })}
            {rest.length === 0 && featured.length === 0 ? <li className="py-8 text-sm text-muted">{note || "Nothing matched."}</li> : null}
          </ul>
          {rows.length < total || !done ? (
            <button type="button" onClick={() => setPageSize((n) => n + 60)} className="mx-4 mb-8 min-h-11 w-[calc(100%-2rem)] rounded-full border border-border text-sm font-semibold">
              Show more
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
