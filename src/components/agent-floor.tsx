import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { runInstruction } from "@/lib/agent-run";
import { parseSpawn } from "@/lib/agent-spawn";
import { recentMemories } from "@/lib/agent-memory";
import { createWorker, dropWorker, listWorkers, logWorker, patchWorker, type Worker } from "@/lib/agent-workspace";
import { impactPct, outUi, quoteJup } from "@/lib/jup-exec";
import { connectPhantom } from "@/lib/phantom";
import { agentStake, fundPurse, loadClearing } from "@/lib/clearing";
import { payUsdc } from "@/lib/solana-pay";
import { runPrestock } from "@/lib/prestock";
import { shortBook, signMarketShort } from "@/lib/short-market";
import { connectWallet } from "@/lib/wallets";
import { bookSignals, sized, type BookSignal } from "@/lib/book-strategies";
import { spendCap } from "@/lib/spend-cap";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { wrappedUsdc } from "@/lib/vault-wrap";
import { KINDS, VENUES, kindOf, openBrief, type AgentKind } from "@/lib/agent-kinds";
import { AgentHarness } from "@/components/agent-harness";
import { AgentKit } from "@/components/agent-kit";
import { AgentSign } from "@/components/agent-sign";
import { TradeAgents } from "@/components/trade-agents";
import { cn } from "@/lib/utils";

const SIZES = [1, 5, 25, 100] as const;

function dollarsIn(text: string, fallback: number): number {
  const m = text.match(/\$\s*(\d+(?:\.\d{1,2})?)/);
  if (!m) return fallback;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(5000, Math.round(n));
}

function stamp(at: string) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function AgentFloor({ names }: { names: HouseListing[] }) {
  const book = useMemo(() => names.filter((n) => n.venue === "prestocks" && n.last > 0), [names]);
  const wallet = useWallet();
  const [rows, setRows] = useState<Worker[]>([]);
  const [id, setId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentJob, setAgentJob] = useState("");
  const [kind, setKind] = useState<AgentKind>("analysis");
  const [desk, setDesk] = useState<"any" | "trade" | "harness" | "kit">("any");
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState(false);
  const end = useRef<HTMLDivElement | null>(null);
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [purseUsd, setPurseUsd] = useState(0);
  const [clearing, setClearing] = useState("");
  const selected = rows.find((r) => r.id === id) ?? null;
  const thread = [...(selected?.log ?? [])].reverse();

  useEffect(() => {
    let live = true;
    const pull = () => {
      loadClearing()
        .then((h) => {
          if (!live) return;
          const house = h as { pubkey?: string; purses?: Array<{ owner: string; name: string; usd: number }> };
          setClearing(house.pubkey || "");
          const mine = (house.purses || []).find((p) => p.owner === owner && selected && p.name === selected.name);
          setPurseUsd(mine?.usd || 0);
        })
        .catch(() => undefined);
    };
    pull();
    const t = window.setInterval(pull, 15_000);
    return () => {
      live = false;
      window.clearInterval(t);
    };
  }, [owner, selected?.name]);

  const played = useRef("");

  function purseKey(who: string, name: string) {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24) || "agent";
    return `${who}:${id}`;
  }

  async function addBalance(usd: number) {
    if (!selected || !clearing) return;
    setBusy(true);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "The wallet did not stay.");
      }
      const paid = await payUsdc({
        owner: who,
        to: clearing,
        usd,
        memo: `Senda clear purse ${selected.name.replace(/[^A-Za-z0-9 ]/g, "").slice(0, 24)}`,
      });
      const opened = await fundPurse({ data: { owner: who, sig: paid.signature, name: selected.name, usd } });
      setPurseUsd(opened.usd);
      toast.success(`${selected.name} has $${opened.usd.toFixed(2)}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The balance did not land.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!selected?.auto || !owner || purseUsd < 0.01 || book.length === 0) return;
    if (Date.now() - (selected.lastStakeAt || 0) < 60 * 60 * 1000) return;
    const hour = `${selected.id}:${Math.floor(Date.now() / 3_600_000)}`;
    if (played.current === hour) return;
    played.current = hour;
    const named = book.filter((n) => {
      const hay = selected.purpose.toLowerCase();
      return selected.symbols.includes(n.symbol) || hay.includes(n.symbol.toLowerCase()) || (n.name.length > 3 && hay.includes(n.name.toLowerCase()));
    });
    const pool = named.length ? named : book;
    const row = [...pool].sort((a, b) => (a.premium ?? 0) - (b.premium ?? 0))[0];
    if (!row) return;
    const side: "yes" | "no" = selected.side === "sell" || (row.premium ?? 0) > 0.02 ? "no" : "yes";
    const usd = Math.min(purseUsd, Math.max(0.01, selected.maxUsd));
    const workerId = selected.id;
    patchWorker(workerId, { lastStakeAt: Date.now() });
    void agentStake({
      data: { owner, purseId: purseKey(owner, selected.name), symbol: row.symbol, mint: row.mint, tenor: "1h", side, usd },
    })
      .then((r) => {
        setPurseUsd(r.left);
        logWorker(workerId, `${side === "yes" ? "Above" : "Below"} ${row.symbol} for $${usd.toFixed(2)}. $${r.left.toFixed(2)} left.`);
        load(workerId);
      })
      .catch((e) => {
        played.current = "";
        patchWorker(workerId, { lastStakeAt: 0 });
        logWorker(workerId, e instanceof Error ? e.message : "The play did not land.");
        load(workerId);
      });
  }, [selected?.auto, selected?.id, selected?.lastStakeAt, selected?.purpose, selected?.side, selected?.maxUsd, purseUsd, owner, book]);

  function load(next?: string | null) {
    const all = listWorkers().map((r) => ({ ...r, notes: r.notes ?? "" }));
    setRows(all);
    setId(next === undefined ? (id && all.some((r) => r.id === id) ? id : (all[0]?.id ?? null)) : next);
  }

  useEffect(() => {
    const all = listWorkers().map((r) => ({ ...r, notes: r.notes ?? "" }));
    setRows(all);
    setId(all[0]?.id ?? null);
  }, []);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [selected?.log.length, id]);

  function birth(name: string, purpose: string, madeBy?: string, usd = 0, nextKind: AgentKind = "analysis"): Worker {
    const card = kindOf(nextKind);
    const maxUsd = card.trades ? dollarsIn(purpose, usd) : dollarsIn(purpose, 0);
    const row = createWorker({
      name,
      purpose,
      kind: card.id,
      tools: card.trades && maxUsd > 0 ? ["book", "trade", "memory"] : ["book", "memory"],
      symbols: [],
      maxUsd,
      side: /\bsell\b/i.test(purpose) ? "sell" : "buy",
    });
    if (madeBy) patchWorker(row.id, { madeBy });
    const brief = openBrief(card.id, purpose);
    const pass = card.reads ? runInstruction(purpose, book, { side: row.side, maxUsd: row.maxUsd, symbols: [], trade: card.trades && maxUsd > 0 }) : null;
    const venue = card.reads
      ? VENUES.map((v) => `${v.name} · ${v.chain}. ${v.sign}`).join("\n")
      : "";
    const lines = [...brief, ...(pass?.lines ?? []), venue].filter(Boolean);
    logWorker(row.id, purpose, "you");
    logWorker(row.id, lines.join("\n"), "agent");
    patchWorker(row.id, { queue: pass?.queue ?? null, symbols: pass?.symbols ?? [] });
    return { ...row, madeBy, notes: row.notes ?? "", queue: pass?.queue ?? null, symbols: pass?.symbols ?? [] };
  }

  async function jupiterLine(queue: Worker["queue"]): Promise<string | null> {
    if (!queue) return null;
    if (queue.side === "short") {
      const book = shortBook(queue.symbol);
      return book ? `Short ${queue.symbol} on ${book.label}. $${queue.usd} collateral, 2×. You still sign.` : `No short market on ${queue.symbol}.`;
    }
    const name = book.find((n) => n.symbol === queue.symbol);
    if (!name?.mint) return null;
    const q = await quoteJup({ data: { mint: name.mint, usd: queue.usd, side: queue.side } });
    if ("error" in q) return `Jupiter: ${q.error}`;
    return `Jupiter ${queue.side} $${queue.usd} of ${name.symbol}\n${outUi(q, 6).toFixed(4)} out · ${q.route.join(" → ") || "route"} · impact ${impactPct(q).toFixed(2)}%`;
  }

  async function reply(row: Worker, text: string): Promise<{ text: string; open?: string }> {
    const spawn = parseSpawn(text);
    if (spawn) {
      const child = birth(spawn.name, spawn.purpose, row.name, dollarsIn(text, 0), row.kind ?? "analysis");
      const extra = await jupiterLine(child.queue);
      if (extra) logWorker(child.id, extra, "agent");
      return { text: `Made ${child.name}. It is open, and it already ran.\n${child.purpose}`, open: child.id };
    }
    const parts = text.trim().split(/\s+/);
    const op = parts[0]?.toLowerCase() ?? "";
    const rest = parts.slice(1).join(" ");
    if (op === "quote") {
      const name = book.find((n) => n.symbol.toLowerCase() === rest.toLowerCase());
      if (!name) return { text: "Name a symbol that is on the book. Example: quote OPENAI" };
      const q = await quoteJup({ data: { mint: name.mint, usd: row.maxUsd, side: "buy" } });
      if ("error" in q) return { text: q.error };
      return { text: `Jupiter for $${row.maxUsd} of ${name.symbol}\n${outUi(q, 6).toFixed(4)} out · ${q.route.join(" → ") || "no venue named"}` };
    }
    if (op === "memory") {
      const mem = recentMemories();
      return { text: mem.length ? mem.map((m) => `${m.side} ${m.symbol} $${m.usd}`).join("\n") : "Nothing remembered in this browser." };
    }
    if (op === "vault") {
      const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      return {
        text: owner
          ? `Wrapped $${wrappedUsdc(owner).toFixed(2)} of ${owner.slice(0, 4)}…\nSpend cap $${spendCap()}. The USDC is still in the wallet.`
          : "No wallet is connected, so there is nothing to wrap.",
      };
    }
    if (op === "note") {
      if (!rest) return { text: "Write the note after the word note." };
      patchWorker(row.id, { notes: `${row.notes ? `${row.notes}\n` : ""}${rest}`.slice(0, 4000) });
      return { text: `Filed. ${rest}` };
    }
    const card = kindOf(row.kind);
    const canTrade = card.trades && row.maxUsd > 0;
    const usd = canTrade ? dollarsIn(text, row.maxUsd) : 0;
    if (canTrade && usd !== row.maxUsd) patchWorker(row.id, { maxUsd: usd });
    const pass = runInstruction(text, book, { side: row.side, maxUsd: canTrade ? usd : 0, symbols: row.symbols, trade: canTrade });
    const brief = openBrief(card.id, text);
    patchWorker(row.id, {
      queue: pass.queue,
      purpose: text,
      symbols: row.symbols.length ? row.symbols : pass.symbols,
      side: pass.queue && pass.queue.side !== "short" ? pass.queue.side : row.side,
    });
    const extra = await jupiterLine(pass.queue);
    const body = [...brief, ...pass.lines].join("\n");
    return { text: extra ? `${body}\n\n${extra}` : body };
  }

  async function makeOwn() {
    const purpose = agentJob.trim();
    if (!purpose) return toast.error("Say what this agent should do.");
    const row = birth(agentName.trim() || purpose.split(/[.\n]/)[0].slice(0, 28), purpose, undefined, dollarsIn(purpose, 0), kind);
    const extra = await jupiterLine(row.queue);
    if (extra) logWorker(row.id, extra, "agent");
    setAgentName("");
    setAgentJob("");
    load(row.id);
    toast.success(`${row.name} is on the desk.`);
  }

  async function say(text: string, existing?: Worker) {
    const clean = text.trim();
    if (!clean || working) return;
    const parent = existing ?? selected;
    const spawn = parseSpawn(clean);
    if (spawn && !parent) {
      const row = birth(spawn.name, spawn.purpose, undefined, dollarsIn(clean, 0), kind);
      const extra = await jupiterLine(row.queue);
      if (extra) logWorker(row.id, extra, "agent");
      setDraft("");
      load(row.id);
      return;
    }
    setWorking(true);
    setDraft("");
    try {
      const row = parent;
      if (!row) return;
      logWorker(row.id, clean, "you");
      const answer = await reply(row, clean);
      logWorker(row.id, answer.text, "agent");
      load(answer.open ?? row.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The agent did not answer.");
    } finally {
      setWorking(false);
    }
  }

  async function sign(row: Worker) {
    if (!row.queue) return;
    const name = book.find((n) => n.symbol === row.queue?.symbol);
    if (!name) return toast.error("That name is not on the book.");
    setBusy(true);
    try {
      const existing = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      const who = existing || (await connectPhantom());
      if (!existing) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      if (row.queue.side === "short") {
        const venue = shortBook(row.queue.symbol);
        if (!venue) throw new Error("No short market on that name.");
        let trader = "";
        if (venue.kind === "base") {
          const evm = wallet.w.links.find((l) => l.kind === "evm")?.address ?? "";
          trader = evm || (await connectWallet("metamask")).address;
          if (!evm) {
            const linked = wallet.linkChain(trader, "MetaMask", "evm");
            if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep MetaMask.");
          }
        }
        const done = await signMarketShort({ book: venue, usd: row.queue.usd, owner: who, trader });
        logWorker(row.id, `Signed short ${row.queue.symbol} $${row.queue.usd} on ${done.where}. ${done.id.slice(0, 8)}.`, "agent");
        patchWorker(row.id, { queue: null });
        load(row.id);
        toast.success(`Short signed. ${done.id.slice(0, 8)}…`);
        return;
      }
      const done = await runPrestock({ owner: who, mint: name.mint, side: row.queue.side, usd: row.queue.usd, price: name.last, symbol: name.symbol });
      logWorker(row.id, `Signed ${row.queue.side} ${name.symbol} $${row.queue.usd}. ${done.signature.slice(0, 8)}.`, "agent");
      patchWorker(row.id, { queue: null });
      load(row.id);
      toast.success(`Signed. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not sign.");
    } finally {
      setBusy(false);
    }
  }

  async function signSignal(row: BookSignal) {
    const amount = sized(25, spendCap());
    if (!(amount > 0)) {
      toast.error("The cap leaves nothing to sign.");
      return;
    }
    setBusy(true);
    try {
      const who = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "The wallet did not stay.");
      }
      const done = await runPrestock({ owner: who, mint: row.mint, side: row.side, usd: amount, price: row.last, symbol: row.symbol });
      toast.success(`${row.side === "buy" ? "Bought" : "Sold"} ${row.symbol}. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The strategy did not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-9.5rem)] flex-col bg-[#05060a] text-white lg:h-[calc(100dvh-4rem)]">
      <div className="flex items-center gap-1 border-b border-white/10 px-3 py-2">
        <button type="button" onClick={() => setDesk("any")} className={cn("h-9 rounded-full px-4 text-sm font-semibold", desk === "any" ? "bg-white text-black" : "text-white/55")}>Agents</button>
        <button type="button" onClick={() => setDesk("trade")} className={cn("h-9 rounded-full px-4 text-sm font-semibold", desk === "trade" ? "bg-white text-black" : "text-white/55")}>Trading</button>
        <button type="button" onClick={() => setDesk("kit")} className={cn("h-9 rounded-full px-4 text-sm font-semibold", desk === "kit" ? "bg-white text-black" : "text-white/55")}>Kit</button>
        <button type="button" onClick={() => setDesk("harness")} className={cn("h-9 rounded-full px-4 text-sm font-semibold", desk === "harness" ? "bg-white text-black" : "text-white/55")}>Harness</button>
        <span className="ml-2 hidden text-xs text-white/35 sm:inline">{desk === "kit" ? "An outside agent can look and queue. It never gets a key." : desk === "harness" ? "The token lets an agent queue. You still sign." : desk === "trade" ? "You sign the live trade. Paper stays on the other switch." : "Name it. Tell it the job. Come back to it."}</span>
      </div>
      {desk === "kit" ? <AgentKit /> : desk === "harness" ? <AgentHarness /> : desk === "trade" ? <TradeAgents names={names} /> : (
      <>
      <div className="flex items-center gap-2 overflow-x-auto border-b border-white/10 px-3 py-2">
        <span className="shrink-0 px-2 font-mono text-[11px] tracking-[0.18em] text-accent uppercase">Agent</span>
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => setId(row.id)}
            className={cn("flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm", row.id === id ? "bg-white text-black" : "bg-white/6 text-white/70")}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", row.queue ? "bg-accent" : "bg-emerald-400")} />
            <span className="text-left">
              <span className="block">{row.name}</span>
              {row.madeBy ? <span className="block text-[10px] opacity-60">by {row.madeBy}</span> : null}
            </span>
          </button>
        ))}
        <button type="button" onClick={() => setId(null)} className="shrink-0 rounded-full px-3 py-1.5 text-sm text-white/50">
          + New
        </button>
      </div>

      {!selected ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          <div className="mx-auto grid w-full max-w-[1400px] gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div>
              <p className="font-mono text-[11px] tracking-[0.22em] text-accent uppercase">New agent</p>
              <h1 className="mt-2 font-display text-4xl tracking-tight xl:text-5xl">Make one for the job. Not for a size.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/50">
                Analysis, marketing, a business call, a trip, a portfolio read. Money is not required. A trading agent can take a size later, and even then you sign.
              </p>
              <div className="mt-4 rounded-2xl border border-white/10 p-3">
                <p className="text-sm font-semibold">Discount buys. Rich sells.</p>
                <p className="mt-1 text-xs text-white/45">At least 2% through the mark. $25 or the cap, whichever is smaller. You sign each one.</p>
                <ul className="mt-2 space-y-1">
                  {bookSignals(book).map((row) => (
                    <li key={`${row.why}:${row.mint}`} className="flex items-center justify-between gap-2">
                      <span className="text-sm">{row.side === "buy" ? "Buy" : "Sell"} {row.symbol} <span className="font-mono text-[11px] text-white/40">{(row.premium * 100).toFixed(1)}%</span></span>
                      <button type="button" disabled={busy} onClick={() => void signSignal(row)} className="min-h-9 rounded-full bg-accent px-3 text-xs font-semibold text-accent-fg disabled:opacity-40">Sign</button>
                    </li>
                  ))}
                </ul>
                {bookSignals(book).length === 0 ? <p className="mt-2 text-xs text-white/40">Nothing is 2% through its mark.</p> : null}
              </div>
              <div className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {KINDS.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => {
                      setKind(card.id);
                      if (!agentJob.trim()) setAgentJob(card.example);
                    }}
                    className={cn("rounded-2xl border px-4 py-3 text-left", kind === card.id ? "border-accent bg-white/8" : "border-white/10 hover:bg-white/5")}
                  >
                    <span className="block text-sm font-semibold">{card.title}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-white/45">{card.line}</span>
                  </button>
                ))}
              </div>
            </div>
            <form
              className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/4 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                makeOwn();
              }}
            >
              <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">{kindOf(kind).title}</p>
              <input value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="Name" className="h-12 rounded-2xl border border-white/15 bg-black/40 px-4 text-base outline-none placeholder:text-white/30" />
              <textarea value={agentJob} onChange={(e) => setAgentJob(e.target.value)} placeholder={kindOf(kind).example} rows={4} className="rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-base leading-relaxed outline-none placeholder:text-white/30" />
              <button type="button" onClick={() => setAgentJob(kindOf(kind).example)} className="text-left text-xs text-white/45 underline-offset-2 hover:underline">
                Use the example
              </button>
              <button type="submit" className="h-12 rounded-2xl bg-white text-sm font-semibold text-black">
                Make this agent
              </button>
              <p className="text-xs leading-relaxed text-white/35">It runs once as soon as it exists. It stays in this browser, so you can come back to it. Nothing here asks the wallet.</p>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex flex-col gap-3 border-b border-white/10 px-3 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-10">
              <div>
                <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">{kindOf(selected.kind ?? "desk").title}</p>
                <p className="mt-1 text-sm text-white/55">{kindOf(selected.kind ?? "desk").trades ? (selected.maxUsd > 0 ? `Can queue up to $${selected.maxUsd}. Wallet spend cap $${spendCap()}. You sign. It never holds the keys.` : "No size set. It reads. It does not queue. It never holds the keys.") : "No balance. It writes and it stays here. It never holds the keys."}</p>
              </div>
              {kindOf(selected.kind ?? "desk").trades ? (
              <div className="flex flex-wrap items-center justify-end gap-1">
                <p className="mr-2 font-mono text-xs text-white/40">${purseUsd.toFixed(2)} purse</p>
                {[5, 25].map((n) => (
                  <button key={n} type="button" disabled={busy || !clearing} onClick={() => void addBalance(n)} className="min-h-9 rounded-full bg-white/8 px-3 font-mono text-[11px] text-white/80 disabled:opacity-40">
                    Add ${n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    patchWorker(selected.id, { auto: !selected.auto, lastStakeAt: selected.auto ? selected.lastStakeAt : 0 });
                    load(selected.id);
                  }}
                  className={cn("min-h-9 rounded-full px-3 text-[11px] font-semibold", selected.auto ? "bg-accent text-accent-fg" : "border border-white/15 text-white/70")}
                >
                  {selected.auto ? "On its own" : "Let it play"}
                </button>
              </div>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-10">
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
                {thread.length === 0 ? <p className="text-sm text-white/35">This session is open. Tell it what to do.</p> : null}
                {thread.map((line, i) =>
                  (line.role ?? "agent") === "you" ? (
                    <div key={`${line.at}-${i}`} className="flex justify-end">
                      <div className="max-w-[80%] rounded-3xl bg-white px-4 py-3 text-sm text-black">{line.text}</div>
                    </div>
                  ) : (
                    <div key={`${line.at}-${i}`} className="max-w-[90%]">
                      <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">
                        {selected.name} · {stamp(line.at)}
                      </p>
                      <pre className="mt-2 font-sans text-[15px] leading-relaxed whitespace-pre-wrap text-white/85">{line.text}</pre>
                    </div>
                  ),
                )}
                {working ? <p className="font-mono text-xs text-white/40">Reading the book…</p> : null}
                <div ref={end} />
              </div>
            </div>
            <AgentSign
              names={book}
              agentName={selected.name}
              onDone={(line) => {
                logWorker(selected.id, line, "agent");
                load(selected.id);
              }}
            />
            {selected.queue ? (
              <div className="mx-3 mb-2 flex flex-col gap-2 rounded-2xl bg-accent px-4 py-3 text-accent-fg sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium">
                  {selected.queue.side} {selected.queue.symbol} · ${selected.queue.usd}
                  <span className="ml-2 font-normal opacity-70">{selected.queue.why}</span>
                </p>
                <button type="button" disabled={busy} onClick={() => void sign(selected)} className="shrink-0 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                  {busy ? "Waiting on the wallet" : "Sign"}
                </button>
              </div>
            ) : null}
            <form
              className="border-t border-white/10 px-4 py-3 lg:px-10"
              onSubmit={(e) => {
                e.preventDefault();
                void say(draft, selected);
              }}
            >
              <div className="mx-auto flex w-full max-w-4xl items-center gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={`Tell ${selected.name}…   or   make an agent that watches Neuralink`}
                  className="h-14 min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-5 text-base outline-none"
                />
                <button type="submit" disabled={working || !draft.trim()} className="h-14 rounded-full bg-white px-5 text-sm font-semibold text-black disabled:opacity-40">
                  Send
                </button>
              </div>
            </form>
          </div>
          <aside className="hidden w-[340px] shrink-0 flex-col border-l border-white/10 xl:flex">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-mono text-[11px] tracking-[0.16em] text-white/40 uppercase">{kindOf(selected.kind ?? "desk").title}</p>
                {kindOf(selected.kind ?? "desk").trades ? (
                <div className="mt-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      patchWorker(selected.id, { maxUsd: 0, queue: null });
                      load(selected.id);
                    }}
                    className={cn("rounded-full px-2.5 py-1 font-mono text-[11px]", selected.maxUsd === 0 ? "bg-accent text-accent-fg" : "bg-white/8 text-white/60")}
                  >
                    None
                  </button>
                  {SIZES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        patchWorker(selected.id, { maxUsd: n });
                        load(selected.id);
                      }}
                      className={cn("rounded-full px-2.5 py-1 font-mono text-[11px]", selected.maxUsd === n ? "bg-accent text-accent-fg" : "bg-white/8 text-white/60")}
                    >
                      ${n}
                    </button>
                  ))}
                </div>
                ) : (
                  <p className="mt-2 text-xs leading-relaxed text-white/45">{kindOf(selected.kind ?? "desk").line}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  dropWorker(selected.id);
                  const all = listWorkers();
                  setRows(all);
                  setId(all[0]?.id ?? null);
                }}
                className="text-xs text-white/35"
              >
                Delete
              </button>
            </div>
            {kindOf(selected.kind ?? "desk").reads ? (
            <ul className="min-h-0 flex-1 overflow-y-auto px-2">
              {book.map((n) => {
                const on = selected.symbols.includes(n.symbol);
                return (
                  <li key={n.symbol}>
                    <button
                      type="button"
                      onClick={() => {
                        const symbols = on ? selected.symbols.filter((s) => s !== n.symbol) : [...selected.symbols, n.symbol];
                        patchWorker(selected.id, { symbols });
                        load(selected.id);
                      }}
                      className={cn("flex w-full items-baseline justify-between rounded-xl px-3 py-2 text-left", on ? "bg-white/8" : "hover:bg-white/5")}
                    >
                      <span>
                        <span className="text-sm font-medium">{n.symbol}</span>
                        <span className="ml-2 font-mono text-[11px] text-white/40">{formatPremium(n.premium)}</span>
                      </span>
                      <span className="font-mono text-xs text-white/60">{formatUsd(n.last)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
                {openBrief(kindOf(selected.kind ?? "desk").id, selected.purpose).map((line) => (
                  <p key={line} className="mb-3 text-xs leading-relaxed text-white/55">{line}</p>
                ))}
              </div>
            )}
            {selected.notes ? <p className="border-t border-white/10 px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap text-white/50">{selected.notes}</p> : null}
          </aside>
        </div>
      )}
      </>
      )}
    </div>
  );
}
