import { Link } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { brandIcon, equityIcon, listedMint, loadFaceBook, tokenListIcon, trustIcon, type FaceRow } from "@/lib/face-book";
import type { HoldMove } from "@/lib/hold-tape";
import type { TokenMark } from "@/lib/token-mark";

export type HoldingRow = {
  mint: string;
  symbol: string;
  name: string;
  qty: number;
  value: number;
  where: "share" | "pre" | "coin" | "cash";
};

function qty(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function usd(n: number): string {
  if (!(n > 0)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n < 1 ? 4 : 2 });
}

function pct(n: number | null): string {
  if (n == null) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

const KNOWN: Record<string, string> = {
  So11111111111111111111111111111111111111112: "Solana",
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USD Coin",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "Tether",
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: "Jupiter",
  "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4": "Jupiter LP",
  "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh": "Bitcoin",
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs": "Ether",
};

export function LineGlance({ points }: { points: number[]; down?: boolean }) {
  if (points.length < 2) return null;
  const open = points[0];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const y = (p: number) => 30 - ((p - min) / span) * 26;
  const base = y(open);
  return (
    <svg viewBox="0 0 100 32" className="mt-3 h-8 w-full" aria-hidden>
      <line x1="0" x2="100" y1={base} y2={base} stroke="rgba(255,255,255,0.45)" strokeDasharray="2 2" strokeWidth="1" />
      {points.slice(1).map((p, i) => {
        const a = points[i];
        const x1 = (i / (points.length - 1)) * 100;
        const x2 = ((i + 1) / (points.length - 1)) * 100;
        const above = p >= open;
        return <line key={i} x1={x1} y1={y(a)} x2={x2} y2={y(p)} stroke={above ? "var(--color-up)" : "var(--color-down)"} strokeWidth="1.75" strokeLinecap="round" />;
      })}
    </svg>
  );
}

function VolumeBars({ points }: { points: number[] }) {
  if (points.filter((n) => n > 0).length < 2) return null;
  const max = Math.max(...points, 1);
  return (
    <span className="mt-2 flex h-8 items-end gap-px" aria-hidden>
      {points.map((n, i) => (
        <span key={i} className="min-w-0 flex-1 rounded-sm bg-white/35" style={{ height: `${Math.max(8, (n / max) * 100)}%` }} />
      ))}
    </span>
  );
}

function money(n: number): string {
  if (!(n > 0)) return "";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

type Face = { icon: string; name: string; symbol: string };
let byMint: Record<string, Face> = {};
let bySymbol: Record<string, Face> = {};
const subs = new Set<() => void>();
let loading = false;

function emit() {
  for (const fn of subs) fn();
}

export function startFaces() {
  if (loading || typeof window === "undefined") return;
  loading = true;
  loadFaceBook()
    .then((rows: FaceRow[]) => {
      const mints: Record<string, Face> = {};
      const symbols: Record<string, Face> = {};
      for (const row of rows) {
        const face = { icon: row.icon, name: row.name, symbol: row.symbol };
        if (row.mint) mints[row.mint] = face;
        if (row.symbol) symbols[row.symbol.toUpperCase()] = face;
      }
      byMint = mints;
      bySymbol = symbols;
      emit();
    })
    .catch(() => undefined);
}

function subscribe(fn: () => void) {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function useFace(mint?: string, symbol?: string): Face | null {
  return useSyncExternalStore(
    subscribe,
    () => (mint && byMint[mint]) || (symbol && bySymbol[symbol.toUpperCase()]) || null,
    () => null,
  );
}

export function MarkFace({ icon, symbol, mint, size = 36, fill = false }: { icon?: string; symbol: string; mint?: string; size?: number; fill?: boolean }) {
  const face = useFace(mint, symbol);
  const resolved = mint || listedMint(symbol);
  const chain = [icon, brandIcon(symbol), face?.icon, equityIcon(symbol), tokenListIcon(resolved), trustIcon(resolved)].filter((src): src is string => !!src);
  const [step, setStep] = useState(0);
  useEffect(() => setStep(0), [mint, symbol, icon, face?.icon]);
  const src = chain[step];
  const box = fill ? undefined : { width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.28)) };
  const shape = "shrink-0 rounded-full bg-[#16181d] object-contain ring-1 ring-inset ring-white/12";
  if (!src) {
    const letters = (symbol || "?").replace(/x$/i, "").slice(0, 2).toUpperCase();
    return (
      <span className={cn("grid place-items-center rounded-full bg-[#1c1c1e] font-semibold tracking-tight text-white ring-1 ring-inset ring-white/15", fill && "size-full text-[0.32em]")} style={box}>
        {letters}
      </span>
    );
  }
  return <img src={src} alt="" onError={() => setStep((n) => n + 1)} className={cn(shape, fill && "size-full")} style={fill ? undefined : { width: size, height: size, padding: Math.max(3, Math.round(size * 0.12)) }} />;
}

export function HoldingCards({
  rows,
  moves,
  marks = {},
  className,
  activeMint,
  onOpen,
}: {
  rows: HoldingRow[];
  moves: Record<string, HoldMove>;
  marks?: Record<string, TokenMark>;
  className?: string;
  activeMint?: string;
  onOpen?: (row: HoldingRow) => void;
}) {
  if (!rows.length) return null;
  return (
    <ul className={cn("grid gap-2 sm:grid-cols-2", className)}>
      {rows.map((row) => {
        const move = moves[row.mint];
        const value = row.value > 0 ? row.value : move?.price ? row.qty * move.price : 0;
        const day = move?.day ?? null;
        const mark = marks[row.mint];
        const on = activeMint === row.mint;
        const symbol = mark?.symbol || row.symbol;
        const title = mark?.name || KNOWN[row.mint] || symbol;
        const body = (
          <>
            <span className="flex items-start justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <MarkFace icon={mark?.icon} symbol={symbol} mint={row.mint} />
                <span className="min-w-0">
                  <span className="block truncate text-lg font-semibold tracking-tight">{symbol}</span>
                  <span className="block truncate text-[11px] text-white/45">{title}</span>
                </span>
              </span>
              <span className={cn("rounded-full px-2 py-1 font-mono text-[11px] tabular-nums", (day ?? 0) < 0 ? "bg-down/15 text-down" : "bg-accent/15 text-accent")}>
                {pct(day)}
              </span>
            </span>
            <span className="mt-3 block font-mono text-2xl tabular-nums tracking-tight">{move?.price ? usd(move.price) : "—"}</span>
            <span className="mt-1 block font-mono text-[11px] text-white/40">
              {qty(row.qty)} · {usd(value)}
              {day != null && value > 0 ? (
                <span className={(value * day) / 100 < 0 ? "text-down" : "text-up"}>
                  {" "}· {(value * day) / 100 >= 0 ? "+" : "−"}${Math.abs((value * day) / 100).toFixed(2)} today
                </span>
              ) : null}
            </span>
            {mark?.line && mark.line.length > 1 ? (
              <LineGlance points={mark.line} />
            ) : (
              <span className="mt-3 block h-8 text-[10px] text-white/30">No hourly print</span>
            )}
            <VolumeBars points={mark?.volume || []} />
            <span className="mt-1 block font-mono text-[10px] text-white/40">
              {mark?.poolVol ? `24h ${mark.poolDex || "pool"} ${money(mark.poolVol)}` : mark?.vol24 ? `24h chart ${money(mark.vol24)}` : "No 24h volume"}
            </span>
            <span className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-2 font-mono text-[11px] tabular-nums">
              <span>
                <span className="block text-white/35">Hour</span>
                <span className={cn((move?.hour ?? 0) < 0 ? "text-down" : "text-up")}>{pct(move?.hour ?? null)}</span>
              </span>
              <span>
                <span className="block text-white/35">Day</span>
                <span className={cn((day ?? 0) < 0 ? "text-down" : "text-up")}>{pct(day)}</span>
              </span>
              <span>
                <span className="block text-white/35">Week</span>
                <span className={cn((move?.week ?? 0) < 0 ? "text-down" : "text-up")}>{pct(move?.week ?? null)}</span>
              </span>
            </span>
          </>
        );
        const cls = cn(
          "block w-full rounded-2xl border bg-[#12151e] px-3 py-3 text-left",
          on ? "border-accent" : "border-white/10 hover:border-white/25",
        );
        if (onOpen) {
          return (
            <li key={row.mint} className="min-w-[230px] snap-start lg:min-w-0">
              <button type="button" onClick={() => onOpen(row)} className={cls}>{body}</button>
            </li>
          );
        }
        if (row.where === "share") {
          return (
            <li key={row.mint}>
              <Link to="/equities" className={cls}>{body}</Link>
            </li>
          );
        }
        if (row.where === "pre") {
          return (
            <li key={row.mint}>
              <Link to="/pre" className={cls}>{body}</Link>
            </li>
          );
        }
        if (row.where === "coin") {
          return (
            <li key={row.mint}>
              <Link to="/invest" search={{ desk: "tape" }} className={cls}>{body}</Link>
            </li>
          );
        }
        return (
          <li key={row.mint}>
            <div className={cls}>{body}</div>
          </li>
        );
      })}
    </ul>
  );
}