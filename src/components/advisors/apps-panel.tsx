import { useState } from "react";
import { toast } from "sonner";
import { dropApp, listApps, SHIPPED, userSpecs, type AdvisorApp, type AdvisorOrder, type AdvisorSpec } from "@/lib/advisors";
import { runAdvisor } from "@/lib/advisors/engine";
import { spendCap } from "@/lib/spend-cap";
import { formatUsd, type HouseListing } from "@/lib/sol-house";

function findSpec(id: string): AdvisorSpec | null {
  const shipped = SHIPPED.find((row) => row.id === id);
  if (shipped) return shipped;
  const yours = userSpecs().find((row) => row.ok && row.spec.id === id);
  return yours && yours.ok ? yours.spec : null;
}

export function AppsPanel({
  names,
  busy,
  onSign,
}: {
  names: HouseListing[];
  busy: boolean;
  onSign: (order: AdvisorOrder) => void;
}) {
  const [apps, setApps] = useState<AdvisorApp[]>(() => listApps());
  const [open, setOpen] = useState<string | null>(apps[0]?.id ?? null);
  const [budget, setBudget] = useState(25);
  const app = apps.find((row) => row.id === open) ?? null;
  const spec = app ? findSpec(app.advisorId) : null;
  const run = spec ? runAdvisor(spec, names, budget, spendCap()) : null;

  return (
    <div className="grid gap-3 p-3 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside>
        <p className="font-mono text-[10px] tracking-[0.16em] text-white/35 uppercase">Apps</p>
        <div className="mt-2 space-y-1">
          {apps.map((row) => (
            <button key={row.id} type="button" onClick={() => setOpen(row.id)} className={row.id === open ? "block w-full rounded-xl bg-white px-3 py-2 text-left text-sm font-semibold text-black" : "block w-full rounded-xl px-3 py-2 text-left text-sm text-white/70"}>
              {row.name}
              <span className="mt-0.5 block font-mono text-[10px] font-normal opacity-60">{row.advisorId.startsWith("ship:") ? "Shipped · takes updates" : "Yours · stays"}</span>
            </button>
          ))}
          {apps.length === 0 ? <p className="px-1 text-sm text-white/45">No app yet. Save one from a strategy file.</p> : null}
        </div>
      </aside>
      <section className="rounded-2xl border border-white/10 bg-[#101114] p-4">
        {app && spec && run ? (
          <>
            <p className="text-lg font-semibold">{app.name}</p>
            <p className="mt-1 text-xs leading-relaxed text-white/45">{app.blurb || spec.line}</p>
            <p className="mt-2 font-mono text-[11px] text-white/35">{spec.title} · v{spec.version} · {run.note}</p>
            <label className="mt-3 block max-w-xs text-xs text-white/45">
              Budget
              <input value={budget} onChange={(e) => setBudget(Math.max(0, Number(e.target.value) || 0))} inputMode="decimal" className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black px-3 font-mono text-sm text-white" />
            </label>
            <ul className="mt-3 space-y-2">
              {run.orders.map((order) => (
                <li key={`${order.mint}-${order.side}`} className="flex items-center justify-between gap-2">
                  <span className="text-sm">
                    {order.side === "buy" ? "Buy" : "Sell"} {order.symbol}
                    <span className="ml-2 font-mono text-[11px] text-white/40">{formatUsd(order.last)} · {(order.premium * 100).toFixed(1)}% · ${order.usd.toFixed(2)}</span>
                  </span>
                  <button type="button" disabled={busy || !(order.usd > 0)} onClick={() => onSign(order)} className="min-h-9 rounded-full bg-accent px-3 text-xs font-semibold text-accent-fg disabled:opacity-40">Sign</button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                dropApp(app.id);
                const next = listApps();
                setApps(next);
                setOpen(next[0]?.id ?? null);
                toast.message("The app was removed from this browser.");
              }}
              className="mt-4 min-h-10 rounded-full border border-white/15 px-4 text-sm text-white/70"
            >
              Remove
            </button>
          </>
        ) : (
          <p className="text-sm text-white/45">{app ? "That strategy is no longer on this browser." : "Open an app, or make one from a file."}</p>
        )}
      </section>
    </div>
  );
}
