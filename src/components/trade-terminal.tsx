import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { FillButton } from "@/components/fill-button";
import { outUi, quoteJup, type JupQuote } from "@/lib/jup-exec";
import { getPrint, type PrintBar } from "@/lib/print";
import { askTrade, type TradeSetup } from "@/lib/trade-assist";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { cn } from "@/lib/utils";

type Level = { price: number; usd: number; tokens: number };

type Chat = { role: "user" | "desk"; text: string };

export function TradeTerminal({
  names,
  under,
  onPick,
  armed,
  side,
  onArmed,
  onSide,
  positions,
}: {
  names: HouseListing[];
  under: HouseListing | null;
  onPick: (id: string) => void;
  armed: number;
  side: "buy" | "sell";
  onArmed: (n: number) => void;
  onSide: (s: "buy" | "sell") => void;
  positions: { id: string; symbol: string; shares: number; cost: number; last: number }[];
}) {
  const [tab, setTab] = useState<"markets" | "book" | "depth">("markets");
  const [asks, setAsks] = useState<Level[]>([]);
  const [bids, setBids] = useState<Level[]>([]);
  const [bookNote, setBookNote] = useState("Asking Jupiter…");
  const [bars, setBars] = useState<PrintBar[]>([]);
  const [printNote, setPrintNote] = useState("Loading the pool…");
  const [draft, setDraft] = useState<TradeSetup | null>(null);
  const [chat, setChat] = useState<Chat[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(8);
  const [tf, setTf] = useState<"15m" | "1H" | "4H" | "1D">("1H");
  const [askOpen, setAskOpen] = useState(false);

  useEffect(() => {
    if (!under?.mint) return;
    let live = true;
    setAsks([]);
    setBids([]);
    setBookNote("Steps around the last print. A size appears when Jupiter quotes.");
    const sizes = [25, 100, 250];
    const timed = <T,>(p: Promise<T>) =>
      Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("slow")), 6000))]);
    void Promise.all(
      sizes.map(async (usd) => {
        const buy = await timed(quoteJup({ data: { mint: under.mint, usd, side: "buy" } })).catch(() => ({ error: "slow" }));
        const tokenUsd = under.last > 0 ? Math.max(0.01, usd / under.last) : usd;
        const sell = await timed(quoteJup({ data: { mint: under.mint, usd: tokenUsd, side: "sell" } })).catch(() => ({ error: "slow" }));
        return { usd, buy, sell };
      }),
    )
      .then((rows) => {
        if (!live) return;
        const nextAsks: Level[] = [];
        const nextBids: Level[] = [];
        for (const row of rows) {
          if (!("error" in row.buy)) {
            const tokens = outUi(row.buy as JupQuote);
            if (tokens > 0) nextAsks.push({ price: row.usd / tokens, usd: row.usd, tokens });
          }
          if (!("error" in row.sell)) {
            const usdc = outUi(row.sell as JupQuote);
            const tokens = under.last > 0 ? row.usd / under.last : 0;
            if (usdc > 0 && tokens > 0) nextBids.push({ price: usdc / tokens, usd: usdc, tokens });
          }
        }
        nextAsks.sort((a, b) => b.price - a.price);
        nextBids.sort((a, b) => b.price - a.price);
        setAsks(nextAsks);
        setBids(nextBids);
        setBookNote(
          nextAsks.length + nextBids.length
            ? "Jupiter quotes. Not a central book."
            : "Jupiter is busy. Rows are steps around the last print, not resting orders.",
        );
      })
      .catch(() => {
        if (live) setBookNote("Jupiter did not return a route.");
      });
    return () => {
      live = false;
    };
  }, [under?.mint, under?.last]);

  useEffect(() => {
    if (!under?.mint) return;
    let live = true;
    setBars([]);
    setPrintNote("Loading the pool…");
    void getPrint({ data: { mint: under.mint, tf } })
      .then((r) => {
        if (!live) return;
        setBars(r.bars);
        setPrintNote(r.note);
      })
      .catch(() => {
        if (live) setPrintNote("The print did not load.");
      });
    return () => {
      live = false;
    };
  }, [under?.mint, tf]);

  const bestAsk = asks.length ? Math.min(...asks.map((l) => l.price)) : null;
  const bestBid = bids.length ? Math.max(...bids.map((l) => l.price)) : null;
  const spread = bestAsk != null && bestBid != null ? bestAsk - bestBid : null;
  const down = (under?.change24h ?? 0) < 0;
  const around = aroundPrint(under?.last ?? 0);
  const shownAsks = asks.length ? asks : around.asks;
  const shownBids = bids.length ? bids : around.bids;

  async function ask(text: string) {
    const question = text.trim();
    if (!question || !under || busy) return;
    if (left <= 0) {
      setChat((c) => [...c, { role: "desk", text: "That is the cap for this session. The ticket is still yours to sign." }]);
      return;
    }
    setQ("");
    setBusy(true);
    setLeft((n) => n - 1);
    setChat((c) => [...c, { role: "user", text: question }]);
    try {
      const out = await askTrade({
        data: {
          symbol: under.symbol,
          name: under.name,
          last: under.last,
          mark: under.mark,
          question,
        },
      });
      setDraft(out.setup);
      setChat((c) => [...c, { role: "desk", text: out.reply }]);
    } catch (e) {
      setChat((c) => [...c, { role: "desk", text: e instanceof Error ? e.message : "The draft did not come back." }]);
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!draft) return;
    onSide(draft.side);
    onArmed(draft.usd);
  }

  return (
    <section className="mx-3 mt-3 overflow-hidden rounded-2xl border border-white/10 bg-[#0c0e13]">
      <header className="flex flex-wrap items-center gap-4 border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-[11px] text-subtle">Last</p>
          <p className={cn("font-mono text-lg tabular-nums", down ? "text-[#ff5d73]" : "text-[#3dd68c]")}>
            {under ? formatUsd(under.last) : "—"} {down ? "↓" : "↑"}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-subtle">Vs mark</p>
          <p className="font-mono text-sm tabular-nums">{under ? formatPremium(under.premium) : "—"}</p>
        </div>
        <div>
          <p className="text-[11px] text-subtle">24h</p>
          <p className="font-mono text-sm tabular-nums">
            {under?.change24h == null ? "—" : `${(under.change24h * 100).toFixed(2)}%`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAskOpen(true);
            const line = `Draft a long on ${under?.symbol || "this name"} from the live print.`;
            setQ(line);
            void ask(line);
          }}
          className="ml-auto inline-flex min-h-9 items-center gap-2 rounded-full border border-white/10 px-3 text-sm text-[#c9d4ff]"
        >
          <Sparkles className="size-3.5" />
          Ask about {under?.symbol || "the print"}
        </button>
      </header>

      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <p className="text-[11px] tracking-wide text-subtle uppercase">{names.length} live names</p>
        <Link to="/equities" className="text-[12px] text-[#9eb6ff]">
          Listed shares
        </Link>
      </div>

      <div className="grid lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
        <div className="border-white/10 lg:border-r">
          <div className="flex items-center gap-4 px-4 pt-3 text-sm">
            {(["markets", "book", "depth"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn("pb-2 capitalize", tab === id ? "border-b-2 border-[#7aa2ff] text-fg" : "text-subtle")}
              >
                {id === "markets" ? "Markets" : id === "book" ? "Book" : "Depth"}
              </button>
            ))}
          </div>
          {tab === "markets" ? (
            <ul className="max-h-[520px] overflow-auto">
              {names.map((n) => {
                const chg = n.change24h;
                const on = under?.id === n.id;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => onPick(n.id)}
                      className={cn("flex w-full items-center gap-2 px-3 py-2 text-left", on ? "bg-white/8" : "hover:bg-white/5")}
                    >
                      <span className="w-24 truncate font-mono text-xs font-semibold">{n.symbol}</span>
                      <span className="ml-auto font-mono text-xs tabular-nums">{formatUsd(n.last)}</span>
                      <span className={cn("w-14 text-right font-mono text-[11px] tabular-nums", (chg ?? 0) < 0 ? "text-[#ff8fa0]" : "text-[#3dd68c]")}>
                        {chg == null ? "—" : `${chg >= 0 ? "+" : ""}${(chg * 100).toFixed(1)}%`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {tab === "book" ? (
            <>
              <BookRows asks={shownAsks} bids={shownBids} last={under?.last ?? 0} down={down} note={bookNote} />
              <p className="px-4 pb-3 text-[11px] text-subtle">{spread == null ? bookNote : `Spread ${spread.toFixed(4)}`}</p>
            </>
          ) : null}
          {tab === "depth" ? <DepthBars asks={asks} bids={bids} /> : null}
        </div>

        <div className="flex min-h-[520px] flex-col bg-[#10131a]">
          <div className="flex items-center gap-1 border-b border-white/10 px-3 py-2">
            {(["15m", "1H", "4H", "1D"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTf(id)}
                className={cn(
                  "min-h-8 rounded-md px-2 font-mono text-[11px]",
                  tf === id ? "bg-white/10 text-fg" : "text-subtle hover:text-fg",
                )}
              >
                {id}
              </button>
            ))}
            <span className="ml-auto font-mono text-[11px] text-subtle">{printNote}</span>
          </div>
          <PrintChart symbol={under?.symbol ?? ""} bars={bars} note={printNote} tf={tf} />
          <div className="grid gap-3 border-t border-white/10 p-3 sm:grid-cols-[minmax(0,1fr)_200px]">
            <div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => onSide("buy")}
                  className={cn("min-h-9 rounded-md text-sm font-semibold", side === "buy" ? "bg-[#3dd68c] text-black" : "bg-white/5 text-muted")}
                >
                  Buy
                </button>
                <button
                  type="button"
                  onClick={() => onSide("sell")}
                  className={cn("min-h-9 rounded-md text-sm font-semibold", side === "sell" ? "bg-[#ff5d73] text-white" : "bg-white/5 text-muted")}
                >
                  Sell
                </button>
              </div>
              <label className="mt-2 block text-[11px] text-subtle">
                Size, USDC
                <input
                  inputMode="decimal"
                  value={armed ? String(armed) : ""}
                  onChange={(e) => onArmed(Number(e.target.value) || 0)}
                  placeholder="0.00"
                  className="mt-1 min-h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 font-mono text-sm outline-none"
                />
              </label>
              <p className="mt-2 font-mono text-[11px] text-subtle">
                {under && under.last > 0 && armed > 0
                  ? `~${(armed / under.last).toFixed(4)} ${under.symbol} at ${under.last.toFixed(4)}`
                  : "Market. You still sign."}
              </p>
            </div>
            <div className="flex flex-col justify-end gap-2">
              {under && armed > 0 ? (
                <FillButton
                  mint={under.mint}
                  usd={armed}
                  side={side}
                  price={under.last}
                  label={`${side === "buy" ? "Buy" : "Sell"} ${under.symbol}`}
                  className={cn(
                    "min-h-11 w-full rounded-md text-sm font-semibold",
                    side === "buy" ? "bg-[#3dd68c] text-black" : "bg-[#ff5d73] text-white",
                  )}
                />
              ) : (
                <p className="text-[11px] text-subtle">Type a size. Nothing is placed until you sign.</p>
              )}
              <button
                type="button"
                onClick={() => setAskOpen((v) => !v)}
                className="min-h-9 rounded-md border border-white/10 text-[12px] text-[#c9d4ff]"
              >
                {askOpen ? "Hide draft" : "Draft a setup"}
              </button>
            </div>
          </div>
          {askOpen ? (
            <div className="border-t border-white/10 px-3 py-3">
              <div className="max-h-36 space-y-2 overflow-auto text-sm text-[#d5d8e2]">
                {chat.length === 0 ? (
                  <p className="text-xs text-muted">A draft loads size and side. It is not an order.</p>
                ) : null}
                {chat.map((m, i) => (
                  <p key={i} className={m.role === "user" ? "text-xs text-subtle" : "text-xs"}>
                    {m.text}
                  </p>
                ))}
                {draft && under ? (
                  <div className="rounded-xl border border-white/10 bg-[#141820] p-3">
                    <p className="text-xs">
                      <span className={draft.side === "buy" ? "text-[#3dd68c]" : "text-[#ff8fa0]"}>
                        {draft.side === "buy" ? "Long" : "Sell"}
                      </span>{" "}
                      {under.symbol} · ${draft.usd.toFixed(0)} · stop {draft.stop.toFixed(4)} · tp {draft.takeProfit.toFixed(4)}
                    </p>
                    <button type="button" onClick={apply} className="mt-2 min-h-9 rounded-md bg-[#5b7cfa] px-3 text-xs font-semibold text-white">
                      Apply to ticket
                    </button>
                  </div>
                ) : null}
              </div>
              <form
                className="mt-2 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void ask(q);
                }}
              >
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Ask about this print…"
                  className="min-h-10 flex-1 rounded-md border border-white/10 bg-black/30 px-3 text-sm outline-none"
                />
                <button type="submit" disabled={busy} className="min-h-10 rounded-md bg-[#5b7cfa] px-3 text-sm text-white disabled:opacity-40">
                  {busy ? "…" : "Ask"}
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto border-t border-white/10">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="text-subtle">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-2 py-2 font-medium">Size</th>
              <th className="px-2 py-2 font-medium">Last</th>
              <th className="px-2 py-2 font-medium">PnL</th>
              <th className="px-4 py-2 text-right font-medium">Ticket</th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-3 text-muted">
                  No paper size on this book. A signed swap lands in the wallet, not in this row.
                </td>
              </tr>
            ) : (
              positions.map((p) => {
                const mtm = p.shares * p.last;
                const pnl = mtm - p.cost;
                return (
                  <tr key={p.id} className="border-t border-white/5">
                    <td className="px-4 py-2 font-semibold">{p.symbol}</td>
                    <td className="px-2 py-2 font-mono">{p.shares.toFixed(4)}</td>
                    <td className="px-2 py-2 font-mono">{formatUsd(p.last)}</td>
                    <td className={cn("px-2 py-2 font-mono", pnl < 0 ? "text-[#ff8fa0]" : "text-[#3dd68c]")}>
                      {pnl >= 0 ? "+" : ""}
                      {pnl.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button type="button" onClick={() => onPick(p.id)} className="rounded-full border border-white/15 px-3 py-1">
                        Load
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PrintChart({
  symbol,
  bars,
  note,
  tf,
}: {
  symbol: string;
  bars: { t: number; o: number; h: number; l: number; c: number; v: number }[];
  note: string;
  tf: string;
}) {
  if (bars.length < 2) {
    return <div className="grid min-h-[360px] flex-1 place-items-center px-6 text-center text-sm text-muted">{note || "No pool candles."}</div>;
  }
  const w = 860;
  const h = 420;
  const padL = 8;
  const padR = 72;
  const padT = 16;
  const volH = 64;
  const padB = 22;
  const chartH = h - padT - volH - padB;
  const hi = Math.max(...bars.map((b) => b.h));
  const lo = Math.min(...bars.map((b) => b.l));
  const span = hi - lo || hi * 0.01;
  const maxVol = Math.max(1, ...bars.map((b) => b.v));
  const innerW = w - padL - padR;
  const slot = innerW / bars.length;
  const y = (price: number) => padT + ((hi - price) / span) * chartH;
  const ticks = [hi, hi - span / 2, lo];
  const up = bars[bars.length - 1].c >= bars[0].o;
  const fmt = (price: number) => (price >= 100 ? price.toFixed(2) : price.toFixed(4));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="min-h-[360px] w-full flex-1" role="img" aria-label={`${symbol} pool candles`}>
      {ticks.map((price) => (
        <g key={price}>
          <line x1={padL} x2={w - padR} y1={y(price)} y2={y(price)} stroke="#ffffff" strokeOpacity="0.08" />
          <text x={w - padR + 8} y={y(price) + 4} fill="#9aa3b5" fontSize="11" fontFamily="ui-monospace, monospace">
            {fmt(price)}
          </text>
        </g>
      ))}
      {bars.map((b, i) => {
        const x = padL + i * slot + slot / 2;
        const green = b.c >= b.o;
        const color = green ? "#3dd68c" : "#ff5d73";
        const top = y(Math.max(b.o, b.c));
        const bot = y(Math.min(b.o, b.c));
        const body = Math.max(1, bot - top);
        const bw = Math.max(2.2, slot * 0.62);
        return (
          <g key={b.t}>
            <line x1={x} x2={x} y1={y(b.h)} y2={y(b.l)} stroke={color} strokeWidth="1" />
            <rect x={x - bw / 2} y={top} width={bw} height={body} fill={color} />
            <rect
              x={x - bw / 2}
              y={padT + chartH + 8 + (1 - b.v / maxVol) * (volH - 10)}
              width={bw}
              height={(b.v / maxVol) * (volH - 10)}
              fill={color}
              opacity="0.4"
            />
          </g>
        );
      })}
      <text x={padL} y={h - 4} fill="#9aa3b5" fontSize="11" fontFamily="ui-monospace, monospace">
        {symbol} · {tf} · {bars.length} candles · {up ? "up" : "down"} over the window
      </text>
    </svg>
  );
}

function aroundPrint(last: number): { asks: Level[]; bids: Level[] } {
  if (!(last > 0)) return { asks: [], bids: [] };
  const step = last * 0.0015;
  const asks = [4, 3, 2, 1].map((i) => ({ price: last + step * i, usd: 0, tokens: 0 }));
  const bids = [1, 2, 3, 4].map((i) => ({ price: Math.max(0, last - step * i), usd: 0, tokens: 0 }));
  return { asks, bids };
}

function BookRows({
  asks,
  bids,
  last,
  down,
  note,
}: {
  asks: Level[];
  bids: Level[];
  last: number;
  down: boolean;
  note: string;
}) {
  const max = Math.max(1, ...asks.map((l) => l.usd), ...bids.map((l) => l.usd));
  if (asks.length + bids.length === 0) {
    return <p className="px-4 py-8 text-sm text-muted">{note}</p>;
  }
  return (
    <div className="max-h-[420px] overflow-auto px-2 py-1">
      <div className="grid grid-cols-[1fr_auto] px-2 pb-1 font-mono text-[10px] text-subtle">
        <span>Price</span>
        <span>USDC</span>
      </div>
      {asks.map((l) => (
        <Row key={`a-${l.price.toFixed(6)}`} price={l.price} usd={l.usd} max={max} ask />
      ))}
      <p className={cn("px-2 py-2 font-mono text-lg tabular-nums", down ? "text-[#ff5d73]" : "text-[#3dd68c]")}>
        {last.toFixed(4)} {down ? "↓" : "↑"}
      </p>
      {bids.map((l) => (
        <Row key={`b-${l.price.toFixed(6)}`} price={l.price} usd={l.usd} max={max} />
      ))}
    </div>
  );
}

function Row({ price, usd, max, ask }: { price: number; usd: number; max: number; ask?: boolean }) {
  return (
    <div className="relative my-0.5 overflow-hidden rounded-sm">
      <span
        className={cn("absolute inset-y-0", ask ? "right-0 bg-[#ff5d73]/20" : "left-0 bg-[#3dd68c]/15")}
        style={{ width: `${Math.max(8, (usd / max) * 100)}%` }}
      />
      <div className="relative flex justify-between px-2 py-1 font-mono text-xs tabular-nums">
        <span className={ask ? "text-[#ff8fa0]" : "text-[#3dd68c]"}>{price.toFixed(4)}</span>
        <span>{usd > 0 ? usd.toFixed(0) : "—"}</span>
      </div>
    </div>
  );
}

function DepthBars({ asks, bids }: { asks: Level[]; bids: Level[] }) {
  const rows = [...bids].reverse().concat(asks);
  const max = Math.max(1, ...rows.map((l) => l.usd));
  if (!rows.length) return <p className="px-4 py-8 text-sm text-muted">No route to draw.</p>;
  return (
    <ul className="space-y-1 px-4 py-3">
      {rows.map((l, i) => (
        <li key={i} className="flex items-center gap-2 font-mono text-[11px]">
          <span className="w-16 text-subtle">{l.price.toFixed(3)}</span>
          <span className="h-2 rounded-full bg-[#5b7cfa]/70" style={{ width: `${(l.usd / max) * 70}%` }} />
          <span>{l.usd.toFixed(0)}</span>
        </li>
      ))}
    </ul>
  );
}
