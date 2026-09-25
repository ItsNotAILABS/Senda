import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Binoculars, CalendarClock, FileText, Shield, TrendingDown, TrendingUp } from "lucide-react";
import { AgentComputer } from "@/components/agent-computer";
import { bookLevel, pushLevel, review, type Gate } from "@/lib/agent-risk";
import { recall, remember } from "@/lib/agent-memory";
import { JOBS, think, type Job } from "@/lib/agent-shift";
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
  const [usd, setUsd] = useState(25);
  const [symbol, setSymbol] = useState(book[0]?.symbol ?? "");
  const [payWith, setPayWith] = useState<"USDC" | "SOL">("USDC");
  const [watch, setWatch] = useState<string[]>(() => {
    const u = readUsing();
    return u ? [u.symbol] : [];
  });
  const [busy, setBusy] = useState(false);
  const [series, setSeries] = useState<number[]>([]);
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
        writeLog(e.id, out.log);
        patchEnvelope(e.id, { lastTick: new Date().toISOString(), queue: out.queue ?? e.queue });
      }
      if (changed) setEnvs(listEnvelopes());
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
      side: draftJob === "rich" ? "sell" : "buy",
      job: draftJob,
    });
    setEnvs(listEnvelopes());
    setMade(row.id);
    setDraftName("");
    setDraftSay("");
  }

  function lookNow() {
    for (const e of listEnvelopes()) {
      if (e.armed === false) continue;
      patchEnvelope(e.id, { lastTick: "" });
      const fresh = listEnvelopes().find((x) => x.id === e.id);
      if (!fresh) continue;
      const out = think(fresh, book);
      if (!out) continue;
      writeLog(e.id, out.log);
      patchEnvelope(e.id, { lastTick: new Date().toISOString(), queue: out.queue ?? null });
    }
    setEnvs(listEnvelopes());
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
      <section className="rounded-[22px] border border-white/[0.08] bg-[#10131c] p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Agents</p>
            <h1 className="mt-2 text-4xl leading-[1.05] tracking-tight">
              They watch. <span className="text-accent">You sign.</span>
            </h1>
          </div>
          <button type="button" onClick={lookNow} className="min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">
            Look now
          </button>
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

      <section className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-[22px] border border-white/[0.08] bg-[#10131c] p-5">
          <p className="text-sm font-semibold">New shift</p>
          <p className="mt-1 font-mono text-xs text-subtle">
            {JOBS.find((j) => j.id === draftJob)?.title} · ${usd}
            {watch.length ? ` · ${watch.join(" ")}` : " · every name"}
          </p>
          <input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Name" className={cn(field, "mt-3")} />
          <input value={draftSay} onChange={(e) => setDraftSay(e.target.value)} placeholder="What it watches" className={cn(field, "mt-2")} />
          <div className="mt-3 flex flex-wrap gap-1">
            {book.map((n) => (
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
          <button type="button" onClick={makeAgent} className="mt-4 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg">
            Start this shift
          </button>
        </div>

        <div className="space-y-3">
          <div className="rounded-[22px] border border-white/[0.08] bg-[#10131c] p-4 sm:p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">Queue</h2>
              <p className="font-mono text-[11px] text-subtle">{waiting} waiting</p>
            </div>
            {ordered.length === 0 ? <p className="mt-3 text-sm text-muted">Nothing is waiting on a signature.</p> : null}
            <ul className="mt-2">
              {ordered.map((e) => {
                const Icon = JOB_ICON[e.job] ?? Binoculars;
                const on = made === e.id;
                return (
                  <li key={e.id} className={cn("mt-2 rounded-2xl", on ? "bg-white/[0.05]" : "")}>
                    <button
                      type="button"
                      onClick={() => setMade(on ? null : e.id)}
                      className="flex w-full items-center gap-3 px-2 py-2.5 text-left"
                    >
                      <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", e.queue ? "bg-accent text-accent-fg" : "bg-white/[0.06]")}>
                        <Icon className="size-4" strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{e.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {e.queue
                            ? `${e.queue.side} ${e.queue.symbol} · ${e.queue.why}`
                            : e.armed === false
                              ? "Paused"
                              : "Watching"}
                        </span>
                      </span>
                      <span className="font-mono text-sm tabular-nums">{e.queue ? `$${e.queue.usd}` : `$${e.maxUsd}`}</span>
                    </button>
                    {on && e.queue ? (
                      <div className="px-2 pb-3">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void runMade(e)}
                          className="min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-50"
                        >
                          {busy ? "Waiting for the wallet…" : `Sign · $${e.queue.usd}`}
                        </button>
                      </div>
                    ) : null}
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
                  <button
                    type="button"
                    onClick={() => {
                      dropEnvelope(env.id);
                      setEnvs(listEnvelopes());
                      setMade(null);
                    }}
                    className="text-xs text-down"
                  >
                    Remove
                  </button>
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
                <button
                  type="button"
                  onClick={() => {
                    patchEnvelope(env.id, { armed: env.armed === false });
                    setEnvs(listEnvelopes());
                  }}
                  className="mt-3 min-h-10 rounded-full border border-white/15 px-4 text-sm font-semibold"
                >
                  {env.armed === false ? "Put it back on shift" : "Pause the shift"}
                </button>
                <div className="mt-3 max-h-36 overflow-y-auto font-mono text-xs">
                  {env.log.length === 0 ? <p className="text-subtle">Nothing written yet.</p> : null}
                  {env.log.map((l, i) => (
                    <p key={`${l.at}-${i}`} className="border-t border-white/[0.06] py-1.5 text-muted first:border-0">
                      {l.text}
                    </p>
                  ))}
                </div>
                {!env.queue ? <p className="mt-3 text-xs text-subtle">On shift. Nothing moves until you sign.</p> : null}
              </div>
            ) : (
              <div className="mt-4 border-t border-white/[0.08] pt-4">
                <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Sign</p>
                <h3 className="mt-1 text-2xl tracking-tight">{move?.title}</h3>
                <p className="mt-1 text-sm text-muted">{move?.line}</p>
                {id === "daily" ? (
                  <select
                    value={picked?.symbol ?? ""}
                    onChange={(e) => setSymbol(e.target.value)}
                    className={cn(field, "mt-3")}
                  >
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
              </div>
            )}
          </div>
          <AgentComputer names={book} envelopeId={env?.id ?? null} />
        </div>
      </section>
    </div>
  );
}
