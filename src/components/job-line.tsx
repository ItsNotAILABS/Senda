import { useEffect, useState } from "react";
import { toast } from "sonner";
import { addJob, dropJob, listJobs, patchJob, runLine, type Job } from "@/lib/job-line";
import { listWorkers } from "@/lib/agent-workspace";
import { connectPhantom } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { formatUsd, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

const STEPS = ["Book", "Route", "Sign"] as const;

export function JobLine({ names }: { names: HouseListing[] }) {
  const wallet = useWallet();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [symbol, setSymbol] = useState(names[0]?.symbol || "");
  const [usd, setUsd] = useState(25);
  const [running, setRunning] = useState(false);
  const [signing, setSigning] = useState("");
  const name = names.find((n) => n.symbol === symbol) ?? names[0];

  useEffect(() => setJobs(listJobs()), []);

  function putOnLine() {
    if (!name) return;
    const row = addJob({ symbol: name.symbol, mint: name.mint, usd });
    setJobs(listJobs());
    toast.success(`${row.symbol} is on the line.`);
  }

  function pullAgents() {
    const queued = listWorkers().filter((w) => w.queue);
    if (!queued.length) {
      toast.error("No agent has a trade waiting.");
      return;
    }
    for (const w of queued) {
      const q = w.queue;
      if (!q) continue;
      const hit = names.find((n) => n.symbol === q.symbol);
      if (!hit) continue;
      addJob({ symbol: hit.symbol, mint: hit.mint, usd: q.usd, side: q.side });
    }
    setJobs(listJobs());
  }

  async function quoteAll() {
    setRunning(true);
    try {
      const next = await runLine(listJobs());
      setJobs(next);
      const blocked = next.filter((j) => j.step === "blocked" || j.step === "failed").length;
      const ready = next.filter((j) => j.step === "quoted").length;
      toast.success(blocked ? `${ready} ready. ${blocked} stopped.` : `${ready} ready to sign.`);
    } finally {
      setRunning(false);
    }
  }

  async function sign(job: Job) {
    if (job.step !== "quoted" && job.side !== "sell") return;
    setSigning(job.id);
    setJobs(patchJob(job.id, { step: "signing" }));
    try {
      const existing = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      const owner = existing || (await connectPhantom());
      if (!existing) {
        const linked = wallet.linkChain(owner, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      const hit = names.find((n) => n.mint === job.mint);
      const done = await runPrestock({
        owner,
        mint: job.mint,
        side: job.side,
        usd: job.usd,
        price: hit?.last,
      });
      setJobs(patchJob(job.id, { step: "signed", signature: done.signature, outUi: done.outUi, why: "" }));
      toast.success(`${job.symbol} is in the wallet. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      const why = e instanceof Error ? e.message : "The swap did not send.";
      setJobs(patchJob(job.id, { step: "failed", why }));
      toast.error(why);
    } finally {
      setSigning("");
    }
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Line</p>
          <h2 className="mt-1 text-3xl tracking-tight">Put a name on the line. Quote it. Sign it.</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={pullAgents} className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold">
            Pull agent trades
          </button>
          <button type="button" disabled={running || jobs.length === 0} onClick={() => void quoteAll()} className="min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:opacity-40">
            {running ? "Quoting…" : "Run the line"}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select value={name?.symbol || ""} onChange={(e) => setSymbol(e.target.value)} className="min-h-11 rounded-full border border-white/10 bg-black/40 px-4 text-sm outline-none">
          {names.map((n) => (
            <option key={n.id} value={n.symbol}>
              {n.symbol} · {formatUsd(n.last)}
            </option>
          ))}
        </select>
        {[10, 25, 100].map((n) => (
          <button key={n} type="button" onClick={() => setUsd(n)} className={`min-h-11 rounded-full px-4 font-mono text-sm ${usd === n ? "bg-accent text-accent-fg" : "border border-white/10"}`}>
            ${n}
          </button>
        ))}
        <button type="button" disabled={!name} onClick={putOnLine} className="min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg disabled:opacity-40">
          Add {name?.symbol || "name"}
        </button>
      </div>

      {jobs.length === 0 ? <p className="mt-6 text-sm text-muted">Nothing on the line. Add a name, or pull a trade an agent already queued.</p> : null}

      <ol className="mt-4 space-y-3">
        {jobs.map((job) => {
          const active = job.step === "signed" ? 2 : job.step === "book" ? 0 : 1;
          return (
            <li key={job.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-lg font-semibold">
                  {job.symbol} <span className="font-mono text-sm text-muted">${job.usd}</span>
                </p>
                <button type="button" onClick={() => setJobs(dropJob(job.id))} className="text-xs text-subtle">
                  Remove
                </button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {STEPS.map((label, i) => (
                  <div key={label} className={`rounded-xl px-3 py-2 ${i <= active ? "bg-white/10" : "bg-black/40"}`}>
                    <p className="text-[11px] text-subtle">{label}</p>
                    <p className="mt-1 font-mono text-xs">
                      {i === 0 && job.symbol}
                      {i === 1 && (job.outUi != null ? `${job.outUi.toFixed(4)} · min ${job.minUi?.toFixed(4)} · ${job.impact?.toFixed(2)}%` : job.why || "Not quoted")}
                      {i === 2 && (job.signature ? `${job.signature.slice(0, 8)}…` : job.step)}
                    </p>
                  </div>
                ))}
              </div>
              {job.why && job.step !== "signed" ? <p className="mt-2 text-xs text-down">{job.why}</p> : null}
              {job.route ? <p className="mt-1 text-[11px] text-subtle">{job.route}</p> : null}
              <div className="mt-3">
                {job.step === "signed" ? (
                  <p className="text-sm text-accent">In the wallet.</p>
                ) : (
                  <button
                    type="button"
                    disabled={signing === job.id || (job.side === "buy" && job.step !== "quoted")}
                    onClick={() => void sign(job)}
                    className="min-h-10 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40"
                  >
                    {signing === job.id ? "Waiting for the wallet" : job.step === "quoted" || job.side === "sell" ? `Sign ${job.symbol}` : "Run the line first"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
