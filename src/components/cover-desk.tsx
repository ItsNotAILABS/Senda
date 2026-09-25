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

  return (
    <main className="flex flex-1 flex-col px-3 py-3">
      {addOpen ? <AddMoneyScreen onClose={() => setAddOpen(false)} /> : null}
      <header className="rounded-[28px] border border-white/10 bg-[#101018] p-6">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Cover</p>
        <h1 className="mt-2 text-4xl">Cover the life stuff</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">Phone, travel, rent. Puts on a PreStock live under Trade.</p>
      </header>
      {empty ? (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="mt-5 min-h-12 w-full rounded-full bg-accent text-base font-semibold text-accent-fg"
        >
          Add money
        </button>
      ) : null}
      {w.policies.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-sm font-medium text-muted">On the book</h2>
          <ul className="mt-2 divide-y divide-border rounded-2xl bg-elevated">
            {w.policies.map((p) => (
              <li key={p.id} className="flex items-baseline justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{p.title}</p>
                  <p className="text-xs text-subtle">
                    to {new Date(p.until).toLocaleDateString()} · {formatCover(p.cover)}
                  </p>
                </div>
                <p className="text-sm tabular-nums">{formatMoney(p.premium)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="mt-6 grid grid-cols-2 gap-2">
        {COVERS.map((c) => (
          <article key={c.id} className="flex flex-col rounded-2xl bg-paper p-4 text-ink">
            <h2 className="font-display text-xl leading-tight">{c.title}</h2>
            <p className="mt-2 font-display text-2xl tabular-nums">{formatMoney(c.premium)}</p>
            <p className="text-[11px] text-ink/50">{c.term}</p>
            <p className="mt-2 flex-1 text-xs leading-snug text-ink/65">{c.blurb}</p>
            <p className="mt-2 text-[11px] text-ink/45">{formatCover(c.cover)} · {c.payout}</p>
            <button
              type="button"
              onClick={() => {
                const r = cover(c);
                if (!r.ok) toast.error(r.error);
                else toast.success(`${c.title} on · ${formatCover(c.cover)}`);
              }}
              className="mt-3 min-h-11 w-full rounded-full bg-ink text-sm font-semibold text-paper"
            >
              Buy cover
            </button>
          </article>
        ))}
      </div>
    </main>
  );
}
