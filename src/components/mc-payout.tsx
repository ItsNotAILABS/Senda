import { useState } from "react";
import { toast } from "sonner";
import { checkDraft, payoutSeal, type PayoutDraft } from "@/lib/mc-payload";
import { payoutStatus, pushPayout } from "@/lib/mc-send";
import { digestStringAsync, payoutReference } from "@/lib/web-crypto";

const BOOK = "senda.mc.payouts.v1";

type Saved = { id: string; reference: string; last4: string; usd: number; status: string; at: string };

function readSaved(): Saved[] {
  try {
    const raw = JSON.parse(localStorage.getItem(BOOK) || "[]") as Saved[];
    return Array.isArray(raw) ? raw.slice(0, 12) : [];
  } catch {
    return [];
  }
}

export function McPayout() {
  const [usd, setUsd] = useState("5");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [pan, setPan] = useState("");
  const [exp, setExp] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postal, setPostal] = useState("");
  const [country, setCountry] = useState("USA");
  const [reference, setReference] = useState(payoutReference);
  const [seal, setSeal] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Saved[]>(() => (typeof localStorage === "undefined" ? [] : readSaved()));

  function draft(): PayoutDraft {
    return {
      usd: Number(usd),
      reference,
      first,
      last,
      pan,
      exp,
      line1,
      city,
      state,
      postal,
      country,
    };
  }

  async function preview() {
    const row = draft();
    const bad = checkDraft(row);
    if (bad) {
      toast.error(bad);
      return;
    }
    const hash = await digestStringAsync("SHA-256", payoutSeal(row));
    setSeal(`${row.reference} · ${hash.slice(0, 16)}`);
  }

  async function send() {
    const row = draft();
    const bad = checkDraft(row);
    if (bad) {
      toast.error(bad);
      return;
    }
    setBusy(true);
    try {
      const hash = await digestStringAsync("SHA-256", payoutSeal(row));
      setSeal(`${row.reference} · ${hash.slice(0, 16)}`);
      const done = await pushPayout({ data: row });
      const saved: Saved = {
        id: done.id,
        reference: done.reference,
        last4: done.last4,
        usd: row.usd,
        status: done.status,
        at: new Date().toISOString(),
      };
      const next = [saved, ...readSaved()].slice(0, 12);
      localStorage.setItem(BOOK, JSON.stringify(next));
      setRows(next);
      setPan("");
      setReference(payoutReference());
      toast.success(done.status === "APPROVED" ? `Paid to ···· ${done.last4}. ${done.id}` : `${done.status}. ${done.detail || done.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Mastercard Send did not take it.");
    } finally {
      setBusy(false);
    }
  }

  async function refresh(id: string) {
    try {
      const done = await payoutStatus({ data: { id } });
      const next = readSaved().map((row) => (row.id === id ? { ...row, status: done.status || row.status } : row));
      localStorage.setItem(BOOK, JSON.stringify(next));
      setRows(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No status.");
    }
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-black px-4 py-4">
      <p className="text-[11px] tracking-[0.16em] text-white/40 uppercase">Mastercard Send</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">Pay a debit card</h2>
      <p className="mt-2 text-sm text-white/55">
        This is a business disbursement, payment type BDB, amount in cents. Mastercard approves it or they do not. A missing partner key stops here. The card number is not saved on this phone.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Field label="Dollars" value={usd} onChange={setUsd} inputMode="decimal" />
        <Field label="Expiry YYYY-MM" value={exp} onChange={setExp} />
        <Field label="First name" value={first} onChange={setFirst} />
        <Field label="Last name" value={last} onChange={setLast} />
      </div>
      <label className="mt-2 block text-xs text-white/45">
        Card number
        <input value={pan} onChange={(e) => setPan(e.target.value)} inputMode="numeric" autoComplete="off" className="mt-1 min-h-12 w-full rounded-2xl bg-[#1c1c1e] px-4 font-mono outline-none" />
      </label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Field label="Street" value={line1} onChange={setLine1} />
        <Field label="City" value={city} onChange={setCity} />
        <Field label="State" value={state} onChange={setState} />
        <Field label="Postal" value={postal} onChange={setPostal} />
        <Field label="Country" value={country} onChange={setCountry} />
      </div>
      {seal ? <p className="mt-3 font-mono text-[11px] text-white/45">SHA-256 {seal}</p> : null}
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => void preview()} className="min-h-12 flex-1 rounded-full bg-white/10 text-sm font-semibold">Hash</button>
        <button type="button" disabled={busy} onClick={() => void send()} className="min-h-12 flex-1 rounded-full bg-white text-sm font-semibold text-black">
          {busy ? "Sending…" : "Push to card"}
        </button>
      </div>
      {rows.length ? (
        <ul className="mt-4 divide-y divide-white/10">
          {rows.map((row) => (
            <li key={`${row.reference}-${row.at}`} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold">${row.usd.toFixed(2)} ···· {row.last4}</p>
                <p className="font-mono text-[11px] text-white/40">{row.status} · {row.reference}</p>
              </div>
              {row.id ? (
                <button type="button" onClick={() => void refresh(row.id)} className="text-xs font-semibold text-white/70">Status</button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Field({ label, value, onChange, inputMode }: { label: string; value: string; onChange: (v: string) => void; inputMode?: "decimal" | "text" | "numeric" }) {
  return (
    <label className="block text-xs text-white/45">
      {label}
      <input value={value} inputMode={inputMode} onChange={(e) => onChange(e.target.value)} className="mt-1 min-h-12 w-full rounded-2xl bg-[#1c1c1e] px-4 outline-none" />
    </label>
  );
}
