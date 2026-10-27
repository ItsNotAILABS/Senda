import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getEquityBook, type ListedStock } from "@/lib/equities";
import { buyIntoHold, createHold, listHolds, payFromHold, putShares, putUsdc, sendShares, type Hold, type HoldKind } from "@/lib/hold-contract";
import { connectPhantom, phantomProvider, readChain, type ChainToken } from "@/lib/phantom";
import { cancelJob, fundJob, listJobs, releaseJob, type WorkJob } from "@/lib/work-escrow";
import { formatUsd, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const PAY_PURPOSES = [
  { label: "Finance", purpose: "Finance product. This wallet pays the USDC." },
  { label: "Company", purpose: "Company payment. This wallet pays the USDC." },
  { label: "Municipal", purpose: "Municipal invoice. This wallet pays the USDC. Not a bond." },
] as const;

const COPY: Record<HoldKind, { title: string; line: string }> = {
  pay: {
    title: "Payment",
    line: "USDC sits in this address until you pay someone. Phantom signs the deposit. The contract signs the payment. Phantom pays the network fee.",
  },
  gift: {
    title: "Gift",
    line: "USDC or a share sits here until you send it. The person receives the token, not a promise.",
  },
  invest: {
    title: "Invest",
    line: "Jupiter buys the share with USDC from Phantom. A second signature moves those shares into this contract. The contract holds the token.",
  },
};

export function HoldDesk({ names, kind }: { names: HouseListing[]; kind: HoldKind }) {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [rows, setRows] = useState<Hold[]>([]);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [usd, setUsd] = useState(5);
  const [to, setTo] = useState("");
  const [mint, setMint] = useState("");
  const [stocks, setStocks] = useState<ListedStock[]>([]);
  const [tokens, setTokens] = useState<ChainToken[]>([]);
  const [busy, setBusy] = useState(false);
  const hold = rows.find((r) => r.id === id) ?? rows[0] ?? null;
  const book = names.filter((n) => n.mint && n.last > 0);

  useEffect(() => {
    const all = listHolds().filter((row) => row.kind === kind);
    setRows(all);
    setId(all[0]?.id ?? "");
  }, [kind]);

  useEffect(() => {
    if (!hold) {
      setTokens([]);
      return;
    }
    let live = true;
    readChain(hold.id)
      .then((snap) => live && setTokens(snap.tokens))
      .catch(() => live && setTokens([]));
    return () => {
      live = false;
    };
  }, [hold?.id, busy]);

  useEffect(() => {
    getEquityBook()
      .then((b) => setStocks(b.stocks))
      .catch(() => undefined);
  }, []);

  async function signer() {
    const live = phantomProvider()?.publicKey?.toString();
    const who = live || owner || (await connectPhantom());
    if (who !== owner) {
      const linked = wallet.linkChain(who, "Phantom", "phantom");
      if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "The wallet did not stay.");
    }
    return who;
  }

  function refresh(next?: string) {
    const all = listHolds().filter((row) => row.kind === kind);
    setRows(all);
    setId(next ?? (all.some((row) => row.id === id) ? id : (all[0]?.id ?? "")));
  }

  async function run(work: () => Promise<string>) {
    setBusy(true);
    try {
      const sig = await work();
      toast.success(sig.slice(0, 8) + "…");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not sign.");
    } finally {
      setBusy(false);
    }
  }

  const usdc = tokens.find((t) => t.mint === USDC)?.ui ?? 0;
  const shares = tokens.filter((t) => t.mint !== USDC);
  const label = (m: string) => book.find((n) => n.mint === m)?.symbol || stocks.find((s) => s.mint === m)?.symbol || `${m.slice(0, 4)}…`;

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
      <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">{COPY[kind].title}</p>
      <h2 className="mt-1 text-2xl tracking-tight">{COPY[kind].title} contract</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">{COPY[kind].line} The key stays in this browser.</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div>
          <ul className="space-y-1">
            {rows.map((row) => (
              <li key={row.id}>
                <button type="button" onClick={() => setId(row.id)} className={cn("w-full rounded-xl px-3 py-2 text-left", row.id === hold?.id ? "bg-accent/15" : "hover:bg-white/5")}>
                  <span className="block text-sm font-semibold">{row.name}</span>
                  <span className="block text-[11px] text-subtle">{row.purpose}</span>
                </button>
              </li>
            ))}
          </ul>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="mt-3 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm" />
          {kind === "pay" ? (
            <div className="mt-2">
              <div className="flex gap-1">
                {PAY_PURPOSES.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setPurpose(chip.purpose)}
                    className={cn("min-h-9 flex-1 rounded-full text-sm font-semibold", purpose === chip.purpose ? "bg-white text-black" : "border border-white/10 text-muted")}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted">The name is the purpose. The money is still USDC this Phantom signs.</p>
            </div>
          ) : null}
          <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={kind === "pay" ? "Who this pays" : kind === "gift" ? "Who this is for" : "What this buys"} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm" />
          <button
            type="button"
            onClick={() => {
              const row = createHold(name || COPY[kind].title, purpose || COPY[kind].line, kind);
              setName("");
              setPurpose("");
              refresh(row.id);
            }}
            className="mt-2 min-h-11 w-full rounded-full bg-white text-sm font-semibold text-black"
          >
            Create
          </button>
        </div>
        {hold ? (
          <div>
            <p className="text-sm font-semibold">{hold.name}</p>
            <p className="mt-1 text-xs text-muted">{hold.purpose}. Pays and buys only when you sign.</p>
            <p className="mt-2 text-sm text-muted">
              {hold.name}. {hold.purpose || "No purpose written."} This contract is the Solana address below. USDC put in stays there until Execute pays it out. Senda does not hold that key. The contract signs the payment. Phantom pays the fee. This is not a bond, a city share, or a company share.
            </p>
            <p className="mt-2 break-all font-mono text-[11px] text-subtle">{hold.id}</p>
            <p className="mt-3 font-mono text-2xl tabular-nums">{usdc.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC</p>
            {shares.length ? (
              <ul className="mt-2 space-y-1">
                {shares.map((t) => (
                  <li key={t.mint} className="flex justify-between text-sm">
                    <span>{label(t.mint)}</span>
                    <span className="font-mono tabular-nums">{t.ui.toLocaleString("en-US", { maximumFractionDigits: 4 })}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted">No shares in this contract yet.</p>
            )}
            <div className="mt-3 flex gap-1">
              {[1, 5, 25].map((n) => (
                <button key={n} type="button" onClick={() => setUsd(n)} className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold", usd === n ? "bg-white text-black" : "border border-white/15 text-muted")}>
                  ${n}
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button type="button" disabled={busy} onClick={() => void run(async () => putUsdc(await signer(), hold.id, usd))} className="min-h-11 rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
                Put ${usd} USDC in
              </button>
              {kind === "gift" ? (
                <button
                  type="button"
                  disabled={busy || !mint}
                  onClick={() => void run(async () => putShares(await signer(), hold.id, mint))}
                  className="min-h-11 rounded-full border border-white/15 text-sm font-semibold disabled:opacity-40"
                >
                  Put this Phantom’s shares in
                </button>
              ) : null}
            </div>
            {kind !== "pay" ? (
            <label className="mt-3 block text-xs text-muted">
              Share
              <select value={mint} onChange={(e) => setMint(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm">
                <option value="">Pick a token</option>
                {book.map((n) => (
                  <option key={n.mint} value={n.mint}>
                    {n.symbol} · {formatUsd(n.last)}
                  </option>
                ))}
                {stocks.slice(0, 40).map((s) => (
                  <option key={s.mint} value={s.mint}>
                    {s.symbol} · {s.name}
                  </option>
                ))}
              </select>
            </label>
            ) : null}
            {kind === "invest" ? (
            <button
              type="button"
              disabled={busy || !mint}
              onClick={() =>
                void run(async () => {
                  const who = await signer();
                  const row = book.find((n) => n.mint === mint);
                  const done = await buyIntoHold({ hold: hold.id, owner: who, mint, usd, price: row?.last });
                  return done.parked;
                })
              }
              className="mt-2 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40"
            >
              Execute · buy ${usd} in
            </button>
            ) : null}
            {kind === "invest" ? <p className="mt-1 text-[11px] text-subtle">Phantom buys through Jupiter, then a second signature moves the new shares in.</p> : null}
            <label className="mt-3 block text-xs text-muted">
              {kind === "gift" ? "Send to" : "Pay to"}
              <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Solana address" className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-xs" />
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <button type="button" disabled={busy || to.trim().length < 32} onClick={() => void run(async () => payFromHold(hold.id, to.trim(), usd, await signer()))} className="min-h-11 rounded-full border border-white/15 text-sm font-semibold disabled:opacity-40">
                {kind === "gift" ? `Execute · send $${usd}` : `Execute · pay $${usd}`}
              </button>
              {kind === "gift" ? (
              <button type="button" disabled={busy || !mint || to.trim().length < 32} onClick={() => void run(async () => sendShares(hold.id, to.trim(), mint, await signer()))} className="min-h-11 rounded-full border border-white/15 text-sm font-semibold disabled:opacity-40">
                Send the shares
              </button>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">Create one. Nothing moves until you put USDC or a share in.</p>
        )}
      </div>
    </section>
  );
}

export function WorkContracts() {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [jobs, setJobs] = useState<WorkJob[]>([]);
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [worker, setWorker] = useState("");
  const [usd, setUsd] = useState(5);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setJobs(listJobs().filter((job) => job.status === "open"));
  }, [busy]);

  async function signer() {
    const live = phantomProvider()?.publicKey?.toString();
    const who = live || owner || (await connectPhantom());
    if (who !== owner) {
      const linked = wallet.linkChain(who, "Phantom", "phantom");
      if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "The wallet did not stay.");
    }
    return who;
  }

  async function fund() {
    setBusy(true);
    try {
      const who = await signer();
      const job = await fundJob({ owner: who, title, brief, usd, worker: worker.trim() });
      setTitle("");
      setBrief("");
      setJobs(listJobs().filter((row) => row.status === "open"));
      toast.success(`USDC is in the work account. ${job.sig.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The job did not fund.");
    } finally {
      setBusy(false);
    }
  }

  async function finish(job: WorkJob, kind: "release" | "cancel") {
    setBusy(true);
    try {
      const who = await signer();
      const sig = kind === "release" ? await releaseJob(job, who) : await cancelJob(job, who);
      setJobs(listJobs().filter((row) => row.status === "open"));
      toast.success(kind === "release" ? `Paid the worker. ${sig.slice(0, 8)}…` : `Paid you back. ${sig.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The work account did not pay.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
      <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Work</p>
      <h2 className="mt-1 text-2xl tracking-tight">Work order</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Phantom puts USDC into the work account. Release pays the worker that USDC. Cancel pays it back to you. The smallest order is $1. Same account the Work tab uses.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Job" className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm" />
        <input value={worker} onChange={(e) => setWorker(e.target.value)} placeholder="Worker Solana address" className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-xs" />
        <input value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="What done looks like" className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm sm:col-span-2" />
      </div>
      <div className="mt-3 flex gap-1">
        {[1, 5, 25].map((n) => (
          <button key={n} type="button" onClick={() => setUsd(n)} className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold", usd === n ? "bg-white text-black" : "border border-white/15 text-muted")}>
            ${n}
          </button>
        ))}
      </div>
      <button type="button" disabled={busy} onClick={() => void fund()} className="mt-3 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
        Put ${usd} in
      </button>
      <ul className="mt-4 space-y-2">
        {jobs.length === 0 ? <li className="text-sm text-muted">No open work order in this browser.</li> : null}
        {jobs.map((job) => (
          <li key={job.id} className="rounded-2xl border border-white/10 px-3 py-3">
            <p className="text-sm font-semibold">{job.title}</p>
            <p className="mt-1 text-xs text-muted">{job.brief}</p>
            <p className="mt-1 font-mono text-xs text-subtle">${job.usd.toFixed(2)} · {job.worker.slice(0, 4)}…{job.worker.slice(-4)}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" disabled={busy} onClick={() => void finish(job, "release")} className="min-h-10 flex-1 rounded-full bg-accent text-xs font-semibold text-accent-fg">
                Execute · pay the worker
              </button>
              <button type="button" disabled={busy} onClick={() => void finish(job, "cancel")} className="min-h-10 flex-1 rounded-full border border-white/15 text-xs font-semibold">
                Pay me back
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
