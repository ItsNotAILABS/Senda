import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ATTACHED, accountOpen, attachedAddress, openOne, type Attached } from "@/lib/attached";
import { sealState } from "@/lib/seal";

/** The token accounts this Phantom already owns. Opening one is a signature. The app does not hold the key. */
export function VaultAccounts({ owner }: { owner: string }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [seal, setSeal] = useState(sealState());
  const [busy, setBusy] = useState("");

  useEffect(() => {
    const sync = () => setSeal(sealState());
    window.addEventListener("senda-seal", sync);
    return () => window.removeEventListener("senda-seal", sync);
  }, []);

  useEffect(() => {
    if (!owner) {
      setOpen({});
      return;
    }
    let live = true;
    void Promise.all(
      ATTACHED.map(async (row) => {
        if (!row.mint) return [row.id, true] as const;
        const have = await accountOpen(attachedAddress(owner, row)).catch(() => false);
        return [row.id, have] as const;
      }),
    ).then((rows) => {
      if (live) setOpen(Object.fromEntries(rows));
    });
    return () => {
      live = false;
    };
  }, [owner]);

  async function openRow(row: Attached) {
    if (!owner || !row.mint) return;
    setBusy(row.id);
    try {
      const signature = await openOne(owner, row.mint);
      setOpen((cur) => ({ ...cur, [row.id]: true }));
      toast.success(signature ? "Phantom opened that account." : "That account was already open.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Phantom did not open it.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Vault</p>
          <h2 className="mt-1 text-2xl tracking-tight">Accounts on this Phantom</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">Each line is an address only this wallet can spend. Senda does not hold the key. A closed line opens when Phantom signs. SOL is the wallet itself.</p>
        </div>
        <p className={`rounded-full px-3 py-1 text-xs font-semibold ${seal.open ? "bg-accent text-accent-fg" : "bg-white/10 text-muted"}`}>
          {seal.open ? "Desk sealed for this visit" : "Desk locked"}
        </p>
      </div>
      <p className="mt-3 text-xs text-subtle">
        What this browser remembers is AES-GCM. The key is this visit’s wallet signature and it is not written down. A seen-flag stays in the clear. Fills, pairs, and the journal do not.
      </p>
      {!owner ? <p className="mt-3 text-sm text-subtle">Connect Phantom. These addresses are derived from that account.</p> : null}
      <ul className="mt-3 divide-y divide-white/10">
        {ATTACHED.map((row) => {
          const address = owner ? attachedAddress(owner, row) : "";
          const live = Boolean(open[row.id]);
          return (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{row.symbol}{live ? "" : " · closed"}</p>
                <p className="text-xs text-muted">{row.line}</p>
                {address ? <p className="mt-1 truncate font-mono text-[11px] text-subtle">{address}</p> : null}
              </div>
              <div className="flex gap-2">
                {address ? (
                  <button type="button" onClick={() => void navigator.clipboard.writeText(address)} className="min-h-9 rounded-full border border-white/15 px-3 text-xs font-semibold">
                    Copy
                  </button>
                ) : null}
                {row.mint && owner && !live ? (
                  <button type="button" disabled={busy === row.id} onClick={() => void openRow(row)} className="min-h-9 rounded-full bg-accent px-3 text-xs font-semibold text-accent-fg disabled:opacity-40">
                    {busy === row.id ? "Signing" : "Open"}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
