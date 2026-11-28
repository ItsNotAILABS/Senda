import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  clampPromise,
  inventFromBars,
  pickSize,
  roomLeft,
  type FloorPromise,
  type PromiseMode,
  type SizeRow,
} from "@/lib/floor-mind";
import { monroeRoute } from "@/lib/monroe";
import { replayPlay, type PlayBar, type PlayReplay, type PlaySpec } from "@/lib/playbook";
import { printBook } from "@/lib/print-bars";
import { getLiquifyLadder } from "@/lib/liquify";
import { SOL, signRoute } from "@/lib/jup-sign";
import { USDC } from "@/lib/jup-exec";
import { connectPhantom, mintDecimals } from "@/lib/phantom";
import { spendCap } from "@/lib/spend-cap";
import type { HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const PROMISE_KEY = "senda.floor.promise.v1";
const SPENT_KEY = "senda.floor.spent.v1";
const ARMED_KEY = "senda.floor.armed.v1";

type Speech = { id: string; text: string; at: number };
type Armed = { symbol: string; mint: string; spec: PlaySpec; barTime: number };
type Card = {
  symbol: string;
  name: string;
  mint: string;
  spec: PlaySpec;
  replay: PlayReplay;
  bars: PlayBar[];
  why: string;
  sizeNote: string;
  engine: string;
  routeNote: string | null;
  quote: string | null;
  onlyDirect: boolean;
  raw: number;
  outDecimals: number;
  inMint: string;
  outMint: string;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function readPromise(): FloorPromise {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PROMISE_KEY) || "null") as { mode?: string; tradeUsd?: number; dayUsd?: number } | null;
    return clampPromise(raw || { mode: "alert", tradeUsd: 25, dayUsd: 100 }, spendCap());
  } catch {
    return clampPromise({ mode: "alert", tradeUsd: 25, dayUsd: 100 }, spendCap());
  }
}

function readSpent(): number {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SPENT_KEY) || "null") as { day?: string; usd?: number } | null;
    if (!raw || raw.day !== today()) return 0;
    return Math.max(0, Number(raw.usd) || 0);
  } catch {
    return 0;
  }
}

function writeSpent(usd: number) {
  const next = readSpent() + usd;
  window.localStorage.setItem(SPENT_KEY, JSON.stringify({ day: today(), usd: next }));
  return next;
}

function readArmed(): Armed[] {
  try {
    const rows = JSON.parse(window.localStorage.getItem(ARMED_KEY) || "[]") as Armed[];
    return Array.isArray(rows) ? rows.slice(0, 4) : [];
  } catch {
    return [];
  }
}

function targets(names: HouseListing[]): { symbol: string; mint: string; name: string }[] {
  const book = [{ symbol: "SOL", mint: SOL, name: "Wrapped SOL" }];
  const next = [...names]
    .filter((row) => row.mint && row.mint !== SOL && row.symbol && row.last > 0 && row.premium != null)
    .sort((a, b) => Math.abs(b.premium || 0) - Math.abs(a.premium || 0))[0];
  if (next) book.push({ symbol: next.symbol, mint: next.mint, name: next.name });
  return book;
}

function asBars(rows: unknown): PlayBar[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const bar = row as { time?: number; open?: number; high?: number; low?: number; close?: number; volume?: number };
      return {
        time: Number(bar.time) || 0,
        open: Number(bar.open) || 0,
        high: Number(bar.high) || 0,
        low: Number(bar.low) || 0,
        close: Number(bar.close) || 0,
        volume: Number(bar.volume) || 0,
      };
    })
    .filter((bar) => bar.close > 0)
    .sort((a, b) => a.time - b.time);
}

function hourNote(bars: PlayBar[]): string {
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  if (!last || !prev || !(prev.close > 0)) return "The pool did not print an hour I can read.";
  const move = ((last.close - prev.close) / prev.close) * 100;
  const vol = prev.volume > 0 && last.volume > 0 ? ` Volume was ${(last.volume / prev.volume).toFixed(1)}× the prior hour.` : " Volume did not print.";
  return `The last hour moved ${move >= 0 ? "+" : ""}${move.toFixed(1)}%.${vol}`;
}

function Spark({ bars, replay }: { bars: PlayBar[]; replay: PlayReplay }) {
  const width = 320;
  const height = 92;
  const closes = bars.map((bar) => bar.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const x = (i: number) => (bars.length < 2 ? width / 2 : (i / (bars.length - 1)) * width);
  const y = (price: number) => 8 + ((max - price) / span) * 76;
  const line = closes.map((price, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(price).toFixed(1)}`).join(" ");
  const buys = new Set(replay.marks.filter((mark) => mark.kind === "buy").map((mark) => mark.time));
  const sells = new Set(replay.marks.filter((mark) => mark.kind === "sell").map((mark) => mark.time));
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full" role="img" aria-label="Hourly closes and the rule's prints">
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.6" className="text-accent" />
      {bars.map((bar, i) =>
        buys.has(bar.time) ? (
          <circle key={`b${bar.time}`} cx={x(i)} cy={y(bar.close)} r="3" className="fill-accent" />
        ) : sells.has(bar.time) ? (
          <circle key={`s${bar.time}`} cx={x(i)} cy={y(bar.close)} r="3" className="fill-down" />
        ) : null,
      )}
    </svg>
  );
}

export function FloorDesk({ names }: { names: HouseListing[] }) {
  const wallet = useWallet();
  const owner = wallet.w.links.find((link) => link.kind === "phantom" || link.kind === "solana")?.address ?? "";
  const [promise, setPromise] = useState<FloorPromise>(() => clampPromise({ mode: "alert", tradeUsd: 25, dayUsd: 100 }, 100));
  const [spent, setSpent] = useState(0);
  const [lines, setLines] = useState<Speech[]>([
    { id: "open", at: 0, text: "I write the strategy from the last hour. You set what I may do, and how much. I never hold the key." },
  ]);
  const [cards, setCards] = useState<Card[]>([]);
  const [armed, setArmed] = useState<Armed[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [busy, setBusy] = useState<"work" | "sign" | "">("");
  const scroller = useRef<HTMLDivElement | null>(null);
  const cap = spendCap();
  const room = roomLeft(promise, spent, cap);
  const book = useMemo(() => targets(names), [names]);

  useEffect(() => {
    setPromise(readPromise());
    setSpent(readSpent());
    setArmed(readArmed());
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [lines, cards, alerts]);

  function savePromise(next: FloorPromise) {
    const clamped = clampPromise(next, spendCap());
    setPromise(clamped);
    try {
      window.localStorage.setItem(PROMISE_KEY, JSON.stringify(clamped));
    } catch {
      /* quota */
    }
  }

  function say(text: string) {
    setLines((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, text, at: Date.now() }]);
  }

  function keep(card: Card) {
    if (promise.mode === "watch") {
      toast.error("Watch does not alert. Raise the promise.");
      return;
    }
    const row: Armed = { symbol: card.symbol, mint: card.mint, spec: card.spec, barTime: card.bars[card.bars.length - 1]?.time || 0 };
    const next = [row, ...armed.filter((item) => item.symbol !== card.symbol)].slice(0, 4);
    setArmed(next);
    window.localStorage.setItem(ARMED_KEY, JSON.stringify(next));
    toast.success(`${card.symbol} stays on watch. It still does not sign.`);
  }

  async function sign(card: Card) {
    if (promise.mode !== "prepare") {
      toast.error("The promise is not prepare. I will not build a swap.");
      return;
    }
    if (!card.replay.fired || !(card.spec.usd > 0) || card.spec.usd > roomLeft(promise, readSpent(), spendCap())) {
      toast.error("That size is outside the promise.");
      return;
    }
    setBusy("sign");
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const kept = wallet.linkChain(who, "Phantom", "phantom");
        if (!kept.ok && kept.error !== "Already linked.") throw new Error(kept.error || "The wallet did not stay.");
      }
      const done = await signRoute({
        owner: who,
        inputMint: card.inMint,
        outputMint: card.outMint,
        amountRaw: card.raw,
        outDecimals: card.outDecimals,
        usd: card.spec.usd,
        symbol: card.symbol,
        onlyDirect: card.onlyDirect,
      });
      setSpent(writeSpent(card.spec.usd));
      say(`Phantom signed ${card.symbol}. ${done.signature.slice(0, 8)}. I did not.`);
      toast.success(`Signed. ${done.signature.slice(0, 8)}…`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Phantom did not sign.");
    } finally {
      setBusy("");
    }
  }

  async function readOne(name: { symbol: string; mint: string; name: string }, budget: number, mode: PromiseMode): Promise<Card | null> {
    const [loaded, ladder] = await Promise.all([
      printBook({ data: { mint: name.mint, span: "60" } }).catch(() => null),
      budget >= 5 ? getLiquifyLadder({ data: { mint: name.mint } }).catch(() => null) : Promise.resolve(null),
    ]);
    const bars = asBars(loaded && "bars" in loaded ? loaded.bars : []);
    if (bars.length < 8) {
      say(`${name.symbol}. The pool did not print enough hours.`);
      return null;
    }
    say(`${name.symbol}. ${hourNote(bars)}`);
    const rows: Array<SizeRow & { outAmount: string | null }> = (ladder?.sizes || []).map((row) => ({
      usd: row.usd,
      status: row.status,
      impactPct: row.quote?.impactPct ?? null,
      router: row.quote?.router ?? null,
      outAmount: row.quote?.outAmount ?? null,
    }));
    const sized = pickSize(rows, budget);
    const usd = sized.usd ?? 0;
    if (ladder) say(`${sized.note} ${ladder.source}.`);
    else say(budget >= 5 ? "Liquify did not answer, so I will not invent a size." : sized.note);
    const spec = inventFromBars(name.symbol, bars, usd);
    if (!spec) {
      say(`${name.symbol} is quiet. I am not writing a rule the hour does not support.`);
      return null;
    }
    const replay = replayPlay(spec, bars);
    say(spec.line);
    say(
      replay.trades.length
        ? `${replay.trades.length} closed ${replay.trades.length === 1 ? "print" : "prints"} on the replay. ${Math.round(replay.winRate * 100)}% of them were green. Those are prints, not fills.`
        : "No closed print on this window. The rule is still only a read.",
    );
    let routeNote: string | null = null;
    let quote: string | null = null;
    let onlyDirect = false;
    let raw = 0;
    let outDecimals = 6;
    let inMint = USDC;
    let outMint = name.mint;
    if (mode === "prepare" && usd > 0) {
      const dec = name.mint === SOL ? 9 : await mintDecimals(name.mint).catch(() => null);
      if (dec == null) {
        routeNote = "The mint decimals did not come back, so Monroe did not quote.";
      } else if (spec.side === "buy") {
        raw = Math.round(usd * 1e6);
        outDecimals = dec;
        inMint = USDC;
        outMint = name.mint;
      } else {
        const px = bars[bars.length - 1]?.close || 0;
        if (!(px > 0)) routeNote = "No print to size the sell.";
        else {
          raw = Math.max(1, Math.round((usd / px) * 10 ** dec));
          outDecimals = 6;
          inMint = name.mint;
          outMint = USDC;
        }
      }
      if (raw > 0 && !routeNote) {
        const row = rows.find((item) => item.usd === usd && item.outAmount);
        const routed = await monroeRoute({
          side: spec.side,
          mint: name.mint,
          amountRaw: raw,
          outDecimals,
          liquify: spec.side === "buy" && row?.outAmount ? { outAmount: row.outAmount, route: row.router || "Liquify", impact: row.impactPct } : null,
        }).catch((error: unknown) => {
          routeNote = error instanceof Error ? error.message : "Monroe did not get a route.";
          return null;
        });
        if (routed) {
          routeNote = routed.note;
          onlyDirect = routed.onlyDirect;
          if (routed.quote) {
            quote = spec.side === "buy"
              ? `About ${routed.quote.outUi < 1 ? routed.quote.outUi.toPrecision(4) : routed.quote.outUi.toFixed(4)} ${name.symbol}. Nothing is signed.`
              : `About $${routed.quote.outUi.toFixed(2)} USDC. Nothing is signed.`;
          }
        }
      }
      if (routeNote) say(routeNote);
      if (quote) say(quote);
      if (!replay.fired) say("The last bar is quiet, so this route is not a trade.");
    } else if (replay.fired && usd <= 0) {
      say("The last bar matches, but Liquify did not size it, so there is nothing to sign.");
    } else if (replay.fired && mode !== "prepare") {
      say("The last bar matches. I prepared nothing. Raise the promise to prepare if you want a route.");
    } else if (!replay.fired) {
      say("The last bar is quiet. Arm it if you want me to look again.");
    }
    return {
      symbol: name.symbol,
      name: name.name,
      mint: name.mint,
      spec,
      replay,
      bars,
      why: hourNote(bars),
      sizeNote: sized.note,
      engine: ladder?.source || "Liquify did not answer",
      routeNote,
      quote,
      onlyDirect,
      raw,
      outDecimals,
      inMint,
      outMint,
    };
  }

  async function work() {
    if (busy) return;
    setBusy("work");
    setCards([]);
    const budget = roomLeft(promise, readSpent(), spendCap());
    say(budget >= 5 ? `Reading ${book.map((row) => row.symbol).join(" and ")}. One trade may use $${budget}.` : "Nothing is left inside the promise today. I will read, and I will not size.");
    const made: Card[] = [];
    try {
      for (const name of book) {
        const card = await readOne(name, budget, promise.mode);
        if (card) made.push(card);
      }
      if (!made.length) say("I did not write a strategy. The hours I could read were quiet, or the pools did not print.");
      setCards(made);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The floor stopped.");
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    if (promise.mode === "watch" || armed.length === 0) return;
    let live = true;
    const look = async () => {
      const row = armed[0];
      if (!row) return;
      const loaded = await printBook({ data: { mint: row.mint, span: "60" } }).catch(() => null);
      if (!live || !loaded) return;
      const bars = asBars("bars" in loaded ? loaded.bars : []);
      const last = bars[bars.length - 1];
      if (!last || last.time === row.barTime) return;
      const played = replayPlay(row.spec, bars);
      if (!played.fired) return;
      setAlerts((prev) => [`${row.symbol} matches the rule I wrote. I did not sign. ${row.spec.line}`, ...prev].slice(0, 4));
      setArmed((prev) => {
        const next = prev.map((item) => (item.symbol === row.symbol ? { ...item, barTime: last.time } : item));
        try {
          window.localStorage.setItem(ARMED_KEY, JSON.stringify(next));
        } catch {
          /* quota */
        }
        return next;
      });
    };
    const timer = window.setInterval(() => void look(), 90_000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [armed, promise.mode]);

  const modes: { id: PromiseMode; label: string }[] = [
    { id: "watch", label: "Watch" },
    { id: "alert", label: "Alert" },
    { id: "prepare", label: "Prepare" },
  ];
  const trades = [5, 25, 100].filter((n) => n <= cap);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg text-fg">
      <header className="border-b border-border px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] tracking-[0.18em] text-accent uppercase">Floor</p>
            <h1 className="mt-1 text-[22px] leading-none">I write it. You allow it.</h1>
          </div>
          <p className="text-right font-mono text-[11px] text-subtle">
            ${spent.toFixed(0)} used
            <span className="mt-1 block text-muted">${room.toFixed(0)} left</span>
          </p>
        </div>
        <div className="mt-3 flex gap-1">
          {modes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => savePromise({ ...promise, mode: mode.id })}
              className={cn("min-h-11 flex-1 rounded-full text-sm font-semibold", promise.mode === mode.id ? "bg-accent text-accent-fg" : "bg-surface text-muted")}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {trades.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => savePromise({ ...promise, tradeUsd: n, dayUsd: Math.max(promise.dayUsd, n) })}
              className={cn("min-h-10 shrink-0 rounded-full px-3 text-xs font-semibold", promise.tradeUsd === n ? "bg-fg text-bg" : "bg-surface text-muted")}
            >
              ${n} a trade
            </button>
          ))}
          {[promise.tradeUsd, 100, 250].filter((n, i, all) => n >= promise.tradeUsd && n <= 5000 && all.indexOf(n) === i).map((n) => (
            <button
              key={`day-${n}`}
              type="button"
              onClick={() => savePromise({ ...promise, dayUsd: Math.max(n, promise.tradeUsd) })}
              className={cn("min-h-10 shrink-0 rounded-full px-3 text-xs font-semibold", promise.dayUsd === n ? "bg-fg text-bg" : "bg-surface text-muted")}
            >
              ${n} today
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-snug text-subtle">
          {promise.mode === "watch"
            ? "I read and I write. I do not alert and I do not build a swap."
            : promise.mode === "alert"
              ? "I tell you when the last hour matches. I still do not build a swap."
              : "When the last hour matches, Liquify sizes it and Monroe picks the route. You sign."}
        </p>
      </header>
      <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 pb-28">
        {alerts.map((alert) => (
          <p key={alert} className="rounded-2xl border border-accent/40 bg-surface px-3 py-3 text-sm leading-snug text-fg">
            {alert}
          </p>
        ))}
        {lines.map((line) => (
          <p key={line.id} className="max-w-[34rem] text-[15px] leading-snug text-fg/90">
            {line.text}
          </p>
        ))}
        {cards.map((card) => (
          <article key={card.symbol} className="overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="flex items-start justify-between gap-3 px-3 pt-3">
              <div>
                <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">{card.name}</p>
                <h2 className="text-2xl">{card.symbol}</h2>
              </div>
              <p className="text-right font-mono text-[11px] text-muted">{card.spec.side === "buy" ? "Buy" : "Sell"} · ${card.spec.usd || "—"}</p>
            </div>
            <p className="px-3 pt-2 text-sm leading-snug text-muted">{card.why}</p>
            <div className="px-3 pt-2 text-accent">
              <Spark bars={card.bars} replay={card.replay} />
            </div>
            <div className="grid grid-cols-3 gap-2 px-3 pb-2 text-center">
              {[
                [String(card.replay.trades.length), "Prints"],
                [`${Math.round(card.replay.winRate * 100)}%`, "Green"],
                [`${(card.replay.maxDd * 100).toFixed(1)}%`, "Worst"],
              ].map(([value, label]) => (
                <div key={label}>
                  <p className="font-mono text-lg">{value}</p>
                  <p className="text-[10px] tracking-wide text-subtle uppercase">{label}</p>
                </div>
              ))}
            </div>
            <p className="px-3 pb-2 text-xs leading-snug text-subtle">{card.sizeNote} {card.engine}.</p>
            {card.routeNote ? <p className="px-3 pb-2 text-xs leading-snug text-muted">{card.routeNote}</p> : null}
            {card.quote ? <p className="px-3 pb-2 text-sm leading-snug">{card.quote}</p> : null}
            <div className="grid grid-cols-2 gap-2 px-3 pb-3">
              <button type="button" onClick={() => keep(card)} className="min-h-12 rounded-full bg-fg text-sm font-semibold text-bg">
                Keep watch
              </button>
              {promise.mode === "prepare" && card.replay.fired && card.spec.usd > 0 && card.quote ? (
                <button type="button" disabled={busy !== ""} onClick={() => void sign(card)} className="min-h-12 rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
                  {busy === "sign" ? "Waiting on Phantom" : `Sign $${card.spec.usd}`}
                </button>
              ) : (
                <p className="flex min-h-12 items-center text-xs leading-snug text-subtle">
                  {card.replay.fired ? "Not a signature. The promise does not prepare this." : card.quote ? "Route only. Not live." : "Last hour is quiet."}
                </p>
              )}
            </div>
          </article>
        ))}
        <button type="button" disabled={busy !== ""} onClick={() => void work()} className="min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
          {busy === "work" ? "Reading the book…" : "Let the floor work"}
        </button>
      </div>
    </div>
  );
}
