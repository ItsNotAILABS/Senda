import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Binoculars, CalendarClock, Eye, FileText, Lock, Shield, TrendingDown, TrendingUp } from "lucide-react";
import { AgentComputer } from "@/components/agent-computer";
import { TabLead } from "@/components/tab-lead";
import { bookLevel, pushLevel, review, type Gate } from "@/lib/agent-risk";
import { recall, remember } from "@/lib/agent-memory";
import { JOBS, think, type Job, type Queue } from "@/lib/agent-shift";
import { createEnvelope, dropEnvelope, listEnvelopes, patchEnvelope, writeLog, type Envelope } from "@/lib/agent-envelope";
import { loadJobs, saveJobs, todayKey, type AgentJobs } from "@/lib/agents";
import { spendCap } from "@/lib/spend-cap";
import { quoteRoute, signRoute, SOL } from "@/lib/jup-sign";
import { USDC } from "@/lib/jup-exec";
import { connectPhantom, mintDecimals, readChain } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { readUsing } from "@/lib/using";
import { cn } from "@/lib/utils";

type Id = "cheap" | "rich" | "daily";

const JOB_ICON = {
  scout: Binoculars,
  discount: TrendingDown,
  rich: TrendingUp,
  daily: CalendarClock,
  cover: Shield,
  clerk: FileText,
} as const satisfies Record<Job, unknown>;

const BUILT_ICON = {
  cheap: TrendingDown,
  rich: TrendingUp,
  daily: CalendarClock,
} as const satisfies Record<Id, unknown>;

const SHEET = "senda.sheet.v1";

const READY = [
  {
    id: "drop",
    title: "Watch a drop",
    job: "cover",
    side: "buy",
    holdCap: false,
    icon: Eye,
    line: "Flags a hard drop on the live name. It does not buy.",
    mandate: "Watch the live name. Flag a hard drop. Do not send.",
  },
  {
    id: "cheap",
    title: "Buy the cheap print",
    job: "discount",
    side: "buy",
    holdCap: false,
    icon: TrendingDown,
    line: "Queues a buy when a print is under its mark.",
    mandate: "Queue a buy when a print is cheap versus its mark. The user signs.",
  },
  {
    id: "cap",
    title: "Hold the cap",
    job: "scout",
    side: "buy",
    holdCap: true,
    icon: Lock,
    line: "Keeps every queued size at or under the spend cap.",
    mandate: "Hold the spend cap. Write the tape. Do not queue a send above the cap.",
  },
  {
    id: "book",
    title: "Log the book",
    job: "clerk",
    side: "buy",
    holdCap: false,
    icon: FileText,
    line: "Writes the book onto the sheet. No money moves.",
    mandate: "Log the book onto the sheet. Do not send.",
  },
] as const;

function readSheet(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const cur = JSON.parse(window.localStorage.getItem(SHEET) || "{}") as Record<string, string>;
    return cur && typeof cur === "object" && !Array.isArray(cur) ? cur : {};
  } catch {
    return {};
  }
}

function heldCap(): number | null {
  const on = listEnvelopes().some((e) => e.name === "Hold the cap" && e.job === "scout" && e.armed !== false);
  return on ? spendCap() : null;
}

function boundQueue<T extends Queue | null>(queue: T): T {
  if (!queue) return queue;
  const cap = heldCap();
  if (cap == null || queue.usd <= cap) return queue;
  return { ...queue, usd: cap };
}

const field = "min-h-11 w-full rounded-2xl border border-white/[0.08] bg-black/30 px-3 text-sm outline-none placeholder:text-subtle";

export function AgentsDesk({ names }: { names: HouseListing[] }) {
  const book = useMemo(
    () => names.filter((n) => n.venue === "prestocks" && n.last > 0 && n.mark > 0),
    [names],
  );
  const cheap = [...book].sort((a, b) => (a.premium ?? 0) - (b.premium ?? 0))[0];
  const rich = [...book].sort((a, b) => (b.premium ?? 0) - (a.premium ?? 0))[0];
  const [id, setId] = useState<Id>("cheap");
  const [jobs, setJobs] = useState<AgentJobs>(() => loadJobs());
  const [envs, setEnvs] = useState<Envelope[]>(() => listEnvelopes());
  const [made, setMade] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftSay, setDraftSay] = useState("");
  const [draftJob, setDraftJob] = useState<Job>("scout");
  const [draftSide, setDraftSide] = useState<"buy" | "sell">("buy");
  const [bring, setBring] = useState("");
  const [usd, setUsd] = useState(25);
  const [symbol, setSymbol] = useState(book[0]?.symbol ?? "");
  const [payWith, setPayWith] = useState<"USDC" | "SOL">("USDC");
  const [watch, setWatch] = useState<string[]>(() => {
    const u = readUsing();
    return u ? [u.symbol] : [];
  });
  const [busy, setBusy] = useState(false);
  const [series, setSeries] = useState<number[]>([]);
  const [sheet, setSheet] = useState<Record<string, string>>(() => readSheet());
  const wallet = useWallet();
  const picked = book.find((n) => n.symbol === symbol) ?? book[0];

  function put(next: AgentJobs) {
    setJobs(saveJobs(next));
  }

  useEffect(() => {
    const level = bookLevel(book.map((n) => n.last));
    if (level > 0) setSeries(pushLevel(level));
  }, [book]);

  useEffect(() => {
    if (!book.length) return;
    const timer = window.setInterval(() => {
      let changed = false;
      for (const e of listEnvelopes()) {
        const out = think(e, book);
        if (!out) continue;
        changed = true;
        const raw = out.queue ?? e.queue;
        const queue = boundQueue(raw);
        writeLog(e.id, out.log);
        if (raw && queue && queue.usd < raw.usd) writeLog(e.id, `Held ${raw.symbol} at the cap. $${raw.usd} is now $${queue.usd}.`);
        patchEnvelope(e.id, { lastTick: new Date().toISOString(), queue });
      }
      if (changed) {
        setEnvs(listEnvelopes());
        setSheet(readSheet());
      }
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [book]);

  const focus = id === "rich" ? rich : id === "daily" ? picked : cheap;
  const side = id === "rich" ? "sell" : "buy";
  const gate: Gate | null = focus
    ? review({
        symbol: focus.symbol,
        side,
        usd,
        premium: focus.premium,
        change24h: focus.change24h,
        series,
        cap: spendCap(),
      })
    : null;
  const sendUsd = gate?.usd ?? usd;
  const hits = focus
    ? recall({
        premium: focus.premium ?? 0,
        change24h: focus.change24h ?? 0,
        drawdown: gate?.drawdown ?? 0,
        side,
      })
    : [];
  const prior = hits.find((h) => h.score > 0.85);

  function note(symbol: string, side: "buy" | "sell", amount: number, name?: HouseListing) {
    remember({
      at: new Date().toISOString(),
      symbol,
      side,
      usd: amount,
      premium: name?.premium ?? 0,
      change24h: name?.change24h ?? 0,
      drawdown: gate?.drawdown ?? 0,
    });
  }

  async function owner(): Promise<string> {
    const existing = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
    const who = existing || (await connectPhantom());
    if (!existing) {
      const linked = wallet.linkChain(who, "Phantom", "phantom");
      if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
    }
    return who;
  }

  async function run() {
    setBusy(true);
    try {
      const who = await owner();
      if (gate?.blocked) throw new Error(gate.blocked);
      const usd = sendUsd;
      if (!(usd > 0)) throw new Error("The risk gate cut this to nothing.");
      const buyMint = id === "cheap" ? cheap?.mint : picked?.mint;
      const buySymbol = id === "cheap" ? cheap?.symbol : picked?.symbol;
      if (id !== "rich" && payWith === "SOL") {
        if (id === "daily" && picked && jobs.daily?.mint === picked.mint && jobs.daily.lastDay === todayKey()) {
          throw new Error(`Today's buy of ${picked.symbol} already went out.`);
        }
        if (!buyMint || !buySymbol) throw new Error("No name to buy.");
        const px = await quoteRoute({ inputMint: SOL, outputMint: USDC, amountRaw: 1e9, outDecimals: 6 });
        if (!(px.outUi > 0)) throw new Error("No SOL price.");
        const solAmt = usd / px.outUi;
        const dOut = await mintDecimals(buyMint);
        const done = await signRoute({
          owner: who,
          inputMint: SOL,
          outputMint: buyMint,
          amountRaw: Math.floor(solAmt * 1e9),
          outDecimals: dOut,
          usd,
        });
        if (id === "daily" && picked) put({ ...jobs, daily: { symbol: picked.symbol, mint: picked.mint, usd, lastDay: todayKey() } });
        if (id === "cheap" && cheap) put({ ...jobs, cheap: { usd, under: cheap.premium ?? 0 } });
        toast.success(`Bought ${buySymbol} with SOL. ${done.signature.slice(0, 8)}…`);
        note(buySymbol, "buy", usd, id === "cheap" ? cheap : picked);
        return;
      }
      if (id === "cheap") {
        if (!cheap) throw new Error("No names on the book.");
        const done = await runPrestock({ owner: who, mint: cheap.mint, side: "buy", usd, price: cheap.last });
        put({ ...jobs, cheap: { usd, under: cheap.premium ?? 0 } });
        toast.success(`Bought ${cheap.symbol}. ${done.signature.slice(0, 8)}…`);
        note(cheap.symbol, "buy", usd, cheap);
      } else if (id === "rich") {
        const snap = await readChain(who);
        const held = book.find((n) => (snap.tokens.find((t) => t.mint === n.mint)?.ui ?? 0) > 0 && (n.premium ?? 0) > 0);
        const target = held ?? null;
        if (!target) throw new Error("Nothing you hold is above its mark.");
        const done = await runPrestock({ owner: who, mint: target.mint, side: "sell", usd, price: target.last });
        put({ ...jobs, rich: { usd } });
        toast.success(`Sold ${target.symbol}. ${done.signature.slice(0, 8)}…`);
        note(target.symbol, "sell", usd, target);
      } else {
        if (!picked) throw new Error("Pick a name.");
        if (jobs.daily?.mint === picked.mint && jobs.daily.lastDay === todayKey()) {
          throw new Error(`Today's buy of ${picked.symbol} already went out.`);
        }
        const done = await runPrestock({ owner: who, mint: picked.mint, side: "buy", usd, price: picked.last });
        put({ ...jobs, daily: { symbol: picked.symbol, mint: picked.mint, usd, lastDay: todayKey() } });
        toast.success(`Bought ${picked.symbol}. ${done.signature.slice(0, 8)}…`);
        note(picked.symbol, "buy", usd, picked);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "It did not send.");
    } finally {
      setBusy(false);
    }
  }

  const env = envs.find((e) => e.id === made) ?? null;

  async function runMade(target?: Envelope) {
    const row = target ?? env;
    if (!row) return;
    setMade(row.id);
    setBusy(true);
    try {
      const who = await owner();
      const queued = row.queue ? book.find((n) => n.symbol === row.queue?.symbol) : null;
      const pool = row.symbols.length ? book.filter((n) => row.symbols.includes(n.symbol)) : book;
      const pick =
        queued ??
        [...pool].sort((a, b) => (row.side === "sell" ? (b.premium ?? 0) - (a.premium ?? 0) : (a.premium ?? 0) - (b.premium ?? 0)))[0];
      if (!pick) throw new Error("No name inside this envelope.");
      const side = row.queue?.side ?? row.side;
      const g = review({
        symbol: pick.symbol,
        side,
        usd: Math.min(row.queue?.usd ?? row.maxUsd, spendCap()),
        premium: pick.premium,
        change24h: pick.change24h,
        series,
        cap: Math.min(row.maxUsd, spendCap()),
      });
      if (g.blocked) throw new Error(g.blocked);
      const done = await runPrestock({ owner: who, mint: pick.mint, side, usd: g.usd, price: pick.last });
      const line = `${side} ${pick.symbol} $${g.usd} · ${done.signature.slice(0, 8)} · ${g.tape}`;
      writeLog(row.id, line);
      patchEnvelope(row.id, { queue: null });
      setEnvs(listEnvelopes());
      note(pick.symbol, side, g.usd, pick);
      toast.success(`${row.name} sent ${pick.symbol}. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "It did not send.";
      writeLog(row.id, msg);
      setEnvs(listEnvelopes());
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  function makeAgent() {
    const row = createEnvelope({
      name: draftName,
      mandate: draftSay,
      symbols: watch,
      maxUsd: usd,
      side: draftSide,
      job: draftJob,
    });
    setEnvs(listEnvelopes());
    setMade(row.id);
    setDraftName("");
    setDraftSay("");
    toast.success(`${row.name} is on the roster. Nothing sends until you sign.`);
  }

  function bringOne() {
    let raw: unknown;
    try {
      raw = JSON.parse(bring);
    } catch {
      toast.error("That is not JSON.");
      return;
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      toast.error("That is not JSON.");
      return;
    }
    const body = raw as Record<string, unknown>;
    const job = JOBS.find((j) => j.id === body.job)?.id;
    if (!job) {
      toast.error("That job is not one of the desk jobs.");
      return;
    }
    if (body.side !== "buy" && body.side !== "sell") {
      toast.error("Side has to be buy or sell.");
      return;
    }
    const maxUsd = typeof body.maxUsd === "number" ? body.maxUsd : Number(body.maxUsd);
    if (!Number.isFinite(maxUsd)) {
      toast.error("maxUsd has to be a number.");
      return;
    }
    const symbols = Array.isArray(body.symbols) ? body.symbols.filter((s): s is string => typeof s === "string") : [];
    const row = createEnvelope({
      name: typeof body.name === "string" ? body.name : "",
      mandate: typeof body.mandate === "string" ? body.mandate : "",
      symbols,
      maxUsd,
      side: body.side,
      job,
    });
    setEnvs(listEnvelopes());
    setMade(row.id);
    setBring("");
    toast.success(`${row.name} is on the roster. Nothing sends until you sign.`);
  }

  function lookNow() {
    for (const e of listEnvelopes()) {
      if (e.armed === false) continue;
      patchEnvelope(e.id, { lastTick: "" });
      const fresh = listEnvelopes().find((x) => x.id === e.id);
      if (!fresh) continue;
      const out = think(fresh, book);
      if (!out) continue;
      const queue = out.queue ? boundQueue(out.queue) : null;
      if (out.queue && queue && queue.usd < out.queue.usd) {
        writeLog(e.id, `${out.log} Held ${out.queue.symbol} at the cap. $${out.queue.usd} is now $${queue.usd}.`);
      } else writeLog(e.id, out.log);
      patchEnvelope(e.id, { lastTick: new Date().toISOString(), queue });
    }
    setEnvs(listEnvelopes());
    setSheet(readSheet());
  }

  function armReady(desk: (typeof READY)[number]) {
    const cap = spendCap();
    const live = book.find((n) => n.symbol === readUsing()?.symbol) ?? book[0];
    const symbols = desk.id === "drop" && live ? [live.symbol] : [];
    const maxUsd = desk.holdCap ? cap : Math.min(cap, Math.max(1, Math.round(usd)));
    const mandate = desk.id === "drop" && live ? `Watch ${live.symbol}. Flag a hard drop. Do not send.` : desk.mandate;
    const existing = listEnvelopes().find((e) => e.name === desk.title && e.job === desk.job);
    const row = existing
      ? patchEnvelope(existing.id, { armed: true, mandate, symbols, maxUsd, side: desk.side, lastTick: "" })
      : createEnvelope({
          name: desk.title,
          mandate,
          symbols,
          maxUsd,
          side: desk.side,
          job: desk.job,
        });
    if (!row) return;
    const out = think(row, book);
    if (out) {
      const queue = out.queue ? boundQueue({ ...out.queue, usd: Math.min(out.queue.usd, cap, maxUsd) }) : null;
      writeLog(row.id, out.log);
      patchEnvelope(row.id, { lastTick: new Date().toISOString(), queue });
    }
    if (desk.holdCap) {
      for (const e of listEnvelopes()) {
        if (!e.queue || e.queue.usd <= cap) continue;
        writeLog(e.id, `Held ${e.queue.symbol} at the cap. $${e.queue.usd} is now $${cap}.`);
        patchEnvelope(e.id, { queue: { ...e.queue, usd: cap } });
      }
      writeLog(row.id, `Cap held at $${cap}. Nothing moves until you sign.`);
    }
    setSheet(readSheet());
    setEnvs(listEnvelopes());
    setMade(row.id);
    const queued = listEnvelopes().find((e) => e.id === row.id)?.queue;
    toast.success(
      queued
        ? `${desk.title} queued ${queued.side} ${queued.symbol} for $${queued.usd}. Sign it in the queue.`
        : `${desk.title} is armed. Nothing sends until you sign.`,
    );
  }

  const rows: { id: Id; title: string; line: string }[] = [
    {
      id: "cheap",
      title: "Buy what's cheap",
      line: cheap ? `${cheap.symbol} is ${formatPremium(cheap.premium)} versus its mark.` : "Waiting on the book.",
    },
    {
      id: "rich",
      title: "Sell what got rich",
      line: rich && (rich.premium ?? 0) > 0 ? `${rich.symbol} is ${formatPremium(rich.premium)} over its mark.` : "Nothing on the book is over its mark.",
    },
    {
      id: "daily",
      title: "Buy one every day",
      line: jobs.daily ? `${jobs.daily.symbol} · $${jobs.daily.usd} · last ${jobs.daily.lastDay || "never"}` : "Pick a name. One buy a day.",
    },
  ];

  const capNow = spendCap();
  const ask = env?.queue ? Math.min(env.queue.usd, capNow) : env ? Math.min(env.maxUsd, capNow) : sendUsd;
  const barPct = Math.max(0, Math.min(100, (ask / Math.max(capNow, 1)) * 100));
  const ordered = [...envs].sort((a, b) => Number(Boolean(b.queue)) - Number(Boolean(a.queue)));
  const waiting = ordered.filter((e) => e.queue).length;
  const move = rows.find((r) => r.id === id);

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <TabLead
        kicker="Agents"
        title="An agent that watches the book"
        accent="You still sign."
        line="You name it, you bound it, it writes a queue. It cannot move money until you press sign."
        live={["Create an envelope", "Arm a ready desk", "The computer log", "You sign the queue"]}
        coming={["An agent you host off this browser", "A key of its own"]}
      />

      <section className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              makeAgent();
            }}
            className="rounded-[22px] border border-white/[0.08] bg-[#10131c] p-5"
          >
            <p className="text-sm font-semibold">Make an agent</p>
            <p className="mt-1 text-xs text-muted">You name it and bound it. It writes a queue. You press sign.</p>
            <input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Name" className={cn(field, "mt-3")} />
            <textarea
              value={draftSay}
              onChange={(e) => setDraftSay(e.target.value)}
              placeholder="Mandate"
              className={cn(field, "mt-2 min-h-20 py-3")}
            />
            <label className="mt-3 block text-[11px] tracking-[0.14em] text-subtle uppercase">Job</label>
            <select value={draftJob} onChange={(e) => setDraftJob(e.target.value as Job)} className={cn(field, "mt-1")}>
              {JOBS.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted">{JOBS.find((j) => j.id === draftJob)?.line}</p>
            <div className="mt-3 flex gap-1">
              {(["buy", "sell"] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => setDraftSide(side)}
                  className={cn("min-h-9 rounded-full px-3 text-xs font-semibold", draftSide === side ? "bg-accent text-accent-fg" : "bg-white/[0.06] text-muted")}
                >
                  {side}
                </button>
              ))}
            </div>
            <label className="mt-3 block text-[11px] tracking-[0.14em] text-subtle uppercase">Max USD</label>
            <input
              type="number"
              min={1}
              max={5000}
              value={usd}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) setUsd(n);
              }}
              className={cn(field, "mt-1")}
            />
            <div className="mt-3 flex flex-wrap gap-1">
              {(book.length ? book : names).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setWatch((cur) => (cur.includes(n.symbol) ? cur.filter((s) => s !== n.symbol) : [...cur, n.symbol]))}
                  className={cn("min-h-8 rounded-full px-2 font-mono text-[11px]", watch.includes(n.symbol) ? "bg-accent text-accent-fg" : "bg-white/[0.06] text-muted")}
                >
                  {n.symbol}
                </button>
              ))}
            </div>
            <p className="mt-2 font-mono text-xs text-subtle">
              {JOBS.find((j) => j.id === draftJob)?.title} · {draftSide} · ${usd}
              {watch.length ? ` · ${watch.join(" ")}` : " · every name"}
            </p>
            <button type="submit" className="mt-4 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg">
              Create
            </button>
          </form>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              bringOne();
            }}
            className="rounded-[22px] border border-white/[0.08] bg-[#10131c] p-5"
          >
            <p className="text-sm font-semibold">Bring one</p>
            <p className="mt-1 text-xs text-muted">Paste JSON. name, mandate, job, maxUsd, side, symbols.</p>
            <textarea
              value={bring}
              onChange={(e) => setBring(e.target.value)}
              placeholder='{"name":"Night desk","mandate":"Watch the cheap print","job":"discount","maxUsd":25,"side":"buy","symbols":["NVDA"]}'
              className={cn(field, "mt-3 min-h-28 py-3 font-mono text-xs")}
            />
            <button type="submit" className="mt-3 min-h-11 w-full rounded-full border border-white/15 text-sm font-semibold">
              Bring it in
            </button>
          </form>
        </div>

        <div className="space-y-3">
          <div className="rounded-[22px] border border-white/[0.08] bg-[#10131c] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Roster</h2>
                <p className="font-mono text-[11px] text-subtle">{waiting} waiting on a signature</p>
              </div>
              <button type="button" onClick={lookNow} className="min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">
                Look now
              </button>
            </div>
            {ordered.length === 0 ? <p className="mt-3 text-sm text-muted">No agent yet. Name one, or arm a ready desk.</p> : null}
            <ul className="mt-2">
              {ordered.map((e) => {
                const Icon = JOB_ICON[e.job] ?? Binoculars;
                const on = made === e.id;
                const last = e.log[0]?.text;
                return (
                  <li key={e.id} className={cn("mt-2 rounded-2xl border border-white/[0.06] px-2 py-2", on && "bg-white/[0.05]")}>
                    <button type="button" onClick={() => setMade(on ? null : e.id)} className="flex w-full items-center gap-3 py-1 text-left">
                      <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", e.queue ? "bg-accent text-accent-fg" : "bg-white/[0.06]")}>
                        <Icon className="size-4" strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{e.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {e.armed === false ? "Paused" : e.queue ? `${e.queue.side} ${e.queue.symbol} · ${e.queue.why}` : "Watching"}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-subtle">{last ?? "Nothing written yet."}</span>
                      </span>
                      <span className="font-mono text-sm tabular-nums">{e.queue ? `$${e.queue.usd}` : `$${e.maxUsd}`}</span>
                    </button>
                    <div className="mt-2 flex gap-2 px-1">
                      <button
                        type="button"
                        onClick={() => {
                          patchEnvelope(e.id, { armed: e.armed === false });
                          setEnvs(listEnvelopes());
                        }}
                        className="min-h-9 rounded-full border border-white/15 px-3 text-xs font-semibold"
                      >
                        {e.armed === false ? "Arm" : "Pause"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          dropEnvelope(e.id);
                          setEnvs(listEnvelopes());
                          if (made === e.id) setMade(null);
                        }}
                        className="min-h-9 rounded-full px-3 text-xs font-semibold text-down"
                      >
                        Delete
                      </button>
                    </div>
                    {e.queue ? (
                      <div className="px-1 pt-2 pb-1">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void runMade(e)}
                          className="min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-50"
                        >
                          {busy ? "Waiting for the wallet…" : `Sign · $${e.queue.usd}`}
                        </button>
                      </div>
                    ) : (
                      <p className="px-1 pt-2 text-xs text-subtle">Nothing moves until you sign.</p>
                    )}
                  </li>
                );
              })}
            </ul>

            {env ? (
              <div className="mt-4 border-t border-white/[0.08] pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">{env.job}</p>
                    <h3 className="mt-1 text-2xl tracking-tight">{env.name}</h3>
                    {env.mandate ? <p className="mt-1 text-sm text-muted">{env.mandate}</p> : null}
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-2xl bg-white/[0.04] px-3 py-2">
                    <dt className="text-[11px] text-subtle">Max</dt>
                    <dd className="font-mono">${env.maxUsd}</dd>
                  </div>
                  <div className="rounded-2xl bg-white/[0.04] px-3 py-2">
                    <dt className="text-[11px] text-subtle">Side</dt>
                    <dd className="font-mono">{env.side}</dd>
                  </div>
                  <div className="rounded-2xl bg-white/[0.04] px-3 py-2">
                    <dt className="text-[11px] text-subtle">Names</dt>
                    <dd className="truncate font-mono">{env.symbols.length ? env.symbols.join(" ") : "All"}</dd>
                  </div>
                </dl>
                <div className="mt-3 max-h-36 overflow-y-auto font-mono text-xs">
                  {env.log.length === 0 ? <p className="text-subtle">Nothing written yet.</p> : null}
                  {env.log.map((l, i) => (
                    <p key={`${l.at}-${i}`} className="border-t border-white/[0.06] py-1.5 text-muted first:border-0">
                      {l.text}
                    </p>
                  ))}
                </div>
                {env.job === "clerk" ? (
                  <div className="mt-3 font-mono text-xs">
                    {Object.keys(sheet).length === 0 ? <p className="text-subtle">The sheet is empty.</p> : null}
                    {Object.entries(sheet).map(([k, v]) => (
                      <p key={k} className="truncate border-t border-white/[0.06] py-1.5 text-muted first:border-0">
                        {k} {v}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <AgentComputer names={book} envelopeId={env?.id ?? null} />
        </div>
      </section>

      <section>
        <p className="mb-2 px-1 text-sm font-semibold">Ready desks</p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {READY.map((desk) => {
          const Icon = desk.icon;
          const row = envs.find((e) => e.name === desk.title && e.job === desk.job);
          const on = Boolean(row && made === row.id);
          return (
            <div
              key={desk.id}
              className={cn("rounded-[22px] border border-white/10 bg-[#10131c] p-4", on && "ring-1 ring-accent")}
            >
              <span className={cn("grid size-9 place-items-center rounded-full", row ? "bg-accent text-accent-fg" : "bg-white/[0.06]")}>
                <Icon className="size-4" strokeWidth={1.75} />
              </span>
              <p className="mt-3 text-sm font-semibold">{desk.title}</p>
              <p className="mt-1 text-[11px] leading-snug text-muted">{desk.line}</p>
              <p className="mt-2 font-mono text-xs tabular-nums text-subtle">
                {row?.queue
                  ? `${row.queue.side} ${row.queue.symbol} $${row.queue.usd}`
                  : row
                    ? desk.holdCap
                      ? `cap $${row.maxUsd}`
                      : "watching"
                    : "off"}
              </p>
              {desk.id === "book" && Object.keys(sheet).length > 0 ? (
                <ul className="mt-2 space-y-1 font-mono text-[11px] text-muted">
                  {Object.entries(sheet)
                    .slice(0, 6)
                    .map(([k, v]) => (
                      <li key={k} className="truncate">
                        {k} {v}
                      </li>
                    ))}
                </ul>
              ) : null}
              <button
                type="button"
                onClick={() => armReady(desk)}
                className="mt-3 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg"
              >
                Arm
              </button>
            </div>
          );
        })}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {JOBS.map((j) => {
          const Icon = JOB_ICON[j.id];
          const on = draftJob === j.id;
          return (
            <button
              key={j.id}
              type="button"
              onClick={() => setDraftJob(j.id)}
              className={cn(
                "rounded-[22px] border border-white/[0.08] bg-[#10131c] px-3 py-3 text-left",
                on && "ring-1 ring-accent",
              )}
            >
              <span className={cn("grid size-9 place-items-center rounded-full", on ? "bg-accent text-accent-fg" : "bg-white/[0.06]")}>
                <Icon className="size-4" strokeWidth={1.75} />
              </span>
              <span className="mt-3 block text-sm font-semibold">{j.title}</span>
              <span className="mt-1 block text-[11px] leading-snug text-muted">{j.line}</span>
            </button>
          );
        })}
      </section>

      <section className="grid gap-2 sm:grid-cols-3">
        {rows.map((r) => {
          const Icon = BUILT_ICON[r.id];
          const on = !env && id === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setMade(null);
                setId(r.id);
              }}
              className={cn(
                "flex items-center gap-3 rounded-[22px] border border-white/[0.08] bg-[#10131c] px-3 py-3 text-left",
                on && "ring-1 ring-accent",
              )}
            >
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", on ? "bg-accent text-accent-fg" : "bg-white/[0.06]")}>
                <Icon className="size-4" strokeWidth={1.75} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{r.title}</span>
                <span className="mt-0.5 block truncate text-xs text-muted">{r.line}</span>
              </span>
            </button>
          );
        })}
      </section>

      <section className="rounded-[22px] border border-white/[0.08] bg-[#10131c] p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold">Cap</p>
          <p className="font-mono text-sm tabular-nums">
            ${ask.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            <span className="text-subtle"> / ${capNow}</span>
          </p>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]"
          role="meter"
          aria-label="Amount against the cap"
          aria-valuemin={0}
          aria-valuemax={capNow}
          aria-valuenow={Math.min(ask, capNow)}
        >
          <div className="h-full rounded-full bg-accent" style={{ width: `${barPct}%` }} />
        </div>
        <div className="mt-3 flex gap-2">
          {[10, 25, 100].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setUsd(n)}
              className={cn("min-h-9 rounded-full px-3 font-mono text-xs", usd === n ? "bg-accent text-accent-fg" : "bg-white/[0.06] text-muted")}
            >
              ${n}
            </button>
          ))}
        </div>
      </section>

      {!env ? (
        <section className="rounded-[22px] border border-white/[0.08] bg-[#10131c] p-4 sm:p-5">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Sign</p>
          <h3 className="mt-1 text-2xl tracking-tight">{move?.title}</h3>
          <p className="mt-1 text-sm text-muted">{move?.line}</p>
          {id === "daily" ? (
            <select value={picked?.symbol ?? ""} onChange={(e) => setSymbol(e.target.value)} className={cn(field, "mt-3")}>
              {book.map((n) => (
                <option key={n.id} value={n.symbol}>
                  {n.symbol} · {formatUsd(n.last)}
                </option>
              ))}
            </select>
          ) : null}
          {id === "cheap" && cheap ? (
            <p className="mt-3 font-mono text-sm tabular-nums">
              {formatUsd(cheap.last)} token · {formatUsd(cheap.mark)} mark
            </p>
          ) : null}
          <div className="mt-3 flex gap-1">
            {(["USDC", "SOL"] as const).map((pay) => (
              <button
                key={pay}
                type="button"
                onClick={() => setPayWith(pay)}
                className={cn("min-h-9 rounded-full px-3 text-xs font-semibold", payWith === pay ? "bg-accent text-accent-fg" : "bg-white/[0.06] text-muted")}
              >
                Pay with {pay}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-1.5 text-sm">
            <p>
              <span className="text-muted">Tape </span>
              {gate?.tape || "Waiting on the book."}
            </p>
            <p>
              <span className="text-muted">Risk </span>
              {gate?.risk || "—"}
            </p>
            {prior ? (
              <p>
                <span className="text-muted">Last </span>
                {prior.memory.side} {prior.memory.symbol} ${prior.memory.usd}
              </p>
            ) : null}
            {gate?.blocked ? <p className="text-xs text-down">{gate.blocked}</p> : null}
          </div>
          <button
            type="button"
            disabled={busy || book.length === 0 || Boolean(gate?.blocked)}
            onClick={() => void run()}
            className="mt-4 min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-50"
          >
            {busy ? "Waiting for the wallet…" : gate?.blocked ? "Blocked" : `Sign · $${sendUsd}`}
          </button>
          {book.length === 0 ? <p className="mt-3 text-sm text-muted">PreStocks did not answer. Nothing to sign.</p> : null}
        </section>
      ) : null}
    </div>
  );
}
