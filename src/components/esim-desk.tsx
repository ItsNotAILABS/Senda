import { useState } from "react";
import { toast } from "sonner";
import { TRAVEL, esimPlans, type EsimPlan } from "@/lib/global-rails";
import { cn } from "@/lib/utils";

/** A destination, then the plans ESIMaccess actually returns. No invented price. */
export function EsimDesk() {
  const [code, setCode] = useState("MX");
  const [plans, setPlans] = useState<EsimPlan[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const place = TRAVEL.find((row) => row.code === code) ?? TRAVEL[0];

  async function load() {
    setBusy(true);
    setPlans([]);
    setNote("");
    try {
      const row = await esimPlans({ data: { location: code } });
      setPlans(row.plans);
      if (!row.ok) {
        setNote(row.error);
        toast.error(row.error);
        return;
      }
      if (row.plans.length === 0) setNote("ESIMaccess returned no plan for that country.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ESIMaccess did not answer.";
      setNote(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
      <h2 className="text-lg">5 · Travel eSIM</h2>
      <p className="mt-1 text-sm text-muted">Pick where you land. The prices are ESIMaccess’s, and only after the key answers. This screen does not buy the plan.</p>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {TRAVEL.map((row) => (
          <button
            key={row.code}
            type="button"
            onClick={() => { setCode(row.code); setPlans([]); setNote(""); }}
            className={cn("min-h-14 rounded-2xl px-2 text-left", code === row.code ? "bg-white text-black" : "bg-black/30")}
          >
            <span className="block font-mono text-[11px] opacity-60">{row.code}</span>
            <span className="block text-sm font-semibold leading-tight">{row.name}</span>
          </button>
        ))}
      </div>
      <button type="button" disabled={busy} onClick={() => void load()} className="mt-3 min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40">
        {busy ? "Asking ESIMaccess…" : `Plans for ${place.name}`}
      </button>
      {note ? <p className="mt-3 text-sm text-muted">{note}</p> : null}
      <ul className="mt-3 space-y-2">
        {plans.map((plan) => (
          <li key={plan.code} className="rounded-2xl bg-black/30 px-3 py-3">
            <p className="text-sm font-semibold">{plan.name}</p>
            <p className="mt-1 font-mono text-xs text-white/60">
              {plan.gb ? `${plan.gb} GB` : "Data"}{plan.days ? ` · ${plan.days} days` : ""} · ${plan.usd.toFixed(2)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
