/** A one-day line for one mint. Closes come from the pool candle engine. Nothing is drawn until they arrive. */

import { useEffect, useState } from "react";
import { getPrint } from "@/lib/print";

let gate: Promise<void> = Promise.resolve();

function takePrint(mint: string) {
  const job = gate.then(() => getPrint({ data: { mint, tf: "1H" } }));
  gate = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
}

export function HomeLine({ mint }: { mint: string }) {
  const [closes, setCloses] = useState<number[]>([]);
  useEffect(() => {
    let live = true;
    takePrint(mint)
      .then((got) => {
        if (!live) return;
        const rows = (got.bars || []).slice(-24).map((bar) => bar.c).filter((n) => n > 0);
        setCloses(rows);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [mint]);
  if (closes.length < 2) return <span className="block h-8 w-[72px]" />;
  const open = closes[0];
  const last = closes[closes.length - 1];
  const lo = Math.min(...closes, open);
  const hi = Math.max(...closes, open);
  const span = hi - lo || open * 0.01 || 1;
  const w = 72;
  const h = 32;
  const x = (i: number) => (i / (closes.length - 1)) * w;
  const y = (p: number) => h - ((p - lo) / span) * (h - 2) - 1;
  const d = closes.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p).toFixed(1)}`).join(" ");
  const up = last >= open;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-[72px]" aria-hidden>
      <line x1="0" x2={w} y1={y(open)} y2={y(open)} stroke="rgba(255,255,255,0.28)" strokeDasharray="2 2" />
      <path d={d} fill="none" stroke={up ? "#c6f56a" : "#ff5d73"} strokeWidth="1.6" />
    </svg>
  );
}
