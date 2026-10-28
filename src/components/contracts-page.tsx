import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { listChainCovers } from "@/lib/cover-chain";
import { listFills } from "@/lib/account-book";
import { DEAL_CHAINS, DEAL_TEMPLATES, listDeals, saveDeal, termsFor, voidDeal, type Deal, type DealChain, type DealTemplate } from "@/lib/deals";
import { loadGifts } from "@/lib/gift-vault";
import { connectPhantom } from "@/lib/phantom";
import { setSpendCap } from "@/lib/spend-cap";
import { payUsdc } from "@/lib/solana-pay";
import { payUsdcEvm, type EvmPayChain } from "@/lib/usdc-evm";
import { RailContracts } from "@/components/rail-contracts";
import { listJobs } from "@/lib/work-jobs";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

type Lane = "option" | "pay" | "work" | "gift" | "invest" | "pair";
type Row = { id: string; lane: Lane; name: string; detail: string; amount: string; open: boolean };

const LANES: { id: Lane; label: string }[] = [
  { id: "option", label: "Option" },
  { id: "pay", label: "Payment" },
  { id: "work", label: "Work" },
  { id: "gift", label: "Gift" },
  { id: "invest", label: "Invest" },
  { id: "pair", label: "Pair" },
];

const OPEN_TO: Record<Lane, string> = {
  option: "/cover",
  pay: "/payments",
  work: "/work",
  gift: "/payments/gift",
  invest: "/pre",
  pair: "/wallet",
};

function readRows(): Row[] {
  const rows: Row[] = [];
  for (const c of listChainCovers()) {
    rows.push({
      id: c.id,
      lane: "option",
      name: `${c.symbol} ${c.kind === "drop" ? "Put" : "Call"}`,
      detail: `Strike ${c.strike.toFixed(2)} · size $${c.cover.toFixed(2)}`,
      amount: `$${c.premium.toFixed(2)} debit`,
      open: c.status === "open",
    });
  }
  for (const j of listJobs()) {
    rows.push({ id: j.id, lane: "work", name: j.title, detail: j.brief, amount: `$${j.pay.toFixed(2)}`, open: j.status === "open" });
  }
  for (const g of loadGifts()) {
    rows.push({ id: g.pubkey, lane: "gift", name: g.memo || "Gift", detail: "USDC sits until it is claimed.", amount: `$${g.usd.toFixed(2)}`, open: g.status === "open" });
  }
  for (const f of listFills()) {
    const lane: Lane = f.side === "send" ? "pay" : f.desk === "pair" ? "pair" : "invest";
    rows.push({ id: f.id, lane, name: f.symbol, detail: `${f.desk} · ${f.side}`, amount: `$${f.usd.toFixed(2)}`, open: true });
  }
  return rows;
}

function tomorrow(): string {
  const day = new Date();
  day.setDate(day.getDate() + 7);
  return day.toISOString().slice(0, 10);
}

export function ContractsPage() {
  const navigate = useNavigate();
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [rows, setRows] = useState<Row[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [lane, setLane] = useState<Lane | "all">("all");
  const [chain, setChain] = useState<DealChain>("Solana");
  const [pick, setPick] = useState<DealTemplate>(DEAL_TEMPLATES[0]);
  const [who, setWho] = useState("");
  const [usd, setUsd] = useState("100");
  const [note, setNote] = useState("");
  const [due, setDue] = useState(tomorrow);
  const [busy, setBusy] = useState(false);
  const [deskOpen, setDeskOpen] = useState(false);
  const [armed, setArmed] = useState(false);

  function refresh() {
    setRows(readRows());
    setDeals(listDeals());
  }

  useEffect(() => {
    refresh();
    window.addEventListener("senda-account", refresh);
    return () => window.removeEventListener("senda-account", refresh);
  }, []);

  const amount = Number(usd);
  const terms = useMemo(
    () => (amount > 0 ? termsFor(pick, { chain, amount, counterparty: who, note, due }) : ""),
    [pick, chain, amount, who, note, due],
  );
  const open = rows.filter((r) => r.open);
  const counts = useMemo(() => {
    const n: Record<Lane, number> = { option: 0, pay: 0, work: 0, gift: 0, invest: 0, pair: 0 };
    for (const r of open) n[r.lane] += 1;
    return n;
  }, [open]);
  const shown = lane === "all" ? open : open.filter((r) => r.lane === lane);
  const live = deals.filter((d) => d.status === "signed");

  useEffect(() => {
    setArmed(false);
  }, [chain, who, usd, note, due, pick.id]);

  async function sign() {
    if (!(amount >= 1) || amount > 5000) {
      toast.error("The amount is between $1 and $5,000.");
      return;
    }
    if (pick.pays && who.trim().length < 8) {
      toast.error(chain === "Solana" ? "Paste the Solana address that gets paid." : "Paste the address that gets paid.");
      return;
    }
    if (!pick.pays && !note.trim() && !who.trim()) {
      toast.error("Name the agent, or write what it may do.");
      return;
    }
    setBusy(true);
    try {
      let sig = "";
      if (!pick.pays) {
        setSpendCap(amount);
        sig = "mandate";
      } else if (chain === "Solana") {
        const payer = owner || (await connectPhantom());
        const done = await payUsdc({ owner: payer, to: who.trim(), usd: amount, memo: pick.title.slice(0, 32) });
        sig = done.signature;
      } else if (chain === "Monad") {
        throw new Error("Monad is on the list. This desk has no USDC address there, so it cannot pay yet.");
      } else {
        sig = await payUsdcEvm(chain as EvmPayChain, who.trim(), amount);
      }
      saveDeal({
        template: pick.id,
        title: pick.title,
        tag: pick.tag,
        chain,
        amount,
        counterparty: who.trim(),
        note: note.trim(),
        terms,
        due,
        pays: pick.pays,
        sig,
      });
      refresh();
      toast.success(pick.pays ? "Signed. The USDC is on its way." : "Mandate signed. No USDC moved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The wallet did not sign.");
    } finally {
      setBusy(false);
    }
  }

  async function share(deal: Deal) {
    const text = `${deal.title} · ${deal.chain}\n$${deal.amount.toFixed(2)} USDC\n${deal.terms}`;
    if (typeof navigator.share === "function") await navigator.share({ title: deal.title, text }).catch(() => undefined);
    else {
      await navigator.clipboard.writeText(text);
      toast.success("Contract copied.");
    }
  }

  return (
    <div className="space-y-4 px-3 py-3 lg:px-4">
      <header>
        <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">Contracts</p>
        <h1 className="mt-1 font-display text-4xl tracking-tight">Write one. Sign it.</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">Ten kinds. Nine chains. A payment is USDC from your wallet to theirs. An agent mandate sets the desk cap and moves nothing.</p>
      </header>

      <RailContracts />

      <div className="flex gap-1.5 overflow-x-auto">
        {DEAL_CHAINS.map((id) => (
          <button key={id} type="button" onClick={() => setChain(id)} className={cn("h-9 shrink-0 rounded-full px-3 text-xs font-semibold", chain === id ? "bg-white text-black" : "bg-white/10 text-white/70")}>
            {id}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {DEAL_TEMPLATES.map((item) => (
          <button key={item.id} type="button" onClick={() => setPick(item)} className={cn("rounded-2xl border px-3 py-3 text-left", pick.id === item.id ? "border-accent bg-accent/10" : "border-white/10 bg-black")}>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase">{item.tag}</span>
            <p className="mt-2 text-sm font-semibold">{item.title}</p>
            <p className="mt-1 text-[11px] leading-snug text-white/45">{item.line}</p>
          </button>
        ))}
      </div>

      <section className="rounded-[22px] border border-white/10 bg-black p-4">
        <p className="text-sm font-semibold">{pick.title} on {chain}</p>
        <div className="mt-3 grid gap-2">
          <input value={who} onChange={(e) => setWho(e.target.value)} placeholder={pick.pays ? (chain === "Solana" ? "Solana address that gets paid" : "0x address that gets paid") : "Agent name, if you have one"} className="min-h-12 rounded-2xl border border-white/10 bg-black px-3 text-sm outline-none" />
          <div className="flex gap-2">
            <input value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal" aria-label="USDC" className="min-h-12 w-28 rounded-2xl border border-white/10 bg-black px-3 font-mono text-sm outline-none" />
            <input value={due} onChange={(e) => setDue(e.target.value)} type="date" aria-label="Due" className="min-h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-black px-3 text-sm outline-none" />
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={pick.id === "rent" ? "Which month, which place" : pick.id === "mandate" ? "What the agent may do" : "What this payment is for"} className="min-h-12 rounded-2xl border border-white/10 bg-black px-3 text-sm outline-none" />
        </div>
        <div className="mt-3 rounded-2xl bg-white/[0.04] px-3 py-3">
          <p className="font-mono text-[10px] tracking-[0.14em] text-white/40 uppercase">The contract</p>
          <p className="mt-2 text-sm leading-relaxed">{terms || "Enter an amount."}</p>
        </div>
        {armed ? (
          <div className="mt-3 rounded-2xl border border-white/10 px-3 py-3 text-sm leading-relaxed">
            {pick.pays && chain === "Solana" ? <p>One Solana signature. ${amount.toFixed(2)} USDC leaves this wallet for the address you typed. Gas is a little SOL.</p> : null}
            {pick.pays && chain !== "Solana" && chain !== "Monad" ? <p>The wallet switches to {chain}. One signature calls that chain’s USDC transfer for ${amount.toFixed(2)}. Gas is that chain’s coin, not USDC.</p> : null}
            {pick.pays && chain === "Monad" ? <p>Monad is on the chain row. This desk has no USDC contract there, so the wallet is not asked.</p> : null}
            {!pick.pays ? <p>No USDC moves. The desk cap becomes ${amount.toFixed(2)} until {due}. A later send still asks the wallet.</p> : null}
            <p className="mt-2 text-white/45">Voiding the record later does not pull a payment back.</p>
          </div>
        ) : null}
        <button
          type="button"
          disabled={busy || (armed && pick.pays && chain === "Monad")}
          onClick={() => {
            if (!armed) {
              if (!(amount >= 1) || amount > 5000) {
                toast.error("The amount is between $1 and $5,000.");
                return;
              }
              if (pick.pays && who.trim().length < 8) {
                toast.error(chain === "Solana" ? "Paste the Solana address that gets paid." : "Paste the address that gets paid.");
                return;
              }
              setArmed(true);
              return;
            }
            void sign();
          }}
          className="mt-3 min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-50"
        >
          {busy ? "Waiting on the wallet" : armed ? (pick.pays ? `Sign $${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"} on ${chain}` : "Sign the mandate") : "Review the signature"}
        </button>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Yours · {live.length}</h2>
        <ul className="mt-2 space-y-2">
          {live.length === 0 ? <li className="text-sm text-white/45">None signed yet.</li> : null}
          {live.map((deal) => (
            <li key={deal.id} className="rounded-2xl border border-white/10 px-3 py-3">
              <div className="flex flex-wrap gap-1">
                <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-fg">{deal.tag}</span>
                <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/60">{deal.chain}</span>
                <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/60">{deal.pays ? "USDC sent" : "No funds"}</span>
              </div>
              <p className="mt-2 text-sm font-semibold">{deal.title} · ${deal.amount.toFixed(2)}</p>
              <p className="mt-1 text-sm leading-relaxed text-white/55">{deal.terms}</p>
              {deal.sig && deal.sig !== "mandate" ? <p className="mt-1 truncate font-mono text-[11px] text-white/35">{deal.sig}</p> : null}
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => void share(deal)} className="h-9 rounded-full border border-white/15 px-3 text-xs font-semibold">Share</button>
                <button type="button" onClick={() => { voidDeal(deal.id); refresh(); }} className="h-9 rounded-full border border-white/15 px-3 text-xs">Void the record</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <button type="button" onClick={() => setDeskOpen((v) => !v)} className="flex min-h-11 w-full items-center justify-between text-left">
          <span className="text-lg font-semibold">Already on the desk · {open.length}</span>
          <span className="text-xs text-white/45">{deskOpen ? "Close" : "Open"}</span>
        </button>
        {deskOpen ? (
          <>
            <div className="mt-2 flex gap-1 overflow-x-auto">
              <button type="button" onClick={() => setLane("all")} className={cn("h-8 shrink-0 rounded-full px-3 text-xs font-semibold", lane === "all" ? "bg-white text-black" : "bg-white/10")}>All</button>
              {LANES.map((item) => (
                <button key={item.id} type="button" onClick={() => setLane(item.id)} className={cn("h-8 shrink-0 rounded-full px-3 text-xs font-semibold", lane === item.id ? "bg-white text-black" : "bg-white/10")}>
                  {item.label} {counts[item.id]}
                </button>
              ))}
            </div>
            <ul className="mt-2 divide-y divide-white/10">
              {shown.length === 0 ? <li className="py-4 text-sm text-white/45">Nothing in this lane.</li> : null}
              {shown.map((row) => (
                <li key={`${row.lane}:${row.id}`} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{row.name}</p>
                    <p className="truncate text-xs text-white/45">{row.lane} · {row.detail}</p>
                  </div>
                  <p className="font-mono text-sm">{row.amount}</p>
                  <button type="button" onClick={() => void navigate({ href: OPEN_TO[row.lane] })} className="h-9 rounded-full border border-white/15 px-3 text-xs">Open</button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
    </div>
  );
}
