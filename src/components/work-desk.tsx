import { useEffect, useState } from "react";
import { toast } from "sonner";
import { JumpStrip } from "@/components/jump-strip";
import { DeskAudit } from "@/components/money-flow";
import { bumpClears } from "@/components/clear-strip";
import { rememberClear } from "@/lib/clear-tape";
import { connectPhantom } from "@/lib/phantom";
import { payBatch, payUsdc } from "@/lib/solana-pay";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx } from "@/lib/wallet-context";
import { cancelJob, fundJob, listJobs, releaseJob, workUsdc, type WorkJob } from "@/lib/work-escrow";
import { MakeDesk } from "@/components/make-desk";

const BOOK = "senda.paybook.v1";
const SHEET = "senda.sheet.v1";

type Payee = { id: string; name: string; role: string; address: string };

function loadPayees(): Payee[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(BOOK) || "[]") as Payee[];
    return Array.isArray(rows) ? rows.filter((row) => row && row.address) : [];
  } catch {
    return [];
  }
}
const DOC = "senda.doc.v1";

function notes(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const p = JSON.parse(window.localStorage.getItem(SHEET) || "{}") as Record<string, string>;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function usdc(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function JobBoard() {
  const wallet = useWalletCtx();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [worker, setWorker] = useState("");
  const [usd, setUsd] = useState("");
  const [jobs, setJobs] = useState<WorkJob[]>([]);
  const [held, setHeld] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [payees, setPayees] = useState<Payee[]>([]);
  const [whoName, setWhoName] = useState("");
  const [role, setRole] = useState("Contractor");
  const [addr, setAddr] = useState("");
  const open = jobs.filter((j) => j.status === "open");

  function reload() {
    setJobs(listJobs());
    void workUsdc().then(setHeld).catch(() => setHeld(null));
  }

  useEffect(() => {
    reload();
    setPayees(loadPayees());
  }, []);

  async function payer(): Promise<string> {
    const who = owner || (await connectPhantom());
    if (!owner) {
      const linked = wallet.linkChain(who, "Phantom", "phantom");
      if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
    }
    return who;
  }

  function savePayee() {
    const address = addr.trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
      toast.error("A contact needs a Solana address.");
      return;
    }
    const row: Payee = { id: address, name: whoName.trim() || address.slice(0, 4), role: role.trim() || "Payee", address };
    const next = [row, ...payees.filter((p) => p.address !== address)];
    setPayees(next);
    try {
      window.localStorage.setItem(BOOK, JSON.stringify(next));
    } catch {
      /* quota */
    }
    toast.success(`${row.name} can be paid.`);
  }

  async function payNow(row: Payee) {
    const n = Number(usd);
    if (!(n > 0)) {
      toast.error("Set the USDC amount.");
      return;
    }
    setBusy(true);
    try {
      const who = await payer();
      const done = await payUsdc({ owner: who, to: row.address, usd: n, memo: `${row.role}: ${row.name}`, deskFee: true });
      rememberClear({ sig: done.signature, from: who, to: row.address, usd: n, memo: row.name, kind: "work", status: "pending" });
      bumpClears();
      toast.success(`Paid ${row.name}. ${done.signature.slice(0, 8)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The payment did not sign.");
    } finally {
      setBusy(false);
    }
  }

  async function payAll() {
    const n = Number(usd);
    if (!(n > 0)) {
      toast.error("Set the USDC amount.");
      return;
    }
    const rows = payees.slice(0, 6).map((row) => ({ to: row.address, usd: n, memo: row.name }));
    if (rows.length < 2) {
      toast.error("Save at least two contacts. One person is Pay now.");
      return;
    }
    setBusy(true);
    try {
      const who = await payer();
      const sig = await payBatch({ owner: who, rows });
      rememberClear({ sig, from: who, to: rows[0].to, usd: n * rows.length, memo: "batch", kind: "work", status: "pending" });
      bumpClears();
      toast.success(`Paid ${rows.length} in one signature. ${sig.slice(0, 8)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The batch did not sign.");
    } finally {
      setBusy(false);
    }
  }

  async function fund() {
    setBusy(true);
    try {
      const who = await payer();
      const job = await fundJob({ owner: who, title, brief, usd: Number(usd), worker });
      rememberClear({ sig: job.sig, from: who, to: worker.trim(), usd: job.usd, memo: job.title, kind: "work", status: "pending" });
      bumpClears();
      toast.success(`Held. ${job.sig.slice(0, 8)}`);
      setTitle("");
      setBrief("");
      setWorker("");
      setUsd("");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The job did not fund.");
    } finally {
      setBusy(false);
    }
  }

  async function act(job: WorkJob, kind: "release" | "cancel") {
    setBusy(true);
    try {
      const who = await payer();
      const sig = kind === "release" ? await releaseJob(job, who) : await cancelJob(job, who);
      rememberClear({
        sig,
        from: who,
        to: kind === "release" ? job.worker : who,
        usd: job.usd,
        memo: job.title,
        kind: "work",
        status: "pending",
      });
      bumpClears();
      toast.success(kind === "release" ? `Paid the worker. ${sig.slice(0, 8)}` : `Paid you back. ${sig.slice(0, 8)}`);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The USDC did not move.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="w-full rounded-2xl border border-white/10 bg-[#10131c]">
      <div className="flex items-end justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <h2 className="text-lg tracking-tight">Hold the pay</h2>
          <p className="text-xs text-subtle">Pay a contact now, or hold the USDC until the work is done. Both move real USDC. Phantom signs.</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] tracking-wide text-subtle uppercase">Work account</p>
          <p className="font-mono text-sm tabular-nums">{held == null ? "—" : `${usdc(held)} USDC`}</p>
        </div>
      </div>
      <div className="grid gap-2 border-b border-white/10 p-3 sm:grid-cols-[1fr_8rem_minmax(0,1.2fr)_auto]">
        <input value={whoName} onChange={(e) => setWhoName(e.target.value)} placeholder="Contact name" className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none" />
        <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role" className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none" />
        <input value={addr} onChange={(e) => setAddr(e.target.value.trim())} placeholder="Their Solana address" spellCheck={false} className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-xs outline-none" />
        <button type="button" onClick={savePayee} className="h-10 rounded-full border border-white/15 px-4 text-sm font-semibold">Save contact</button>
      </div>
      {payees.length > 0 ? (
        <ul className="divide-y divide-white/10 border-b border-white/10">
          {payees.map((row) => (
            <li key={row.address} className="flex items-center gap-2 px-3 py-2">
              <button
                type="button"
                onClick={() => {
                  setWorker(row.address);
                  setAddr(row.address);
                  setWhoName(row.name);
                }}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block text-sm font-semibold">{row.name}</span>
                <span className="block truncate font-mono text-[11px] text-muted">{row.role} · {row.address.slice(0, 4)}…{row.address.slice(-4)}</span>
              </button>
              <button type="button" disabled={busy} onClick={() => void payNow(row)} className="h-9 rounded-full bg-accent px-3 text-xs font-semibold text-accent-fg disabled:opacity-40">Pay now</button>
            </li>
          ))}
        </ul>
      ) : null}
      {payees.length >= 2 ? (
        <div className="border-b border-white/10 px-3 py-2">
          <button type="button" disabled={busy} onClick={() => void payAll()} className="h-10 rounded-full border border-white/15 px-4 text-xs font-semibold disabled:opacity-40">
            Pay {Math.min(6, payees.length)} contacts ${Number(usd) || 0} in one signature
          </button>
        </div>
      ) : null}
      <form
        className="grid gap-2 border-b border-white/10 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.3fr)_7rem_auto] lg:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void fund();
        }}
      >
        <label className="block text-xs text-subtle">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none"
          />
        </label>
        <label className="block text-xs text-subtle">
          What done looks like
          <input
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="What done looks like"
            className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none"
          />
        </label>
        <label className="block text-xs text-subtle">
          Worker address
          <input
            value={worker}
            onChange={(e) => setWorker(e.target.value)}
            placeholder="Worker address"
            spellCheck={false}
            className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm outline-none"
          />
        </label>
        <label className="block text-xs text-subtle">
          USDC
          <input
            value={usd}
            onChange={(e) => setUsd(e.target.value)}
            placeholder="1"
            inputMode="decimal"
            className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-sm tabular-nums outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="h-10 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-50"
        >
          {busy ? "Waiting for Phantom…" : "Hold the pay"}
        </button>
      </form>
      <div className="max-h-56 overflow-auto">
        {open.length === 0 ? <p className="px-4 py-4 text-sm text-muted">No open jobs.</p> : null}
        {open.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[#10131c] text-[11px] tracking-wide text-subtle uppercase">
              <tr>
                <th className="px-4 py-2 font-medium">Job</th>
                <th className="px-2 py-2 font-medium">Worker</th>
                <th className="px-2 py-2 text-right font-medium">USDC</th>
                <th className="px-3 py-2 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {open.map((job) => (
                <tr key={job.id} className="border-t border-white/5">
                  <td className="px-4 py-2">
                    <div className="font-semibold">{job.title}</div>
                    <div className="max-w-xl truncate text-xs text-muted" title={job.brief}>{job.brief}</div>
                    <a href={`https://solscan.io/tx/${job.sig}`} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-accent">
                      {job.sig.slice(0, 8)}
                    </a>
                  </td>
                  <td className="px-2 py-2 font-mono text-xs" title={job.worker}>
                    {job.worker.slice(0, 4)}…{job.worker.slice(-4)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">{usdc(job.usd)}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void act(job, "release")}
                        className="h-9 rounded-full bg-accent px-3 text-xs font-semibold text-accent-fg disabled:opacity-40"
                      >
                        Release
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void act(job, "cancel")}
                        className="h-9 rounded-full border border-white/15 px-3 text-xs font-semibold disabled:opacity-40"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </section>
  );
}

export function WorkDesk({ names }: { names: HouseListing[] }) {
  const book = names.filter((n) => n.venue === "prestocks" && n.last > 0);
  const [sheet, setSheet] = useState<Record<string, string>>({});
  const [doc, setDoc] = useState("");

  useEffect(() => {
    setSheet(notes());
    setDoc(window.localStorage.getItem(DOC) || "");
  }, []);

  function note(sym: string, value: string) {
    const next = { ...sheet, [sym]: value };
    setSheet(next);
    try {
      window.localStorage.setItem(SHEET, JSON.stringify(next));
    } catch {
      /* quota */
    }
  }

  function writeDoc(value: string) {
    setDoc(value);
    try {
      window.localStorage.setItem(DOC, value);
    } catch {
      /* quota */
    }
  }

  function ontoPage(row: HouseListing) {
    const line = `${row.symbol} — ${formatUsd(row.last)} last, ${formatUsd(row.mark)} mark, ${formatPremium(row.premium)}. ${sheet[row.symbol] || ""}`.trim();
    writeDoc(doc ? `${doc}\n${line}` : line);
  }

  function copyPage() {
    void navigator.clipboard.writeText(doc);
  }

  const words = doc.trim() ? doc.trim().split(/\s+/).length : 0;

  return (
    <div className="space-y-3 px-3 py-3">
      <JumpStrip />
      <DeskAudit live="A listing and a job both pay USDC when Phantom signs." hold="The notes under the market stay in this browser." />
      <MakeDesk embedded />
      <JobBoard />
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)] lg:grid-rows-1">
        <section className="min-h-0 overflow-auto border-white/10 lg:border-r">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[#0c0e14] text-[11px] tracking-wide text-subtle uppercase">
              <tr>
                <th className="px-4 py-2 font-medium">Symbol</th>
                <th className="px-2 py-2 text-right font-medium">Last</th>
                <th className="px-2 py-2 text-right font-medium">Vs mark</th>
                <th className="px-3 py-2 font-medium">Note</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {book.map((row) => (
                <tr key={row.id} className="border-t border-white/5">
                  <td className="px-4 py-2 font-semibold">{row.symbol}</td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">{formatUsd(row.last)}</td>
                  <td className={`px-2 py-2 text-right font-mono tabular-nums ${(row.premium ?? 0) > 0 ? "text-down" : (row.premium ?? 0) < 0 ? "text-accent" : "text-muted"}`}>
                    {formatPremium(row.premium)}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={sheet[row.symbol] || ""}
                      onChange={(e) => note(row.symbol, e.target.value)}
                      placeholder="Note"
                      className="h-9 w-full min-w-[8rem] rounded-lg border border-white/10 bg-black/30 px-2 text-sm outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => ontoPage(row)} className="h-9 rounded-full bg-accent px-3 text-xs font-semibold text-accent-fg">
                      Onto the page
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {book.length === 0 ? <p className="px-4 py-6 text-sm text-muted">PreStocks did not answer.</p> : null}
        </section>
        <section className="flex min-h-0 flex-col bg-[#10131c]">
          <div className="flex shrink-0 items-end justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div>
              <h2 className="text-xl tracking-tight">Page</h2>
              <p className="font-mono text-xs text-subtle">{words} {words === 1 ? "word" : "words"}</p>
            </div>
            <button type="button" onClick={copyPage} className="h-9 rounded-full border border-white/15 px-3 text-xs font-semibold">
              Copy page
            </button>
          </div>
          <textarea
            value={doc}
            onChange={(e) => writeDoc(e.target.value)}
            placeholder="Write the page."
            className="min-h-0 w-full flex-1 resize-none bg-transparent px-4 py-4 text-[15px] leading-relaxed outline-none"
          />
        </section>
      </div>
    </div>
  );
}
