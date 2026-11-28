import { useState } from "react";
import { toast } from "sonner";
import { connectPhantom } from "@/lib/phantom";
import { CARD_KINDS, listCards, makeCard, useCard, type CardKind, type SpendCard } from "@/lib/spend-cards";
import { cn } from "@/lib/utils";

/** Caps that send USDC when used. Not a card network. */
export function SpendCards({ owner }: { owner: string }) {
  const [kind, setKind] = useState<CardKind>("once");
  const [cap, setCap] = useState("5");
  const [dest, setDest] = useState("");
  const [rows, setRows] = useState<SpendCard[]>(() => listCards());
  const [useAmt, setUseAmt] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");

  function reload() {
    setRows(listCards());
  }

  async function create() {
    setBusy("new");
    try {
      makeCard(kind, Number(cap), dest);
      setDest("");
      reload();
      toast.success("Card is live. Nothing moved yet.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That card was not made.");
    } finally {
      setBusy("");
    }
  }

  async function pay(row: SpendCard) {
    const usd = Number(useAmt[row.id] || Math.max(row.cap - row.spent, 0));
    setBusy(row.id);
    try {
      const who = owner || (await connectPhantom());
      const sig = await useCard(row.id, who, usd);
      toast.success(`Sent. ${sig.slice(0, 8)}…`);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The card did not pay.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Cards</p>
      <h2 className="mt-1 font-display text-2xl tracking-tight">A cap that actually pays.</h2>
      <p className="mt-1 max-w-lg text-sm text-muted">Not a Mastercard number. There is no issuer here. Using a card sends USDC from this Phantom to the one address on it. Cash means Bitso, then they withdraw. Once dies after a single send.</p>
      <div className="mt-4 flex flex-wrap gap-1">
        {CARD_KINDS.map((row) => (
          <button key={row.id} type="button" onClick={() => setKind(row.id)} className={cn("min-h-9 rounded-full px-3 text-xs font-semibold", kind === row.id ? "bg-white text-black" : "border border-white/10 text-muted")}>
            {row.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">{CARD_KINDS.find((row) => row.id === kind)?.line}</p>
      <div className="mt-3 flex gap-2">
        <input value={cap} onChange={(e) => setCap(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="Card cap in dollars" className="min-h-11 w-24 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm" />
        <input value={dest} onChange={(e) => setDest(e.target.value.trim())} placeholder="Only address this card can pay" spellCheck={false} className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-xs" />
      </div>
      <button type="button" disabled={busy === "new"} onClick={() => void create()} className="mt-3 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
        {busy === "new" ? "…" : `Make a ${kind} card`}
      </button>
      {rows.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {rows.map((row) => {
            const left = Math.max(row.cap - row.spent, 0);
            return (
              <li key={row.id} className="rounded-2xl border border-white/10 px-3 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold capitalize">{row.kind} {row.live ? "" : "· spent"}</p>
                  <p className="font-mono text-sm tabular-nums">${left.toFixed(2)} left</p>
                </div>
                <p className="truncate font-mono text-[11px] text-subtle">{row.dest}</p>
                {row.live ? (
                  <div className="mt-2 flex gap-2">
                    <input value={useAmt[row.id] ?? ""} onChange={(e) => setUseAmt((cur) => ({ ...cur, [row.id]: e.target.value.replace(/[^0-9.]/g, "") }))} placeholder={left.toFixed(2)} inputMode="decimal" aria-label="Amount to send" className="min-h-9 w-24 rounded-full border border-white/10 bg-black/30 px-3 font-mono text-xs" />
                    <button type="button" disabled={busy === row.id} onClick={() => void pay(row)} className="min-h-9 rounded-full bg-white px-3 text-xs font-semibold text-black disabled:opacity-40">
                      {busy === row.id ? "Waiting" : "Use card"}
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
