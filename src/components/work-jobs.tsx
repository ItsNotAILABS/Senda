import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClearStrip } from "@/components/clear-strip";
import { rememberClear } from "@/lib/clearing";
import { connectPhantom } from "@/lib/phantom";
import { payUsdc, usdcPayLink } from "@/lib/solana-pay";
import { JOB_STARTS, cancelJob, listJobs, markJobPaid, postJob, type WorkJob } from "@/lib/work-jobs";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

export function WorkJobs({ symbol = "" }: { symbol?: string }) {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [title, setTitle] = useState(JOB_STARTS[0].title);
  const [brief, setBrief] = useState(JOB_STARTS[0].brief);
  const [pay, setPay] = useState(JOB_STARTS[0].pay);
  const [worker, setWorker] = useState("");
  const [rows, setRows] = useState<WorkJob[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  function refresh() {
    setRows(listJobs());
  }

  useEffect(() => {
    setRows(listJobs());
  }, []);

  function post() {
    try {
      postJob({ title, brief, pay, worker, symbol });
      refresh();
      toast.success("Job is on the board. Pay sends USDC when you sign.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not post.");
    }
  }

  async function payJob(job: WorkJob) {
    setBusy(job.id);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "The wallet did not stay.");
      }
      if (!job.worker) throw new Error("Paste the worker’s Solana address first.");
      const out = await payUsdc({
        owner: who,
        to: job.worker,
        usd: job.pay,
        memo: `Senda job ${job.title}`,
      });
      markJobPaid(job.id, out.signature);
      rememberClear({
        desk: "work",
        title: job.title,
        legs: [{ side: "out", asset: "USDC", amount: job.pay, where: job.worker }],
        feeUsd: 0,
        sig: out.signature,
        status: "signed",
      });
      refresh();
      toast.success(`Paid. ${out.signature.slice(0, 8)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The pay did not send.");
    } finally {
      setBusy(null);
    }
  }

  async function copyLink(job: WorkJob) {
    const to = (job.worker || worker).trim();
    if (!to) {
      toast.error("Paste the worker’s Solana address first. The link pays that wallet.");
      return;
    }
    const url = usdcPayLink(to, job.pay, `Senda job ${job.title}`);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Pay link copied. They open it in a Solana wallet and sign.");
    } catch {
      toast.message(url);
    }
  }

  const open = rows.filter((j) => j.status === "open");
  const done = rows.filter((j) => j.status !== "open");

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5 sm:p-8">
      <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Jobs</p>
      <h2 className="mt-2 text-3xl tracking-tight">Pay a person in USDC.</h2>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Post the work. Paste their Solana address. Pay asks your wallet to send that USDC. Or copy a pay link they open themselves. The mint stays theirs. Senda does not hold the pay.
      </p>
      {symbol ? <p className="mt-2 text-xs text-accent">Tied to {symbol} on the sheet.</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {JOB_STARTS.map((j) => (
          <button
            key={j.title}
            type="button"
            onClick={() => {
              setTitle(j.title);
              setBrief(j.brief);
              setPay(j.pay);
            }}
            className="min-h-10 rounded-full border border-white/10 px-3 text-sm text-muted"
          >
            {j.title}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <label className="block text-xs text-subtle">
          Job
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 min-h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-sm text-fg outline-none" />
        </label>
        <label className="block text-xs text-subtle">
          USDC
          <input value={pay} onChange={(e) => setPay(Math.max(0.01, Number(e.target.value) || 0))} inputMode="decimal" className="mt-1 min-h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 font-mono text-sm outline-none" />
        </label>
        <label className="block text-xs text-subtle lg:col-span-2">
          What they do
          <input value={brief} onChange={(e) => setBrief(e.target.value)} className="mt-1 min-h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-sm outline-none" />
        </label>
        <label className="block text-xs text-subtle lg:col-span-2">
          Worker Solana address
          <input value={worker} onChange={(e) => setWorker(e.target.value)} placeholder="Their wallet" className="mt-1 min-h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 font-mono text-sm outline-none" />
        </label>
      </div>
      <button type="button" onClick={post} className="mt-4 min-h-12 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">
        Post job
      </button>
      <ul className="mt-6 space-y-4">
        <JobCol title="Open" empty="No open jobs." rows={open} busy={busy} onPay={(job) => void payJob({ ...job, worker: job.worker || worker })} onCancel={(id) => { cancelJob(id); refresh(); }} onLink={(job) => void copyLink(job)} />
        <JobCol title="Settled" empty="Nothing paid or cancelled yet." rows={done} busy={busy} onPay={() => undefined} onCancel={() => undefined} onLink={(job) => void copyLink(job)} />
      </ul>
      <div className="mt-4">
        <ClearStrip desk="work" />
      </div>
    </section>
  );
}

function JobCol({
  title,
  empty,
  rows,
  busy,
  onPay,
  onCancel,
  onLink,
}: {
  title: string;
  empty: string;
  rows: WorkJob[];
  busy: string | null;
  onPay: (job: WorkJob) => void;
  onCancel: (id: string) => void;
  onLink: (job: WorkJob) => void;
}) {
  return (
    <li>
      <p className="text-[11px] tracking-[0.14em] text-subtle uppercase">{title}</p>
      {rows.length === 0 ? <p className="py-2 text-sm text-muted">{empty}</p> : null}
      <ul className="divide-y divide-white/10">
        {rows.map((job) => (
          <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {job.symbol ? <span className="mr-2 font-mono text-[11px] text-accent">{job.symbol}</span> : null}
                {job.title}
              </p>
              <p className="text-xs text-muted">{job.brief}</p>
              <p className="mt-1 font-mono text-[11px] text-subtle">
                {job.pay} USDC · {job.status}
                {job.worker ? ` · ${job.worker.slice(0, 4)}…${job.worker.slice(-4)}` : " · no worker"}
              </p>
            </div>
            {job.status === "open" ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy !== null} onClick={() => onPay(job)} className="min-h-10 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-50">
                  {busy === job.id ? "Waiting…" : "Pay"}
                </button>
                <button type="button" onClick={() => onLink(job)} className="min-h-10 rounded-full border border-white/15 px-4 text-sm">
                  Copy link
                </button>
                <button type="button" onClick={() => onCancel(job.id)} className="min-h-10 rounded-full border border-white/15 px-4 text-sm">
                  Cancel
                </button>
              </div>
            ) : job.sig ? (
              <a className="font-mono text-xs text-accent" href={`https://solscan.io/tx/${job.sig}`} target="_blank" rel="noreferrer">
                {job.sig.slice(0, 8)}
              </a>
            ) : (
              <span className="text-xs text-subtle">{job.status}</span>
            )}
          </li>
        ))}
      </ul>
    </li>
  );
}
