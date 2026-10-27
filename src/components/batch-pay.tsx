import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { USDC } from "@/lib/jup-exec";
import { connectPhantom } from "@/lib/phantom";
import { payBatch } from "@/lib/solana-pay";
import { rememberTrade } from "@/lib/trade-log";

type Line = { id: string; place: string; to: string; usd: string };

const PLACES = ["US", "Mexico", "US card", "Mexico card"];

function blank(place: string): Line {
  return { id: `${place}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, place, to: "", usd: "" };
}

/** One signature pays several Solana addresses. A US card and a Mexico card can be in the same batch. */
export function BatchPay({ owner }: { owner: string }) {
  const [rows, setRows] = useState<Line[]>([blank("US"), blank("Mexico")]);
  const [busy, setBusy] = useState(false);

  function setRow(id: string, patch: Partial<Line>) {
    setRows((cur) => cur.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function pay() {
    const ready = rows
      .map((row) => ({ to: row.to.trim(), usd: Number(row.usd), memo: row.place }))
      .filter((row) => row.to && row.usd > 0);
    if (ready.length < 2) {
      toast.error("Two addresses, each with an amount.");
      return;
    }
    setBusy(true);
    try {
      const who = owner || (await connectPhantom());
      const signature = await payBatch({ owner: who, rows: ready });
      const sum = ready.reduce((n, row) => n + row.usd, 0);
      rememberTrade({ symbol: "USDC", side: "send", usd: sum, mint: USDC, signature });
      toast.success(`Paid ${ready.length}. ${signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The batch did not send.");
    } finally {
      setBusy(false);
    }
  }

  const sum = rows.reduce((n, row) => n + (Number(row.usd) || 0), 0);

  return (
    <section className="space-y-3 rounded-[22px] border border-white/10 bg-[#10131c] p-5">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Batch</p>
      <h2 className="font-display text-2xl tracking-tight">US and Mexico in one signature.</h2>
      <p className="max-w-lg text-sm text-muted">Every line is USDC. A person gets their Phantom address. A US card is the Solana USDC address Coinbase shows, and the Coinbase Visa spends it. A Mexico card is the Solana USDC address Bitso shows, and the Bitso card spends the pesos after they sell. Senda does not see either card.</p>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="grid gap-2 sm:grid-cols-[8rem_1fr_6rem]">
            <select value={row.place} onChange={(e) => setRow(row.id, { place: e.target.value })} aria-label="Where this payment goes" className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-2 text-sm">
              {PLACES.map((place) => (
                <option key={place}>{place}</option>
              ))}
            </select>
            <input value={row.to} onChange={(e) => setRow(row.id, { to: e.target.value.trim() })} placeholder="Solana address" spellCheck={false} className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-xs" />
            <input value={row.usd} onChange={(e) => setRow(row.id, { usd: e.target.value.replace(/[^0-9.]/g, "") })} inputMode="decimal" placeholder="USD" aria-label="Dollars" className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm" />
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button type="button" disabled={rows.length >= 6} onClick={() => setRows((cur) => [...cur, blank("US")])} className="min-h-10 rounded-full border border-white/10 px-4 text-xs font-semibold disabled:opacity-40">Add a line</button>
        {rows.length > 2 ? (
          <button type="button" onClick={() => setRows((cur) => cur.slice(0, -1))} className="min-h-10 rounded-full border border-white/10 px-4 text-xs font-semibold">Remove</button>
        ) : null}
      </div>
      <button type="button" disabled={busy} onClick={() => void pay()} className="min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
        {busy ? "Waiting on Phantom" : `Pay $${sum.toFixed(2)} across ${rows.filter((row) => row.to && Number(row.usd) > 0).length || 0}`}
      </button>
      <p className="text-xs text-muted">What is left can be converted on <Link to="/wallet" className="font-semibold text-accent">Swap</Link> or put to work on <Link to="/invest" className="font-semibold text-accent">Trade</Link>.</p>
    </section>
  );
}
