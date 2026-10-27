import { useState } from "react";
import { toast } from "sonner";
import { coverPremium, openChainCover } from "@/lib/cover-chain";
import { getEquityBook, type ListedStock } from "@/lib/equities";
import { buyIntoHold, createHold, listHolds, payFromHold, putUsdc, type HoldKind } from "@/lib/hold-contract";
import { connectPhantom, phantomProvider } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { payUsdc } from "@/lib/solana-pay";
import { fundJob } from "@/lib/work-escrow";
import { formatUsd, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

type Act = "pre" | "x" | "cover" | "send" | "pay" | "work" | "gift" | "invest";

export function AgentSign({ names, agentName, onDone }: { names: HouseListing[]; agentName?: string; onDone: (line: string) => void }) {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [act, setAct] = useState<Act>("pre");
  const [symbol, setSymbol] = useState(names[0]?.symbol ?? "");
  const [usd, setUsd] = useState(1);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [stocks, setStocks] = useState<ListedStock[]>([]);
  const [x, setX] = useState("");
  const [to, setTo] = useState("");
  const [job, setJob] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);
  const name = names.find((n) => n.symbol === symbol) ?? names[0];

  async function signer() {
    const live = phantomProvider()?.publicKey?.toString();
    const who = live || owner || (await connectPhantom());
    if (who !== owner) {
      const linked = wallet.linkChain(who, "Phantom", "phantom");
      if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "The wallet did not stay.");
    }
    return who;
  }

  function purse(kind: HoldKind, label: string) {
    const named = `${agentName || "Agent"} ${label}`;
    return listHolds().find((row) => row.kind === kind && row.name === named) ?? createHold(named, label, kind);
  }

  async function openStocks() {
    setAct("x");
    if (stocks.length) return;
    const book = await getEquityBook().catch(() => null);
    const rows = book?.stocks ?? [];
    setStocks(rows);
    setX(rows.find((s) => s.symbol === "AAPLx")?.symbol || rows[0]?.symbol || "");
  }

  async function run() {
    setBusy(true);
    try {
      const who = await signer();
      if (act === "pre") {
        if (!name) throw new Error("Pick a name.");
        const done = await runPrestock({ owner: who, mint: name.mint, side, usd, price: name.last });
        const line = `Signed ${side} ${name.symbol} $${usd}. ${done.signature.slice(0, 8)}.`;
        onDone(line);
        toast.success(line);
      } else if (act === "x") {
        const stock = stocks.find((s) => s.symbol === x);
        if (!stock) throw new Error("Pick an xStock.");
        const done = await runPrestock({ owner: who, mint: stock.mint, side: "buy", usd });
        const line = `Signed buy ${stock.symbol} $${usd}. ${done.signature.slice(0, 8)}.`;
        onDone(line);
        toast.success(line);
      } else if (act === "cover") {
        if (!name) throw new Error("Pick a name.");
        const premium = coverPremium("drop", usd);
        const row = await openChainCover({
          owner: who,
          kind: "drop",
          title: `${name.symbol} drop`,
          symbol: name.symbol,
          mint: name.mint,
          strike: name.last,
          cover: usd,
          premium,
          days: 1,
        });
        const line = `Signed cover ${name.symbol}. Debit $${premium.toFixed(2)}. ${row.sig.slice(0, 8)}.`;
        onDone(line);
        toast.success(line);
      } else if (act === "pay" || act === "gift") {
        if (to.trim().length < 32) throw new Error("That is not a Solana address.");
        const hold = purse(act, act === "pay" ? "payment" : "gift");
        await putUsdc(who, hold.id, usd);
        const sig = await payFromHold(hold.id, to.trim(), usd, who);
        const line = `${act === "pay" ? "Payment" : "Gift"} ${hold.name}. $${usd} to ${to.slice(0, 4)}… ${sig.slice(0, 8)}.`;
        onDone(line);
        toast.success(line);
      } else if (act === "work") {
        if (usd < 1) throw new Error("The smallest work order is $1.");
        if (!job.trim() || !done.trim()) throw new Error("Name the job and what done looks like.");
        if (to.trim().length < 32) throw new Error("The worker needs a Solana address.");
        const row = await fundJob({ owner: who, title: job.trim(), brief: done.trim(), usd, worker: to.trim() });
        const line = `Work order ${row.title}. $${row.usd} is in the work account. ${row.sig.slice(0, 8)}.`;
        onDone(line);
        toast.success(line);
      } else if (act === "invest") {
        const mint = name?.mint;
        if (!mint || !name) throw new Error("Pick a name.");
        const hold = purse("invest", name.symbol);
        const filled = await buyIntoHold({ hold: hold.id, owner: who, mint, usd, price: name.last });
        const line = `Invest ${hold.name} holds ${name.symbol}. ${filled.parked.slice(0, 8)}.`;
        onDone(line);
        toast.success(line);
      } else {
        const paid = await payUsdc({ owner: who, to, usd, memo: "Senda agent send" });
        const line = `Signed $${usd} USDC. ${paid.signature.slice(0, 8)}.`;
        onDone(line);
        toast.success(line);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-4 mb-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 lg:mx-10">
      <div className="flex flex-wrap gap-1">
        {(
          [
            ["pre", "PreStock"],
            ["x", "xStock"],
            ["cover", "Option"],
            ["pay", "Payment"],
            ["work", "Work"],
            ["gift", "Gift"],
            ["invest", "Invest"],
            ["send", "Send USDC"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => (id === "x" ? void openStocks() : setAct(id))}
            className={cn("min-h-9 rounded-full px-3 text-xs font-semibold", act === id ? "bg-white text-black" : "border border-white/15 text-white/70")}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {act === "pre" || act === "cover" || act === "invest" ? (
          <select value={name?.symbol ?? ""} onChange={(e) => setSymbol(e.target.value)} className="min-h-10 rounded-full border border-white/15 bg-black/40 px-3 text-sm">
            {names.map((n) => (
              <option key={n.id} value={n.symbol}>
                {n.symbol} {formatUsd(n.last)}
              </option>
            ))}
          </select>
        ) : null}
        {act === "x" ? (
          <select value={x} onChange={(e) => setX(e.target.value)} className="min-h-10 max-w-full rounded-full border border-white/15 bg-black/40 px-3 text-sm">
            {stocks.slice(0, 80).map((s) => (
              <option key={s.mint} value={s.symbol}>
                {s.symbol} · {s.name}
              </option>
            ))}
          </select>
        ) : null}
        {act === "send" || act === "pay" || act === "gift" || act === "work" ? (
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder={act === "work" ? "Worker address" : "Solana address"} className="min-h-10 min-w-0 flex-1 rounded-full border border-white/15 bg-black/40 px-3 font-mono text-xs" />
        ) : null}
        {act === "work" ? (
          <>
            <input value={job} onChange={(e) => setJob(e.target.value)} placeholder="Job" className="min-h-10 rounded-full border border-white/15 bg-black/40 px-3 text-xs" />
            <input value={done} onChange={(e) => setDone(e.target.value)} placeholder="What done looks like" className="min-h-10 min-w-0 flex-1 rounded-full border border-white/15 bg-black/40 px-3 text-xs" />
          </>
        ) : null}
        {act === "pre" ? (
          <button type="button" onClick={() => setSide(side === "buy" ? "sell" : "buy")} className="min-h-10 rounded-full border border-white/15 px-3 text-xs font-semibold">
            {side}
          </button>
        ) : null}
        {[1, 5, 25].map((n) => (
          <button key={n} type="button" onClick={() => setUsd(n)} className={cn("min-h-10 rounded-full px-3 text-xs font-semibold", usd === n ? "bg-white text-black" : "border border-white/15 text-white/60")}>
            ${n}
          </button>
        ))}
        <button type="button" disabled={busy || ((act === "send" || act === "pay" || act === "gift" || act === "work") && to.trim().length < 32)} onClick={() => void run()} className="min-h-10 rounded-full bg-accent px-4 text-xs font-semibold text-accent-fg disabled:opacity-40">
          {busy ? "Waiting on Phantom" : "Sign"}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-white/40">
        {act === "pre" ? "Jupiter. The token lands in this Phantom." : null}
        {act === "x" ? "Same Jupiter route, listed share. Phantom signs the buy." : null}
        {act === "cover" ? "Option debit. Close it on Contracts." : null}
        {act === "pay" ? "Two signatures. USDC goes into the payment contract, then out to that address. The contract stays on Contracts." : null}
        {act === "work" ? "USDC goes into the work account. Release it on Contracts or Work." : null}
        {act === "gift" ? "Two signatures. The gift contract receives the USDC, then sends it." : null}
        {act === "invest" ? "Jupiter buys the share. The invest contract keeps it. Two signatures." : null}
        {act === "send" ? "USDC leaves this Phantom for that address. No contract." : null}
      </p>
    </div>
  );
}
