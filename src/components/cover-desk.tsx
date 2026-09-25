import { useState } from "react";
import { toast } from "sonner";
import { COVERS, formatCover } from "@/lib/cover";
import { formatMoney } from "@/lib/wallet";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { AddMoneyScreen } from "@/components/add-money";

const WHEN: Record<string, string> = {
  phone: "The phone cracks, is stolen, or takes liquid.",
  travel: "A delay, a lost bag, or medical care on the trip.",
  renters: "Theft or water in the place you rent.",
  accident: "An ER visit and the follow-up.",
  pet: "A vet emergency.",
  auto: "A windshield or a roadside stop.",
  load: "The haul is a total loss.",
  life: "The term pays the named family.",
};

export function CoverDesk() {
  const { w, cover, claim } = useWallet();
  const [addOpen, setAddOpen] = useState(false);
  const [id, setId] = useState(COVERS[0].id);
  const plan = COVERS.find((c) => c.id === id) ?? COVERS[0];
  const empty = w.balances.USD < plan.premium;

  function buy(c: (typeof COVERS)[number]) {
    const r = cover(c);
    if (!r.ok) toast.error(r.error || "Not enough cash.");
    else toast.success(`${c.title} is on. Pays ${formatCover(c.cover)}.`);
  }

  return (
    <div className="grid gap-3 px-3 py-3 lg:grid-cols-[240px_minmax(0,1fr)_300px] lg:px-4">
      {addOpen ? <AddMoneyScreen onClose={() => setAddOpen(false)} /> : null}
      <aside className="rounded-[28px] border border-white/10 bg-[#101018] p-2">
        <p className="px-2 py-2 font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Cover</p>
        {COVERS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setId(c.id)}
            className={`flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm ${c.id === plan.id ? "bg-white/10" : "hover:bg-white/5"}`}
          >
            <span className="font-semibold">{c.title}</span>
            <span className="font-mono text-[11px] text-muted">{formatMoney(c.premium)}</span>
          </button>
        ))}
      </aside>

      <section className="rounded-[28px] border border-white/10 bg-[#101018] p-6">
        <p className="text-xs text-subtle">{plan.term} · not a licensed policy</p>
        <h1 className="mt-2 text-4xl">{plan.title}</h1>
        <p className="mt-3 max-w-lg text-sm text-muted">{plan.blurb}</p>
        <dl className="mt-5 grid grid-cols-2 gap-2">
          <Cell k="Premium now" v={formatMoney(plan.premium)} />
          <Cell k="Pays" v={formatCover(plan.cover)} />
          <Cell k="Pays when" v={WHEN[plan.id] || plan.blurb} />
          <Cell k="Paid as" v={`${plan.payout} into Senda cash`} />
        </dl>
        <p className="mt-4 text-sm text-muted">Cash on the account: ${w.balances.USD.toFixed(2)}</p>
        {empty ? (
          <button type="button" onClick={() => setAddOpen(true)} className="mt-4 min-h-11 rounded-full bg-white/10 px-5 text-sm font-semibold">
            Add cash first
          </button>
        ) : (
          <button type="button" onClick={() => buy(plan)} className="mt-4 min-h-12 rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg">
            Buy {plan.title} · {formatMoney(plan.premium)}
          </button>
        )}
      </section>

      <aside className="rounded-[28px] border border-white/10 bg-[#101018] p-5">
        <h2 className="text-lg">On you</h2>
        <p className="mt-1 text-xs text-muted">File it and the cover pays once, then it ends. You are saying the thing happened.</p>
        {w.policies.length === 0 ? <p className="mt-3 text-sm text-subtle">Nothing bought.</p> : null}
        <ul className="mt-3 space-y-2">
          {w.policies.map((p) => (
            <li key={p.id} className="rounded-2xl bg-black/40 px-3 py-3">
              <p className="text-sm font-semibold">{p.title}</p>
              <p className="text-xs text-subtle">until {new Date(p.until).toLocaleDateString()} · {formatCover(p.cover)}</p>
              <button
                type="button"
                onClick={() => {
                  const r = claim(p.id);
                  if (!r.ok) toast.error(r.error || "Could not pay the cover.");
                  else toast.success(`${p.title} paid ${formatCover(p.cover)}.`);
                }}
                className="mt-2 text-xs font-semibold text-accent"
              >
                File and pay
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl bg-black/40 px-3 py-2">
      <p className="text-[11px] text-subtle">{k}</p>
      <p className="text-sm">{v}</p>
    </div>
  );
}
