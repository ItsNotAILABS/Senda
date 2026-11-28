import { useEffect, useMemo, useState } from "react";
import { BookEcho } from "@/components/book-echo";
import { DepthSlot } from "@/components/depth-ladder";
import { polyPage, type PolyRow } from "@/lib/poly-book";
import { takePredictQuery } from "@/lib/predict-query";
import { cn } from "@/lib/utils";

type Card = {
  id: string;
  title: string;
  category: string;
  close: string;
  vol: number;
  liq: number;
  slug: string;
  legs: PolyRow[];
};

function pct(n: number | null): number | null {
  if (n == null || !(n > 0) || n >= 1) return null;
  return Math.round(n * 100);
}

function yesPx(row: PolyRow): number | null {
  return row.last ?? row.bid;
}

function when(close: string): string {
  if (!close) return "";
  const day = new Date(`${close}T00:00:00`);
  if (Number.isNaN(day.getTime())) return close;
  if (day.toDateString() === new Date().toDateString()) return "Today";
  return day.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function shift(n: number | null) {
  if (n == null || Math.abs(n) < 0.005) return null;
  const cents = Math.round(n * 100);
  return (
    <span className={cn("font-mono text-xs", cents > 0 ? "text-up" : "text-down")}>
      {cents > 0 ? "+" : ""}
      {cents}¢
    </span>
  );
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

function group(rows: PolyRow[]): Card[] {
  const map = new Map<string, PolyRow[]>();
  for (const row of rows) {
    const id = row.eventId || row.title;
    const list = map.get(id) ?? [];
    list.push(row);
    map.set(id, list);
  }
  return [...map.values()]
    .map((legs) => {
      const ranked = legs.slice().sort((a, b) => (yesPx(b) ?? 0) - (yesPx(a) ?? 0));
      const head = ranked[0];
      return {
        id: head.eventId || head.id,
        title: head.title,
        category: head.category || "Markets",
        close: ranked.map((leg) => leg.close).filter(Boolean).sort()[0] || "",
        vol: Math.max(...ranked.map((leg) => leg.vol)),
        liq: head.eventLiq || Math.max(...ranked.map((leg) => leg.liq)),
        slug: head.eventSlug || head.slug,
        legs: ranked,
      };
    })
    .sort((a, b) => b.vol - a.vol);
}

export function PolyTape() {
  const [q, setQ] = useState("");
  const [booted, setBooted] = useState(false);
  const [cat, setCat] = useState("");
  const [rows, setRows] = useState<PolyRow[]>([]);
  const [more, setMore] = useState(false);
  const [note, setNote] = useState("");
  const [sort, setSort] = useState<"hot" | "soon" | "chance">("hot");
  const [eventId, setEventId] = useState<string | null>(null);
  const [legId, setLegId] = useState<string | null>(null);
  const [skip, setSkip] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const saved = takePredictQuery();
    if (saved) setQ(saved);
    setBooted(true);
  }, []);

  useEffect(() => {
    if (!booted) return;
    let live = true;
    const handle = window.setTimeout(() => {
      polyPage({ data: { q, offset: 0 } })
        .then((page) => {
          if (!live) return;
          setRows(page.rows);
          setSkip(0);
          setMore(page.more);
          setNote(page.rows.length ? "" : "Nothing matched.");
        })
        .catch(() => live && setNote("Polymarket did not answer."));
    }, q ? 280 : 0);
    return () => {
      live = false;
      window.clearTimeout(handle);
    };
  }, [q, booted, tick]);

  useEffect(() => {
    if (skip > 0) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 20_000);
    return () => window.clearInterval(id);
  }, [skip]);

  function next() {
    const nextSkip = skip + 40;
    polyPage({ data: { offset: nextSkip } })
      .then((page) => {
        setSkip(nextSkip);
        setRows((cur) => [...cur, ...page.rows]);
        setMore(page.more);
      })
      .catch(() => setNote("Polymarket did not answer."));
  }

  const cats = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) map.set(row.category || "Markets", (map.get(row.category || "Markets") ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  }, [rows]);

  const cards = useMemo(() => {
    const filtered = cat ? rows.filter((row) => row.category === cat) : rows;
    const list = group(filtered);
    if (sort === "soon") list.sort((a, b) => (a.close || "9999").localeCompare(b.close || "9999") || b.vol - a.vol);
    else if (sort === "chance") list.sort((a, b) => (pct(yesPx(b.legs[0])) ?? 0) - (pct(yesPx(a.legs[0])) ?? 0));
    return list;
  }, [rows, cat, sort]);

  const open = cards.find((card) => card.id === eventId) ?? null;
  const featured = !q && !cat && sort === "hot" ? cards.filter((card) => card.legs.length === 1).slice(0, 6) : [];
  const featuredIds = new Set(featured.map((card) => card.id));
  const rest = featured.length ? cards.filter((card) => !featuredIds.has(card.id)) : cards;

  return (
    <div className="bg-bg text-fg">
      <div className="px-4 pt-4">
        <h1 className="text-3xl">Polymarket</h1>
        <p className="mt-1 text-sm text-muted">Live yes-prices, the public ladder, and pool size. Senda does not hold the contract. The trade opens on their site.</p>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setEventId(null);
          }}
          placeholder="Search Polymarket"
          aria-label="Search Polymarket"
          className="mt-3 min-h-11 w-full rounded-full bg-surface px-4 text-sm outline-none"
        />
        <BookEcho q={q} from="poly" />
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
          {cats.slice(0, 12).map((id) => (
            <button key={id} type="button" onClick={() => { setCat(id); setEventId(null); }} className={cn("min-h-9 shrink-0 rounded-full px-3 text-sm font-semibold", cat === id ? "bg-fg text-bg" : "bg-surface text-muted")}>
              {id}
            </button>
          ))}
        </div>
        {note ? <p className="mt-2 text-xs text-subtle">{note}</p> : null}
      </div>

      {open ? (
        <div className="px-4 pt-2 pb-8">
          <button type="button" onClick={() => setEventId(null)} className="min-h-11 text-sm text-muted">Back</button>
          <p className="mt-2 text-xs text-subtle">{[open.category, when(open.close) || "Open", vol(open.vol), open.liq ? `pool ${vol(open.liq)}` : ""].filter(Boolean).join(" · ")}</p>
          <h2 className="mt-1 text-2xl leading-tight">{open.title}</h2>
          {(() => {
            const focus = open.legs.find((leg) => leg.id === legId) ?? open.legs[0];
            return focus ? <DepthSlot venue="poly" id={focus.yesToken} label={focus.question || focus.title} /> : null;
          })()}
          <ul className="mt-4 space-y-3">
            {open.legs.map((leg) => {
              const yes = pct(yesPx(leg));
              const no = yes == null ? null : 100 - yes;
              const spread = leg.bid != null && leg.ask != null && leg.ask >= leg.bid ? Math.round((leg.ask - leg.bid) * 100) : 0;
              return (
                <li key={leg.id} className="rounded-3xl bg-surface p-4">
                  <button type="button" onClick={() => setLegId(leg.id)} className="w-full text-left">
                    <p className="text-sm font-semibold">{leg.question || leg.title}</p>
                    <Bar n={yes} />
                    <p className="mt-2 text-xs text-subtle">
                      Yes {yes == null ? "—" : `${yes}¢`}
                      {no == null ? "" : ` · No ${no}¢ is the complement, not their no book`}
                      {spread > 0 ? ` · ${spread}¢ spread` : ""}
                      {shift(leg.change) ? " · " : ""}
                      {shift(leg.change)}
                    </p>
                  </button>
                  <a
                    href={`https://polymarket.com/event/${leg.slug || open.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 flex min-h-12 items-center justify-center rounded-2xl bg-fg text-sm font-semibold text-bg"
                  >
                    Trade on Polymarket
                  </a>
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
                    <span className="mt-1 flex items-center gap-2 text-xs text-subtle">
                      <span>{vol(card.vol) || "Open"}</span>
                      {shift(card.legs[0].change)}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
          <ul className="mt-4 space-y-3 px-4 pb-6">
            {rest.map((card) => {
              const binary = card.legs.length === 1 ? card.legs[0] : null;
              const yes = binary ? pct(yesPx(binary)) : null;
              return (
                <li key={card.id} className="rounded-3xl bg-surface p-4">
                  <button type="button" onClick={() => setEventId(card.id)} className="w-full text-left">
                    <span className="flex items-center justify-between gap-2 text-xs text-subtle">
                      <span className="truncate">{card.category}</span>
                      <span className="max-w-[58%] shrink-0 truncate text-right">{[when(card.close), vol(card.vol), card.liq ? `pool ${vol(card.liq)}` : ""].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="mt-2 block text-base font-semibold leading-snug">{card.title}</span>
                    {binary ? <Bar n={yes} /> : null}
                  </button>
                  {binary ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setEventId(card.id)} className="flex min-h-12 items-center justify-center rounded-2xl bg-up text-sm font-semibold text-up-fg">
                        Yes {yes == null ? "" : `${yes}¢`}
                      </button>
                      <a
                        href={`https://polymarket.com/event/${card.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-h-12 items-center justify-center rounded-2xl bg-fg text-sm font-semibold text-bg"
                      >
                        Trade there
                      </a>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {card.legs.slice(0, 3).map((leg) => {
                        const px = pct(yesPx(leg));
                        const label = leg.question || "";
                        if (!label) return null;
                        return (
                          <button key={leg.id} type="button" onClick={() => setEventId(card.id)} className="flex min-h-11 w-full items-center gap-2 text-left">
                            <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
                            <span className="font-mono text-sm text-up">{px == null ? "—" : `${px}¢`}</span>
                          </button>
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
            {rest.length === 0 ? <li className="py-8 text-sm text-muted">{note || "Nothing matched."}</li> : null}
          </ul>
          {more && !q ? (
            <button type="button" onClick={next} className="mx-4 mb-8 min-h-11 w-[calc(100%-2rem)] rounded-full border border-border text-sm font-semibold">
              Show more
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
