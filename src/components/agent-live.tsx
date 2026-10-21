import { useState } from "react";
import { toast } from "sonner";
import { createWorker, listWorkers, logWorker, type AgentAutonomy, type AgentCategory, type ToolId, type Worker } from "@/lib/agent-workspace";
import { formatUsd, type HouseListing } from "@/lib/sol-house";
import { cn } from "@/lib/utils";

const JOBS: {
  id: string;
  name: string;
  line: string;
  category: AgentCategory;
  tools: ToolId[];
  autonomy: AgentAutonomy;
  example: string;
}[] = [
  {
    id: "analysis",
    name: "Financial analysis",
    line: "Reads the live book and writes who is cheap, who is rich, and where the pool is thin.",
    category: "markets",
    tools: ["book", "notes"],
    autonomy: "observe",
    example: "Read the live book. Name who is cheap, who is rich, and where the pool is thin.",
  },
  {
    id: "marketing",
    name: "Marketing",
    line: "Turns what you sell into an audience, an offer, a channel, and the next thing to publish.",
    category: "content",
    tools: ["notes", "planner"],
    autonomy: "draft",
    example: "Turn the book into an audience, an offer, a channel, and the next thing to publish.",
  },
  {
    id: "business",
    name: "Business",
    line: "Writes the unit you sell, the constraint, and the decision sitting in front of you.",
    category: "operations",
    tools: ["planner", "notes"],
    autonomy: "draft",
    example: "Write the unit we sell, the constraint, and the decision in front of us.",
  },
  {
    id: "decision",
    name: "Decision",
    line: "Lays the options out and names what would change the call. It does not pick for you.",
    category: "research",
    tools: ["notes"],
    autonomy: "draft",
    example: "Lay the options out. Name what would change the call. Do not pick.",
  },
  {
    id: "portfolio",
    name: "Portfolio",
    line: "Reads the names you care about against the live book. It does not need a size, and it does not sign.",
    category: "markets",
    tools: ["book", "notes"],
    autonomy: "observe",
    example: "Read the names on the live book. Do not ask for a size and do not sign.",
  },
  {
    id: "travel",
    name: "Travel",
    line: "Builds the trip from the cities, the dates, and the budget you actually wrote.",
    category: "personal",
    tools: ["planner", "notes"],
    autonomy: "draft",
    example: "Build the trip from the cities, the dates, and the budget I wrote.",
  },
  {
    id: "economics",
    name: "Economics",
    line: "Frames the question, then checks any name you mentioned against the live print.",
    category: "research",
    tools: ["book", "notes"],
    autonomy: "observe",
    example: "Frame the question, then check any name I mentioned against the live print.",
  },
  {
    id: "trading",
    name: "Trading desk",
    line: "Can queue a buy or a sell once you set a size. Until then it only reads. You still sign.",
    category: "markets",
    tools: ["book", "trade"],
    autonomy: "queue",
    example: "Read the book. Queue a buy only after I set a size. Do not sign.",
  },
  {
    id: "research",
    name: "Research",
    line: "Keeps a question, a finding, and what to read next. You come back to the same note.",
    category: "research",
    tools: ["notes", "memory"],
    autonomy: "draft",
    example: "Keep a question, a finding, and what to read next.",
  },
];

function firstNote(jobId: string, names: HouseListing[], size: number): string {
  const live = names.filter((n) => n.venue === "prestocks" && n.last > 0);
  const byPrem = [...live].sort((a, b) => (a.premium ?? 0) - (b.premium ?? 0));
  const cheap = byPrem[0];
  const rich = byPrem[byPrem.length - 1];
  const thin = [...live].sort((a, b) => a.liquidity - b.liquidity)[0];
  if (!cheap || !rich) return "The book had no live print, so this run wrote nothing.";
  if (jobId === "analysis" || jobId === "portfolio" || jobId === "economics" || jobId === "trading") {
    const book = `${cheap.symbol} is cheap at ${formatUsd(cheap.last)} versus its mark. ${rich.symbol} is rich at ${formatUsd(rich.last)}. ${thin ? `${thin.symbol} has the thinnest pool.` : ""}`;
    if (jobId === "trading" && size > 0) return `${book} A $${size} buy is queued. You still sign it.`;
    if (jobId === "trading") return `${book} No size is set, so nothing is queued.`;
    return book;
  }
  if (jobId === "marketing") return `The offer is the live print. ${cheap.symbol} is the cheap name to lead with. Next is a post, not a signature.`;
  if (jobId === "research") return `Question: what is the print saying. Finding: ${cheap.symbol} is under its mark and ${rich.symbol} is over it. Read those two next.`;
  return `Noted. ${cheap.symbol} at ${formatUsd(cheap.last)} is the cheap print on the book. Nothing was signed.`;
}

export function AgentLive({ names }: { names: HouseListing[] }) {
  const [rows, setRows] = useState<Worker[]>(() => (typeof window === "undefined" ? [] : listWorkers()));
  const [jobId, setJobId] = useState(JOBS[0].id);
  const [name, setName] = useState("");
  const [job, setJob] = useState("");
  const [size, setSize] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const picked = JOBS.find((j) => j.id === jobId) ?? JOBS[0];
  const selected = rows.find((r) => r.id === open) ?? null;

  function refresh(id?: string) {
    const next = listWorkers();
    setRows(next);
    if (id) setOpen(id);
  }

  function useExample() {
    setName(picked.name);
    setJob(picked.example);
  }

  function make() {
    const purpose = (job || picked.example).trim();
    if (!purpose) {
      toast.error("Tell it the job.");
      return;
    }
    const row = createWorker({
      name: name.trim() || picked.name,
      purpose,
      category: picked.category,
      tools: [...picked.tools],
      trigger: "manual",
      autonomy: picked.autonomy,
      symbols: names.filter((n) => n.venue === "prestocks" && n.last > 0).slice(0, 8).map((n) => n.symbol),
      maxUsd: picked.id === "trading" && size > 0 ? size : 25,
      side: "buy",
    });
    logWorker(row.id, firstNote(picked.id, names, size), "success");
    toast.success(`${row.name} ran once. It stays in this browser.`);
    setName("");
    setJob("");
    refresh(row.id);
  }

  return (
    <div className="grid gap-3 px-3 py-3 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-4">
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Agent</p>
          <button type="button" onClick={() => setOpen(null)} className="text-xs font-semibold text-accent">
            + New
          </button>
        </div>
        <ul className="mt-3 space-y-1">
          {rows.length === 0 ? <li className="text-sm text-muted">None yet.</li> : null}
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setOpen(r.id)}
                className={cn("w-full rounded-xl px-3 py-2 text-left text-sm", open === r.id ? "bg-white/10" : "hover:bg-white/5")}
              >
                <span className="font-semibold">{r.name}</span>
                <span className="mt-0.5 block truncate text-[11px] text-subtle">{r.purpose}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5 sm:p-8">
        <p className="font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">Agents · Trading</p>
        <h1 className="mt-2 text-4xl tracking-tight">Name it. Tell it the job. Come back to it.</h1>
        <p className="mt-3 max-w-xl text-sm text-muted">
          Make one for the job. Not for a size. Money is not required. A trading agent can take a size later, and even then you sign.
        </p>
        {selected ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-sm font-semibold">{selected.name}</p>
            <p className="mt-1 text-sm text-muted">{selected.purpose}</p>
            <ul className="mt-4 space-y-2">
              {selected.log.map((line, i) => (
                <li key={`${line.at}-${i}`} className="text-sm">
                  {line.text}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {JOBS.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => setJobId(j.id)}
                  className={cn("rounded-2xl border px-3 py-3 text-left", jobId === j.id ? "border-accent bg-accent/10" : "border-white/10")}
                >
                  <span className="text-sm font-semibold">{j.name}</span>
                  <span className="mt-1 block text-xs text-muted">{j.line}</span>
                </button>
              ))}
            </div>
            <label className="mt-5 block text-xs text-subtle">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={picked.name} className="mt-1 min-h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-3 text-sm outline-none" />
            </label>
            <label className="mt-3 block text-xs text-subtle">
              Job
              <textarea value={job} onChange={(e) => setJob(e.target.value)} placeholder={picked.example} rows={3} className="mt-1 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none" />
            </label>
            {picked.id === "trading" ? (
              <label className="mt-3 block text-xs text-subtle">
                Size, optional
                <input inputMode="decimal" value={size || ""} onChange={(e) => setSize(Number(e.target.value) || 0)} placeholder="0" className="mt-1 min-h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-3 font-mono text-sm outline-none" />
              </label>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={useExample} className="min-h-11 rounded-full border border-white/10 px-4 text-sm font-semibold">
                Use the example
              </button>
              <button type="button" onClick={make} className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">
                Make this agent
              </button>
            </div>
            <p className="mt-3 text-xs text-muted">It runs once as soon as it exists. It stays in this browser, so you can come back to it. Nothing here asks the wallet.</p>
          </>
        )}
      </section>
    </div>
  );
}
