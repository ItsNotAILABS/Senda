import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FillCard } from "@/components/fill-card";
import { DayChart, MarkChart } from "@/components/mark-chart";
import { hlBook, hlCash, hlPositions, hlRange, type HlCash, type HlKind, type HlMarket, type HlPosition } from "@/lib/hl-book";
import { dayChange, impliedValue, markText, privateBooks, type DayBar } from "@/lib/hl-private";
import { hlAccount, hlClose, hlFund, hlOpen, hlUnify } from "@/lib/hl-sign";
import { noteAct } from "@/lib/book";
import { cn } from "@/lib/utils";

const KINDS: Array<[HlKind | "all", string]> = [
  ["all", "All"],
  ["private", "Private"],
  ["crypto", "Crypto"],
  ["stock", "Stocks"],
  ["commodity", "Gold & oil"],
  ["fx", "FX"],
  ["index", "Indexes"],
];

function money(n: number): string {
  if (!(n > 0)) return "—";
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
  return `$${n.toPrecision(4)}`;
}

function heroPrice(mark: number, unit: HlMarket["unit"]): string {
  if (!(mark > 0)) return "—";
  if (unit === "valuation") return markText(mark, unit);
  return `$${mark.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
}

function chipLabel(row: HlMarket): string {
  if (row.id === "xyz:ANT") return "Share";
  if (row.id === "para:ANTH") return "Other share";
  if (row.id === "io:ANTH") return "Value";
  if (row.id === "io:OAI") return "OpenAI";
  if (row.id === "vntl:SPACEX") return "SpaceX";
  if (row.dex === "vntl") return `${row.company}, quiet`;
  return row.company;
}

export function HlTicket({ start = "all" }: { start?: HlKind | "all" }) {
  const [book, setBook] = useState<HlMarket[]>([]);
  const [kind, setKind] = useState<HlKind | "all">(start);
  useEffect(() => {
    if (start === "private") setKind("private");
  }, [start]);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState("");
  const [open, setOpen] = useState(false);
  const [margin, setMargin] = useState("10");
  const [lev, setLev] = useState(5);
  const [busy, setBusy] = useState(false);
  const [who, setWho] = useState("");
  const [cash, setCash] = useState<HlCash | null>(null);
  const [sort, setSort] = useState<"volume" | "move" | "name">("volume");
  const [dex, setDex] = useState("all");
  const [positions, setPositions] = useState<HlPosition[]>([]);
  const [fill, setFill] = useState<{ title: string; symbol: string; amount: string; paid: string; received: string; sig: string } | null>(null);
  const [trail, setTrail] = useState<Record<string, number[]>>({});
  const [range, setRange] = useState<DayBar | null>(null);
  const [feature, setFeature] = useState("xyz:ANT");
  const [day, setDay] = useState<(DayBar & { id: string }) | null>(null);

  useEffect(() => {
    let live = true;
    const pull = () =>
      hlBook()
        .then((rows) => {
          if (!live) return;
          setBook(rows);
          setTrail((cur) => {
            const next = { ...cur };
            for (const row of rows) {
              if (!(row.mark > 0)) continue;
              const prev = next[row.id] ?? [];
              const last = prev[prev.length - 1];
              next[row.id] = last === row.mark ? prev : [...prev, row.mark].slice(-48);
            }
            return next;
          });
        })
        .catch(() => undefined);
    void pull();
    const id = window.setInterval(pull, 20_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!who) return;
    let live = true;
    hlPositions({ data: { user: who } }).then((rows) => live && setPositions(rows)).catch(() => undefined);
    hlCash({ data: { user: who } }).then((row) => live && setCash(row)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [who, busy]);

  const dexes = useMemo(() => ["all", ...Array.from(new Set(book.map((row) => row.dex || "hyperliquid")))], [book]);
  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    const rows = book
      .filter((row) => kind === "all" || row.kind === kind)
      .filter((row) => dex === "all" || (row.dex || "hyperliquid") === dex)
      .filter((row) => !query || row.label.toLowerCase().includes(query) || row.id.toLowerCase().includes(query) || row.company.toLowerCase().includes(query));
    if (sort === "name") rows.sort((a, b) => a.label.localeCompare(b.label));
    else if (sort === "move") rows.sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0));
    else rows.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
    return rows;
  }, [book, kind, q, sort, dex]);
  const market = book.find((row) => row.id === pick) ?? null;
  const order = useMemo(() => new Map(privateBooks().map((row, i) => [row.id, i])), []);
  const privates = useMemo(
    () => book.filter((row) => order.has(row.id)).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)),
    [book, order],
  );
  const hero = privates.find((row) => row.id === feature) ?? privates[0] ?? null;
  const value = privates.find((row) => row.id === "io:ANTH") ?? null;
  const marginN = Number(margin);
  const maxLev = market ? Math.min(40, market.maxLeverage) : 20;

  useEffect(() => {
    if (!open || !pick) {
      setRange(null);
      return;
    }
    let live = true;
    setRange(null);
    hlRange({ data: { coin: pick } })
      .then((row) => live && setRange(row))
      .catch(() => live && setRange(null));
    return () => {
      live = false;
    };
  }, [open, pick]);

  useEffect(() => {
    const id = hero?.id;
    if (!id) return;
    let live = true;
    hlRange({ data: { coin: id } })
      .then((row) => {
        if (live) setDay(row ? { id, ...row } : { id, high: 0, low: 0, points: [] });
      })
      .catch(() => {
        if (live) setDay(null);
      });
    return () => {
      live = false;
    };
  }, [hero?.id]);

  async function account() {
    const address = who || (await hlAccount());
    if (!who) setWho(address);
    return address;
  }

  async function trade(side: "long" | "short") {
    if (!market) return;
    if (!(marginN > 0)) {
      toast.error("Enter a margin.");
      return;
    }
    setBusy(true);
    try {
      const address = await account();
      const purse = cash ?? (await hlCash({ data: { user: address } }));
      setCash(purse);
      if (market.dex && purse.abstraction !== "unifiedAccount" && purse.abstraction !== "portfolioMargin") {
        await hlUnify(address);
      }
      if (purse.perp + 0.01 < marginN) {
        const need = Math.ceil((marginN - purse.perp) * 100) / 100;
        if (purse.spot + 0.01 < need) {
          throw new Error(`The perp account has $${purse.perp.toFixed(2)}. Spot USDC on Hyperliquid is $${purse.spot.toFixed(2)}. This order needs $${marginN.toFixed(2)} there. USDC on Solana is a different balance.`);
        }
        await hlFund(need);
      }
      const done = await hlOpen({
        asset: market.asset,
        side,
        margin: marginN,
        leverage: Math.min(lev, maxLev),
        mark: market.mark,
        szDecimals: market.szDecimals,
      });
      noteAct({
        kind: "swap",
        title: `${side} ${market.label} ${Math.min(lev, maxLev)}x`,
        detail: `$${marginN} margin · Hyperliquid`,
        signature: done.oid,
      });
      setFill({
        title: `${side === "long" ? "Long" : "Short"} ${market.label}`,
        symbol: market.label,
        amount: `$${marginN}`,
        paid: `$${marginN} USDC margin`,
        received: done.filled && done.filled !== "0" ? `${done.filled} @ ${done.avg}` : "Resting on the book",
        sig: done.oid,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The order did not send.");
    } finally {
      setBusy(false);
    }
  }

  async function close(row: HlPosition) {
    const match = book.find((m) => m.id === row.coin || m.label === row.coin || `${m.dex}:${m.label}` === row.coin);
    if (!match) {
      toast.error("That market is not on the book right now.");
      return;
    }
    setBusy(true);
    try {
      const done = await hlClose({
        asset: match.asset,
        side: row.side,
        size: row.size,
        mark: match.mark || row.entry,
        szDecimals: match.szDecimals,
      });
      setFill({
        title: `Closed ${row.coin}`,
        symbol: match.label,
        amount: row.pnl >= 0 ? `+$${row.pnl.toFixed(2)}` : `−$${Math.abs(row.pnl).toFixed(2)}`,
        paid: `${row.side} ${row.size}`,
        received: "Closed on Hyperliquid",
        sig: done.oid,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The close did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {fill ? (
        <FillCard
          title={fill.title}
          symbol={fill.symbol}
          amount={fill.amount}
          paid={fill.paid}
          received={fill.received}
          where="Hyperliquid"
          when="Just now"
          sig={fill.sig}
          onDone={() => setFill(null)}
        />
      ) : null}
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-black">24/7</span>
        <span className="rounded-full bg-[#2a2a2e] px-3 py-1 text-xs font-semibold">Crypto · stocks · private · gold · FX</span>
        <span className="rounded-full bg-[#2a2a2e] px-3 py-1 text-xs font-semibold">No expiry</span>
      </div>
      <p className="text-sm text-white/60">
        {book.length
          ? kind === "private"
            ? `${shown.length} private names. ${book.length} markets on the book.`
            : `${book.length} markets.`
          : "Loading the book."}{" "}
        Long or short. A private name is not a share of the company. Hyperliquid clears the order. Senda does not hold the margin, and you can lose it. A US or UK address is refused. The USDC has to already be on that account. Solana USDC is a different balance.
      </p>
      <button
        type="button"
        onClick={() => void account().catch((e) => toast.error(e instanceof Error ? e.message : "Phantom did not open."))}
        className="min-h-10 rounded-full bg-[#2a2a2e] px-4 text-sm font-semibold"
      >
        {who ? `${who.slice(0, 6)}…${who.slice(-4)} · perp $${(cash?.perp ?? 0).toFixed(2)} · spot $${(cash?.spot ?? 0).toFixed(2)}` : "Open the perp account"}
      </button>
      <div className="flex gap-2 overflow-x-auto">
        {KINDS.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setKind(id)} className={cn("min-h-9 shrink-0 rounded-full px-3 text-sm font-semibold active:scale-95", kind === id ? "bg-white text-black" : "bg-[#2a2a2e]")}>
            {label}
          </button>
        ))}
      </div>
      {hero ? (
        <div className="rounded-[22px] bg-[#101114] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] tracking-[0.14em] text-white/45 uppercase">{hero.company}</p>
            <p className="text-[11px] text-white/40">{hero.id}</p>
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto">
            {privates.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setFeature(row.id)}
                className={cn("min-h-8 shrink-0 rounded-full px-3 text-xs font-semibold", hero.id === row.id ? "bg-white text-black" : "bg-[#2a2a2e]")}
              >
                {chipLabel(row)}
              </button>
            ))}
          </div>
          <p className="mt-3 font-mono text-4xl tabular-nums tracking-tight">{heroPrice(hero.mark, hero.unit)}</p>
          {hero.unit === "valuation" ? <p className="mt-1 font-mono text-sm text-[#c6f56a]">{impliedValue(hero.mark)}</p> : null}
          <p className="mt-1 text-sm">
            <span className={cn("font-mono", (hero.change ?? 0) < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]")}>
              {dayChange(hero.mark, hero.prev, hero.unit)?.text ?? "—"}
            </span>
            <span className="ml-2 text-white/40">Past 24 hours</span>
          </p>
          <div className="mt-3 overflow-hidden rounded-2xl bg-black/40">
            <DayChart
              points={day?.id === hero.id ? day.points : []}
              highText={day?.id === hero.id && day.high > 0 ? heroPrice(day.high, hero.unit) : "—"}
              lowText={day?.id === hero.id && day.low > 0 ? heroPrice(day.low, hero.unit) : "—"}
              empty={day?.id === hero.id ? "No day of trades on this book." : "Pulling the day."}
            />
          </div>
          <p className="mt-3 text-sm leading-snug text-white/60">{hero.unitLine}</p>
          {hero.unit === "share" && value && hero.id !== value.id ? (
            <p className="mt-1 text-xs text-white/45">
              The valuation book is {markText(value.mark, "valuation")} · {impliedValue(value.mark)}. It is not this price.
            </p>
          ) : null}
          {hero.volume === 0 ? <p className="mt-1 text-sm text-[#ffb020]">No trades in the last day. A market order may not fill.</p> : null}
          <button
            type="button"
            onClick={() => {
              setPick(hero.id);
              setOpen(true);
              setLev((cur) => Math.min(cur, hero.maxLeverage));
            }}
            className="mt-3 min-h-11 w-full rounded-full bg-[#c6f56a] text-sm font-semibold text-black active:scale-[0.98]"
          >
            Long or short · {hero.maxLeverage}×
          </button>
        </div>
      ) : null}
      <div className="flex gap-2 overflow-x-auto">
        {dexes.map((id) => (
          <button key={id} type="button" onClick={() => setDex(id)} className={cn("min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold active:scale-95", dex === id ? "bg-white text-black" : "bg-[#1c1c1e] text-white/70")}>
            {id === "all" ? "Every book" : id === "hyperliquid" ? "Hyperliquid" : id}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${shown.length}`}
          className="min-h-11 min-w-0 flex-1 rounded-full bg-[#1c1c1e] px-4 text-sm outline-none"
        />
        {(["volume", "move", "name"] as const).map((id) => (
          <button key={id} type="button" onClick={() => setSort(id)} className={cn("min-h-11 rounded-full px-3 text-xs font-semibold capitalize", sort === id ? "bg-white text-black" : "bg-[#2a2a2e]")}>{id}</button>
        ))}
      </div>
      <ul className="max-h-[70vh] divide-y divide-white/10 overflow-auto">
        {shown.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => {
                setPick(row.id);
                setOpen(true);
                setLev((cur) => Math.min(cur, row.maxLeverage));
              }}
              className="flex w-full items-center justify-between gap-3 py-3 text-left active:scale-[0.98]"
            >
              <span>
                <span className="block text-sm font-semibold">{row.company ? `${row.company} · ${row.label}` : row.label}</span>
                <span className="block text-[11px] text-white/40">
                  {row.unit === "valuation" ? "Valuation" : row.unit === "share" ? "Share price" : row.kind}
                  {row.dex ? ` · ${row.dex}` : ""} · {row.maxLeverage}×
                  {row.unit === "valuation" ? ` · ${impliedValue(row.mark)}` : ""}
                </span>
              </span>
              <span className="text-right">
                <span className="block font-mono text-sm">{markText(row.mark, row.unit)}</span>
                <span className={cn("font-mono text-xs", (row.change ?? 0) < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]")}>
                  {row.change == null ? "—" : `${row.change >= 0 ? "+" : ""}${row.change.toFixed(2)}%`}
                </span>
              </span>
            </button>
          </li>
        ))}
        {shown.length === 0 ? <li className="py-3 text-sm text-white/45">The book has not come back yet.</li> : null}
      </ul>
      {positions.length > 0 ? (
        <ul className="rounded-[22px] bg-[#101114] px-3">
          {positions.map((row) => (
            <li key={`${row.dex}:${row.coin}`} className="flex items-center justify-between border-t border-white/10 py-3 first:border-0">
              <span>
                <span className="block text-sm font-semibold">{row.coin} {row.side} {row.leverage ? `${row.leverage}×` : ""}</span>
                <span className="font-mono text-[11px] text-white/40">{row.size} · liq {row.liq ? money(row.liq) : "—"}</span>
              </span>
              <span className="text-right">
                <span className={cn("block font-mono text-sm", row.pnl < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]")}>{row.pnl >= 0 ? "+" : ""}{row.pnl.toFixed(2)}</span>
                <button type="button" disabled={busy} onClick={() => void close(row)} className="text-xs font-semibold text-white/70">Close</button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {open && market ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" role="dialog">
          <div className="max-h-[88vh] w-full overflow-auto rounded-t-[28px] bg-[#0c0c0f] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-white/50">{market.company || market.kind}{market.dex ? ` · ${market.dex}` : " · Hyperliquid"}</p>
                <h2 className="text-3xl font-semibold">{market.label}</h2>
                <p className="mt-1 font-mono text-3xl tabular-nums">{markText(market.mark, market.unit)}</p>
                {market.unit === "valuation" ? <p className="font-mono text-sm text-white/70">{impliedValue(market.mark)}</p> : null}
                <p className={cn("font-mono text-sm", (market.change ?? 0) < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]")}>
                  {market.change == null ? "no day" : `${market.change >= 0 ? "+" : ""}${market.change.toFixed(2)}%`}
                  {market.funding == null ? "" : ` · funding ${(market.funding * 100).toFixed(4)}%`}
                </p>
                {market.unitLine ? <p className="mt-2 text-sm leading-snug text-white/60">{market.unitLine}</p> : null}
                {market.volume === 0 ? <p className="mt-1 text-sm text-[#ffb020]">No trades in the last day. A market order may not fill.</p> : null}
              </div>
              <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-full bg-[#2a2a2e] px-4 text-sm font-semibold">Close</button>
            </div>
            <div className="mt-3 overflow-hidden rounded-2xl bg-black/30">
              {range && range.points.length > 1 ? (
                <DayChart points={range.points} highText={markText(range.high, market.unit)} lowText={markText(range.low, market.unit)} />
              ) : (
                <MarkChart points={trail[market.id] ?? []} label={`${market.label} marks received on this screen`} />
              )}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-[18px] bg-[#1c1c1e] px-2 py-3"><p className="text-[11px] text-white/45">24h high</p><p className="font-mono text-sm">{range ? markText(range.high, market.unit) : "—"}</p></div>
              <div className="rounded-[18px] bg-[#1c1c1e] px-2 py-3"><p className="text-[11px] text-white/45">24h low</p><p className="font-mono text-sm">{range ? markText(range.low, market.unit) : "—"}</p></div>
              <div className="rounded-[18px] bg-[#1c1c1e] px-2 py-3"><p className="text-[11px] text-white/45">Max</p><p className="font-mono text-lg">{market.maxLeverage}×</p></div>
            </div>
            <label className="mt-4 block text-xs text-white/45">
              Margin, USDC
              <input value={margin} onChange={(e) => setMargin(e.target.value)} inputMode="decimal" className="mt-1 min-h-12 w-full rounded-2xl bg-[#1c1c1e] px-4 font-mono text-lg outline-none" />
            </label>
            <p className="mt-2 text-xs text-white/55">
              Perp account {cash ? `$${cash.perp.toFixed(2)}` : "—"}. Spot USDC {cash ? `$${cash.spot.toFixed(2)}` : "—"}.
              {cash && cash.perp + 0.01 < marginN
                ? ` Long or Short moves $${Math.max(0, marginN - cash.perp).toFixed(2)} from spot into this account, then signs the order.`
                : " The order uses the perp account. Phantom signs it here."}
            </p>
            <div className="mt-2 flex gap-2">
              {[10, 25, 50, 100].map((n) => (
                <button key={n} type="button" onClick={() => setMargin(String(n))} className={cn("min-h-9 flex-1 rounded-full font-mono text-xs active:scale-95", Number(margin) === n ? "bg-white text-black" : "bg-[#2a2a2e]")}>${n}</button>
              ))}
            </div>
            <label className="mt-3 block">
              <span className="text-[11px] tracking-[0.14em] text-white/45">LEVERAGE {Math.min(lev, maxLev)}× · size ${((marginN || 0) * Math.min(lev, maxLev)).toFixed(0)}</span>
              <input type="range" min={1} max={maxLev} step={1} value={Math.min(lev, maxLev)} onChange={(e) => setLev(Number(e.target.value))} className="mt-2 w-full accent-white" />
            </label>
            <p className="mt-1 text-[11px] text-white/40">A market order is an immediate limit, one percent through the mark. Hyperliquid sets the fill. You sign twice: leverage, then the order.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" disabled={busy} onClick={() => void trade("long")} className="min-h-12 rounded-full bg-[#c6f56a] text-sm font-semibold text-black active:scale-95 disabled:opacity-40">Long</button>
              <button type="button" disabled={busy} onClick={() => void trade("short")} className="min-h-12 rounded-full bg-[#ff5d73] text-sm font-semibold text-black active:scale-95 disabled:opacity-40">Short</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
