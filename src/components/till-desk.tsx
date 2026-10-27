import { useEffect, useState } from "react";
import { toast } from "sonner";
import { connectPhantom } from "@/lib/phantom";
import { payUsdc } from "@/lib/solana-pay";
import { listTills, onTills, spinTill, sweepTill, tillUsdc, TILL_REASONS, type Till, type TillReason } from "@/lib/tills";

/** Spin a real Solana wallet from the connected Phantom. The secret stays sealed to that Phantom. */
export function TillDesk({ owner }: { owner: string }) {
  const [rows, setRows] = useState<Till[]>([]);
  const [held, setHeld] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState("");

  function reload() {
    const next = listTills();
    setRows(next);
    void Promise.all(next.map(async (row) => [row.id, await tillUsdc(row.address).catch(() => 0)] as const)).then((pairs) => {
      setHeld(Object.fromEntries(pairs));
    });
  }

  useEffect(() => {
    reload();
    return onTills(reload);
  }, []);

  async function spin(reason: TillReason) {
    setBusy(reason);
    try {
      const who = owner || (await connectPhantom());
      const row = await spinTill(who, reason);
      toast.success(`${row.name} is live. ${row.address.slice(0, 4)}…`);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Phantom did not open the desk.");
    } finally {
      setBusy("");
    }
  }

  async function fund(row: Till, usd: number) {
    setBusy(row.id);
    try {
      const who = owner || (await connectPhantom());
      const paid = await payUsdc({ owner: who, to: row.address, usd, memo: row.reason });
      toast.success(`Funded. ${paid.signature.slice(0, 8)}…`);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not fund it.");
    } finally {
      setBusy("");
    }
  }

  async function sweep(row: Till) {
    setBusy(`sweep-${row.id}`);
    try {
      const who = owner || (await connectPhantom());
      const sig = await sweepTill(row.id, who);
      toast.success(`Back on Phantom. ${sig.slice(0, 8)}…`);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "It did not come back.");
    } finally {
      setBusy("");
    }
  }

  async function copy(address: string) {
    try {
      await navigator.clipboard.writeText(address);
      toast.success("Address copied.");
    } catch {
      toast.error("Could not copy that address.");
    }
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Wallets</p>
      <h2 className="mt-1 font-display text-2xl tracking-tight">Spin one up.</h2>
      <p className="mt-1 max-w-lg text-sm text-muted">A real Solana wallet. The key is sealed to this Phantom. The app can hold it for a job. It cannot spend the Phantom itself.</p>
      <div className="mt-4 grid gap-2">
        {TILL_REASONS.map((row) => {
          const have = rows.some((item) => item.reason === row.id);
          return (
            <div key={row.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 px-3 py-2">
              <div>
                <p className="text-sm font-semibold">{row.label}</p>
                <p className="text-[11px] text-muted">{row.line}</p>
              </div>
              {have ? (
                <span className="shrink-0 text-xs font-semibold text-subtle">Open</span>
              ) : (
                <button type="button" disabled={busy === row.id} onClick={() => void spin(row.id)} className="min-h-9 shrink-0 rounded-full bg-accent px-3 text-xs font-semibold text-accent-fg disabled:opacity-40">
                  {busy === row.id ? "…" : "Open"}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {rows.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded-2xl border border-white/10 px-3 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold">{row.name}</p>
                <p className="font-mono text-sm tabular-nums">${(held[row.id] ?? 0).toFixed(2)}</p>
              </div>
              <p className="truncate font-mono text-[11px] text-subtle">{row.address}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                <button type="button" onClick={() => void copy(row.address)} className="min-h-9 rounded-full border border-white/10 px-3 text-xs font-semibold">Copy</button>
                {[5, 20].map((usd) => (
                  <button key={usd} type="button" disabled={busy === row.id} onClick={() => void fund(row, usd)} className="min-h-9 rounded-full border border-white/10 px-3 text-xs font-semibold disabled:opacity-40">
                    {busy === row.id ? "…" : `Fund $${usd}`}
                  </button>
                ))}
                <button type="button" disabled={busy === `sweep-${row.id}`} onClick={() => void sweep(row)} className="min-h-9 rounded-full bg-white px-3 text-xs font-semibold text-black disabled:opacity-40">
                  {busy === `sweep-${row.id}` ? "…" : "Back to Phantom"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
