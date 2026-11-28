import { Buffer } from "buffer";
import { useEffect, useMemo, useState } from "react";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { toast } from "sonner";
import { MarkFace } from "@/components/holding-cards";
import { noteFill } from "@/lib/account-book";
import { connectPhantom, signAndBroadcast } from "@/lib/phantom";
import {
  phoenixBook,
  phoenixCandles,
  phoenixDetail,
  phoenixLogin,
  phoenixMoves,
  phoenixNonce,
  phoenixOrder,
  phoenixPositions,
  phoenixRegister,
  type PhoenixCandle,
  type PhoenixDetail,
  type PhoenixIx,
  type PhoenixKind,
  type PhoenixMarket,
  type PhoenixPosition,
} from "@/lib/phoenix-book";
import { cn } from "@/lib/utils";

const KINDS: { id: "all" | PhoenixKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "equity", label: "Equity" },
  { id: "etf", label: "ETF" },
  { id: "preipo", label: "Pre-IPO" },
  { id: "commodity", label: "Commodity" },
  { id: "crypto", label: "Crypto" },
];

const TFS = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"] as const;
type Tf = (typeof TFS)[number];

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function b58(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  const digits = [0];
  for (let i = zeros; i < bytes.length; i += 1) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j += 1) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "1".repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i -= 1) out += ALPHABET[digits[i]];
  return out;
}

function px(n: number | null | undefined) {
  if (n == null || !(n > 0)) return "—";
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${n.toPrecision(4)}`;
}

function compact(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return px(n);
}

function moveText(n: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

async function blockhash(): Promise<string> {
  const urls = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];
  let last = "No blockhash";
  for (const url of urls) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getLatestBlockhash", params: [{ commitment: "confirmed" }] }),
      });
      const j = (await r.json()) as { result?: { value?: { blockhash?: string } }; error?: { message?: string } };
      if (j.result?.value?.blockhash) return j.result.value.blockhash;
      last = j.error?.message || last;
    } catch (e) {
      last = e instanceof Error ? e.message : last;
    }
  }
  throw new Error(last);
}

async function sendIxs(ixs: PhoenixIx[], payer: string): Promise<string> {
  const tx = new Transaction({ feePayer: new PublicKey(payer), recentBlockhash: await blockhash() });
  for (const ix of ixs) {
    tx.add(new TransactionInstruction({
      programId: new PublicKey(ix.programId),
      keys: ix.keys.map((k) => ({ pubkey: new PublicKey(k.pubkey), isSigner: k.isSigner, isWritable: k.isWritable })),
      data: Buffer.from(ix.data),
    }));
  }
  return signAndBroadcast(tx);
}

function readSession(): { token: string; exp: number } | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem("senda.phoenix.session") || "null") as { token?: string; exp?: number } | null;
    if (!raw?.token || !raw.exp || raw.exp < Date.now() + 15_000) return null;
    return { token: raw.token, exp: raw.exp };
  } catch {
    return null;
  }
}

export function PhoenixDesk() {
  const [rows, setRows] = useState<PhoenixMarket[]>([]);
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"move" | "name" | "oi">("move");
  const [symbol, setSymbol] = useState("");
  const [tf, setTf] = useState<Tf>("15m");
  const [priceMode, setPriceMode] = useState<"last" | "mark">("last");
  const [bars, setBars] = useState<PhoenixCandle[]>([]);
  const [detail, setDetail] = useState<PhoenixDetail | null>(null);
  const [line, setLine] = useState<number | null>(null);
  const [usd, setUsd] = useState(25);
  const [lev, setLev] = useState(0);
  const [busy, setBusy] = useState("");
  const [positions, setPositions] = useState<PhoenixPosition[]>([]);
  const [signed, setSigned] = useState<{ side: string; sig: string; size: number } | null>(null);

  useEffect(() => {
    let live = true;
    phoenixBook()
      .then((book) => {
        if (!live) return;
        setRows(book);
        setSymbol((cur) => cur || book.find((r) => r.symbol === "MRNA")?.symbol || book[0]?.symbol || "");
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Phoenix book did not load"));
    const later = window.setTimeout(() => {
      phoenixMoves()
        .then((moves) => {
          if (!live || !moves.length) return;
          const by = new Map(moves.map((m) => [m.symbol, m]));
          setRows((prev) => prev.map((row) => {
            const hit = by.get(row.symbol);
            return hit ? { ...row, change: hit.change, volume: hit.volume } : row;
          }));
        })
        .catch(() => undefined);
    }, 2500);
    return () => {
      live = false;
      window.clearTimeout(later);
    };
  }, []);

  const picked = rows.find((r) => r.symbol === symbol) ?? null;
  const leverage = lev > 0 ? lev : picked?.leverage ?? 1;

  useEffect(() => {
    if (!symbol) return;
    let live = true;
    setBars([]);
    setDetail(null);
    setLine(null);
    phoenixCandles({ data: { symbol, timeframe: tf } })
      .then((next) => live && setBars(next))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Candles did not load"));
    phoenixDetail({ data: { symbol } })
      .then((next) => live && setDetail(next))
      .catch(() => undefined);
    return () => { live = false; };
  }, [symbol, tf]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => (kind === "all" || r.kind === kind) && (!needle || `${r.symbol} ${r.name}`.toLowerCase().includes(needle)))
      .slice()
      .sort((a, b) => {
        if (sort === "name") return a.symbol.localeCompare(b.symbol);
        if (sort === "oi") return (b.oi ?? 0) * (b.mark || 0) - (a.oi ?? 0) * (a.mark || 0);
        return Math.abs(b.change ?? -1) - Math.abs(a.change ?? -1);
      });
  }, [rows, kind, q, sort]);

  const last = bars.at(-1) ?? null;
  const ohlc = last
    ? priceMode === "mark"
      ? { o: last.markOpen, h: last.markHigh, l: last.markLow, c: last.markClose }
      : { o: last.open, h: last.high, l: last.low, c: last.close }
    : null;
  const mark = detail?.mark || picked?.mark || 0;
  const index = detail?.index || mark;
  const change = picked?.change ?? null;
  const notion = usd > 0 && mark ? (usd * leverage) / mark : 0;

  async function session(): Promise<{ owner: string; token: string }> {
    const owner = await connectPhantom();
    const cached = readSession();
    if (cached) return { owner, token: cached.token };
    const nonce = await phoenixNonce({ data: { wallet: owner } });
    const injected = (window as unknown as { phantom?: { solana?: { signMessage?: (m: Uint8Array) => Promise<{ signature: Uint8Array }> } } }).phantom?.solana
      ?? (window as unknown as { solana?: { signMessage?: (m: Uint8Array) => Promise<{ signature: Uint8Array }> } }).solana;
    if (!injected?.signMessage) throw new Error("This wallet cannot sign the Phoenix login. Open it in Phantom.");
    const signedMsg = await injected.signMessage(new TextEncoder().encode(nonce.message));
    const auth = await phoenixLogin({ data: { wallet: owner, signature: b58(signedMsg.signature), nonceId: nonce.nonce_id } });
    sessionStorage.setItem("senda.phoenix.session", JSON.stringify({ token: auth.accessToken, exp: Date.now() + auth.expiresIn * 1000 }));
    return { owner, token: auth.accessToken };
  }

  async function openAccount() {
    setBusy("account");
    try {
      const owner = await connectPhantom();
      const built = await phoenixRegister({ data: { authority: owner } });
      const sig = await sendIxs(built.ixs, owner);
      toast.success(`Phoenix account opened. ${sig.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The account did not open");
    } finally {
      setBusy("");
    }
  }

  async function trade(side: "bid" | "ask") {
    if (!picked || !(usd > 0) || !(mark > 0)) return toast.error("Pick a market and a margin.");
    setBusy(side);
    setSigned(null);
    try {
      const { owner, token } = await session();
      const built = await phoenixOrder({
        data: { token, authority: owner, symbol: picked.symbol, side, quantity: Number(notion.toFixed(detail?.decimals ?? 4)), margin: usd },
      });
      const sig = await sendIxs(built.ixs, owner);
      noteFill({ desk: "phoenix", symbol: picked.symbol, side: side === "bid" ? "buy" : "sell", usd, sig });
      setSigned({ side: side === "bid" ? "Long" : "Short", sig, size: notion });
      toast.success(`${side === "bid" ? "Long" : "Short"} ${picked.symbol} signed.`);
      const book = await phoenixPositions({ data: { token, authority: owner } }).catch(() => []);
      setPositions(book);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Phoenix did not take the order";
      if (/trader|not found|account/i.test(msg)) toast.error("Open the Phoenix account first, then sign the order.");
      else toast.error(msg);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-3 px-3 py-3">
      <header>
        <p className="text-[11px] tracking-[0.16em] text-[#ff8a3d] uppercase">Phoenix · Solana perps</p>
        <h2 className="mt-1 text-2xl tracking-tight">{rows.length || "—"} markets, 24/7</h2>
        <p className="mt-1 text-sm text-white/55">Equity, ETF, pre-IPO, commodity, and crypto perps. The position stays on Phoenix. Phantom signs it.</p>
      </header>

      {picked ? (
        <section className="rounded-[22px] bg-[#101114] p-3">
          <div className="flex items-center gap-3">
            <MarkFace icon={picked.logo || undefined} symbol={picked.symbol} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold">{picked.symbol} <span className="text-sm font-medium text-white/45">{picked.name}</span></p>
              <p className="text-xs text-white/45">{picked.kind} · {picked.isolated ? "isolated" : "cross"} · max {picked.leverage}x</p>
            </div>
            <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-semibold">{leverage}x</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <Stat label="Mark" value={px(mark)} />
            <Stat label="Index" value={px(index)} />
            <Stat label="24h" value={moveText(change)} tone={change == null ? "" : change < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]"} />
            <Stat label="24h volume" value={compact(picked.volume)} />
            <Stat label="Open interest" value={compact((detail?.oi ?? picked.oi) && mark ? (detail?.oi ?? picked.oi ?? 0) * mark : null)} />
            <Stat label="Market cap" value={compact(picked.cap)} />
            <Stat label="1h funding" value={detail?.funding == null ? "—" : `${detail.funding.toFixed(4)}%`} />
            <Stat label="Bid" value={px(detail?.bids[0]?.price)} />
            <Stat label="Ask" value={px(detail?.asks.at(-1)?.price)} />
          </div>
          <div className="mt-3 flex gap-1 overflow-x-auto">
            {TFS.map((id) => (
              <button key={id} type="button" onClick={() => setTf(id)} className={cn("min-h-8 shrink-0 rounded-full px-3 text-xs font-semibold", tf === id ? "bg-white text-black" : "bg-white/10 text-white/70")}>{id}</button>
            ))}
          </div>
          <div className="mt-2 flex gap-1">
            {(["last", "mark"] as const).map((id) => (
              <button key={id} type="button" onClick={() => setPriceMode(id)} className={cn("min-h-8 rounded-full px-3 text-xs font-semibold", priceMode === id ? "bg-[#ff8a3d] text-black" : "bg-white/10 text-white/70")}>
                {id === "last" ? "Last price" : "Mark price"}
              </button>
            ))}
            {line != null ? <button type="button" onClick={() => setLine(null)} className="min-h-8 rounded-full px-3 text-xs text-white/60">Clear line</button> : null}
          </div>
          <p className="mt-2 font-mono text-[11px] text-[#c6f56a]">
            {ohlc ? `O ${px(ohlc.o)}  H ${px(ohlc.h)}  L ${px(ohlc.l)}  C ${px(ohlc.c)}` : "Candles loading"}
          </p>
          <CandleChart bars={bars} mode={priceMode} line={line} onLine={setLine} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-xs text-white/45">
              Margin USDC
              <input inputMode="decimal" value={String(usd)} onChange={(e) => setUsd(Math.max(0, Number(e.target.value) || 0))} className="mt-1 min-h-11 w-full rounded-full bg-black/40 px-4 font-mono text-sm text-white outline-none" />
            </label>
            <label className="text-xs text-white/45">
              Leverage
              <input inputMode="decimal" value={String(leverage)} onChange={(e) => setLev(Math.min(picked.leverage, Math.max(1, Number(e.target.value) || 1)))} className="mt-1 min-h-11 w-full rounded-full bg-black/40 px-4 font-mono text-sm text-white outline-none" />
            </label>
          </div>
          <p className="mt-2 text-xs text-white/50">Size {notion ? notion.toPrecision(4) : "—"} {picked.symbol} · notional {compact(usd * leverage)} · fee {detail?.takerBps ?? "—"} bps taker</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" disabled={!!busy} onClick={() => void trade("bid")} className="min-h-12 rounded-full bg-[#c6f56a] text-sm font-semibold text-black disabled:opacity-50">{busy === "bid" ? "Signing…" : "Long"}</button>
            <button type="button" disabled={!!busy} onClick={() => void trade("ask")} className="min-h-12 rounded-full bg-[#ff5d73] text-sm font-semibold text-black disabled:opacity-50">{busy === "ask" ? "Signing…" : "Short"}</button>
          </div>
          <button type="button" disabled={!!busy} onClick={() => void openAccount()} className="mt-2 min-h-10 w-full rounded-full bg-white/10 text-sm font-semibold">{busy === "account" ? "Opening…" : "Open Phoenix account"}</button>
          {signed ? (
            <div className="mt-3 rounded-2xl border border-[#c6f56a]/40 bg-[#c6f56a]/10 p-3">
              <p className="text-sm font-semibold">{signed.side} {picked.symbol} signed</p>
              <p className="mt-1 font-mono text-xs text-white/70">{signed.size.toPrecision(4)} @ mark {px(mark)}</p>
              <a className="mt-1 block truncate text-xs text-[#9ecbff]" href={`https://solscan.io/tx/${signed.sig}`} target="_blank" rel="noreferrer">{signed.sig}</a>
            </div>
          ) : null}
          {positions.length ? (
            <ul className="mt-3 divide-y divide-white/10 text-sm">
              {positions.map((p) => (
                <li key={`${p.sub}-${p.symbol}`} className="flex justify-between py-2">
                  <span>{p.symbol}</span>
                  <span className={p.size < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]"}>{p.size > 0 ? "Long" : "Short"} {Math.abs(p.size)} · {px(p.entry)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <div className="flex gap-1 overflow-x-auto">
        {KINDS.map((item) => (
          <button key={item.id} type="button" onClick={() => setKind(item.id)} className={cn("min-h-9 shrink-0 rounded-full px-3 text-sm font-semibold", kind === item.id ? "bg-white text-black" : "bg-white/10 text-white/70")}>{item.label}</button>
        ))}
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Phoenix" className="min-h-11 w-full rounded-full bg-[#1c1c1e] px-4 text-sm outline-none" />
      <div className="flex gap-1">
        {(["move", "oi", "name"] as const).map((id) => (
          <button key={id} type="button" onClick={() => setSort(id)} className={cn("min-h-8 rounded-full px-3 text-xs font-semibold", sort === id ? "bg-white text-black" : "bg-white/10 text-white/70")}>{id === "oi" ? "Open interest" : id === "move" ? "Move" : "Name"}</button>
        ))}
        <p className="ml-auto self-center text-xs text-white/40">{shown.length} shown</p>
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {shown.map((row) => (
          <li key={row.symbol}>
            <button type="button" onClick={() => setSymbol(row.symbol)} className={cn("flex w-full items-center gap-3 rounded-[18px] bg-[#141418] p-3 text-left", row.symbol === symbol ? "ring-1 ring-white/40" : "")}>
              <MarkFace icon={row.logo || undefined} symbol={row.symbol} size={36} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-semibold">{row.symbol}</span>
                  <span className="rounded-full bg-white/10 px-1.5 text-[10px]">{row.leverage}x</span>
                </span>
                <span className="block truncate text-xs text-white/45">{row.name}</span>
              </span>
              <span className="text-right">
                <span className="block font-mono text-sm">{px(row.mark)}</span>
                <span className={cn("block text-xs", (row.change ?? 0) < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]")}>{moveText(row.change)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-black/30 px-2 py-2">
      <p className="text-[10px] tracking-wide text-white/40 uppercase">{label}</p>
      <p className={cn("mt-0.5 font-mono text-sm", tone)}>{value}</p>
    </div>
  );
}

function CandleChart({
  bars,
  mode,
  line,
  onLine,
}: {
  bars: PhoenixCandle[];
  mode: "last" | "mark";
  line: number | null;
  onLine: (n: number) => void;
}) {
  const w = 360;
  const h = 220;
  const pad = 8;
  const series = bars.map((b) => mode === "mark" ? { o: b.markOpen, h: b.markHigh, l: b.markLow, c: b.markClose } : { o: b.open, h: b.high, l: b.low, c: b.close });
  if (series.length < 2) return <div className="mt-2 grid h-52 place-items-center rounded-2xl bg-black/30 text-sm text-white/40">Waiting for candles</div>;
  let lo = Math.min(...series.map((b) => b.l));
  let hi = Math.max(...series.map((b) => b.h));
  if (line != null) {
    lo = Math.min(lo, line);
    hi = Math.max(hi, line);
  }
  const span = hi - lo || 1;
  const y = (v: number) => pad + ((hi - v) / span) * (h - pad * 2);
  const slot = (w - pad * 2) / series.length;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-2 h-56 w-full rounded-2xl bg-black/40"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const py = ((e.clientY - rect.top) / rect.height) * h;
        onLine(hi - ((py - pad) / (h - pad * 2)) * span);
      }}
    >
      {series.map((b, i) => {
        const up = b.c >= b.o;
        const x = pad + i * slot + slot / 2;
        const body = Math.max(1, Math.abs(y(b.o) - y(b.c)));
        return (
          <g key={bars[i].time}>
            <line x1={x} x2={x} y1={y(b.h)} y2={y(b.l)} stroke={up ? "#c6f56a" : "#ff5d73"} strokeWidth="1" />
            <rect x={x - Math.max(1, slot * 0.28)} y={Math.min(y(b.o), y(b.c))} width={Math.max(1.5, slot * 0.56)} height={body} fill={up ? "#c6f56a" : "#ff5d73"} />
          </g>
        );
      })}
      {line != null ? <line x1={pad} x2={w - pad} y1={y(line)} y2={y(line)} stroke="#ff8a3d" strokeDasharray="4 3" /> : null}
    </svg>
  );
}
