import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PanelLeft, PanelRight } from "lucide-react";
import { MarkFace } from "@/components/holding-cards";
import { toast } from "sonner";
import { DepthScreen } from "@/components/depth-screen";
import { PrintChart } from "@/components/print-chart";
import { PrintTape } from "@/components/print-tape";
import { holdTrade } from "@/lib/offline-rail";
import { connectPhantom, pickOwner, readChain } from "@/lib/phantom";
import { SOL } from "@/lib/jup-sign";
import { runPrestock } from "@/lib/prestock";
import { formatUsd, getHouse, HOUSE_FALLBACK, type HouseListing } from "@/lib/sol-house";
import { loadPulse, loadTape } from "@/lib/universe";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

type Name = { symbol: string; name: string; mint: string; price: number; change: number; book: string };

function fromHouse(row: HouseListing): Name {
  return {
    symbol: row.symbol,
    name: row.name,
    mint: row.mint,
    price: row.last,
    change: row.change24h == null ? 0 : row.change24h * 100,
    book: row.venue === "prestocks" ? "PreStocks" : "Tessera",
  };
}

const SEEDED: Name[] = [
  { symbol: "SOL", name: "Solana", mint: SOL, price: 0, change: 0, book: "Spot" },
  ...HOUSE_FALLBACK.filter((row) => row.mint && row.last > 0).map(fromHouse),
];

type BookId = "PreStocks" | "Spot" | "Tessera" | "Held" | "Crypto" | "Listed" | "Stakes" | "Watch";

const MARKETS: { id: BookId; label: string }[] = [
  { id: "PreStocks", label: "PreStocks" },
  { id: "Spot", label: "Spot" },
  { id: "Crypto", label: "Crypto" },
  { id: "Listed", label: "Listed" },
  { id: "Stakes", label: "Stakes" },
  { id: "Tessera", label: "Tessera" },
  { id: "Held", label: "Held" },
  { id: "Watch", label: "Watch" },
];

const ORDERS = [
  { id: "market", label: "Market Execution" },
  { id: "buy-limit", label: "Buy Limit" },
  { id: "sell-limit", label: "Sell Limit" },
  { id: "buy-stop", label: "Buy Stop" },
  { id: "sell-stop", label: "Sell Stop" },
] as const;

type OrderId = (typeof ORDERS)[number]["id"];

const CABS = "senda.cabinets.v1";
const WATCHLIST = "senda.watchlist.v1";
const RAILS = "senda.terminal.rails";
const HARNESS = "senda.harness.token";

type Mission = { id: string; strategyId: string; leftToday: number; status: string };

async function harness(token: string, method: string, params: Record<string, unknown> = {}) {
  const res = await fetch("/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ method, params }),
  });
  const body = (await res.json()) as { result?: Record<string, unknown>; error?: string };
  if (!res.ok || !body.result) throw new Error(body.error || "The harness did not answer.");
  return body.result;
}

function readIds<T extends string>(key: string, allow: readonly T[], fallback: T[]): T[] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = JSON.parse(window.localStorage.getItem(key) || "[]") as unknown;
    if (!Array.isArray(raw)) return fallback;
    const next = raw.filter((id): id is T => typeof id === "string" && (allow.length === 0 ? id.length > 20 : allow.includes(id as T)));
    return next.length ? next : fallback;
  } catch {
    return fallback;
  }
}

function inBook(row: Name, id: BookId, watch: Set<string>): boolean {
  if (id === "Watch") return watch.has(row.mint);
  if (id === "Spot") return row.book === "Spot" || row.symbol === "SOL" || row.symbol === "ETH" || row.symbol === "BTC";
  return row.book === id;
}

function px(n: number): string {
  if (!(n > 0)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return n.toPrecision(4);
}

/** A menu that opens over the page. A native select inside the ticket was clipped and never kept a value. */
function Drop({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState({ top: 0, left: 0, width: 160 });
  const current = options.find((row) => row.id === value)?.label || label;

  function toggle() {
    const rect = btn.current?.getBoundingClientRect();
    if (rect) setAt({ top: rect.bottom + 2, left: rect.left, width: Math.max(rect.width, 196) });
    setOpen((on) => !on);
  }

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={toggle}
        className="flex h-7 min-w-0 flex-1 items-center justify-between gap-2 border border-[#3d4354] bg-[#131722] px-2 text-left text-[12px] text-[#d1d4dc]"
      >
        <span className="truncate">{current}</span>
        <span className="text-[10px] text-[#787b86]">{open ? "▴" : "▾"}</span>
      </button>
      {open ? (
        <>
          <button type="button" aria-label="Close menu" className="fixed inset-0 z-[80] cursor-default" onClick={() => setOpen(false)} />
          <ul className="fixed z-[81] max-h-64 overflow-auto border border-[#3d4354] bg-[#1e222d] py-1 shadow-lg" style={{ top: at.top, left: at.left, width: at.width }}>
            {options.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(row.id);
                    setOpen(false);
                  }}
                  className={cn("block w-full px-2 py-1.5 text-left text-[12px] hover:bg-[#2a2e39]", row.id === value ? "text-[#2962ff]" : "text-[#d1d4dc]")}
                >
                  {row.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

/** The trade ticket. A name is on the chart before a wallet is connected. */
export function TradeBoard() {
  const wallet = useWallet();
  const owner = pickOwner(wallet.w.links);
  const [names, setNames] = useState<Name[]>(SEEDED);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState(SOL);
  const [buyUsd, setBuyUsd] = useState(25);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [order, setOrder] = useState<OrderId>("market");
  const [buying, setBuying] = useState(false);
  const [arm, setArm] = useState(false);
  const [pane, setPane] = useState<"book" | "depth">("book");
  const [usdc, setUsdc] = useState(0);
  const [open, setOpen] = useState<BookId[]>(["PreStocks"]);
  const [active, setActive] = useState<BookId>("PreStocks");
  const [watch, setWatch] = useState<string[]>([]);
  const [bookOpen, setBookOpen] = useState(true);
  const [boxOpen, setBoxOpen] = useState(true);
  const [usdText, setUsdText] = useState("25.00");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [atPrice, setAtPrice] = useState("");
  const [actor, setActor] = useState("wallet");
  const [missions, setMissions] = useState<Mission[]>([]);

  useEffect(() => {
    const allow = MARKETS.map((row) => row.id);
    const saved = readIds(CABS, allow, ["PreStocks"] as BookId[]);
    setOpen(saved);
    setActive(saved[0]);
    setWatch(readIds(WATCHLIST, [] as string[], []));
    try {
      const rails = JSON.parse(window.localStorage.getItem(RAILS) || "") as { book?: boolean; box?: boolean };
      if (typeof rails.book === "boolean") setBookOpen(rails.book);
      if (typeof rails.box === "boolean") setBoxOpen(rails.box);
    } catch {
      /* a missing rail just stays open */
    }
    const token = window.localStorage.getItem(HARNESS) || "";
    if (!token) return;
    harness(token, "list_missions")
      .then((row) => setMissions(((row.missions as Mission[]) || []).filter((m) => m.status === "open")))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let live = true;
    getHouse()
      .then((rows) => {
        if (!live || !rows.length) return;
        setNames((cur) => {
          const spot = cur.filter((row) => row.book === "Spot");
          const next = rows.filter((row) => row.mint && row.last > 0).map(fromHouse);
          return [...spot, ...next];
        });
      })
      .catch(() => undefined);
    loadPulse()
      .then((pulse) => {
        if (!live) return;
        setNames((cur) => {
          const byMint = new Map(cur.map((row) => [row.mint, row]));
          for (const row of pulse.rows) {
            const prev = byMint.get(row.mint);
            const book = row.group === "listed" ? "Listed" : row.group === "stake" ? "Stakes" : row.group === "crypto" ? "Crypto" : prev?.book || "PreStocks";
            byMint.set(row.mint, {
              symbol: row.symbol,
              name: prev?.name || row.symbol,
              mint: row.mint,
              price: row.price,
              change: row.change,
              book: prev?.book === "Spot" || prev?.book === "PreStocks" || prev?.book === "Tessera" ? prev.book : book,
            });
          }
          return [...byMint.values()];
        });
      })
      .catch(() => undefined);
    loadTape()
      .then((tape) => {
        if (!live) return;
        setNames((cur) => {
          const byMint = new Map(cur.map((row) => [row.mint, row]));
          for (const row of tape) {
            if (!(row.price > 0)) continue;
            const prev = byMint.get(row.mint);
            const book = row.group === "listed" ? "Listed" : row.group === "stake" ? "Stakes" : row.group === "crypto" ? "Crypto" : prev?.book || "PreStocks";
            byMint.set(row.mint, {
              symbol: row.symbol,
              name: prev?.name || row.symbol,
              mint: row.mint,
              price: row.price,
              change: row.change,
              book: prev?.book === "PreStocks" || prev?.book === "Tessera" || prev?.book === "Spot" ? prev.book : book,
            });
          }
          return [...byMint.values()];
        });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!owner) {
      setUsdc(0);
      return;
    }
    let live = true;
    readChain(owner)
      .then((chain) => {
        if (live) setUsdc(chain.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [owner]);

  const watched = useMemo(() => new Set(watch), [watch]);
  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    return names.filter((row) => row.mint && inBook(row, active, watched) && (!query || `${row.symbol} ${row.name} ${row.book}`.toLowerCase().includes(query)));
  }, [names, q, active, watched]);

  const chosen = names.find((row) => row.mint === pick) ?? shown.find((row) => row.price > 0) ?? shown[0] ?? null;
  const market = order === "market";

  function openMarket(id: BookId) {
    setActive(id);
    setOpen((cur) => {
      const next = cur.includes(id) ? cur : [...cur, id];
      window.localStorage.setItem(CABS, JSON.stringify(next));
      return next;
    });
  }

  function closeMarket(id: BookId) {
    setOpen((cur) => {
      const next = cur.filter((row) => row !== id);
      const kept = next.length ? next : (["PreStocks"] as BookId[]);
      window.localStorage.setItem(CABS, JSON.stringify(kept));
      setActive((on) => (on === id ? kept[kept.length - 1] : on));
      return kept;
    });
  }

  function rails(next: { book?: boolean; box?: boolean }) {
    const book = next.book ?? bookOpen;
    const box = next.box ?? boxOpen;
    if (next.book != null) setBookOpen(book);
    if (next.box != null) setBoxOpen(box);
    window.localStorage.setItem(RAILS, JSON.stringify({ book, box }));
  }

  function toggleWatch(mint: string) {
    setWatch((cur) => {
      const next = cur.includes(mint) ? cur.filter((id) => id !== mint) : [...cur, mint].slice(0, 40);
      window.localStorage.setItem(WATCHLIST, JSON.stringify(next));
      return next;
    });
  }

  function setSize(n: number) {
    const usd = Math.round(n * 100) / 100;
    setBuyUsd(usd);
    setUsdText(usd.toFixed(2));
    setArm(false);
  }

  function pickOrder(id: string) {
    const next = id as OrderId;
    setOrder(next);
    setArm(false);
    if (next.startsWith("buy")) setSide("buy");
    if (next.startsWith("sell")) setSide("sell");
    if (chosen && chosen.price > 0 && !atPrice) setAtPrice(String(chosen.price));
  }

  async function send() {
    if (!chosen?.mint) return;
    if (!market) {
      toast.error("Limit and stop orders do not rest on this pool. Market execution is what signs.");
      setArm(false);
      return;
    }
    const usd = Number(usdText);
    if (!(usd >= 1)) {
      toast.error("A trade is at least $1.");
      return;
    }
    setBuying(true);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep the address.");
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const heldTrade = holdTrade({
          kind: "spot",
          mint: chosen.mint,
          symbol: chosen.symbol,
          side,
          usd,
          sol: 0,
          pool: "auto",
          price: chosen.price,
          decimals: 6,
        });
        if ("error" in heldTrade) throw new Error(heldTrade.error);
        toast.success(`${chosen.symbol} is held on this phone. It signs when the network is back.`);
        return;
      }
      const mission = missions.find((row) => row.id === actor);
      let intentId = "";
      if (mission) {
        const token = window.localStorage.getItem(HARNESS) || "";
        if (!token) throw new Error("No harness on this phone. Trade with this wallet, or open a mission under Agents.");
        const queued = await harness(token, "queue_trade", {
          missionId: mission.id,
          symbol: chosen.symbol,
          usd,
          side,
          model: "terminal",
          why: "Trading terminal",
        });
        intentId = String(queued.id || "");
      }
      const done = await runPrestock({ owner: who, mint: chosen.mint, side, usd, price: chosen.price }).catch(async (err: unknown) => {
        if (intentId) {
          const token = window.localStorage.getItem(HARNESS) || "";
          if (token) await harness(token, "release", { id: intentId }).catch(() => undefined);
        }
        throw err;
      });
      if (intentId) {
        const token = window.localStorage.getItem(HARNESS) || "";
        if (token) await harness(token, "mark_signed", { id: intentId, signature: done.signature });
      }
      toast.success(`${side === "buy" ? "Bought" : "Sold"} ${chosen.symbol}. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The order did not send.");
    } finally {
      setBuying(false);
      setArm(false);
    }
  }

  const last = chosen?.price || 0;
  const symbolOptions = (shown.length ? shown : names).slice(0, 40).map((row) => ({ id: row.mint, label: `${row.symbol}  ${row.price > 0 ? px(row.price) : "—"}` }));
  const whoOptions = [
    { id: "wallet", label: "This wallet" },
    ...missions.map((row) => ({ id: row.id, label: `${row.strategyId} · $${row.leftToday.toFixed(2)} left` })),
  ];

  return (
    <section className="flex min-h-[70vh] flex-col bg-[#0c0f16] lg:flex-row">
      <div className={cn("order-3 overflow-hidden border-b border-white/10 transition-[width] duration-200 ease-out lg:order-1 lg:shrink-0 lg:border-r lg:border-b-0", bookOpen ? "lg:w-[260px]" : "lg:w-11")}>
        <div className={cn("flex items-center gap-2 p-2", !bookOpen && "lg:flex-col lg:px-1")}>
          <button
            type="button"
            onClick={() => rails({ book: !bookOpen })}
            aria-label={bookOpen ? "Collapse markets" : "Open markets"}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-white/50 hover:bg-white/5 hover:text-white"
          >
            <PanelLeft className="size-4" />
          </button>
          {bookOpen ? (
            <>
              <div className="min-w-0 flex-1">
                <Drop label="Open a market" value={active} options={MARKETS.map((row) => ({ id: row.id, label: open.includes(row.id) ? `${row.label} · open` : row.label }))} onChange={(id) => openMarket(id as BookId)} />
              </div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search"
                aria-label="Search this market"
                className="h-7 w-20 border border-[#3d4354] bg-[#131722] px-2 text-[12px] text-[#d1d4dc] outline-none"
              />
            </>
          ) : (
            <button type="button" onClick={() => rails({ book: true })} className="min-h-8 px-2 text-[11px] font-semibold text-white/50 lg:px-0 lg:[writing-mode:vertical-rl]">
              Markets
            </button>
          )}
        </div>
        {bookOpen ? (
          <div className="max-h-72 overflow-auto lg:max-h-[70vh]">
            {open.map((id) => {
              const label = MARKETS.find((row) => row.id === id)?.label || id;
              const rows = names.filter((row) => row.mint && inBook(row, id, watched) && (!q.trim() || `${row.symbol} ${row.name}`.toLowerCase().includes(q.trim().toLowerCase())));
              const on = id === active;
              return (
                <div key={id} className="border-t border-white/10">
                  <div className="flex items-center">
                    <button type="button" onClick={() => setActive(id)} className={cn("flex min-h-10 min-w-0 flex-1 items-center justify-between px-3 text-left text-xs font-semibold", on && "text-white")}>
                      <span>{label}</span>
                      <span className="font-mono text-[11px] text-white/40">{rows.length}</span>
                    </button>
                    {open.length > 1 ? (
                      <button type="button" onClick={() => closeMarket(id)} aria-label={`Close ${label}`} className="min-h-10 px-3 text-xs text-white/40">Close</button>
                    ) : null}
                  </div>
                  {on ? (
                    <ul>
                      {rows.length === 0 ? <li className="px-3 py-4 text-xs text-white/45">{id === "Watch" ? "Star a name. The watch list does not trade." : id === "Held" ? "Nothing in this wallet yet." : "This market has not priced yet."}</li> : null}
                      {rows.map((row) => (
                        <li key={row.mint}>
                          <div className={cn("grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-2", chosen?.mint === row.mint && "bg-white/[0.06]")}>
                            <button type="button" aria-label={watched.has(row.mint) ? `Remove ${row.symbol} from the watch list` : `Watch ${row.symbol}`} onClick={() => toggleWatch(row.mint)} className={cn("min-h-11 w-8 text-sm", watched.has(row.mint) ? "text-accent" : "text-white/25")}>
                              {watched.has(row.mint) ? "●" : "○"}
                            </button>
                            <button type="button" onClick={() => { setPick(row.mint); setArm(false); }} className="flex min-h-11 min-w-0 items-center justify-between gap-2 py-2 text-left">
                              <span className="flex min-w-0 items-center gap-2">
                                <MarkFace symbol={row.symbol} mint={row.mint} size={32} />
                                <span className="min-w-0">
                                  <span className="block text-sm font-semibold">{row.symbol}</span>
                                  <span className="block truncate text-[11px] text-white/40">{row.name}</span>
                                </span>
                              </span>
                              <span className="text-right">
                                <span className="block font-mono text-sm tabular-nums">{row.price > 0 ? formatUsd(row.price) : "—"}</span>
                                <span className={cn("block font-mono text-[11px] tabular-nums", row.change < 0 ? "text-down" : row.change > 0 ? "text-accent" : "text-white/30")}>
                                  {row.change ? `${row.change >= 0 ? "+" : ""}${row.change.toFixed(1)}%` : ""}
                                </span>
                              </span>
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="order-1 min-w-0 flex-1 border-b border-white/10 lg:order-2 lg:border-b-0">
        <div className="flex items-end justify-between gap-3 px-3 pt-3">
          <div>
            <p className="font-display text-4xl tracking-tight">{chosen?.symbol || "—"}</p>
            <p className="mt-1 text-xs text-white/40">{chosen ? `${chosen.book} · ${chosen.name}` : "Trading terminal"}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-3xl tabular-nums">{last > 0 ? formatUsd(last) : "—"}</p>
            <p className={cn("font-mono text-sm tabular-nums", (chosen?.change ?? 0) < 0 ? "text-down" : "text-accent")}>
              {chosen ? `${chosen.change >= 0 ? "+" : ""}${chosen.change.toFixed(2)}%` : ""}
            </p>
          </div>
        </div>
        <div className="px-1 pt-2">
          {chosen?.mint ? <PrintChart mint={chosen.mint} symbol={chosen.symbol} className="h-[420px] lg:h-[calc(100dvh-8rem)]" /> : null}
        </div>
      </div>

      <div className={cn("order-2 flex min-h-0 flex-col overflow-hidden transition-[width] duration-200 ease-out lg:order-3 lg:shrink-0 lg:border-l lg:border-white/10", boxOpen ? "lg:w-[300px]" : "lg:w-11")}>
        <div className={cn("flex items-center gap-2 border-b border-[#2a2e39] bg-[#1e222d] p-1.5", !boxOpen && "lg:flex-col")}>
          <button type="button" onClick={() => rails({ box: !boxOpen })} aria-label={boxOpen ? "Collapse the trading box" : "Open the trading box"} className="grid size-8 shrink-0 place-items-center text-[#787b86] hover:text-white">
            <PanelRight className="size-4" />
          </button>
          {boxOpen ? <p className="text-[12px] font-semibold text-[#d1d4dc]">Order</p> : (
            <button type="button" onClick={() => rails({ box: true })} className="min-h-8 px-2 text-[11px] font-semibold text-white/50 lg:[writing-mode:vertical-rl]">Box</button>
          )}
          {boxOpen ? <span className="ml-auto font-mono text-[10px] text-[#787b86]">{owner ? `USDC ${usdc.toFixed(2)}` : "Not connected"}</span> : null}
        </div>
        {boxOpen ? (
          <div className="bg-[#1e222d] p-2 text-[#d1d4dc]">
            <Row k="Symbol">
              <Drop label="Symbol" value={chosen?.mint || ""} options={symbolOptions.length ? symbolOptions : [{ id: pick, label: chosen?.symbol || "Symbol" }]} onChange={(id) => { setPick(id); setArm(false); }} />
            </Row>
            <Row k="Type">
              <Drop label="Type" value={order} options={ORDERS.map((row) => ({ id: row.id, label: row.label }))} onChange={pickOrder} />
            </Row>
            <Row k="Volume">
              <div className="flex h-7 flex-1 border border-[#3d4354] bg-[#131722]">
                <button type="button" aria-label="Smaller size" onClick={() => setSize(Math.max(1, buyUsd - 1))} className="w-7 text-[#787b86] hover:text-white">−</button>
                <input
                  value={usdText}
                  inputMode="decimal"
                  aria-label="Volume in USDC"
                  onChange={(e) => { setUsdText(e.target.value.replace(/[^0-9.]/g, "")); setArm(false); }}
                  onBlur={() => { const n = Number(usdText); if (n >= 1) setSize(n); }}
                  className="w-full bg-transparent text-center font-mono text-[12px] outline-none"
                />
                <button type="button" aria-label="Larger size" onClick={() => setSize(buyUsd + 1)} className="w-7 text-[#787b86] hover:text-white">+</button>
              </div>
            </Row>
            <p className="-mt-1 mb-1 pl-[92px] text-[10px] text-[#787b86]">USDC. Not a forex lot.</p>
            {market ? null : (
              <Row k="Price">
                <input value={atPrice} aria-label="Pending price" onChange={(e) => setAtPrice(e.target.value.replace(/[^0-9.]/g, ""))} className="h-7 flex-1 border border-[#3d4354] bg-[#131722] px-2 font-mono text-[12px] outline-none" />
              </Row>
            )}
            <Row k="Stop Loss">
              <input value={sl} aria-label="Stop loss" onChange={(e) => setSl(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="not sent" className="h-7 flex-1 border border-[#3d4354] bg-[#131722] px-2 font-mono text-[12px] outline-none placeholder:text-[#4b5163]" />
            </Row>
            <Row k="Take Profit">
              <input value={tp} aria-label="Take profit" onChange={(e) => setTp(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="not sent" className="h-7 flex-1 border border-[#3d4354] bg-[#131722] px-2 font-mono text-[12px] outline-none placeholder:text-[#4b5163]" />
            </Row>
            <Row k="Who">
              <Drop label="Who" value={actor} options={whoOptions} onChange={(id) => { setActor(id); setArm(false); }} />
            </Row>

            <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-stretch gap-1">
              <button type="button" onClick={() => { setSide("sell"); setArm(false); }} className={cn("flex flex-col items-center justify-center py-2", side === "sell" ? "bg-[#f23645] text-white" : "bg-[#3a1d22] text-[#f23645]")}>
                <span className="text-[11px] tracking-wide">SELL</span>
                <span className="font-mono text-[18px] leading-none tabular-nums">{px(last)}</span>
                <span className="text-[10px] opacity-80">by market</span>
              </button>
              <div className="flex items-center px-1 text-[10px] text-[#787b86]">last</div>
              <button type="button" onClick={() => { setSide("buy"); setArm(false); }} className={cn("flex flex-col items-center justify-center py-2", side === "buy" ? "bg-[#2962ff] text-white" : "bg-[#17233a] text-[#5b8def]")}>
                <span className="text-[11px] tracking-wide">BUY</span>
                <span className="font-mono text-[18px] leading-none tabular-nums">{px(last)}</span>
                <span className="text-[10px] opacity-80">by market</span>
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-snug text-[#787b86]">
              {market
                ? "One print. This pool does not publish a separate bid and ask. Stop loss and take profit stay on the ticket. They are not sent with the swap."
                : "A limit or stop is not resting on this pool. Switch the type back to Market Execution to sign."}
              {actor === "wallet" ? " This wallet signs." : " The mission queues, then this wallet signs. The aim returns if you refuse."}
            </p>
            <button
              type="button"
              disabled={buying || !chosen || !market}
              onClick={() => { if (!arm) { setArm(true); return; } void send(); }}
              className={cn("mt-2 h-9 w-full text-[13px] font-semibold disabled:opacity-40", side === "sell" ? "bg-[#f23645] text-white" : "bg-[#2962ff] text-white")}
            >
              {buying ? "Waiting for the wallet…" : !market ? "Market execution only" : arm && chosen ? `Sign ${side} ${usdText} ${chosen.symbol}` : chosen ? `${side === "sell" ? "Sell" : "Buy"} ${chosen.symbol} by market` : "Pick a symbol"}
            </button>
            <div className="mt-2 flex gap-1">
              {(["book", "depth"] as const).map((id) => (
                <button key={id} type="button" onClick={() => setPane(id)} className={cn("h-7 px-2 text-[11px]", pane === id ? "bg-[#2a2e39] text-white" : "text-[#787b86]")}>
                  {id === "book" ? "Book" : "Depth"}
                </button>
              ))}
            </div>
            <div className="mt-1 max-h-64 overflow-auto bg-[#131722]">
              {chosen?.mint && pane === "book" ? <PrintTape mint={chosen.mint} symbol={chosen.symbol} size={buyUsd} /> : null}
              {chosen?.mint && pane === "depth" ? <DepthScreen mint={chosen.mint} symbol={chosen.symbol} /> : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <label className="mb-1.5 flex items-center gap-2">
      <span className="w-[84px] shrink-0 text-[11px] text-[#787b86]">{k}</span>
      {children}
    </label>
  );
}
