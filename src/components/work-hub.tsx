import { useEffect, useState } from "react";
import { toast } from "sonner";
import { listWorkers } from "@/lib/agent-workspace";
import { connectPhantom } from "@/lib/phantom";
import { payUsdc } from "@/lib/solana-pay";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { claimWork, listWork, markPaid, postWork, type Gig } from "@/lib/work-hub";
import { cn } from "@/lib/utils";

const KINDS = [
  ["hire", "Hire"],
  ["build", "Build"],
  ["teach", "Teach"],
  ["deliver", "Deliver"],
  ["research", "Research"],
] as const;

export function WorkHub() {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [role, setRole] = useState<"need" | "offer">("need");
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>("hire");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [usd, setUsd] = useState(50);
  const [agent, setAgent] = useState("");
  const [busy, setBusy] = useState("");
  const agents = typeof window === "undefined" ? [] : listWorkers();

  async function reload() {
    const rows = await listWork();
    setGigs(rows);
  }

  useEffect(() => {
    let live = true;
    listWork()
      .then((rows) => live && setGigs(rows))
      .catch(() => live && setGigs([]));
    return () => {
      live = false;
    };
  }, []);

  async function walletOf() {
    if (owner) return owner;
    const who = await connectPhantom();
    const linked = wallet.linkChain(who, "Phantom", "phantom");
    if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
    return who;
  }

  async function post() {
    if (!title.trim()) return toast.error("Say what the work is.");
    if (!(usd > 0)) return toast.error("Set the USDC.");
    setBusy("post");
    try {
      const poster = await walletOf();
      await postWork({ data: { title: title.trim(), detail: detail.trim(), usd, kind, role, poster, agent } });
      setTitle("");
      setDetail("");
      await reload();
      toast.success(role === "need" ? "It’s up. Someone can take it." : "It’s up. They pay your wallet.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not post.");
    } finally {
      setBusy("");
    }
  }

  async function claim(gig: Gig) {
    setBusy(gig.id);
    try {
      const worker = await walletOf();
      await claimWork({ data: { id: gig.id, worker, agent } });
      await reload();
      toast.success("You have it. They pay this wallet.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not take it.");
    } finally {
      setBusy("");
    }
  }

  async function pay(gig: Gig) {
    const to = gig.role === "offer" ? gig.poster : gig.worker;
    if (to.length < 32) return toast.error("Nobody has taken this yet.");
    setBusy(gig.id);
    try {
      const who = await walletOf();
      const paid = await payUsdc({ owner: who, to, usd: gig.usd, memo: gig.title });
      await markPaid({ data: { id: gig.id, signature: paid.signature } });
      await reload();
      toast.success(`Paid. ${paid.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The payment did not send.");
    } finally {
      setBusy("");
    }
  }

  const open = gigs.filter((g) => g.status !== "paid");
  const paid = gigs.filter((g) => g.status === "paid");

  return (
    <section className="space-y-3">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Post work</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setRole("need")} className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold", role === "need" ? "bg-accent text-accent-fg" : "border border-white/10")}>
              I need this done
            </button>
            <button type="button" onClick={() => setRole("offer")} className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold", role === "offer" ? "bg-accent text-accent-fg" : "border border-white/10")}>
              I will do this
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {KINDS.map(([id, label]) => (
              <button key={id} type="button" onClick={() => setKind(id)} className={cn("min-h-9 rounded-full px-3 text-xs font-semibold", kind === id ? "bg-white text-black" : "bg-black/40 text-muted")}>
                {label}
              </button>
            ))}
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={role === "need" ? "What you need done" : "What you will do"} className="mt-3 min-h-12 w-full rounded-2xl bg-black/40 px-4 text-sm outline-none" />
          <textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="What done looks like" rows={3} className="mt-2 w-full rounded-2xl bg-black/40 px-4 py-3 text-sm outline-none" />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {[25, 50, 100, 250].map((n) => (
              <button key={n} type="button" onClick={() => setUsd(n)} className={cn("min-h-10 rounded-full px-3 font-mono text-sm", usd === n ? "bg-accent text-accent-fg" : "border border-white/10")}>
                ${n}
              </button>
            ))}
            <input value={usd} onChange={(e) => setUsd(Number(e.target.value) || 0)} inputMode="decimal" aria-label="USDC" className="min-h-10 w-24 rounded-full bg-black/40 px-3 font-mono text-sm outline-none" />
          </div>
          <label className="mt-3 block text-xs text-subtle">
            Agent on this, if one of yours is doing it
            <select value={agent} onChange={(e) => setAgent(e.target.value)} className="mt-1 min-h-11 w-full rounded-full bg-black/40 px-4 text-sm outline-none">
              <option value="">No agent</option>
              {agents.map((a) => (
                <option key={a.id} value={a.name}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" disabled={busy === "post"} onClick={() => void post()} className="mt-4 min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-50">
            {busy === "post" ? "Posting…" : role === "need" ? "Put the work up" : "Offer the work"}
          </button>
          <p className="mt-2 text-xs text-muted">
            {owner ? `This wallet posts and pays. ${owner.slice(0, 4)}…${owner.slice(-4)}` : "Connect a wallet. USDC leaves that wallet and lands in theirs."}
          </p>
        </div>

        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold">Open</p>
            <p className="font-mono text-xs text-subtle">{open.length}</p>
          </div>
          {open.length === 0 ? <p className="mt-4 text-sm text-muted">Nothing up. Post work, or offer to do some.</p> : null}
          <ul className="mt-3 space-y-2">
            {open.map((gig) => (
              <GigCard key={gig.id} gig={gig} busy={busy === gig.id} onClaim={() => void claim(gig)} onPay={() => void pay(gig)} />
            ))}
          </ul>
        </div>
      </div>

      {paid.length > 0 ? (
        <div className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
          <p className="text-sm font-semibold">Paid</p>
          <ul className="mt-3 grid gap-2 lg:grid-cols-2">
            {paid.map((gig) => (
              <li key={gig.id} className="rounded-2xl bg-black/30 px-4 py-3">
                <p className="font-semibold">{gig.title}</p>
                <p className="mt-1 font-mono text-xs text-accent">
                  ${gig.usd} · {gig.signature.slice(0, 8)}…
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function GigCard({ gig, busy, onClaim, onPay }: { gig: Gig; busy: boolean; onClaim: () => void; onPay: () => void }) {
  const who = gig.role === "offer" ? gig.poster : gig.worker;
  return (
    <li className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.14em] text-subtle uppercase">
            {gig.kind} · {gig.role === "need" ? "Needs someone" : "Will do it"}
            {gig.agent ? ` · ${gig.agent}` : ""}
          </p>
          <p className="mt-1 text-lg font-semibold">{gig.title}</p>
          {gig.detail ? <p className="mt-1 text-sm text-muted">{gig.detail}</p> : null}
        </div>
        <p className="font-mono text-xl">${gig.usd}</p>
      </div>
      <p className="mt-2 font-mono text-[11px] text-subtle">
        {gig.status === "claimed" ? `Taken · pay ${who.slice(0, 4)}…${who.slice(-4)}` : gig.role === "offer" ? `Pay ${gig.poster.slice(0, 4)}…${gig.poster.slice(-4)}` : "Open"}
      </p>
      <div className="mt-3 flex gap-2">
        {gig.role === "need" && gig.status === "open" ? (
          <button type="button" disabled={busy} onClick={onClaim} className="min-h-10 rounded-full border border-white/15 px-4 text-sm font-semibold disabled:opacity-40">
            {busy ? "…" : "I’ll do it"}
          </button>
        ) : null}
        {who.length >= 32 ? (
          <button type="button" disabled={busy} onClick={onPay} className="min-h-10 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40">
            {busy ? "Waiting for the wallet" : `Pay $${gig.usd} USDC`}
          </button>
        ) : null}
      </div>
    </li>
  );
}
