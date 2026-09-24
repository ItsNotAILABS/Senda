import { useState } from "react";
import { toast } from "sonner";
import { jupFillUrl } from "@/lib/jup-exec";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { cn } from "@/lib/utils";

export function PlayFloor({ names }: { names: HouseListing[] }) {
  const live = names.filter((n) => n.last > 0 && !/xai/i.test(n.symbol));
  const [a, setA] = useState(live[0]?.symbol ?? "");
  const [b, setB] = useState(live[1]?.symbol ?? live[0]?.symbol ?? "");
  const [open, setOpen] = useState<Record<string, number>>({});
  const left = live.find((n) => n.symbol === a);
  const right = live.find((n) => n.symbol === b);
  const cheap = [...live].sort((x, y) => (x.premium ?? 0) - (y.premium ?? 0))[0];
  const tight = [...live].sort((x, y) => Math.abs(x.premium ?? 9) - Math.abs(y.premium ?? 9))[0];

  function arm() {
    const snap: Record<string, number> = {};
    for (const n of live) snap[n.symbol] = n.last;
    setOpen(snap);
    toast.success("Race armed on this print.");
  }

  const move = (n?: HouseListing) => (n && open[n.symbol] ? (n.last - open[n.symbol]) / open[n.symbol] : null);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 overflow-auto lg:grid-cols-2">
      <section className="border-b border-border p-6 lg:border-r lg:border-b-0">
        <p className="text-xs tracking-wide text-subtle uppercase">Race</p>
        <h1 className="mt-1 font-display text-4xl">Which name moves</h1>
        <p className="mt-2 max-w-md text-sm text-muted">
          Arm on the live last. The name that moves more from that print wins. The fill, if you want one, is Jupiter.
        </p>
        <div className="mt-4 grid max-w-lg grid-cols-2 gap-2">
          <Pick value={a} names={live} onChange={setA} />
          <Pick value={b} names={live} onChange={setB} />
        </div>
        <button type="button" onClick={arm} className="mt-3 min-h-11 rounded-lg bg-fg px-5 text-sm font-semibold text-bg">
          Arm on this print
        </button>
        {left && right && open[left.symbol] ? (
          <div className="mt-4 grid max-w-lg grid-cols-2 gap-2">
            <Score name={left.symbol} pct={move(left) ?? 0} />
            <Score name={right.symbol} pct={move(right) ?? 0} />
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {left ? <Fill mint={left.mint} label={`Buy ${left.symbol}`} /> : null}
          {right ? <Fill mint={right.mint} label={`Buy ${right.symbol}`} /> : null}
        </div>
      </section>

      <section className="p-6">
        <p className="text-xs tracking-wide text-subtle uppercase">Off the mark</p>
        <h2 className="mt-1 font-display text-4xl">Two fills from the print</h2>
        <p className="mt-2 max-w-md text-sm text-muted">
          Closest name is the tight book. Cheapest vs the SPV mark is the discount. Both open a real Jupiter swap.
        </p>
        <div className="mt-5 grid gap-3">
          {tight ? (
            <article className="rounded-xl bg-elevated p-4">
              <p className="text-xs text-subtle">Closest to mark</p>
              <p className="mt-1 font-display text-3xl">{tight.symbol}</p>
              <p className="mt-1 font-mono text-xs">
                {formatUsd(tight.last)} · {formatPremium(tight.premium)}
              </p>
              <Fill mint={tight.mint} label={`Fill ${tight.symbol}`} />
            </article>
          ) : null}
          {cheap ? (
            <article className="rounded-xl bg-elevated p-4">
              <p className="text-xs text-subtle">Cheapest vs mark</p>
              <p className="mt-1 font-display text-3xl">{cheap.symbol}</p>
              <p className="mt-1 font-mono text-xs">
                {formatUsd(cheap.last)} · {formatPremium(cheap.premium)}
              </p>
              <Fill mint={cheap.mint} label={(cheap.premium ?? 0) < 0 ? `Buy the discount` : `Sell the premium`} side={(cheap.premium ?? 0) < 0 ? "buy" : "sell"} />
            </article>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Pick({ value, names, onChange }: { value: string; names: HouseListing[]; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-11 rounded-lg bg-elevated px-3 text-sm outline-none"
    >
      {names.map((n) => (
        <option key={n.symbol}>{n.symbol}</option>
      ))}
    </select>
  );
}

function Score({ name, pct }: { name: string; pct: number }) {
  return (
    <div className={cn("rounded-lg px-3 py-3", pct >= 0 ? "bg-up/15" : "bg-down/15")}>
      <p className="text-xs text-subtle">{name}</p>
      <p className="font-mono text-lg tabular-nums">{(pct * 100).toFixed(2)}%</p>
    </div>
  );
}

function Fill({ mint, label, side = "buy" }: { mint: string; label: string; side?: "buy" | "sell" }) {
  return (
    <a
      href={jupFillUrl(mint, side)}
      target="_blank"
      rel="noreferrer"
      className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg"
    >
      {label}
    </a>
  );
}
