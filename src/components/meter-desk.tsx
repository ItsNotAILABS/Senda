import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { EventBoard } from "@/components/event-board";
import { exactRequirement, SOLANA_DEVNET, type PaymentRequired } from "@/lib/x402-exact";
import { checkParallaxDevnet, PARALLAX_CLUSTER, PARALLAX_RPC } from "@/lib/parallax-devnet";
import { getLiquifyLadder, type LiquifyResult } from "@/lib/liquify";
import { payUsdc } from "@/lib/solana-pay";
import { isSeat, loadIssues } from "@/lib/product-issue";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

const field = "min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm outline-none";
const SOL = "So11111111111111111111111111111111111111112";

export function MeterDesk() {
  const wallet = useWallet();
  const owner = wallet.w.links.find((link) => link.kind === "phantom" || link.kind === "solana")?.address ?? "";
  const issues = loadIssues().filter((row) => isSeat(row.kind) && row.sig);
  const [wedge, setWedge] = useState<"liquidity" | "book" | "license">("liquidity");
  const [payTo, setPayTo] = useState("");
  const [price, setPrice] = useState("0.25");
  const [mint, setMint] = useState(SOL);
  const [issueId, setIssueId] = useState(issues[0]?.hash ?? "");
  const [required, setRequired] = useState<PaymentRequired | null>(null);
  const [sig, setSig] = useState("");
  const [ladder, setLadder] = useState<LiquifyResult | null>(null);
  const [busy, setBusy] = useState("");
  const [devUsd, setDevUsd] = useState("5");
  const [devImpact, setDevImpact] = useState("0.4");
  const [devBudget, setDevBudget] = useState("20");
  const [devNote, setDevNote] = useState("");
  const payRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (required) payRef.current?.scrollIntoView({ block: "center" });
  }, [required]);

  function build() {
    const issue = issues.find((row) => row.hash === issueId);
    let usd = Number(price);
    let description = wedge === "liquidity" ? "Four-size liquidity brief" : "Event book brief";
    let url = wedge === "liquidity" ? "/liquify" : "/agents/meter";
    let to = payTo.trim();
    if (wedge === "license") {
      if (!issue) return toast.error("Publish a license on Launch first.");
      if (issue.makerBps !== 10000) return toast.error("This license has a split. Exact pays one address. Pay the split on Launch.");
      usd = issue.priceUsd;
      description = `License ${issue.title}`.slice(0, 80);
      url = "/solana/launch";
      to = issue.maker;
    }
    const next = exactRequirement({ payTo: to, usd, description, url });
    if ("error" in next) return toast.error(next.error);
    setRequired(next);
    setSig("");
    setLadder(null);
  }

  async function pay() {
    if (!required) return;
    if (!owner) return toast.error("Connect Phantom. It pays. This desk does not.");
    const ticket = required.accepts[0];
    const usd = Number(ticket.amount) / 1_000_000;
    setBusy("pay");
    try {
      const paid = await payUsdc({
        owner,
        to: ticket.payTo,
        usd,
        memo: `x402 exact ${ticket.amount}`,
      });
      setSig(paid.signature);
      if (wedge === "liquidity") {
        const book = await getLiquifyLadder({ data: { mint: mint.trim() } });
        setLadder(book);
      }
      toast.success("Paid. That signature is a USDC transfer, not a facilitator settle.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nothing was paid.");
    } finally {
      setBusy("");
    }
  }

  function runDevnet() {
    const row = checkParallaxDevnet({
      cluster: PARALLAX_CLUSTER,
      usd: Number(devUsd),
      impact: Number(devImpact),
      budget: Number(devBudget),
    });
    setDevNote(row.why);
  }

  const ticket = required?.accepts[0];

  return (
    <div className="space-y-3 px-3 py-3 pb-28">
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">x402 exact</p>
        <h2 className="mt-1 text-xl font-semibold">A ticket an agent can pay.</h2>
        <p className="mt-1 text-sm text-muted">
          Protocol v2, scheme exact, Solana mainnet USDC. One payee. Phantom signs the transfer. This desk does not run a facilitator, so it does not offer upto or a batch. Devnet id {SOLANA_DEVNET} is not this ticket.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {([
            ["liquidity", "Liquidity"],
            ["book", "Book"],
            ["license", "License"],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => { setWedge(id); setRequired(null); setSig(""); }} className={`min-h-11 rounded-full px-4 text-sm font-semibold ${wedge === id ? "bg-white text-black" : "bg-white/10 text-white/80"}`}>
              {label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-white/55">
          {wedge === "liquidity"
            ? "A four-size Jupiter quote, after the ticket is paid."
            : wedge === "book"
              ? "The event book below is public. The ticket pays the address you name. It does not unlock a hidden price."
              : "A published license that pays the maker 100%. A split stays on Launch."}
        </p>
        {wedge === "license" ? (
          <select value={issueId} onChange={(e) => setIssueId(e.target.value)} aria-label="License" className={`mt-3 ${field}`}>
            {issues.length === 0 ? <option value="">No published license on this phone</option> : null}
            {issues.map((row) => (
              <option key={row.hash} value={row.hash}>{row.kind} · {row.title} · ${row.priceUsd}</option>
            ))}
          </select>
        ) : (
          <>
            <input value={payTo} onChange={(e) => setPayTo(e.target.value)} placeholder="Payee wallet" aria-label="Payee" className={`mt-3 ${field} font-mono text-xs`} />
            <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" aria-label="Ticket price" placeholder="USDC" className={`mt-2 ${field} font-mono`} />
          </>
        )}
        {wedge === "liquidity" ? (
          <input value={mint} onChange={(e) => setMint(e.target.value)} aria-label="Mint" className={`mt-2 ${field} font-mono text-xs`} />
        ) : null}
        <button type="button" onClick={build} className="mt-3 min-h-12 w-full rounded-full bg-[#d7e36a] text-sm font-semibold text-black">
          Write the 402
        </button>
        {ticket ? (
          <div className="mt-3 rounded-2xl bg-white/[0.04] p-3 text-sm">
            <p className="font-semibold">{required?.resource.description}</p>
            <p className="mt-1 font-mono text-xs text-white/60">exact · Solana mainnet · {Number(ticket.amount) / 1_000_000} USDC</p>
            <button ref={payRef} type="button" disabled={Boolean(busy)} onClick={() => void pay()} className="mt-3 min-h-12 w-full rounded-full bg-white text-sm font-semibold text-black disabled:opacity-40">
              {busy === "pay" ? "Waiting for Phantom" : "Pay the exact ticket"}
            </button>
            <p className="mt-2 break-all font-mono text-[11px] text-white/45">{ticket.network}</p>
            <p className="mt-1 break-all font-mono text-[11px] text-white/45">pay {ticket.payTo}</p>
            {sig ? <a className="mt-2 block break-all text-xs text-white/70 underline" href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer">Transfer {sig.slice(0, 8)}…</a> : null}
          </div>
        ) : null}
        {ladder ? (
          <ul className="mt-3 space-y-2 text-sm">
            <li className="text-xs text-white/45">{ladder.source}. {ladder.note}</li>
            {ladder.sizes.map((row) => (
              <li key={row.usd} className="flex justify-between gap-3 font-mono text-xs">
                <span>${row.usd}</span>
                <span className="text-right text-white/70">{row.status === "available" ? `${row.quote?.router || "Jupiter"}${row.quote?.impactPct != null ? ` · ${row.quote.impactPct}%` : ""}` : row.reason || "No quote"}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-3 text-xs text-white/40">
          <Link to="/liquify" className="underline">Liquify</Link> is the quote curve. <Link to="/solana/launch" className="underline">Launch</Link> is the license. <Link to="/invest" className="underline">Trade</Link> is the book you sign yourself.
        </p>
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Parallax · {PARALLAX_CLUSTER}</p>
        <h2 className="mt-1 text-lg font-semibold">A separate devnet control.</h2>
        <p className="mt-1 text-sm text-muted">This check only accepts devnet. It does not read the mainnet spend cap, it does not sign, and it cannot move USDC. RPC {PARALLAX_RPC}.</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <input value={devUsd} onChange={(e) => setDevUsd(e.target.value)} aria-label="Devnet size" inputMode="decimal" className={`${field} font-mono`} />
          <input value={devImpact} onChange={(e) => setDevImpact(e.target.value)} aria-label="Devnet impact" inputMode="decimal" className={`${field} font-mono`} />
          <input value={devBudget} onChange={(e) => setDevBudget(e.target.value)} aria-label="Devnet budget" inputMode="decimal" className={`${field} font-mono`} />
        </div>
        <button type="button" onClick={runDevnet} className="mt-3 min-h-12 w-full rounded-full bg-white/10 text-sm font-semibold">
          Run the devnet check
        </button>
        {devNote ? <p className="mt-2 text-sm text-white/70">{devNote}</p> : null}
      </section>

      <EventBoard />
    </div>
  );
}
