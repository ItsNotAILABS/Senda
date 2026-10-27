import { useEffect, useState } from "react";
import { toast } from "sonner";
import { listSleeves, moveSleeve, openSleeve, vaultHealth, type Sleeve } from "@/lib/vault-wrap";

/** Labels on USDC that is still in the wallet. The sum is the claim. The chain is the limit. */
export function VaultSleeves({ owner, onChain, open = true, onChange }: { owner: string; onChain: number; open?: boolean; onChange?: () => void }) {
  const [rows, setRows] = useState<Sleeve[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("10");
  const [toId, setToId] = useState("");

  function pull() {
    setRows(owner && open ? listSleeves(owner) : []);
  }

  useEffect(() => {
    pull();
    const sync = () => pull();
    window.addEventListener("senda-vault", sync);
    return () => window.removeEventListener("senda-vault", sync);
  }, [owner, open]);

  const health = owner && open ? vaultHealth(owner, onChain) : { claimed: 0, free: onChain, over: 0 };
  const from = rows.find((s) => s.id === "cash") ?? rows.find((s) => s.usdc > 0);
  const targets = rows.filter((s) => s.id !== from?.id);

  function add() {
    if (!owner || !open) return toast.error("Open the vault first.");
    try {
      openSleeve(owner, name);
      setName("");
      onChange?.();
      toast.success("Sleeve opened. Nothing moved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open it.");
    }
  }

  function move() {
    if (!owner || !from) return toast.error("Wrap USDC into Cash before you split it.");
    const dest = toId || targets[0]?.id;
    if (!dest) return toast.error("Open another sleeve first.");
    try {
      moveSleeve(owner, from.id, dest, Number(amount));
      onChange?.();
      toast.success("Moved inside the claim. The wallet did not sign.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not move it.");
    }
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4 sm:p-5">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Sleeves</p>
      <h2 className="mt-1 text-2xl tracking-tight">One claim, split by name.</h2>
      <p className="mt-1 max-w-xl text-sm text-muted">A sleeve is a label on USDC that is still in Phantom. The sleeves add up to the wrap. They cannot pass the chain balance.</p>
      <dl className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-black/30 px-3 py-3">
          <dt className="text-[11px] text-white/45">On chain</dt>
          <dd className="mt-1 font-mono text-sm tabular-nums">{open && owner ? `$${onChain.toFixed(2)}` : "—"}</dd>
        </div>
        <div className="rounded-2xl bg-black/30 px-3 py-3">
          <dt className="text-[11px] text-white/45">Claimed</dt>
          <dd className="mt-1 font-mono text-sm tabular-nums">{open && owner ? `$${health.claimed.toFixed(2)}` : "—"}</dd>
        </div>
        <div className="rounded-2xl bg-black/30 px-3 py-3">
          <dt className="text-[11px] text-white/45">{health.over > 0 ? "Over" : "Free"}</dt>
          <dd className={`mt-1 font-mono text-sm tabular-nums ${health.over > 0 ? "text-down" : ""}`}>
            {open && owner ? `$${(health.over > 0 ? health.over : health.free).toFixed(2)}` : "—"}
          </dd>
        </div>
      </dl>
      {health.over > 0 ? (
        <p className="mt-3 text-sm text-down">Phantom holds less USDC than this claim. Spend or unwrap before you add more.</p>
      ) : null}
      <ul className="mt-3 divide-y divide-white/10">
        {rows.length === 0 ? <li className="py-3 text-sm text-muted">No sleeve yet. A wrap lands in Cash.</li> : null}
        {rows.map((row) => (
          <li key={row.id} className="flex items-baseline justify-between py-3">
            <span className="text-sm font-semibold">{row.name}</span>
            <span className="font-mono text-sm tabular-nums">${row.usdc.toFixed(2)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sleeve name" className="min-h-11 flex-1 rounded-full border border-white/10 bg-black/40 px-4 text-sm outline-none" />
        <button type="button" onClick={add} className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold">Open sleeve</button>
      </div>
      {from && targets.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="min-h-11 w-24 rounded-full border border-white/10 bg-black/40 px-4 font-mono text-sm outline-none" />
          <select value={toId || targets[0].id} onChange={(e) => setToId(e.target.value)} className="min-h-11 flex-1 rounded-full border border-white/10 bg-black/40 px-3 text-sm">
            {targets.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button type="button" onClick={move} className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">Move from {from.name}</button>
        </div>
      ) : null}
    </section>
  );
}
