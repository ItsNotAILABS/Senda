import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
    const id = window.setInterval(() => {
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
    return () => window.clearInterval(id);
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

  async function runMade() {
    if (!env) return;
    setBusy(true);
    try {
      const who = await owner();
      const queued = env.queue ? book.find((n) => n.symbol === env.queue?.symbol) : null;
      const pool = env.symbols.length ? book.filter((n) => env.symbols.includes(n.symbol)) : book;
      const pick =
        queued ??
        [...pool].sort((a, b) => (env.side === "sell" ? (b.premium ?? 0) - (a.premium ?? 0) : (a.premium ?? 0) - (b.premium ?? 0)))[0];
      if (!pick) throw new Error("No name inside this envelope.");
      const side = env.queue?.side ?? env.side;
      const g = review({
        symbol: pick.symbol,
        side,
        usd: Math.min(env.queue?.usd ?? env.maxUsd, spendCap()),
        premium: pick.premium,
        change24h: pick.change24h,
        series,
        cap: Math.min(env.maxUsd, spendCap()),
      });
      if (g.blocked) throw new Error(g.blocked);
      const done = await runPrestock({ owner: who, mint: pick.mint, side, usd: g.usd, price: pick.last });
      const line = `${side} ${pick.symbol} $${g.usd} · ${done.signature.slice(0, 8)} · ${g.tape}`;
      writeLog(env.id, line);
      patchEnvelope(env.id, { queue: null });
      setEnvs(listEnvelopes());
      note(pick.symbol, side, g.usd, pick);
      toast.success(`${env.name} sent ${pick.symbol}. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "It did not send.";
      if (env) writeLog(env.id, msg);
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

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-[28px] border border-white/10 bg-[#0c0c14] p-6 lg:p-8">
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Agents</p>
          <h1 className="mt-3 max-w-lg text-4xl leading-[1.05] tracking-tight lg:text-5xl">
            They watch the book. <span className="text-accent">You sign.</span>
          </h1>
          <p className="mt-4 max-w-md text-sm text-muted">
            A shift reads the print and writes a queue. Nothing leaves the wallet until you press sign. The cap is the most it can ask for.
          </p>
          <button type="button" onClick={lookNow} className="mt-6 min-h-12 rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg">
            Look at the book now
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {JOBS.map((j) => (
            <button
              key={j.id}
              type="button"
              onClick={() => setDraftJob(j.id)}
              className={cn("rounded-2xl border px-3 py-3 text-left", draftJob === j.id ? "border-accent bg-[#101018]" : "border-white/10 bg-[#101018]")}
            >
              <span className="block text-sm font-semibold">{j.title}</span>
              <span className="mt-1 block text-[11px] text-muted">{j.line}</span>
            </button>
          ))}
        </div>
      </section>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="h-fit rounded-[28px] border border-white/10 bg-[#101018]">
        <div className="px-4 py-4">
          <p className="text-sm font-semibold">New shift</p>
          <p className="mt-1 text-xs text-muted">{JOBS.find((j) => j.id === draftJob)?.title}. Max ${usd}. {watch.length ? watch.join(" ") : "Every name."}</p>
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Name"
            className="mt-3 min-h-11 w-full rounded-2xl bg-black/40 px-3 text-sm outline-none"
          />
          <input
            value={draftSay}
            onChange={(e) => setDraftSay(e.target.value)}
            placeholder="What it watches"
            className="mt-2 min-h-11 w-full rounded-2xl bg-black/40 px-3 text-sm outline-none"
          />
          <div className="mt-2 flex flex-wrap gap-1">
            {book.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setWatch((cur) => (cur.includes(n.symbol) ? cur.filter((s) => s !== n.symbol) : [...cur, n.symbol]))}
                className={cn("min-h-8 rounded-full px-2 font-mono text-[11px]", watch.includes(n.symbol) ? "bg-accent text-accent-fg" : "bg-black/40 text-muted")}
              >
                {n.symbol}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-1">
            {[10, 25, 100].map((n) => (
              <button key={n} type="button" onClick={() => setUsd(n)} className={cn("min-h-9 rounded-full px-3 font-mono text-xs", usd === n ? "bg-accent text-accent-fg" : "bg-black/40 text-muted")}>
                ${n}
              </button>
            ))}
          </div>
          <button type="button" onClick={makeAgent} className="mt-3 min-h-11 w-full rounded-full bg-accent px-3 text-sm font-semibold text-accent-fg">
            Start this shift
          </button>
        </div>
        <ul>
          {envs.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => setMade(e.id)}
                className={cn("w-full px-5 py-3 text-left", made === e.id ? "bg-elevated" : "hover:bg-surface")}
              >
                <span className="block text-sm font-semibold">{e.name}</span>
                <span className="mt-0.5 block text-xs text-muted">{e.job} · {e.armed === false ? "paused" : "on shift"} · ${e.maxUsd}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="px-5 pt-4 pb-1 font-mono text-[10px] tracking-widest text-subtle uppercase">Built in</p>
        <ul>
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  setMade(null);
                  setId(r.id);
                }}
                className={cn("w-full px-5 py-4 text-left", id === r.id ? "bg-elevated" : "hover:bg-surface")}
              >
                <span className="block text-sm font-semibold">{r.title}</span>
                <span className="mt-1 block text-xs text-muted">{r.line}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section className="rounded-[28px] border border-white/10 bg-[#101018] px-5 py-6 lg:px-8">
        <AgentComputer names={book} envelopeId={env?.id ?? null} />
        {env ? (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] tracking-widest text-accent uppercase">Envelope</p>
                <h2 className="mt-1 font-display text-4xl">{env.name}</h2>
                <p className="mt-2 max-w-lg text-sm text-muted">{env.mandate || "No mandate yet."}</p>
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
            <dl className="mt-4 grid max-w-lg grid-cols-3 gap-2 text-sm">
              <div className="rounded-xl bg-elevated px-3 py-2">
                <dt className="text-[11px] text-subtle">Max send</dt>
                <dd className="font-mono">${env.maxUsd}</dd>
              </div>
              <div className="rounded-xl bg-black/30 px-3 py-2">
                <dt className="text-[11px] text-subtle">Job</dt>
                <dd className="font-mono">{env.job}</dd>
              </div>
              <div className="rounded-xl bg-elevated px-3 py-2">
                <dt className="text-[11px] text-subtle">Names</dt>
                <dd className="font-mono">{env.symbols.length ? env.symbols.join(" ") : "All"}</dd>
              </div>
            </dl>
            <p className="mt-6 text-xs text-subtle">Computer</p>
            <div className="mt-2 max-w-lg rounded-xl border border-border bg-surface p-3 font-mono text-xs">
              {env.log.length === 0 ? <p className="text-subtle">Nothing written yet. Run it and the gate writes here.</p> : null}
              {env.log.map((l, i) => (
                <p key={i} className="border-t border-border py-1.5 first:border-0">
                  {l.text}
                </p>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                patchEnvelope(env.id, { armed: env.armed === false });
                setEnvs(listEnvelopes());
              }}
              className="mt-4 min-h-10 rounded-full bg-white/10 px-4 text-sm font-semibold"
            >
              {env.armed === false ? "Put it back on shift" : "Pause the shift"}
            </button>
            {env.queue ? (
              <div className="mt-4 rounded-2xl bg-black/40 p-4">
                <p className="text-xs text-subtle">Waiting on you</p>
                <p className="mt-1 text-sm font-semibold">
                  {env.queue.side} {env.queue.symbol} · ${env.queue.usd}
                </p>
                <p className="text-xs text-muted">{env.queue.why}</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runMade()}
                  className="mt-3 min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg"
                >
                  {busy ? "Waiting for the wallet…" : "Sign it"}
                </button>
              </div>
            ) : (
              <p className="mt-4 text-xs text-subtle">On shift. It will write here when the book moves. Nothing is signed until you do.</p>
            )}
          </>
        ) : (
          <>
        <h2 className="font-display text-4xl">{rows.find((r) => r.id === id)?.title}</h2>
        <p className="mt-3 max-w-lg text-sm text-muted">{rows.find((r) => r.id === id)?.line}</p>
        {id === "daily" ? (
          <select
            value={picked?.symbol ?? ""}
            onChange={(e) => setSymbol(e.target.value)}
            className="mt-4 min-h-11 rounded-lg bg-elevated px-3 text-sm"
          >
            {book.map((n) => (
              <option key={n.id} value={n.symbol}>
                {n.symbol} · {formatUsd(n.last)}
              </option>
            ))}
          </select>
        ) : null}
        {id === "cheap" && cheap ? (
          <p className="mt-4 font-mono text-sm">
            {formatUsd(cheap.last)} token · {formatUsd(cheap.mark)} mark
          </p>
        ) : null}
        <div className="mt-4 flex gap-1">
          {(["USDC", "SOL"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setPayWith(id)}
              className={cn("min-h-9 rounded-lg px-3 text-xs font-semibold", payWith === id ? "bg-fg text-bg" : "bg-elevated text-muted")}
            >
              Pay with {id}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-1">
          {[10, 25, 100].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setUsd(n)}
              className={cn("min-h-9 rounded-lg px-3 font-mono text-xs", usd === n ? "bg-fg text-bg" : "bg-elevated text-muted")}
            >
              ${n}
            </button>
          ))}
        </div>
        <div className="mt-6 max-w-lg space-y-2 text-sm">
          <p>
            <span className="text-muted">Tape. </span>
            {gate?.tape || "Waiting on the book."}
          </p>
          <p>
            <span className="text-muted">Risk. </span>
            {gate?.risk || "—"}
          </p>
          <p>
            <span className="text-muted">Send. </span>
            {gate?.blocked ? "Blocked." : `$${sendUsd} after the gate. You still approve it.`}
          </p>
          <p>
            <span className="text-muted">Memory. </span>
            {prior
              ? `Last time it looked like this: ${prior.memory.side} ${prior.memory.symbol} for $${prior.memory.usd}.`
              : "No similar past send yet."}
          </p>
        </div>
        <button
          type="button"
          disabled={busy || book.length === 0 || Boolean(gate?.blocked)}
          onClick={() => void run()}
          className="mt-6 min-h-12 rounded-lg bg-accent px-5 text-sm font-semibold text-accent-fg disabled:opacity-50"
        >
          {busy ? "Waiting for the wallet…" : gate?.blocked ? "Blocked" : `Run · $${sendUsd}`}
        </button>
        {book.length === 0 ? <p className="mt-4 text-sm text-muted">PreStocks did not answer. Nothing to run.</p> : null}
          </>
        )}
      </section>
      </div>
    </div>
  );
}
