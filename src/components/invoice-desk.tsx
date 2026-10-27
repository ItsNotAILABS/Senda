import { useEffect, useState } from "react";
import { toast } from "sonner";
import { payUsdc } from "@/lib/solana-pay";
import { getMxnDesk } from "@/lib/mxn-rate";
import { rememberTrade } from "@/lib/trade-log";
import { USDC } from "@/lib/jup-exec";
import { connectPhantom } from "@/lib/phantom";
import { humanWalletError } from "@/lib/mobile-wallet";

const KEY = "senda.invoices.v1";

type Bill = {
  id: string;
  title: string;
  usd: number;
  to: string;
  sig: string;
  at: number;
};

function load(): Bill[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as Bill[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

/** A bill paid in USDC. The signature is the funding. Pesos are the quote, not the asset. */
export function InvoiceDesk({ owner }: { owner: string }) {
  const [title, setTitle] = useState("");
  const [usd, setUsd] = useState("20");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<Bill[]>([]);
  const [mxn, setMxn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");

  useEffect(() => {
    setRows(load());
    void getMxnDesk()
      .then((d) => setMxn(d.market || d.bitso || 0))
      .catch(() => setMxn(0));
  }, []);

  const pesos = mxn > 0 ? Number(usd) * mxn : 0;

  async function pay() {
    const n = Number(usd);
    if (!title.trim()) return toast.error("Name the invoice.");
    if (!(n > 0)) return toast.error("Enter the dollars.");
    if (!to.trim()) return toast.error("Paste who receives the USDC.");
    setBusy(true);
    setFail("");
    try {
      const who = owner || (await connectPhantom());
      const paid = await payUsdc({ owner: who, to: to.trim(), usd: n, memo: title.trim().slice(0, 32) });
      const bill: Bill = { id: paid.signature.slice(0, 12), title: title.trim(), usd: n, to: to.trim(), sig: paid.signature, at: Date.now() };
      const next = [bill, ...load()].slice(0, 40);
      localStorage.setItem(KEY, JSON.stringify(next));
      setRows(next);
      rememberTrade({ symbol: "USDC", side: "send", usd: n, mint: USDC, signature: paid.signature });
      toast.success("Paid. The invoice is funded.");
    } catch (e) {
      const message = humanWalletError(e instanceof Error ? e.message : "The invoice was not paid.");
      setFail(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function copyBill() {
    if (!owner) return toast.error("Connect Phantom. That address is who they pay.");
    const n = Number(usd) || 0;
    const text = `Invoice: ${title.trim() || "Senda"}\nPay ${n} USDC to\n${owner}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Bill copied. They pay that address.");
    } catch {
      toast.error("Could not copy.");
    }
  }

  return (
    <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#0c0e14]">
      <div className="flex items-end justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Invoice</p>
          <h2 className="text-xl tracking-tight">Bill it. Or pay it.</h2>
        </div>
        <p className="font-mono text-xs text-muted">{pesos > 0 ? `About ${pesos.toLocaleString("en-US", { maximumFractionDigits: 0 })} MXN` : "Peso quote loading"}</p>
      </div>
      <div className="grid gap-2 p-4 sm:grid-cols-[1fr_8rem]">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What it's for" className="min-h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-base outline-none" />
        <input value={usd} onChange={(e) => setUsd(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="USDC" className="min-h-12 rounded-2xl border border-white/10 bg-black/30 px-4 font-mono text-lg outline-none" />
      </div>
      <div className="px-4 pb-4">
        <input value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="Their Solana address, if you are paying" spellCheck={false} className="min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 font-mono text-xs outline-none" />
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => void copyBill()} className="min-h-12 flex-1 rounded-full border border-white/15 text-sm font-semibold">Copy a bill</button>
          <button type="button" disabled={busy} onClick={() => void pay()} className="min-h-12 flex-1 rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">{busy ? "Waiting" : "Pay"}</button>
        </div>
        {fail ? <p className="senda-shake mt-2 text-sm text-down">{fail}</p> : null}
        <ul className="mt-3 divide-y divide-white/10">
          {rows.slice(0, 6).map((row) => (
            <li key={row.sig} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{row.title}</span>
                <a href={`https://solscan.io/tx/${row.sig}`} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-accent">{row.sig.slice(0, 8)}…</a>
              </span>
              <span className="font-mono text-sm tabular-nums">{row.usd} USDC</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
