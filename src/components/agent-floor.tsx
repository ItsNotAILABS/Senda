import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { runInstruction } from "@/lib/agent-run";
import { parseSpawn } from "@/lib/agent-spawn";
import { recentMemories } from "@/lib/agent-memory";
import { readWatch } from "@/lib/tv-watch";
import { createWorker, dropWorker, listWorkers, logWorker, patchWorker, type Worker } from "@/lib/agent-workspace";
import { outUi, quoteJup } from "@/lib/jup-exec";
import { connectPhantom } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { spendCap } from "@/lib/spend-cap";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { claimWork, listWork, type Gig } from "@/lib/work-hub";
import { wrappedUsdc } from "@/lib/vault-wrap";
import { cn } from "@/lib/utils";

const STARTERS = [
  "Watch the book and tell me who is cheap and who is rich.",
  "Buy OpenAI if it is cheap. Do not sign.",
  "Sell whatever is rich versus its mark.",
  "Flag a drop. Do not buy.",
];

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
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState(false);
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);
  const end = useRef<HTMLDivElement | null>(null);
  const selected = rows.find((r) => r.id === id) ?? null;
  const thread = [...(selected?.log ?? [])].reverse();

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

  useEffect(() => {
    let live = true;
    listWork()
      .then((rows) => {
        if (live) setGigs(rows);
      })
      .catch(() => {
        if (live) setGigs([]);
      });
    return () => {
      live = false;
    };
  }, []);

  async function reply(row: Worker, text: string): Promise<{ text: string; open?: string }> {
    const spawn = parseSpawn(text);
    if (spawn) {
      const child = birth(spawn.name, spawn.purpose, row.name);
      return {
        text: `Made ${child.name}. It is open, and it already ran.\n${child.purpose}`,
        open: child.id,
      };
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
    if (op === "tv" || op === "watch" || op === "video") {
      const on = readWatch();
      if (!on) return { text: "Nothing is on Crypto TV in this browser." };
      const where = on.live ? `Live on ${on.channel}` : `${on.channel}: ${on.title}`;
      const link = on.live ? "The live desk is on Crypto TV." : `https://www.youtube.com/watch?v=${on.id}`;
      return { text: `${where}\n${link}` };
    }
    if (op === "note") {
      if (!rest) return { text: "Write the note after the word note." };
      patchWorker(row.id, { notes: `${row.notes ? `${row.notes}\n` : ""}${rest}`.slice(0, 4000) });
      return { text: `Filed. ${rest}` };
    }
    const pass = runInstruction(text, book, {
      side: row.side,
      maxUsd: row.maxUsd,
      symbols: row.symbols,
      trade: true,
    });
    patchWorker(row.id, {
      queue: pass.queue,
      purpose: text,
      symbols: row.symbols.length ? row.symbols : pass.symbols,
      side: pass.queue?.side ?? row.side,
    });
    const on = readWatch();
    const seen = on ? `\nOn Crypto TV: ${on.live ? `live ${on.channel}` : `${on.channel} — ${on.title}`}` : "";
    return { text: `${pass.lines.join("\n")}${seen}` };
  }

  function birth(name: string, purpose: string, madeBy?: string): Worker {
    const row = createWorker({
      name,
      purpose,
      tools: ["book", "trade", "memory"],
      symbols: [],
      maxUsd: 25,
      side: /\bsell\b/i.test(purpose) ? "sell" : "buy",
    });
    if (madeBy) patchWorker(row.id, { madeBy });
    const pass = runInstruction(purpose, book, { side: row.side, maxUsd: row.maxUsd, symbols: [], trade: true });
    logWorker(row.id, purpose, "you");
    logWorker(row.id, pass.lines.join("\n"), "agent");
    patchWorker(row.id, { queue: pass.queue, symbols: pass.symbols });
    return { ...row, madeBy, queue: pass.queue, symbols: pass.symbols };
  }

  function makeOwn() {
    const purpose = agentJob.trim();
    if (!purpose) return toast.error("Say what this agent should do.");
    const row = birth(agentName.trim() || purpose.split(/[.\n]/)[0].slice(0, 28), purpose);
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
      const row = birth(spawn.name, spawn.purpose);
      setDraft("");
      load(row.id);
      return;
    }
    setWorking(true);
    setDraft("");
    try {
      let row = parent;
      if (!row) {
        row = birth(clean.split(/[.\n]/)[0].slice(0, 28) || "Agent", clean);
        load(row.id);
        return;
      }
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
      const done = await runPrestock({ owner: who, mint: name.mint, side: row.queue.side, usd: row.queue.usd, price: name.last });
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

  async function takeGig(gigId: string) {
    setClaiming(gigId);
    try {
      const existing = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      const who = existing || (await connectPhantom());
      if (!existing) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      await claimWork({
        data: {
          id: gigId,
          worker: who,
          ...(selected?.name ? { agent: selected.name } : {}),
        },
      });
      setGigs(await listWork());
      toast.success(selected?.name ? `${selected.name} will do it.` : "You have it.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not take the work.");
    } finally {
      setClaiming(null);
    }
  }

  const openNeeds = gigs.filter((g) => g.role === "need" && g.status === "open");

  return (
    <div className="senda-stage flex h-[calc(100dvh-64px)] flex-col text-fg">
      <div className="flex items-center gap-2 overflow-x-auto border-b border-white/10 bg-black/25 px-4 py-3 backdrop-blur">
        <span className="shrink-0 pr-2 font-mono text-[11px] tracking-[0.2em] text-accent uppercase">Agents</span>
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => setId(row.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm transition-colors",
              row.id === id ? "bg-fg text-bg" : "bg-white/6 text-white/75 hover:bg-white/10",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", row.queue ? "bg-accent" : "bg-emerald-400")} />
            <span className="text-left leading-tight">
              <span className="block font-medium">{row.name}</span>
              {row.madeBy ? <span className="block text-[10px] opacity-60">by {row.madeBy}</span> : null}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setId(null)}
          className="shrink-0 rounded-full border border-accent/40 px-3.5 py-2 text-sm font-medium text-accent hover:bg-accent/10"
        >
          + New
        </button>
      </div>
      {readWatch() ? (
        <p className="border-b border-white/10 px-4 py-2 text-xs text-white/55">
          On Crypto TV: {readWatch()?.live ? `live ${readWatch()?.channel}` : readWatch()?.title}
        </p>
      ) : null}

      <section className="border-b border-white/10 bg-black/20 px-4 py-3 lg:px-6">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-mono text-[11px] tracking-[0.2em] text-accent uppercase">Work</p>
          <p className="text-xs text-white/40">{selected ? `As ${selected.name}` : "Open need-gigs"}</p>
        </div>
        {openNeeds.length === 0 ? (
          <p className="mt-2 text-sm text-white/40">No open need-gigs.</p>
        ) : (
          <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {openNeeds.map((gig) => (
              <li key={gig.id} className="w-64 shrink-0 rounded-2xl border border-white/10 bg-[#10131c] px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{gig.title}</p>
                  <p className="shrink-0 font-mono text-sm">${gig.usd}</p>
                </div>
                {gig.detail ? <p className="mt-1 text-xs leading-snug text-white/45">{gig.detail}</p> : null}
                <button
                  type="button"
                  disabled={claiming === gig.id}
                  onClick={() => void takeGig(gig.id)}
                  className="mt-3 h-9 rounded-full bg-accent px-3 text-xs font-semibold text-accent-fg disabled:opacity-40"
                >
                  {claiming === gig.id ? "Waiting on the wallet" : "I'll do it"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!selected ? (
        <div className="flex flex-1 items-center px-6 py-10 lg:px-12">
          <div className="grid w-full items-center gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(420px,520px)]">
            <div>
              <p className="font-mono text-[11px] tracking-[0.22em] text-accent uppercase">New session</p>
              <h1 className="mt-3 max-w-xl text-5xl tracking-tight xl:text-6xl">Make an agent.</h1>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">
                Name it. Give it a job. It runs on the live book the moment it exists. Ask it to make another, and that one opens already run.
              </p>
            </div>
            <form
              className="rounded-[28px] border border-white/10 bg-[#10131c]/90 p-5 shadow-[0_24px_80px_rgb(0_0_0/0.35)]"
              onSubmit={(e) => {
                e.preventDefault();
                makeOwn();
              }}
            >
              <label className="block">
                <span className="font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">Name</span>
                <input
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="Scout"
                  className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-base outline-none placeholder:text-white/25 focus:border-accent/50"
                />
              </label>
              <label className="mt-4 block">
                <span className="font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">Job</span>
                <input
                  value={agentJob}
                  onChange={(e) => setAgentJob(e.target.value)}
                  placeholder="Watch SpaceX. Buy it if it is cheap."
                  className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-base outline-none placeholder:text-white/25 focus:border-accent/50"
                />
              </label>
              <button type="submit" className="mt-4 h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg">
                Make this agent
              </button>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setAgentJob(s)}
                    className={cn(
                      "rounded-2xl border px-3 py-2.5 text-left text-xs leading-snug text-white/70 hover:bg-white/5",
                      agentJob === s ? "border-accent/50 bg-accent/10 text-fg" : "border-white/10",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-10">
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
                {thread.length === 0 ? <p className="text-sm text-white/35">This session is open. Tell it what to do.</p> : null}
                {thread.map((line, i) =>
                  (line.role ?? (line.text.startsWith(">") ? "you" : "agent")) === "you" ? (
                    <div key={`${line.at}-${i}`} className="flex justify-end">
                      <div className="max-w-[80%] rounded-3xl bg-white px-4 py-3 text-sm text-black">{line.text.replace(/^>\s*/, "")}</div>
                    </div>
                  ) : (
                    <div key={`${line.at}-${i}`} className="max-w-[92%] rounded-2xl border border-white/10 border-l-2 border-l-accent bg-[#10131c] px-4 py-3">
                      <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">
                        {selected.name} · {stamp(line.at)}
                      </p>
                      <pre className="mt-2 font-sans text-[15px] leading-relaxed whitespace-pre-wrap text-fg/90">{line.text}</pre>
                    </div>
                  ),
                )}
                {working ? <p className="font-mono text-xs text-white/40">Reading the book…</p> : null}
                <div ref={end} />
              </div>
            </div>
            {selected.queue ? (
              <div className="mx-4 mb-2 flex items-center justify-between gap-3 rounded-2xl bg-accent px-4 py-3 text-accent-fg lg:mx-10">
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
              className="px-4 pb-4 lg:px-10"
              onSubmit={(e) => {
                e.preventDefault();
                void say(draft, selected);
              }}
            >
              <div className="mx-auto flex w-full max-w-4xl items-center gap-2 rounded-full border border-white/10 bg-[#10131c] p-1.5 pl-5">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={`Tell ${selected.name}…   or   make an agent that watches Neuralink`}
                  className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-white/30"
                />
                <button type="submit" disabled={working || !draft.trim()} className="h-12 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg disabled:opacity-40">
                  Send
                </button>
              </div>
            </form>
          </div>
          <aside className="hidden w-[320px] shrink-0 flex-col border-l border-white/10 bg-black/20 xl:flex">
            <div className="flex items-center justify-between px-4 py-4">
              <div>
                <p className="font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">Book</p>
                <p className="mt-0.5 text-sm text-fg">{selected.symbols.length ? `${selected.symbols.length} pinned` : "The whole book"}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  dropWorker(selected.id);
                  const all = listWorkers();
                  setRows(all);
                  setId(all[0]?.id ?? null);
                }}
                className="text-xs text-white/35 hover:text-white/70"
              >
                Delete
              </button>
            </div>
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
                      className={cn(
                        "flex w-full items-baseline justify-between rounded-xl px-3 py-2.5 text-left",
                        on ? "bg-accent/10" : "hover:bg-white/5",
                      )}
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
            {selected.notes ? <p className="border-t border-white/10 px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap text-white/50">{selected.notes}</p> : null}
          </aside>
        </div>
      )}
    </div>
  );
}
