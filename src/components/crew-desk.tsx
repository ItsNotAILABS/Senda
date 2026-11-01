import { useState } from "react";
import { toast } from "sonner";
import {
  claimCrew,
  closeCrew,
  CREW_KINDS,
  CREW_NETS,
  fileCrew,
  listCrew,
  noteCrew,
  openCrewSeal,
  payCrew,
  type CrewContract,
  type CrewKind,
  type CrewNet,
} from "@/lib/crew-book";
import { sealOpen } from "@/lib/seal";
import { VENDORS } from "@/lib/vendors";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const KIND_LINE: Record<CrewKind, string> = {
  invoice: "A bill. One signature pays it.",
  milestone: "A delivery. Pay when it is done.",
  bounty: "Open crypto work. Claim an address, then the payer signs.",
  retainer: "The same amount again. Every draw is a new signature.",
  grant: "Pay a contributor on a venue this desk already uses.",
};

export function CrewDesk() {
  const wallet = useWallet();
  const payer = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const evm = wallet.w.links.find((l) => l.kind === "evm")?.address ?? "";
  const [rows, setRows] = useState<CrewContract[]>(() => listCrew());
  const [kind, setKind] = useState<CrewKind>("invoice");
  const [net, setNet] = useState<CrewNet>("Solana");
  const [venue, setVenue] = useState(VENDORS[0].name);
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [payee, setPayee] = useState("");
  const [usd, setUsd] = useState("25");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState(sealOpen());

  function refresh() {
    setRows(listCrew());
    setOpen(sealOpen());
  }

  async function unlock() {
    setBusy("seal");
    try {
      if (!payer) throw new Error("Connect the Solana wallet that pays.");
      await openCrewSeal(payer);
      refresh();
      toast.success("Crew is sealed to this wallet.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The seal did not open.");
    } finally {
      setBusy("");
    }
  }

  function file() {
    setBusy("file");
    try {
      fileCrew({
        payer,
        kind,
        title,
        brief,
        usd: Number(usd),
        payee,
        net,
        venue,
      });
      setTitle("");
      setBrief("");
      refresh();
      toast.success("Filed. Nothing has moved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "It did not file.");
    } finally {
      setBusy("");
    }
  }

  async function pay(row: CrewContract) {
    setBusy(row.id);
    try {
      const sig = await payCrew(row.id, payer);
      refresh();
      toast.success(`Paid on ${row.net}. ${sig.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not pay.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
      <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Crew</p>
      <h2 className="mt-1 text-2xl tracking-tight">A contract that pays</h2>
      <p className="mt-2 text-sm text-muted">
        Invoice, milestone, bounty, retainer, or grant. The note is sealed to the wallet. Pay is USDC on the network you pick. An agent can write in the thread. It cannot sign.
      </p>
      <button type="button" disabled={busy !== ""} onClick={() => void unlock()} className="mt-3 min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:opacity-40">
        {open ? "Crew is sealed" : busy === "seal" ? "Waiting on the wallet" : "Unlock the crew"}
      </button>
      <div className="mt-4 flex gap-1 overflow-x-auto">
        {CREW_KINDS.map((id) => (
          <button key={id} type="button" onClick={() => setKind(id)} className={cn("min-h-11 shrink-0 rounded-full px-3 text-sm font-semibold capitalize", kind === id ? "bg-accent text-accent-fg" : "border border-white/15")}>
            {id}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">{KIND_LINE[kind]}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <select value={net} onChange={(e) => setNet(e.target.value as CrewNet)} className="h-12 rounded-xl border border-white/10 bg-black px-3 text-[15px] text-white" aria-label="Network">
          {CREW_NETS.map((id) => (
            <option key={id} value={id}>{id === "Solana" ? "Solana" : `${id} USDC`}</option>
          ))}
        </select>
        <select value={venue} onChange={(e) => setVenue(e.target.value)} className="h-12 rounded-xl border border-white/10 bg-black px-3 text-[15px] text-white" aria-label="Venue">
          {VENDORS.map((row) => (
            <option key={row.name} value={row.name}>{row.name}</option>
          ))}
        </select>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What it is" className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm" />
        <input value={usd} onChange={(e) => setUsd(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="USDC" className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm" />
        <input value={payee} onChange={(e) => setPayee(e.target.value)} placeholder={net === "Solana" ? "Payee Solana address" : "Payee 0x address"} className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-xs sm:col-span-2" />
        <textarea value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="What done looks like" className="min-h-20 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm sm:col-span-2" />
      </div>
      {net !== "Solana" && evm ? <p className="mt-2 font-mono text-[11px] text-subtle">EVM wallet linked. The pay still asks that wallet to switch to {net}.</p> : null}
      <button type="button" disabled={busy !== ""} onClick={file} className="mt-3 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
        File {kind}
      </button>
      <ul className="mt-4 space-y-3">
        {rows.length === 0 ? <li className="text-sm text-muted">No crew contract in this seal.</li> : null}
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl border border-white/10 px-3 py-3">
            <p className="text-sm font-semibold">{row.title}</p>
            <p className="mt-1 text-xs capitalize text-muted">{row.kind} · {row.venue} · {row.net} · {row.status}{row.kind === "retainer" ? ` · ${row.draws} drawn` : ""}</p>
            <p className="mt-1 text-xs text-muted">{row.brief}</p>
            <p className="mt-1 font-mono text-xs text-subtle">${row.usd.toFixed(2)} → {row.payee ? `${row.payee.slice(0, 4)}…${row.payee.slice(-4)}` : "unclaimed"}</p>
            <ul className="mt-2 space-y-1">
              {row.notes.map((line) => (
                <li key={`${line.at}`} className="text-xs text-white/70">{line.from === "agent" ? "Agent" : "You"} · {line.text}</li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" className="min-h-10 min-w-0 flex-1 rounded-full border border-white/10 bg-black/30 px-3 text-xs" />
              <button type="button" disabled={busy !== ""} onClick={() => { try { noteCrew(row.id, "user", note); setNote(""); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "The note did not save."); } }} className="min-h-10 rounded-full border border-white/15 px-3 text-xs font-semibold">Write</button>
            </div>
            {row.kind === "bounty" && row.status === "open" ? (
              <button type="button" className="mt-2 min-h-10 w-full rounded-full border border-white/15 text-xs font-semibold" onClick={() => { try { claimCrew(row.id, payee); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "It did not claim."); } }}>
                Claim with the address above
              </button>
            ) : null}
            <div className="mt-2 flex gap-2">
              {row.status === "open" ? (
                <button type="button" disabled={busy !== ""} onClick={() => void pay(row)} className="min-h-10 flex-1 rounded-full bg-accent text-xs font-semibold text-accent-fg">
                  {busy === row.id ? "Waiting on the wallet" : `Pay $${row.usd.toFixed(0)}`}
                </button>
              ) : null}
              {row.status === "open" && row.draws === 0 ? (
                <button type="button" disabled={busy !== ""} onClick={() => { try { closeCrew(row.id, payer); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "It did not close."); } }} className="min-h-10 flex-1 rounded-full border border-white/15 text-xs font-semibold">
                  Close unpaid
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CrewThread() {
  const [rows, setRows] = useState<CrewContract[]>(() => listCrew().filter((row) => row.status === "open"));
  const [text, setText] = useState("");
  if (!sealOpen()) return <p className="text-sm text-muted">Unlock the crew on Contracts. An agent does not read a brief that is still in the clear.</p>;
  return (
    <div className="space-y-2">
      {rows.length === 0 ? <p className="text-sm text-muted">No open crew contract.</p> : null}
      {rows.map((row) => (
        <div key={row.id} className="rounded-2xl border border-white/10 px-3 py-3">
          <p className="text-sm font-semibold">{row.title}</p>
          <p className="mt-1 text-xs text-muted">{row.kind} · {row.venue} · {row.net} · ${row.usd.toFixed(2)}. The agent can write. It cannot pay.</p>
          <div className="mt-2 flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Note to the payer" className="min-h-10 min-w-0 flex-1 rounded-full border border-white/10 bg-black/30 px-3 text-xs" />
            <button type="button" onClick={() => { try { noteCrew(row.id, "agent", text); setText(""); setRows(listCrew().filter((item) => item.status === "open")); } catch (e) { toast.error(e instanceof Error ? e.message : "The note did not save."); } }} className="min-h-10 rounded-full bg-white px-3 text-xs font-semibold text-black">
              Write
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
