import { useEffect, useState } from "react";
import { printBars } from "@/lib/print-bars";
import type { DerivBar } from "@/lib/deriv-book";
import { loadVenues, type VenueBook } from "@/lib/venue-book";
import { cn } from "@/lib/utils";

function vol(n: number): string {
  if (!(n > 0)) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

function px(n: number): string {
  if (!(n > 0)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toPrecision(4);
}

/** Volume at recent prints, plus the bid and ask when a venue published them. Not a drawn order book. */
export function VolumeBook({
  mint,
  bid,
  ask,
  mid,
  volume,
}: {
  mint: string;
  bid?: number | null;
  ask?: number | null;
  mid?: number | null;
  volume?: number;
}) {
  const [rows, setRows] = useState<Array<{ price: number; vol: number }>>([]);
  const [bare, setBare] = useState(false);
  const [venues, setVenues] = useState<VenueBook | null>(null);

  useEffect(() => {
    if (!mint) {
      setRows([]);
      return;
    }
    let live = true;
    printBars({ data: { mint, span: "15" } })
      .then((bars: DerivBar[]) => {
        if (!live) return;
        const buckets = new Map<number, number>();
        let sized = false;
        for (const bar of bars) {
          const price = Number(bar.close);
          if (!(price > 0)) continue;
          const size = Number(bar.volume) || 0;
          if (size > 0) sized = true;
          const key = Number(price.toPrecision(5));
          buckets.set(key, (buckets.get(key) || 0) + size);
        }
        const list = [...buckets.entries()]
          .map(([price, size]) => ({ price, vol: size }))
          .sort((a, b) => b.price - a.price)
          .slice(0, 18);
        setRows(list);
        setBare(!sized);
      })
      .catch(() => {
        if (live) setRows([]);
      });
    return () => {
      live = false;
    };
  }, [mint]);

  useEffect(() => {
    if (!mint) {
      setVenues(null);
      return;
    }
    let live = true;
    loadVenues({ data: { mint } })
      .then((next) => {
        if (live) setVenues(next);
      })
      .catch(() => {
        if (live) setVenues(null);
      });
    return () => {
      live = false;
    };
  }, [mint]);

  const last = mid && mid > 0 ? mid : rows[Math.floor(rows.length / 2)]?.price || 0;
  const max = Math.max(1, ...rows.map((row) => row.vol));

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] tracking-[0.14em] text-white/40 uppercase">Volume</p>
        <p className="font-mono text-[11px] text-white/50">{venues && venues.vol > 0 ? vol(venues.vol) : volume && volume > 0 ? vol(volume) : "—"}</p>
      </div>
      {venues && venues.venues.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {venues.venues.map((row) => (
            <li key={row.dex} className="grid grid-cols-[5.5rem_1fr_3.2rem] items-center gap-2">
              <span className="truncate text-[11px] text-white/70">{row.dex}</span>
              <span className="h-2 overflow-hidden rounded-sm bg-white/5">
                <span className="block h-2 bg-white/50" style={{ width: `${Math.max(4, (row.vol / Math.max(venues.vol, 1)) * 100)}%` }} />
              </span>
              <span className="text-right font-mono text-[10px] text-white/55">{vol(row.vol)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[11px] text-white/35">No venue has printed this mint yet.</p>
      )}
      <p className="mt-3 text-[10px] tracking-[0.14em] text-white/35 uppercase">Prints</p>
      {bid && ask ? (
        <p className="mt-1 font-mono text-xs">
          <span className="text-down">{px(ask)}</span>
          <span className="text-white/40"> ask · </span>
          <span className="text-up">{px(bid)}</span>
          <span className="text-white/40"> bid</span>
        </p>
      ) : (
        <p className="mt-1 text-xs text-white/45">Size is the pool print. There is no separate order book on this name.</p>
      )}
      {bare ? <p className="mt-1 text-[11px] text-white/35">These prints came back without a size, so the bars stay empty.</p> : null}
      <ul className="mt-2 space-y-1">
        {rows.map((row) => (
          <li key={row.price} className="grid grid-cols-[4.5rem_1fr_3rem] items-center gap-2">
            <span className={cn("font-mono text-[11px]", row.price >= last ? "text-down" : "text-up")}>{px(row.price)}</span>
            <span className="h-2.5 overflow-hidden rounded-sm bg-white/5">
              <span className={cn("block h-2.5", row.price >= last ? "bg-down/80" : "bg-up/80")} style={{ width: row.vol > 0 ? `${Math.max(4, (row.vol / max) * 100)}%` : "0%" }} />
            </span>
            <span className="text-right font-mono text-[10px] text-white/55">{vol(row.vol)}</span>
          </li>
        ))}
      </ul>
      {rows.length === 0 ? <p className="mt-2 text-xs text-white/40">{mint ? "No prints yet." : "This name has a bid and an ask. It has no Solana pool to chart."}</p> : null}
    </div>
  );
}

/** A session line. The candle chart stays where it is. This is the other view. */
export function SessionLine({ mint }: { mint: string }) {
  const [bars, setBars] = useState<DerivBar[]>([]);
  useEffect(() => {
    if (!mint) return;
    let live = true;
    printBars({ data: { mint, span: "5" } })
      .then((rows) => { if (live) setBars(rows); })
      .catch(() => { if (live) setBars([]); });
    return () => { live = false; };
  }, [mint]);
  if (!mint) return <p className="mt-3 text-xs text-white/45">No pool on this name, so there is no session line.</p>;
  if (bars.length < 2) return <p className="mt-3 text-xs text-white/45">The session has not come back.</p>;
  const closes = bars.map((bar) => bar.close).filter((n) => n > 0);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const w = 320;
  const h = 140;
  const points = closes
    .map((close, i) => {
      const x = (i / (closes.length - 1)) * w;
      const y = h - ((close - min) / span) * (h - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = closes[closes.length - 1] >= closes[0];
  const first = bars[0];
  const last = bars[bars.length - 1];
  const t = (n: number) => new Date(n * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return (
    <div className="mt-3">
      <p className="text-[10px] tracking-[0.14em] text-white/40 uppercase">Session</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-[180px] w-full">
        <polyline fill="none" stroke={up ? "#3ddc84" : "#fb7185"} strokeWidth="2" points={points} />
      </svg>
      <div className="flex justify-between font-mono text-[10px] text-white/40">
        <span>{first ? t(first.time) : ""}</span>
        <span>{px(closes[closes.length - 1])}</span>
        <span>{last ? t(last.time) : ""}</span>
      </div>
    </div>
  );
}
