import { useEffect, useState } from "react";
import { FillButton } from "@/components/fill-button";
import { getPrint, type PrintBar } from "@/lib/print";
import { cn } from "@/lib/utils";
import { jupTape, worldBook, type TapeRow, type WorldLane, type WorldRow } from "@/lib/world-book";

type LaneId = WorldLane | "tokens";

const LANES: { id: LaneId | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "fx", label: "FX" },
  { id: "metals", label: "Metals" },
  { id: "energy", label: "Energy" },
  { id: "softs", label: "Softs" },
  { id: "index", label: "Index" },
  { id: "crypto", label: "Crypto" },
  { id: "shares", label: "Shares" },
  { id: "tokens", label: "Tokens" },
];

const CHIPS = [1, 5, 25] as const;

function digits(n: number): number {
  const a = Math.abs(n);
  if (a >= 100) return 2;
  if (a >= 10) return 3;
  if (a >= 1) return 5;
  return 6;
}

function fmt(n: number | null | undefined, quote?: string): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const d = digits(n);
  const body = n.toLocaleString("en-US", {
    minimumFractionDigits: Math.min(2, d),
    maximumFractionDigits: d,
  });
  if (!quote || quote === "USD") return `$${body}`;
  return `${body} ${quote}`;
}

function basisBps(spot: number | null, mid: number | null): number | null {
  if (spot == null || mid == null || !(spot > 0) || !(mid > 0)) return null;
  return ((spot - mid) / mid) * 10000;
}

function CandleChart({ symbol, bars }: { symbol: string; bars: PrintBar[] }) {
  const w = 720;
  const h = 280;
  const padL = 8;
  const padR = 68;
  const padT = 14;
  const volH = 44;
  const padB = 18;
  const chartH = h - padT - volH - padB;
  const hi = Math.max(...bars.map((b) => b.h));
  const lo = Math.min(...bars.map((b) => b.l));
  const span = hi - lo || Math.abs(hi) * 0.01 || 1;
  const maxVol = Math.max(1, ...bars.map((b) => b.v));
  const slot = (w - padL - padR) / bars.length;
  const y = (price: number) => padT + ((hi - price) / span) * chartH;
  const ticks = [hi, hi - span / 2, lo];
  const up = bars[bars.length - 1].c >= bars[0].o;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-64 w-full"
      role="img"
      aria-label={`${symbol} pool candles`}
    >
      {ticks.map((price) => (
        <g key={price}>
          <line
            x1={padL}
            x2={w - padR}
            y1={y(price)}
            y2={y(price)}
            stroke="#ffffff"
            strokeOpacity="0.08"
          />
          <text
            x={w - padR + 8}
            y={y(price) + 4}
            fill="#9aa3b5"
            fontSize="11"
            fontFamily="ui-monospace, monospace"
          >
            {price >= 100 ? price.toFixed(2) : price >= 1 ? price.toFixed(4) : price.toPrecision(3)}
          </text>
        </g>
      ))}
      {bars.map((b, i) => {
        const x = padL + i * slot + slot / 2;
        const color = b.c >= b.o ? "#3dd68c" : "#ff5d73";
        const top = y(Math.max(b.o, b.c));
        const bot = y(Math.min(b.o, b.c));
        const bw = Math.max(2, slot * 0.62);
        return (
          <g key={b.t}>
            <line x1={x} x2={x} y1={y(b.h)} y2={y(b.l)} stroke={color} strokeWidth="1" />
            <rect x={x - bw / 2} y={top} width={bw} height={Math.max(1, bot - top)} fill={color} />
            <rect
              x={x - bw / 2}
              y={padT + chartH + 8 + (1 - b.v / maxVol) * (volH - 8)}
              width={bw}
              height={(b.v / maxVol) * (volH - 8)}
              fill={color}
              opacity="0.4"
            />
          </g>
        );
      })}
      <text x={padL} y={h - 4} fill="#9aa3b5" fontSize="11" fontFamily="ui-monospace, monospace">
        {symbol} · 1H · {bars.length} candles · {up ? "up" : "down"} over the window
      </text>
    </svg>
  );
}

export function WorldDesk({ start }: { start?: LaneId | "all" | "comms" }) {
  const [lane, setLane] = useState<LaneId | "all" | "comms">(
    start ?? (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("lane") === "energy" ? "energy" : "all"),
  );
  const [pick, setPick] = useState("EUR-USD");
  const [usd, setUsd] = useState<number>(5);
  const [book, setBook] = useState<WorldRow[]>([]);
  const [tape, setTape] = useState<TapeRow[]>([]);
  const [tapeReady, setTapeReady] = useState(false);
  const [note, setNote] = useState("Loading the prints…");
  const [bars, setBars] = useState<PrintBar[]>([]);
  const [barMint, setBarMint] = useState("");
  const [barNote, setBarNote] = useState("");
  const [barsReady, setBarsReady] = useState(false);

  useEffect(() => {
    let live = true;
    const pullBook = () => {
      worldBook()
        .then((rows) => {
          if (!live) return;
          setBook((prev) => (rows.some((r) => r.mid != null) || prev.length === 0 ? rows : prev));
          setNote("");
        })
        .catch(() => {
          if (live) setNote("The prints did not load.");
        });
    };
    const pullTape = () => {
      jupTape()
        .then((rows) => {
          if (!live) return;
          setTape(rows);
          setTapeReady(true);
        })
        .catch(() => {
          if (!live) return;
          setTape([]);
          setTapeReady(true);
        });
    };
    pullBook();
    pullTape();
    const bookId = window.setInterval(pullBook, 15_000);
    const tapeId = window.setInterval(pullTape, 60_000);
    return () => {
      live = false;
      window.clearInterval(bookId);
      window.clearInterval(tapeId);
    };
  }, []);

  useEffect(() => {
    if (lane === "tokens") {
      if (tape.length && !tape.some((t) => t.id === pick)) setPick(tape[0].id);
      return;
    }
    const rows = lane === "all" ? book : lane === "comms" ? book.filter((r) => r.lane === "metals" || r.lane === "energy" || r.lane === "softs") : book.filter((r) => r.lane === lane);
    if (rows.length && !rows.some((r) => r.id === pick)) setPick(rows[0].id);
  }, [lane, book, tape, pick]);

  const row =
    lane === "tokens" ? null : (book.find((r) => (lane === "all" || (lane === "comms" && (r.lane === "metals" || r.lane === "energy" || r.lane === "softs")) || r.lane === lane) && r.id === pick) ?? null);
  const token = lane === "tokens" ? (tape.find((t) => t.id === pick) ?? null) : null;
  const mint = token?.id || row?.hold?.mint || "";

  useEffect(() => {
    if (mint.length < 32) {
      setBars([]);
      setBarMint("");
      setBarNote("");
      setBarsReady(false);
      return;
    }
    let live = true;
    setBarsReady(false);
    setBarNote("Loading the pool…");
    void getPrint({ data: { mint, tf: "1H" } })
      .then((r) => {
        if (!live) return;
        setBars(r.bars);
        setBarMint(mint);
        setBarNote(r.note);
        setBarsReady(true);
      })
      .catch(() => {
        if (!live) return;
        setBars([]);
        setBarMint(mint);
        setBarNote("The print did not load.");
        setBarsReady(true);
      });
    return () => {
      live = false;
    };
  }, [mint]);

  const laneRows = book.filter((r) => r.lane === lane);
  const bps = row ? basisBps(row.spot, row.mid) : null;
  const tradeSymbol = token?.symbol || row?.hold?.symbol || "";
  const tradePrice = token
    ? token.price != null && token.price > 0
      ? token.price
      : undefined
    : row?.spot != null && row.spot > 0
      ? row.spot
      : row?.mid != null && row.mid > 0
        ? row.mid
        : undefined;
  const canSign = Boolean(mint && tradeSymbol);
  const down = token ? (token.change ?? 0) < 0 : false;
  const liveBars = barsReady && barMint === mint ? bars : [];

  return (
    <section className="mx-3 mt-3 mb-6 overflow-hidden rounded-[28px] bg-[#101114]">
      <div className="flex gap-1.5 overflow-x-auto px-4 pt-4 pb-2">
        {LANES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setLane(item.id)}
            className={cn(
              "min-h-8 shrink-0 rounded-full px-3 text-xs font-semibold",
              lane === item.id ? "bg-white text-black" : "bg-white/10 text-white/70",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
        <ul className="order-2 max-h-[640px] overflow-auto border-white/10 lg:order-1 lg:border-r">
          {lane === "tokens"
            ? tape.map((t) => {
                const on = token?.id === t.id;
                const chg = t.change;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setPick(t.id)}
                      className={cn(
                        "flex w-full items-center gap-2 px-4 py-2.5 text-left",
                        on ? "bg-white/8" : "hover:bg-white/5",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate font-mono text-xs font-semibold">
                        {t.symbol}
                      </span>
                      <span className="font-mono text-xs tabular-nums">{fmt(t.price)}</span>
                      <span
                        className={cn(
                          "w-16 text-right font-mono text-[11px] tabular-nums",
                          (chg ?? 0) < 0 ? "text-[#ff8fa0]" : "text-[#3dd68c]",
                        )}
                      >
                        {chg == null ? "—" : `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`}
                      </span>
                    </button>
                  </li>
                );
              })
            : lane === "all" || lane === "comms"
              ? (
                  (lane === "comms"
                    ? [
                        ["metals", "Metals"],
                        ["energy", "Energy"],
                        ["softs", "Softs"],
                      ]
                    : [
                        ["fx", "FX"],
                        ["metals", "Metals"],
                        ["energy", "Energy"],
                        ["softs", "Softs"],
                        ["index", "Index"],
                        ["crypto", "Crypto"],
                        ["shares", "Shares"],
                      ]) as readonly (readonly [WorldLane, string])[]
                ).map(([id, label]) => {
                  const rows = book.filter((r) => r.lane === id);
                  if (!rows.length) return null;
                  return (
                    <li key={id}>
                      <p className="px-4 pt-3 text-[11px] tracking-[0.14em] text-white/40 uppercase">{label}</p>
                      <ul>
                        {rows.map((r) => {
                          const on = row?.id === r.id;
                          return (
                            <li key={r.id}>
                              <button type="button" onClick={() => { setLane("all"); setPick(r.id); }} className={cn("flex w-full items-center gap-2 px-4 py-2.5 text-left", on ? "bg-white/8" : "hover:bg-white/5")}>
                                <span className={cn("size-1.5 shrink-0 rounded-full", r.open ? "bg-[#3dd68c]" : "bg-white/25")} />
                                <span className="w-20 truncate font-mono text-xs font-semibold">{r.base}</span>
                                <span className="ml-auto font-mono text-xs tabular-nums">{fmt(r.mid, r.quote)}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  );
                })
              : laneRows.map((r) => {
                const on = row?.id === r.id;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setPick(r.id)}
                      className={cn(
                        "flex w-full items-center gap-2 px-4 py-2.5 text-left",
                        on ? "bg-white/8" : "hover:bg-white/5",
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          r.open ? "bg-[#3dd68c]" : "bg-white/25",
                        )}
                      />
                      <span className="w-20 truncate font-mono text-xs font-semibold">
                        {r.base}
                      </span>
                      <span className="ml-auto font-mono text-xs tabular-nums">
                        {fmt(r.mid, r.quote)}
                      </span>
                    </button>
                  </li>
                );
              })}
          {lane === "tokens" && tape.length === 0 ? (
            <li className="px-4 py-8 text-sm text-white/45">
              {tapeReady ? "Jupiter did not return a tape." : "Loading the tape…"}
            </li>
          ) : null}
          {lane !== "tokens" && laneRows.length === 0 ? (
            <li className="px-4 py-8 text-sm text-white/45">{note || "Loading the prints…"}</li>
          ) : null}
        </ul>

        <div className="order-1 flex min-h-[520px] min-w-0 flex-col bg-[#10131a] lg:order-2">
          <header className="px-4 py-4">
            {token ? (
              <>
                <p className="text-sm text-white/50">
                  {token.symbol} · {token.name}
                </p>
                <p
                  className={cn(
                    "mt-1 font-mono text-4xl tracking-tight tabular-nums",
                    down ? "text-[#ff5d73]" : "text-white",
                  )}
                >
                  {fmt(token.price)}
                </p>
                <p className="mt-1 font-mono text-sm text-white/55">
                  {token.change == null
                    ? "No 24h"
                    : `${token.change >= 0 ? "+" : ""}${token.change.toFixed(2)}%`}
                  <span className="text-white/35"> · Jupiter</span>
                </p>
              </>
            ) : row ? (
              <>
                <p className="text-sm text-white/50">
                  {row.base} · {row.id}
                  {row.open === false ? " · Closed" : row.open ? " · Open" : ""}
                </p>
                <p className="mt-1 font-mono text-4xl tracking-tight text-white tabular-nums">
                  {fmt(row.mid, row.quote)}
                </p>
                <p className="mt-1 font-mono text-sm text-white/55">
                  Bid {fmt(row.bid, row.quote)}
                  <span className="text-white/35"> · </span>
                  Ask {fmt(row.ask, row.quote)}
                  {bps != null ? (
                    <span className="text-white/70">
                      {" "}
                      · hold vs print {bps >= 0 ? "+" : ""}
                      {bps.toFixed(1)} bps
                    </span>
                  ) : null}
                </p>
                {row.hold ? (
                  <p className="mt-2 max-w-md text-sm text-white/50">{row.hold.note}</p>
                ) : null}
                {row.hold && row.spot != null ? (
                  <p className="mt-1 font-mono text-xs text-white/45">
                    {row.hold.symbol} {fmt(row.spot)}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-white/50">{note || "Pick a name"}</p>
            )}
            {lane === "shares" && row && !row.hold ? (
              <p className="mt-2 max-w-md text-sm text-white/50">
                Ostium print. No Solana token for this name yet.
              </p>
            ) : null}
          </header>

          <div className="flex min-h-64 flex-1 flex-col border-t border-white/10">
            {lane === "tokens" && !token ? (
              <div className="grid min-h-64 flex-1 place-items-center px-6 text-center text-sm text-white/50">
                {tapeReady ? "Jupiter did not return a tape." : "Loading the tape…"}
              </div>
            ) : !token && !row ? (
              <div className="grid min-h-64 flex-1 place-items-center px-6 text-center text-sm text-white/50">
                {note || "Loading the prints…"}
              </div>
            ) : mint ? (
              liveBars.length ? (
                <CandleChart symbol={tradeSymbol || row?.base || ""} bars={liveBars} />
              ) : (
                <div className="grid min-h-64 flex-1 place-items-center px-6 text-center text-sm text-white/50">
                  {barsReady && barMint === mint
                    ? barNote || "The pool returned no candles."
                    : "Loading the pool…"}
                </div>
              )
            ) : (
              <div className="grid min-h-64 flex-1 place-items-center px-6 text-center text-sm text-white/50">
                No Solana pool, so no candle. Bid and ask are the print.
              </div>
            )}
          </div>

          <div className="border-t border-white/10 p-3">
            <div className="flex gap-1">
              {CHIPS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setUsd(n)}
                  className={cn(
                    "min-h-8 flex-1 rounded-full font-mono text-[11px]",
                    usd === n ? "bg-white text-black" : "bg-white/10 text-white/70",
                  )}
                >
                  ${n}
                </button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {canSign ? (
                <>
                  <FillButton
                    mint={mint}
                    usd={usd}
                    side="buy"
                    price={tradePrice}
                    symbol={tradeSymbol}
                    label={`Buy $${usd}`}
                    className="min-h-11 w-full rounded-md bg-[#3dd68c] text-sm font-semibold text-black"
                  />
                  <FillButton
                    mint={mint}
                    usd={usd}
                    side="sell"
                    price={tradePrice}
                    symbol={tradeSymbol}
                    label={`Sell $${usd}`}
                    className="min-h-11 w-full rounded-md bg-[#e23b4a] text-sm font-semibold text-white"
                  />
                </>
              ) : (
                <button
                  type="button"
                  disabled
                  className="col-span-2 min-h-11 w-full rounded-md bg-white/10 text-sm font-semibold text-white/40"
                >
                  {lane === "tokens" && !tapeReady ? "Loading the tape…" : "No token to sign"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
