import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bot,
  BrainCircuit,
  Check,
  ChevronRight,
  CirclePause,
  Clock3,
  FileText,
  ListChecks,
  Pause,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  WalletCards,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { think } from "@/lib/agent-shift";
import { remember } from "@/lib/agent-memory";
import {
  TOOLS,
  createWorker,
  dropWorker,
  isWorkerDue,
  listWorkers,
  logWorker,
  patchWorker,
  type AgentAutonomy,
  type AgentCategory,
  type AgentTrigger,
  type ToolId,
  type Worker,
} from "@/lib/agent-workspace";
import { connectPhantom } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

type Starter = {
  name: string;
  category: AgentCategory;
  purpose: string;
  instructions: string;
  tools: ToolId[];
  trigger: AgentTrigger;
  autonomy: AgentAutonomy;
  side: "buy" | "sell";
};

const STARTERS: Starter[] = [
  {
    name: "Market scout",
    category: "markets",
    purpose: "Watch my selected names and give me a clean market brief.",
    instructions: "Call out the cheapest and richest names versus their marks. Keep the brief short.",
    tools: ["planner", "book", "memory"],
    trigger: "on_open",
    autonomy: "draft",
    side: "buy",
  },
  {
    name: "Portfolio guard",
    category: "markets",
    purpose: "Watch for a bounded opportunity and prepare the next action for my approval.",
    instructions: "Never exceed the cap. Queue at most one action per run. Never sign.",
    tools: ["book", "memory", "trade"],
    trigger: "manual",
    autonomy: "queue",
    side: "buy",
  },
  {
    name: "Research desk",
    category: "research",
    purpose: "Turn a research question into a focused plan and working brief.",
    instructions: "Separate what is known from what still needs evidence.",
    tools: ["planner", "notes"],
    trigger: "manual",
    autonomy: "draft",
    side: "buy",
  },
  {
    name: "Content studio",
    category: "content",
    purpose: "Create a useful content plan from my goal and constraints.",
    instructions: "Start with the audience, outcome, proof points, and a clear next action.",
    tools: ["planner", "notes"],
    trigger: "manual",
    autonomy: "draft",
    side: "buy",
  },
  {
    name: "Ops runner",
    category: "operations",
    purpose: "Break an operational goal into the next concrete actions.",
    instructions: "Make every step small, testable, and ordered by dependency.",
    tools: ["planner", "notes"],
    trigger: "daily",
    autonomy: "draft",
    side: "buy",
  },
  {
    name: "Start blank",
    category: "custom",
    purpose: "",
    instructions: "",
    tools: ["planner"],
    trigger: "manual",
    autonomy: "draft",
    side: "buy",
  },
];

const CATEGORY_LABELS: Record<AgentCategory, string> = {
  research: "Research",
  markets: "Markets",
  operations: "Operations",
  content: "Content",
  personal: "Personal",
  custom: "Custom",
};

const TRIGGER_LABELS: Record<AgentTrigger, string> = {
  manual: "Manual",
  on_open: "When workspace opens",
  daily: "Once a day",
};

const AUTONOMY_LABELS: Record<AgentAutonomy, string> = {
  observe: "Observe only",
  draft: "Draft work",
  queue: "Queue actions",
};

export function AgentWorkspace({ names }: { names: HouseListing[] }) {
  const book = useMemo(() => names.filter((name) => name.venue === "prestocks" && name.last > 0), [names]);
  const wallet = useWallet();
  const [rows, setRows] = useState<Worker[]>(() => (typeof window === "undefined" ? [] : listWorkers()));
  const [id, setId] = useState<string | null>(rows[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [instructions, setInstructions] = useState("");
  const [category, setCategory] = useState<AgentCategory>("custom");
  const [tools, setTools] = useState<ToolId[]>(["planner"]);
  const [trigger, setTrigger] = useState<AgentTrigger>("manual");
  const [autonomy, setAutonomy] = useState<AgentAutonomy>("draft");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [usd, setUsd] = useState("25");
  const [symbols, setSymbols] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const automated = useRef(new Set<string>());
  const selected = rows.find((row) => row.id === id) ?? null;
  const visibleRows = rows.filter((row) => {
    const needle = query.trim().toLowerCase();
    return !needle || row.name.toLowerCase().includes(needle) || row.purpose.toLowerCase().includes(needle);
  });
  const activeCount = rows.filter((row) => row.status === "active").length;
  const runCount = rows.reduce((sum, row) => sum + row.runs, 0);

  function refresh(nextId?: string | null) {
    const all = listWorkers();
    setRows(all);
    if (nextId !== undefined) setId(nextId);
    else if (id && all.some((row) => row.id === id)) setId(id);
    else setId(all[0]?.id ?? null);
  }

  function resetBuilder() {
    setId(null);
    setName("");
    setPurpose("");
    setInstructions("");
    setCategory("custom");
    setTools(["planner"]);
    setTrigger("manual");
    setAutonomy("draft");
    setSide("buy");
    setUsd("25");
    setSymbols([]);
  }

  function useStarter(starter: Starter) {
    setName(starter.name === "Start blank" ? "" : starter.name);
    setPurpose(starter.purpose);
    setInstructions(starter.instructions);
    setCategory(starter.category);
    setTools(starter.tools);
    setTrigger(starter.trigger);
    setAutonomy(starter.autonomy);
    setSide(starter.side);
  }

  function toggleTool(tool: ToolId) {
    if (tool === "trade" && autonomy !== "queue") {
      setAutonomy("queue");
      toast.message("Queue actions enabled. The wallet will still require your signature.");
    }
    setTools((current) => (current.includes(tool) ? current.filter((item) => item !== tool) : [...current, tool]));
  }

  function toggleSymbol(symbol: string) {
    setSymbols((current) => (current.includes(symbol) ? current.filter((item) => item !== symbol) : [...current, symbol]));
  }

  function make() {
    if (!purpose.trim()) return toast.error("Tell the agent what outcome you want.");
    const row = createWorker({
      name,
      purpose,
      instructions,
      category,
      tools,
      trigger,
      autonomy,
      symbols,
      maxUsd: Number(usd) || 25,
      side,
    });
    refresh(row.id);
    toast.success(row.name + " is ready. Every wallet action still needs you.");
  }

  function buildChecklist(row: Worker): string[] {
    const goal = row.purpose.replace(/\s+/g, " ").trim();
    const clauses = goal
      .split(/[.;]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 3);
    return [
      "Confirm the outcome: " + (clauses[0] || "Clarify the requested result"),
      clauses[1] ? "Account for: " + clauses[1] : "Gather the inputs available to this agent",
      row.instructions ? "Follow the constraint: " + row.instructions : "Produce the smallest useful result",
      "Review the result before any external or wallet action",
    ];
  }

  function run(row: Worker, automatic = false) {
    if (row.status === "paused") {
      if (!automatic) toast.error("Resume this agent before running it.");
      return;
    }
    const pool = row.symbols.length ? book.filter((name) => row.symbols.includes(name.symbol)) : book;
    const lines: { text: string; kind?: "info" | "action" | "success" }[] = [];
    let queue = row.queue;
    let checklist = row.checklist;

    if (row.tools.includes("planner")) {
      checklist = buildChecklist(row);
      lines.push({ text: "Plan updated with " + checklist.length + " concrete steps.", kind: "success" });
    }
    if (row.tools.includes("notes")) {
      const constraint = row.instructions || "Use the configured goal and require review before external action.";
      lines.push({
        text: "Brief — Goal: " + row.purpose + " Constraint: " + constraint,
        kind: "action",
      });
    }
    if (row.tools.includes("book")) {
      if (!pool.length) lines.push({ text: "The selected live book is empty." });
      else {
        const tape = pool
          .slice(0, 8)
          .map((item) => item.symbol + " " + formatUsd(item.last) + " " + formatPremium(item.premium))
          .join(" · ");
        lines.push({ text: "Live book — " + tape, kind: "action" });
      }
    }
    if (row.tools.includes("trade") && row.autonomy === "queue") {
      const output = think(
        {
          id: row.id,
          name: row.name,
          mandate: row.purpose,
          symbols: row.symbols,
          maxUsd: row.maxUsd,
          side: row.side,
          job: row.side === "sell" ? "rich" : "discount",
          armed: true,
          lastTick: row.lastRunAt,
          queue: null,
          log: [],
        },
        book,
      );
      if (output?.log) lines.push({ text: output.log });
      if (output?.queue) {
        queue = output.queue;
        lines.push({
          text:
            "Queued " +
            output.queue.side +
            " " +
            output.queue.symbol +
            " for $" +
            output.queue.usd +
            ". Waiting for your signature.",
          kind: "action",
        });
      }
    }
    if (row.tools.includes("memory")) {
      const item = pool[0];
      if (item) {
        remember({
          at: new Date().toISOString(),
          symbol: item.symbol,
          side: row.side,
          usd: row.maxUsd,
          premium: item.premium ?? 0,
          change24h: item.change24h ?? 0,
          drawdown: 0,
        });
        lines.push({ text: "Saved the latest " + item.symbol + " observation to local memory." });
      }
    }
    if (!lines.length) lines.push({ text: "No enabled tool produced work on this run." });
    for (const line of lines) logWorker(row.id, line.text, line.kind);
    patchWorker(row.id, {
      queue,
      checklist,
      lastRunAt: new Date().toISOString(),
      runs: row.runs + 1,
    });
    refresh(row.id);
    if (!automatic) toast.success(row.name + " finished its run.");
  }

  useEffect(() => {
    if (!book.length) return;
    for (const row of listWorkers()) {
      const key = row.trigger === "daily" ? row.id + ":" + new Date().toISOString().slice(0, 10) : row.id;
      if (automated.current.has(key) || !isWorkerDue(row)) continue;
      automated.current.add(key);
      run(row, true);
    }
  }, [book]);

  async function sign(row: Worker) {
    if (!row.queue) return toast.error("Nothing is queued.");
    const listing = book.find((item) => item.symbol === row.queue?.symbol);
    if (!listing) return toast.error("That name is not on the live book.");
    setBusy(true);
    try {
      const existing = wallet.w.links.find((link) => link.kind === "phantom" || link.kind === "solana")?.address ?? "";
      const owner = existing || (await connectPhantom());
      if (!existing) {
        const linked = wallet.linkChain(owner, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the wallet address.");
      }
      const done = await runPrestock({
        owner,
        mint: listing.mint,
        side: row.queue.side,
        usd: row.queue.usd,
        price: listing.last,
      });
      logWorker(
        row.id,
        "Wallet signed " + row.queue.side + " " + listing.symbol + " for $" + row.queue.usd + ". " + done.signature.slice(0, 8) + ".",
        "success",
      );
      patchWorker(row.id, { queue: null });
      refresh(row.id);
      toast.success("Signed. " + done.signature.slice(0, 8) + "…");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The wallet did not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-[calc(100dvh-88px)] bg-[#090a10]">
      <header className="border-b border-white/10 px-5 py-5 lg:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] tracking-[0.18em] text-accent uppercase">
              <Sparkles className="size-3.5" />
              Agent studio
            </div>
            <h1 className="mt-2 font-display text-4xl tracking-tight">Build workers, not chatbots.</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/50">
              Give an agent a goal, real tools, a schedule, and a hard approval boundary. It can plan, write, watch the live book, and queue work. You approve every wallet action.
            </p>
          </div>
          <div className="flex items-center gap-5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <MiniStat label="Agents" value={String(rows.length)} />
            <MiniStat label="Active" value={String(activeCount)} />
            <MiniStat label="Runs" value={String(runCount)} />
            <button type="button" onClick={resetBuilder} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg">
              <Plus className="size-4" />
              New agent
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="border-white/10 lg:min-h-[calc(100dvh-220px)] lg:border-r">
          <div className="border-b border-white/10 p-4">
            <label className="flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3">
              <Search className="size-4 text-white/35" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find an agent"
                className="w-full bg-transparent text-sm outline-none placeholder:text-white/30"
              />
            </label>
          </div>
          <ul className="p-2">
            {visibleRows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setId(row.id)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left",
                    id === row.id ? "bg-white/10" : "hover:bg-white/[0.05]",
                  )}
                >
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", row.status === "active" ? "bg-accent/15 text-accent" : "bg-white/5 text-white/35")}>
                    <Bot className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {row.name}
                      <span className={cn("size-1.5 rounded-full", row.status === "active" ? "bg-accent" : "bg-white/25")} />
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-white/35">{CATEGORY_LABELS[row.category]} · {TRIGGER_LABELS[row.trigger]}</span>
                  </span>
                  <ChevronRight className="size-4 text-white/20 group-hover:text-white/50" />
                </button>
              </li>
            ))}
            {!visibleRows.length ? <li className="px-3 py-8 text-center text-sm text-white/35">No agents found.</li> : null}
          </ul>
        </aside>

        <section className="min-w-0 px-5 py-6 lg:px-8">
          {selected ? (
            <AgentDetail
              row={selected}
              onRun={() => run(selected)}
              onToggle={() => {
                patchWorker(selected.id, { status: selected.status === "active" ? "paused" : "active" });
                refresh(selected.id);
              }}
              onDelete={() => {
                dropWorker(selected.id);
                refresh();
                toast.success("Agent removed from this browser.");
              }}
            />
          ) : (
            <Builder
              book={book}
              name={name}
              setName={setName}
              purpose={purpose}
              setPurpose={setPurpose}
              instructions={instructions}
              setInstructions={setInstructions}
              category={category}
              setCategory={setCategory}
              tools={tools}
              toggleTool={toggleTool}
              trigger={trigger}
              setTrigger={setTrigger}
              autonomy={autonomy}
              setAutonomy={(next) => {
                setAutonomy(next);
                if (next !== "queue") setTools((current) => current.filter((tool) => tool !== "trade"));
              }}
              side={side}
              setSide={setSide}
              usd={usd}
              setUsd={setUsd}
              symbols={symbols}
              toggleSymbol={toggleSymbol}
              onStarter={useStarter}
              onCreate={make}
            />
          )}
        </section>

        <aside className="border-white/10 px-5 py-6 lg:border-l">
          <p className="text-[11px] tracking-[0.16em] text-white/40 uppercase">Control room</p>
          {selected ? (
            <>
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {selected.status === "active" ? <Zap className="size-4 text-accent" /> : <CirclePause className="size-4 text-white/40" />}
                  {selected.status === "active" ? "Ready to work" : "Paused"}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-white/45">
                  {selected.queue ? "One wallet action is prepared and waiting for you." : "Runs locally in this browser with the permissions shown."}
                </p>
                <button
                  type="button"
                  onClick={() => run(selected)}
                  disabled={selected.status === "paused"}
                  className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-black disabled:opacity-35"
                >
                  <Play className="size-4 fill-current" />
                  Run now
                </button>
                <button
                  type="button"
                  disabled={!selected.queue || busy}
                  onClick={() => void sign(selected)}
                  className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-accent-fg disabled:opacity-35"
                >
                  <WalletCards className="size-4" />
                  {busy ? "Waiting for wallet" : "Review and sign"}
                </button>
              </div>
              <div className="mt-5 rounded-2xl border border-accent/20 bg-accent/[0.06] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-accent">
                  <ShieldCheck className="size-4" />
                  Approval boundary
                </div>
                <p className="mt-2 text-xs leading-relaxed text-white/50">
                  Agents may prepare work. They cannot sign, move funds, or bypass the configured dollar cap.
                </p>
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <BrainCircuit className="size-5 text-accent" />
              <p className="mt-3 text-sm font-medium">Design the job first.</p>
              <p className="mt-2 text-xs leading-relaxed text-white/45">Choose a template or start blank, then grant only the tools the job needs.</p>
            </div>
          )}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <p className="text-[11px] tracking-[0.16em] text-white/40 uppercase">Live book</p>
              <span className="flex items-center gap-1.5 text-[10px] text-accent"><span className="senda-dot size-1.5 rounded-full bg-accent" />Live</span>
            </div>
            <ul className="mt-3 space-y-2">
              {book.slice(0, 8).map((item) => (
                <li key={item.symbol} className="flex items-baseline justify-between rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
                  <span>{item.symbol}</span>
                  <span className="font-mono text-xs text-white/50">{formatUsd(item.last)}</span>
                </li>
              ))}
              {!book.length ? <li className="text-xs text-white/35">Waiting for the live print.</li> : null}
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}

function AgentDetail({
  row,
  onRun,
  onToggle,
  onDelete,
}: {
  row: Worker;
  onRun: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="senda-rise">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] tracking-[0.16em] text-accent uppercase">
            <span className={cn("size-1.5 rounded-full", row.status === "active" ? "bg-accent" : "bg-white/30")} />
            {row.status} · {CATEGORY_LABELS[row.category]}
          </div>
          <h2 className="mt-2 text-4xl">{row.name}</h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/65">{row.purpose}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onToggle} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm">
            {row.status === "active" ? <Pause className="size-4" /> : <Play className="size-4" />}
            {row.status === "active" ? "Pause" : "Resume"}
          </button>
          <button type="button" onClick={onDelete} aria-label="Delete agent" className="grid size-10 place-items-center rounded-xl border border-white/10 text-white/45 hover:text-down">
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <dl className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<Clock3 className="size-4" />} label="Trigger" value={TRIGGER_LABELS[row.trigger]} />
        <Stat icon={<ShieldCheck className="size-4" />} label="Autonomy" value={AUTONOMY_LABELS[row.autonomy]} />
        <Stat icon={<Activity className="size-4" />} label="Runs" value={String(row.runs)} />
        <Stat icon={<WalletCards className="size-4" />} label="Action cap" value={"$" + row.maxUsd} />
      </dl>

      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="flex items-center gap-2">
              <ListChecks className="size-4 text-accent" />
              <h3 className="text-base">Current plan</h3>
            </div>
            {row.checklist.length ? (
              <ol className="mt-4 space-y-3">
                {row.checklist.map((item, index) => (
                  <li key={item} className="flex gap-3 text-sm text-white/65">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/8 text-[10px] text-white/45">{index + 1}</span>
                    {item}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-white/35">Run the agent to create its first working plan.</p>
            )}
          </section>

          <section className="mt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] tracking-[0.16em] text-white/40 uppercase">Activity</p>
                <h3 className="mt-1 text-xl">Run history</h3>
              </div>
              <button type="button" onClick={onRun} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-black">
                <Play className="size-3.5 fill-current" />
                Run
              </button>
            </div>
            {row.log.length ? (
              <ul className="mt-4 space-y-2">
                {row.log.map((line, index) => (
                  <li key={line.at + index} className="rounded-2xl border border-white/8 bg-[#11131b] px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", line.kind === "success" ? "bg-accent" : line.kind === "action" ? "bg-sol" : "bg-white/30")} />
                      <div>
                        <p className="text-sm leading-relaxed text-white/70">{line.text}</p>
                        <p className="mt-1 font-mono text-[10px] text-white/25">{new Date(line.at).toLocaleString()}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center text-sm text-white/35">No runs yet.</div>
            )}
          </section>
        </div>

        <div>
          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <p className="text-[11px] tracking-[0.14em] text-white/40 uppercase">Permissions</p>
            <ul className="mt-3 space-y-2">
              {row.tools.map((tool) => {
                const item = TOOLS.find((entry) => entry.id === tool);
                return (
                  <li key={tool} className="flex items-start gap-2 rounded-xl bg-white/[0.04] px-3 py-2.5">
                    <Check className="mt-0.5 size-3.5 text-accent" />
                    <div>
                      <p className="text-xs font-medium">{item?.label}</p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-white/35">{item?.line}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
          {row.instructions ? (
            <section className="mt-4 rounded-2xl border border-white/10 p-4">
              <p className="text-[11px] tracking-[0.14em] text-white/40 uppercase">Instructions</p>
              <p className="mt-3 text-xs leading-relaxed text-white/55">{row.instructions}</p>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type BuilderProps = {
  book: HouseListing[];
  name: string;
  setName: (value: string) => void;
  purpose: string;
  setPurpose: (value: string) => void;
  instructions: string;
  setInstructions: (value: string) => void;
  category: AgentCategory;
  setCategory: (value: AgentCategory) => void;
  tools: ToolId[];
  toggleTool: (value: ToolId) => void;
  trigger: AgentTrigger;
  setTrigger: (value: AgentTrigger) => void;
  autonomy: AgentAutonomy;
  setAutonomy: (value: AgentAutonomy) => void;
  side: "buy" | "sell";
  setSide: (value: "buy" | "sell") => void;
  usd: string;
  setUsd: (value: string) => void;
  symbols: string[];
  toggleSymbol: (value: string) => void;
  onStarter: (starter: Starter) => void;
  onCreate: () => void;
};

function Builder(props: BuilderProps) {
  return (
    <div className="senda-rise">
      <div>
        <p className="text-[11px] tracking-[0.16em] text-white/40 uppercase">Choose a starting point</p>
        <h2 className="mt-2 text-3xl">What should this agent own?</h2>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {STARTERS.map((starter) => (
          <button
            key={starter.name}
            type="button"
            onClick={() => props.onStarter(starter)}
            className="group rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-left hover:border-accent/30 hover:bg-accent/[0.04]"
          >
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-xl bg-white/8 text-white/60 group-hover:bg-accent/15 group-hover:text-accent">
                {starter.category === "markets" ? <Activity className="size-4" /> : starter.category === "research" ? <Search className="size-4" /> : starter.category === "content" ? <FileText className="size-4" /> : <Bot className="size-4" />}
              </span>
              <ChevronRight className="size-4 text-white/20" />
            </div>
            <p className="mt-3 text-sm font-semibold">{starter.name}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/40">{starter.purpose || "Design every part yourself."}</p>
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <BuilderSection number="01" title="Identity and outcome">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <input value={props.name} onChange={(event) => props.setName(event.target.value)} placeholder="Research desk" className="agent-input" />
              </Field>
              <Field label="Team">
                <select value={props.category} onChange={(event) => props.setCategory(event.target.value as AgentCategory)} className="agent-input appearance-none">
                  {(Object.keys(CATEGORY_LABELS) as AgentCategory[]).map((item) => <option key={item} value={item}>{CATEGORY_LABELS[item]}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Goal">
              <textarea value={props.purpose} onChange={(event) => props.setPurpose(event.target.value)} rows={4} placeholder="Describe the outcome this agent owns. Be specific about what done means." className="agent-input py-3" />
            </Field>
            <Field label="Operating instructions">
              <textarea value={props.instructions} onChange={(event) => props.setInstructions(event.target.value)} rows={3} placeholder="Tone, constraints, sources, quality bar, and what it should never do." className="agent-input py-3" />
            </Field>
          </BuilderSection>

          <BuilderSection number="02" title="Tools and permissions">
            <div className="grid gap-2 sm:grid-cols-2">
              {TOOLS.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => props.toggleTool(tool.id)}
                  className={cn("rounded-2xl border p-4 text-left", props.tools.includes(tool.id) ? "border-accent/35 bg-accent/[0.08]" : "border-white/10 bg-white/[0.025]")}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{tool.label}</span>
                    <span className={cn("grid size-5 place-items-center rounded-full border", props.tools.includes(tool.id) ? "border-accent bg-accent text-accent-fg" : "border-white/20")}>
                      {props.tools.includes(tool.id) ? <Check className="size-3" /> : null}
                    </span>
                  </div>
                  <span className="mt-2 block text-xs leading-relaxed text-white/40">{tool.line}</span>
                </button>
              ))}
            </div>
          </BuilderSection>

          <BuilderSection number="03" title="Automation and limits">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Trigger">
                <select value={props.trigger} onChange={(event) => props.setTrigger(event.target.value as AgentTrigger)} className="agent-input appearance-none">
                  {(Object.keys(TRIGGER_LABELS) as AgentTrigger[]).map((item) => <option key={item} value={item}>{TRIGGER_LABELS[item]}</option>)}
                </select>
              </Field>
              <Field label="Autonomy">
                <select value={props.autonomy} onChange={(event) => props.setAutonomy(event.target.value as AgentAutonomy)} className="agent-input appearance-none">
                  {(Object.keys(AUTONOMY_LABELS) as AgentAutonomy[]).map((item) => <option key={item} value={item}>{AUTONOMY_LABELS[item]}</option>)}
                </select>
              </Field>
            </div>
            {props.autonomy === "queue" ? (
              <div className="rounded-2xl border border-accent/20 bg-accent/[0.05] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-accent"><ShieldCheck className="size-4" />Action envelope</div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input value={props.usd} onChange={(event) => props.setUsd(event.target.value)} inputMode="decimal" aria-label="Maximum dollars per action" className="agent-input max-w-28" />
                  <button type="button" onClick={() => props.setSide("buy")} className={cn("min-h-11 rounded-xl px-4 text-sm", props.side === "buy" ? "bg-white text-black" : "bg-white/8")}>Buy</button>
                  <button type="button" onClick={() => props.setSide("sell")} className={cn("min-h-11 rounded-xl px-4 text-sm", props.side === "sell" ? "bg-white text-black" : "bg-white/8")}>Sell</button>
                  <span className="text-xs text-white/40">Maximum per queued action. Signing is never delegated.</span>
                </div>
              </div>
            ) : null}
            {props.tools.some((tool) => tool === "book" || tool === "trade" || tool === "memory") ? (
              <div>
                <p className="text-[11px] tracking-[0.14em] text-white/40 uppercase">Watchlist · leave empty for the whole book</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {props.book.map((item) => (
                    <button key={item.symbol} type="button" onClick={() => props.toggleSymbol(item.symbol)} className={cn("min-h-9 rounded-xl px-3 text-xs", props.symbols.includes(item.symbol) ? "bg-white text-black" : "bg-white/8")}>{item.symbol}</button>
                  ))}
                </div>
              </div>
            ) : null}
          </BuilderSection>
        </div>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <div className="rounded-2xl border border-white/10 bg-[#11131b] p-5">
            <p className="text-[11px] tracking-[0.14em] text-white/40 uppercase">Agent contract</p>
            <h3 className="mt-2 text-xl">{props.name || "Untitled agent"}</h3>
            <p className="mt-3 text-xs leading-relaxed text-white/45">{props.purpose || "Add a goal to define what this agent owns."}</p>
            <dl className="mt-5 space-y-3 border-t border-white/10 pt-4">
              <SummaryRow label="Team" value={CATEGORY_LABELS[props.category]} />
              <SummaryRow label="Trigger" value={TRIGGER_LABELS[props.trigger]} />
              <SummaryRow label="Autonomy" value={AUTONOMY_LABELS[props.autonomy]} />
              <SummaryRow label="Tools" value={String(props.tools.length)} />
            </dl>
            <div className="mt-5 rounded-xl bg-accent/[0.07] p-3 text-xs leading-relaxed text-white/50">
              <ShieldCheck className="mb-2 size-4 text-accent" />
              Wallet signing always stays with the user, even when the agent can queue an action.
            </div>
            <button type="button" onClick={props.onCreate} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-accent-fg">
              Create agent
              <ChevronRight className="size-4" />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function BuilderSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <span className="font-mono text-[10px] text-accent">{number}</span>
        <h3 className="text-lg">{title}</h3>
        <span className="h-px flex-1 bg-white/10" />
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] tracking-[0.14em] text-white/40 uppercase">{label}</span>
      {children}
    </label>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3">
      <dt className="flex items-center gap-2 text-[10px] tracking-[0.12em] text-white/35 uppercase">{icon}{label}</dt>
      <dd className="mt-2 text-sm font-medium">{value}</dd>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="font-mono text-base">{value}</p>
      <p className="text-[10px] tracking-[0.1em] text-white/35 uppercase">{label}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      <dt className="text-white/35">{label}</dt>
      <dd className="text-right text-white/70">{value}</dd>
    </div>
  );
}
