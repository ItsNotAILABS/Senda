import { useEffect, useState } from "react";
import { routeCorridor, type CorridorCcy, type CorridorPlan } from "@/lib/corridor-engine";
import { cn } from "@/lib/utils";

const CCYS: CorridorCcy[] = ["MXN", "BRL", "EUR", "GBP", "PHP", "INR"];
const PRESETS = [50, 100, 250, 1000];

function local(amount: string | null | undefined, ccy: string): string {
  if (!amount) return "—";
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  return `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} ${ccy}`;
}

export function CorridorCard() {
  const [usd, setUsd] = useState("250");
  const [ccy, setCcy] = useState<CorridorCcy>("MXN");
  const [accept, setAccept] = useState<"usdc" | "card">("usdc");
  const [cardBps, setCardBps] = useState(100);
  const [plan, setPlan] = useState<CorridorPlan | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const amount = Number(usd);
    if (!(amount > 0) || amount > 5000) return;
    let live = true;
    const timer = window.setTimeout(() => {
      setBusy(true);
      routeCorridor({ data: { usd: amount, currency: ccy, accept, cardBps, cardCap: accept === "card" ? 500 : null } })
        .then((row) => {
          if (!live) return;
          setPlan(row);
          setError("");
        })
        .catch((e: unknown) => {
          if (!live) return;
          setError(e instanceof Error ? e.message : "The corridor did not price.");
        })
        .finally(() => {
          if (live) setBusy(false);
        });
    }, 280);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [usd, ccy, accept, cardBps]);

  const figure = plan ? local(plan.received, plan.currency) : "—";

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
      <p className="text-[11px] tracking-[0.18em] text-[#d6ff4a] uppercase">Corridor</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">What the other side would see</h2>
      <p className="mt-1 max-w-xl text-sm leading-snug text-white/50">
        The planning rate is the median of live prints that sit inside the band. Circle’s fee is theirs, when they answer. A card spread is a scenario. Nothing here is a deposit.
      </p>

      <div className="relative mt-4 aspect-[1.586/1] overflow-hidden rounded-[22px] border border-white/10 bg-[#07080d] px-5 py-4 shadow-[inset_0_1px_0_rgb(214_255_74/0.45)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[#d6ff4a]" />
        <div className="relative flex items-start justify-between">
          <p className="text-[11px] tracking-[0.22em] text-[#d6ff4a] uppercase">Senda</p>
          <p className="font-mono text-[11px] text-white/55">{ccy}</p>
        </div>
        <span className="relative mt-4 grid h-8 w-11 grid-cols-3 gap-px rounded-[4px] bg-[#d6ff4a] p-1" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="rounded-[1px] bg-[#07080d]/80" />
          ))}
        </span>
        <p className="relative mt-4 text-[10px] tracking-[0.16em] text-white/40 uppercase">Local equivalent</p>
        <p className="relative mt-1 font-mono text-[28px] leading-none tracking-tight tabular-nums sm:text-4xl">{figure}</p>
        <div className="relative mt-4 flex items-end justify-between gap-3 text-sm">
          <div>
            <p className="text-[10px] tracking-[0.14em] text-white/40 uppercase">From</p>
            <p className="font-mono tabular-nums">${Number(usd) > 0 ? Number(usd).toFixed(2) : "—"} USDC</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] tracking-[0.14em] text-white/40 uppercase">Planning mid</p>
            <p className="font-mono tabular-nums">{plan ? plan.planningRate : busy ? "…" : "—"}</p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {CCYS.map((id) => (
          <button key={id} type="button" onClick={() => setCcy(id)} className={cn("min-h-10 shrink-0 rounded-full px-3 text-sm font-semibold", ccy === id ? "bg-white text-black" : "bg-white/10 text-white/75")}>
            {id}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={usd}
          onChange={(e) => setUsd(e.target.value.replace(/[^0-9.]/g, ""))}
          inputMode="decimal"
          aria-label="USDC amount"
          className="min-h-12 w-28 rounded-2xl border border-white/10 bg-black px-3 font-mono text-base outline-none"
        />
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {PRESETS.map((n) => (
            <button key={n} type="button" onClick={() => setUsd(String(n))} className={cn("min-h-12 min-w-12 flex-1 rounded-full font-mono text-sm font-semibold", Number(usd) === n ? "bg-[#d6ff4a] text-black" : "bg-white/10 text-white/80")}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setAccept("usdc")} className={cn("min-h-11 rounded-full text-sm font-semibold", accept === "usdc" ? "bg-white text-black" : "bg-white/10 text-white/75")}>
          They take USDC
        </button>
        <button type="button" onClick={() => setAccept("card")} className={cn("min-h-11 rounded-full text-sm font-semibold", accept === "card" ? "bg-white text-black" : "bg-white/10 text-white/75")}>
          Card only
        </button>
      </div>
      {accept === "card" ? (
        <div className="mt-2">
          <p className="text-[11px] text-white/45">Assumed issuer spread. Cap on this scenario is $500. Above that is not priced. Not an issuer quote.</p>
          <div className="mt-1 flex gap-1">
            {[50, 100, 150, 200].map((n) => (
              <button key={n} type="button" onClick={() => setCardBps(n)} className={cn("min-h-10 flex-1 rounded-full font-mono text-xs font-semibold", cardBps === n ? "bg-[#d6ff4a] text-black" : "bg-white/10 text-white/70")}>
                {n} bp
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-[#ff5d73]">{error}</p> : null}
      {plan ? (
        <>
          <ul className="mt-4 divide-y divide-white/10">
            {plan.prints.map((row) => (
              <li key={row.id} className="flex items-baseline justify-between gap-3 py-2">
                <span>
                  <span className="block text-sm font-semibold">{row.label}</span>
                  <span className="block text-[11px] text-white/40">{row.kept ? (row.asOf ? row.asOf.slice(0, 10) : "Live") : "Outside the band. Not in the mid."}</span>
                </span>
                <span className={cn("font-mono text-sm tabular-nums", row.kept ? "text-white" : "text-[#ff5d73]")}>{row.rate}</span>
              </li>
            ))}
          </ul>
          {plan.printShearBps ? <p className="text-xs text-white/45">Best kept print leads the next by {plan.printShearBps} bp.</p> : null}

          <ul className="mt-3 space-y-2">
            {plan.ranked.map((row) => {
              const on = plan.winner?.id === row.id;
              return (
                <li key={row.id} className={cn("rounded-2xl border px-3 py-3", on ? "border-[#d6ff4a]/40 bg-[#d6ff4a]/10" : "border-white/10")}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold">{row.label}</p>
                    <p className="font-mono text-sm tabular-nums">{local(row.local, plan.currency)}</p>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-white/45">
                    {row.spreadBps} bp{row.capped ? " · capped" : ""} · {row.note}
                  </p>
                </li>
              );
            })}
          </ul>

          {plan.uncovered !== "0.00" ? <p className="mt-3 text-sm text-[#ff5d73]">{local(plan.uncovered, "USD")} has no price. It is not filled.</p> : null}
          {plan.breakpointUsd ? <p className="mt-2 text-xs text-white/50">The lead flips at ${plan.breakpointUsd}.</p> : <p className="mt-2 text-xs text-white/40">No flip above this amount. The cheaper spread stays ahead.</p>}

          <div className="mt-3 grid grid-cols-3 gap-2">
            {plan.ladder.map((step) => (
              <div key={step.spreadBps} className="rounded-2xl bg-black/40 px-2 py-2">
                <p className="text-[10px] tracking-[0.12em] text-white/40 uppercase">{step.spreadBps} bp card</p>
                <p className="mt-1 font-mono text-xs tabular-nums">{local(step.local, plan.currency)}</p>
                <p className="font-mono text-[10px] text-[#ff5d73]">−{local(step.gap, plan.currency)}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-snug text-white/45">{plan.proof} {plan.engine === "python" ? "Priced in Python." : "Priced on this host."} Not a payout.</p>
        </>
      ) : busy ? (
        <p className="mt-4 text-sm text-white/45">Reading the prints…</p>
      ) : null}
    </section>
  );
}
