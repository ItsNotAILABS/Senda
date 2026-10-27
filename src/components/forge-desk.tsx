import { useEffect, useState } from "react";
import { toast } from "sonner";
import { addForge, dropForge, listForge, shareText, type ForgeKind, type ForgeTool } from "@/lib/forge";
import { connectPhantom } from "@/lib/phantom";
import { payUsdc } from "@/lib/solana-pay";
import { postJob } from "@/lib/work-jobs";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const KINDS: { id: ForgeKind; label: string }[] = [
  { id: "pay", label: "Payment" },
  { id: "cover", label: "Cover" },
  { id: "job", label: "Job" },
];

async function shareCard(row: ForgeTool) {
  const text = shareText(row);
  if (typeof navigator.share === "function") {
    await navigator.share({ title: row.name, text });
    return;
  }
  await navigator.clipboard.writeText(text);
  toast.success("Card copied.");
}

/** Payment, cover, and job tools. Each one pays USDC. Jupiter is not the rail. */
export function ForgeDesk() {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [rows, setRows] = useState<ForgeTool[]>([]);
  const [kind, setKind] = useState<ForgeKind>("pay");
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [usd, setUsd] = useState("25");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    setRows(listForge());
  }, []);

  function refresh() {
    setRows(listForge());
  }

  function make() {
    try {
      addForge({ kind, name, brief, usd: Number(usd), to });
      setName("");
      setBrief("");
      refresh();
      toast.success("Saved. Nothing has been paid.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save it.");
    }
  }

  async function run(row: ForgeTool) {
    setBusy(row.id);
    try {
      const who = owner || (await connectPhantom());
      if (row.kind === "job") postJob({ title: row.name, brief: row.brief, pay: row.usd, worker: row.to });
      const done = await payUsdc({
        owner: who,
        to: row.to,
        usd: row.usd,
        memo: `${row.tag}: ${row.name}`.slice(0, 80),
      });
      toast.success(`${row.tag} signed. ${done.signature.slice(0, 8)}…`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The wallet did not sign.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-black px-3 py-4">
      <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">Forge</p>
      <h2 className="mt-1 text-lg font-semibold">A payment, a cover, or a job. You sign the USDC.</h2>
      <p className="mt-1 text-sm text-white/55">This is not a Jupiter swap and not a new program. A cover is a premium you pay to an address, with the term written on the card. A job is posted, then the same USDC payment goes to the worker.</p>
      <div className="mt-3 flex gap-1">
        {KINDS.map((item) => (
          <button key={item.id} type="button" onClick={() => setKind(item.id)} className={cn("h-8 rounded-full px-3 text-xs font-semibold", kind === item.id ? "bg-white text-black" : "bg-white/10")}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="min-h-11 rounded-2xl border border-white/10 bg-black px-3 text-sm outline-none" />
        <input value={brief} onChange={(e) => setBrief(e.target.value)} placeholder={kind === "cover" ? "What the premium is for" : kind === "job" ? "The job" : "What the payment is"} className="min-h-11 rounded-2xl border border-white/10 bg-black px-3 text-sm outline-none" />
        <div className="flex gap-2">
          <input value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal" aria-label="USDC" className="min-h-11 w-28 rounded-2xl border border-white/10 bg-black px-3 font-mono text-sm outline-none" />
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Solana address that receives USDC" className="min-h-11 min-w-0 flex-1 rounded-2xl border border-white/10 bg-black px-3 font-mono text-xs outline-none" />
        </div>
        <button type="button" onClick={make} className="min-h-11 rounded-full bg-accent text-sm font-semibold text-accent-fg">Save the card</button>
      </div>
      <ul className="mt-4 space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl border border-white/10 px-3 py-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-fg">{row.tag}</span>
              <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/60">USDC</span>
              <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/60">Solana</span>
              <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/60">You sign</span>
            </div>
            <p className="mt-2 text-sm font-semibold">{row.name}</p>
            <p className="mt-1 text-sm text-white/55">{row.brief}</p>
            <p className="mt-1 font-mono text-xs text-white/40">${row.usd.toFixed(2)} · {row.to.slice(0, 4)}…{row.to.slice(-4)}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={busy === row.id} onClick={() => void run(row)} className="min-h-10 flex-1 rounded-full bg-white text-xs font-semibold text-black disabled:opacity-40">
                {busy === row.id ? "Waiting on the wallet" : `Sign $${row.usd.toFixed(2)}`}
              </button>
              <button type="button" onClick={() => void shareCard(row).catch(() => toast.error("Could not share the card."))} className="min-h-10 rounded-full border border-white/15 px-3 text-xs font-semibold">Share</button>
              <button type="button" onClick={() => { dropForge(row.id); refresh(); }} className="min-h-10 rounded-full border border-white/15 px-3 text-xs">Drop</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
