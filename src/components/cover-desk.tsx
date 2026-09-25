import { useState } from "react";
import { toast } from "sonner";
import { COVERS, formatCover } from "@/lib/cover";
import { formatMoney } from "@/lib/wallet";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { AddMoneyScreen } from "@/components/add-money";

export function CoverDesk() {
  const { w, cover } = useWallet();
  const [addOpen, setAddOpen] = useState(false);
  const empty = w.balances.USD < 1;

  function buy(c: (typeof COVERS)[number]) {
    const r = cover(c);
    if (!r.ok) toast.error(r.error);
    else toast.success(`${c.title} is on. Pays ${formatCover(c.cover)}.`);
  }

  const life = COVERS.filter((c) => c.id !== "load");
  const haul = COVERS.filter((c) => c.id === "load");

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      {addOpen ? <AddMoneyScreen onClose={() => setAddOpen(false)} /> : null}
      <header className="rounded-[28px] border border-white/10 bg-[#101018] p-6">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Cover</p>
        <h1 className="mt-2 text-4xl">Cover what you actually use</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Phone, travel, the apartment, the car, a pet, an accident, a haul, a term for family. Premium comes out of Senda cash. A PreStock drop cover is bought on that name, not here.
        </p>
        <p className="mt-4 font-mono text-3xl">${w.balances.USD.toFixed(2)} <span className="text-base text-muted">cash</span></p>
        {empty ? (
          <button type="button" onClick={() => setAddOpen(true)} className="mt-4 min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">
            Add cash for a premium
          </button>
        ) : null}
      </header>

      <section className="rounded-[28px] border border-white/10 bg-[#101018] p-5">
        <h2 className="text-lg">On you</h2>
        {w.policies.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing bought. A cover does not exist until the premium leaves cash.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {w.policies.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-2xl bg-black/40 px-4 py-3">
                <span>
                  <span className="block text-sm font-semibold">{p.title}</span>
                  <span className="text-xs text-subtle">until {new Date(p.until).toLocaleDateString()} · pays {formatCover(p.cover)}</span>
                </span>
                <span className="font-mono text-sm">{formatMoney(p.premium)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="px-1 text-sm font-semibold">Life</h2>
        <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {life.map((c) => (
            <Plan key={c.id} plan={c} onBuy={() => buy(c)} />
          ))}
        </div>
      </section>
      <section>
        <h2 className="px-1 text-sm font-semibold">A haul</h2>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {haul.map((c) => (
            <Plan key={c.id} plan={c} onBuy={() => buy(c)} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Plan({
  plan,
  onBuy,
}: {
  plan: (typeof COVERS)[number];
  onBuy: () => void;
}) {
  return (
    <article className="flex flex-col rounded-[28px] border border-white/10 bg-[#101018] p-5">
      <p className="text-xs text-subtle">{plan.term}</p>
      <h3 className="mt-1 text-2xl">{plan.title}</h3>
      <p className="mt-2 flex-1 text-sm text-muted">{plan.blurb}</p>
      <p className="mt-4 font-mono text-3xl">{formatMoney(plan.premium)}</p>
      <p className="text-xs text-subtle">pays {formatCover(plan.cover)} · {plan.payout}</p>
      <button type="button" onClick={onBuy} className="mt-4 min-h-11 rounded-full bg-accent text-sm font-semibold text-accent-fg">
        Buy this cover
      </button>
    </article>
  );
}

