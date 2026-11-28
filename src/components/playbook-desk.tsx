import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { compilePlay } from "@/lib/playbook-ai";
import { replayPlay, type PlayBar, type PlayReplay, type PlaySpec } from "@/lib/playbook";
import { printBook } from "@/lib/print-bars";
import { quoteRoute, signRoute, SOL } from "@/lib/jup-sign";
import { USDC } from "@/lib/jup-exec";
import { connectPhantom, mintDecimals } from "@/lib/phantom";
import { spendCap } from "@/lib/spend-cap";
import { tapeNow } from "@/lib/live-tape";
import { searchTape } from "@/lib/world-book";
import type { HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const KEY = "senda.playbook.v1";
const SOL_MINT = SOL;

const EXAMPLES = [
  "Buy SOL when the last hour is up 3% and volume doubles. Take profit at 2%. Stop if it falls 2%.",
  "Buy HYPE when the hour drops 5% and volume doubles. Take profit at 3%. Stop at 4%.",
  "Sell SOL into USDC when the hour is up 4%. Stop if it runs another 2%.",
];

type Step = { label: string; detail: string; ms: number };
type Armed = { spec: PlaySpec; mint: string; name: string; at: number; text: string };

function readArmed(): Armed[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(KEY) || "[]") as Armed[];
    return Array.isArray(rows) ? rows.slice(0, 8) : [];
  } catch {
    return [];
  }
}

function writeArmed(rows: Armed[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 8)));
  } catch {
    /* quota */
  }
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

function RuleChart({ bars, replay }: { bars: PlayBar[]; replay: PlayReplay }) {
  const width = 320;
  const height = 168;
  const closes = bars.map((bar) => bar.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const volMax = Math.max(...bars.map((bar) => bar.volume), 1);
  const x = (i: number) => (bars.length < 2 ? width / 2 : (i / (bars.length - 1)) * width);
  const y = (price: number) => 18 + ((max - price) / span) * 108;
  const line = closes.map((price, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(price).toFixed(1)}`).join(" ");
  const buys = new Set(replay.marks.filter((mark) => mark.kind === "buy").map((mark) => mark.time));
  const sells = new Set(replay.marks.filter((mark) => mark.kind === "sell").map((mark) => mark.time));
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" role="img" aria-label="Pool closes and the rule's prints">
      <rect width={width} height={height} fill="#0c0e14" />
      {bars.map((bar, i) => (
        <rect key={bar.time} x={x(i) - 1} y={148 - (bar.volume / volMax) * 28} width={2} height={(bar.volume / volMax) * 28} fill="rgba(255,255,255,0.18)" />
      ))}
      <path d={line} fill="none" stroke="#d7e36a" strokeWidth="1.6" />
      {bars.map((bar, i) =>
        buys.has(bar.time) ? <circle key={`b${bar.time}`} cx={x(i)} cy={y(bar.close)} r="3.2" fill="#c6f56a" /> : sells.has(bar.time) ? <circle key={`s${bar.time}`} cx={x(i)} cy={y(bar.close)} r="3.2" fill="#ff5d73" /> : null,
      )}
    </svg>
  );
}

export function PlaybookDesk({ names }: { names: HouseListing[] }) {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [text, setText] = useState(EXAMPLES[0]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [spec, setSpec] = useState<PlaySpec | null>(null);
  const [via, setVia] = useState<"grok" | "desk" | "">("");
  const [bars, setBars] = useState<PlayBar[]>([]);
  const [replay, setReplay] = useState<PlayReplay | null>(null);
  const [mint, setMint] = useState("");
  const [title, setTitle] = useState("");
  const [quote, setQuote] = useState("");
  const [busy, setBusy] = useState("");
  const [armed, setArmed] = useState<Armed[]>(() => readArmed());
  const resultRef = useRef<HTMLElement | null>(null);
  const symbols = useMemo(() => {
    const fromTape = tapeNow().map((row) => row.symbol);
    const fromHouse = names.map((row) => row.symbol);
    return [...new Set([...fromTape, ...fromHouse, "SOL", "HYPE"])].filter((symbol) => symbol.length > 0 && symbol.length <= 16).slice(0, 60);
  }, [names]);

  useEffect(() => {
    setArmed(readArmed());
  }, []);

  useEffect(() => {
    if (!replay) return;
    resultRef.current?.scrollIntoView({ block: "start" });
  }, [replay]);

  async function resolveMint(symbol: string): Promise<{ mint: string; name: string } | null> {
    if (symbol.toUpperCase() === "SOL") return { mint: SOL_MINT, name: "Wrapped SOL" };
    const house = names.find((row) => row.symbol.toLowerCase() === symbol.toLowerCase() && row.mint);
    if (house) return { mint: house.mint, name: house.name };
    const local = tapeNow().find((row) => row.symbol.toLowerCase() === symbol.toLowerCase());
    if (local?.id && local.id.length >= 32) return { mint: local.id, name: local.name };
    const hits = await searchTape({ data: symbol }).catch(() => []);
    const hit = hits.find((row) => row.symbol.toLowerCase() === symbol.toLowerCase());
    if (!hit?.id) return null;
    return { mint: hit.id, name: hit.name };
  }

  async function run(sentence = text) {
    setBusy("run");
    setQuote("");
    setReplay(null);
    const next: Step[] = [];
    const mark = (label: string, detail: string, at: number) => {
      next.push({ label, detail, ms: Math.max(1, Math.round(performance.now() - at)) });
      setSteps([...next]);
    };
    try {
      const t0 = performance.now();
      const compiled = await compilePlay({ data: { text: sentence, symbols } });
      if (!compiled.ok) throw new Error(compiled.error);
      mark("Read the sentence", compiled.via === "grok" ? "Grok phrased a coin the desk could not. The coin still had to be in the sentence." : "Price and volume only. Open interest is not armed.", t0);
      const t1 = performance.now();
      const found = await resolveMint(compiled.spec.symbol);
      if (!found) throw new Error(`${compiled.spec.symbol} is not on this tape.`);
      mark("Find the mint", found.name, t1);
      const t2 = performance.now();
      const loaded = await printBook({ data: { mint: found.mint, span: compiled.spec.span } });
      const pool = asBars(loaded.bars);
      if (pool.length < 8) throw new Error("The pool did not print enough bars to replay.");
      const volBars = pool.filter((bar) => bar.volume > 0).length;
      const volNote = compiled.spec.volumeMul && volBars < 8 ? " No volume on these bars, so that clause cannot pass." : "";
      mark("Load the bars", `${pool.length} from ${loaded.source === "none" ? "the book" : loaded.source}.${volNote}`, t2);
      const t3 = performance.now();
      const played = replayPlay(compiled.spec, pool);
      mark(
        "Replay the bars",
        played.trades.length ? `${played.trades.length} closed prints. Not fills.` : "No closed print on this window.",
        t3,
      );
      setSpec(compiled.spec);
      setVia(compiled.via);
      setBars(pool);
      setReplay(played);
      setMint(found.mint);
      setTitle(found.name);
      if (played.fired) {
        const t4 = performance.now();
        try {
          const line = await price(compiled.spec, found.mint, pool);
          mark("Prepare the swap", `${line} Nothing is signed.`, t4);
        } catch (error) {
          const why = error instanceof Error ? error.message : "Jupiter did not quote.";
          setQuote(why);
          mark("Prepare the swap", why, t4);
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The rule did not run.");
    } finally {
      setBusy("");
    }
  }

  async function sized(rule: PlaySpec, id: string, pool: PlayBar[]) {
    const dec = id === SOL_MINT ? 9 : await mintDecimals(id).catch(() => 6);
    if (rule.side === "buy") return { raw: Math.round(rule.usd * 1e6), outDecimals: dec, inMint: USDC, outMint: id };
    const px = pool[pool.length - 1]?.close || 0;
    if (!(px > 0)) throw new Error("No print to size the sell.");
    return { raw: Math.max(1, Math.round((rule.usd / px) * 10 ** dec)), outDecimals: 6, inMint: id, outMint: USDC };
  }

  async function price(rule: PlaySpec, id: string, pool: PlayBar[]) {
    if (rule.usd > spendCap()) {
      const line = `That is $${rule.usd}. The send cap is $${spendCap()}.`;
      setQuote(line);
      return line;
    }
    const order = await sized(rule, id, pool);
    const quoted = await quoteRoute({
      inputMint: order.inMint,
      outputMint: order.outMint,
      amountRaw: order.raw,
      outDecimals: order.outDecimals,
    });
    const line = rule.side === "buy" ? `About ${quoted.outUi < 1 ? quoted.outUi.toPrecision(4) : quoted.outUi.toFixed(4)} ${rule.symbol}` : `About $${quoted.outUi.toFixed(2)} USDC`;
    setQuote(line);
    return line;
  }

  function arm() {
    if (!spec || !mint) return;
    const row: Armed = { spec, mint, name: title, at: Date.now(), text };
    const next = [row, ...armed.filter((item) => item.text !== text)].slice(0, 8);
    writeArmed(next);
    setArmed(next);
    toast.success("Armed on this phone. It does not sign.");
  }

  async function sign() {
    if (!spec || !mint || !replay?.fired) return;
    setBusy("sign");
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const kept = wallet.linkChain(who, "Phantom", "phantom");
        if (!kept.ok && kept.error !== "Already linked.") throw new Error(kept.error || "The wallet did not stay.");
      }
      const order = await sized(spec, mint, bars);
      const done = await signRoute({
        owner: who,
        inputMint: order.inMint,
        outputMint: order.outMint,
        amountRaw: order.raw,
        outDecimals: order.outDecimals,
        usd: spec.usd,
        symbol: spec.symbol,
      });
      toast.success(`Signed. ${done.signature.slice(0, 8)}…`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Phantom did not sign.");
    } finally {
      setBusy("");
    }
  }

  const win = replay ? Math.round(replay.winRate * 100) : 0;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-28">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">Playbook</p>
      <h1 className="mt-1 text-[28px] leading-none font-semibold tracking-tight">Your rule. Not the desk's.</h1>
      <p className="mt-2 max-w-md text-sm leading-snug text-white/55">
        Say when to buy or sell. It reads pool price and volume, replays the bars, and prepares the swap. It never signs. Phantom does.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        className="mt-3 min-h-28 w-full rounded-[22px] border border-white/10 bg-[#10131c] px-4 py-3 text-sm leading-snug outline-none"
      />
      <div className="mt-2 flex gap-2 overflow-x-auto [scrollbar-width:none]">
        {EXAMPLES.map((sample) => (
          <button key={sample} type="button" onClick={() => { setText(sample); void run(sample); }} className="min-h-10 shrink-0 rounded-full bg-white/10 px-3 text-xs font-semibold text-white/80">
            {sample.slice(0, 28)}…
          </button>
        ))}
      </div>
      <button type="button" disabled={busy !== ""} onClick={() => void run()} className="mt-3 min-h-12 w-full rounded-full bg-[#d7e36a] text-sm font-semibold text-black disabled:opacity-40">
        {busy === "run" ? "Reading the pool…" : "Run the rule"}
      </button>
      {steps.length ? (
        <ol className="mt-4 space-y-2">
          {steps.map((step) => (
            <li key={step.label} className="flex items-baseline justify-between gap-3 text-sm">
              <span>
                <span className="font-semibold">{step.label}</span>
                <span className="mt-0.5 block text-xs text-white/45">{step.detail}</span>
              </span>
              <span className="shrink-0 font-mono text-[11px] text-white/35">{step.ms} ms</span>
            </li>
          ))}
        </ol>
      ) : null}
      {spec && replay && bars.length ? (
        <section ref={resultRef} className="mt-4 overflow-hidden rounded-[22px] border border-white/10 bg-[#10131c]">
          <div className="flex items-start justify-between gap-3 px-4 pt-4">
            <div>
              <p className="font-mono text-[11px] tracking-[0.14em] text-white/40 uppercase">{title || spec.symbol}</p>
              <h2 className="text-2xl font-semibold">{spec.symbol}</h2>
            </div>
            <p className="text-right font-mono text-xs text-white/45">{via === "grok" ? "Grok, then the desk" : "Desk"} · ${spec.usd}</p>
          </div>
          <p className="px-4 pt-2 text-sm leading-snug text-white/70">{spec.line}</p>
          <div className="mt-3 px-3">
            <RuleChart bars={bars} replay={replay} />
          </div>
          <div className="grid grid-cols-4 gap-2 px-4 py-3 text-center">
            {[
              [String(replay.trades.length), "Prints"],
              [`${win}%`, "Green"],
              [replay.avgHold ? replay.avgHold.toFixed(1) : "—", "Bars"],
              [`${(replay.maxDd * 100).toFixed(1)}%`, "Worst"],
            ].map(([value, label]) => (
              <div key={label}>
                <p className="font-mono text-lg">{value}</p>
                <p className="text-[10px] tracking-wide text-white/40 uppercase">{label}</p>
              </div>
            ))}
          </div>
          <p className={cn("px-4 pb-4 text-sm", replay.fired ? "text-[#d7e36a]" : "text-white/55")}>
            {replay.fired
              ? `The last bar matches. ${quote || "Asking Jupiter."} Nothing is signed.`
              : replay.open
                ? "The replay is still in a print. That is not a position in the wallet."
                : "The last bar is quiet. Arm it, then check again when you want."}
          </p>
          <div className="grid grid-cols-2 gap-2 px-4 pb-4">
            <button type="button" onClick={arm} className="min-h-12 rounded-full bg-white text-sm font-semibold text-black">
              Arm on this phone
            </button>
            {replay.fired ? (
              <button type="button" disabled={busy !== ""} onClick={() => void sign()} className="min-h-12 rounded-full bg-[#d7e36a] text-sm font-semibold text-black disabled:opacity-40">
                {busy === "sign" ? "Waiting on Phantom" : "Sign with Phantom"}
              </button>
            ) : (
              <button type="button" disabled={busy !== ""} onClick={() => void run()} className="min-h-12 rounded-full border border-white/15 text-sm font-semibold">
                Check again
              </button>
            )}
          </div>
        </section>
      ) : null}
      {armed.length ? (
        <section className="mt-4">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-white/40 uppercase">Armed here</p>
          <ul className="mt-2 space-y-2">
            {armed.map((row) => (
              <li key={`${row.spec.symbol}-${row.at}`}>
                <button type="button" onClick={() => { setText(row.text); void run(row.text); }} className="w-full rounded-2xl bg-white/[0.04] px-3 py-3 text-left">
                  <span className="block text-sm font-semibold">{row.spec.symbol} · {row.spec.side}</span>
                  <span className="mt-1 block text-xs leading-snug text-white/45">{row.spec.line}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
