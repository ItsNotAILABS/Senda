import { useMemo, useState } from "react";
import { toast } from "sonner";
import { think } from "@/lib/agent-shift";
import { remember } from "@/lib/agent-memory";
import {
  TOOLS,
  createWorker,
  dropWorker,
  listWorkers,
  logWorker,
  patchWorker,
  type ToolId,
  type Worker,
} from "@/lib/agent-workspace";
import { connectPhantom } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const STARTERS: { name: string; purpose: string; tools: ToolId[]; side: "buy" | "sell" }[] = [
  {
    name: "Buyer",
    purpose: "Watch the book. When a name is cheap versus its mark, queue a buy at my size. Do not sign.",
    tools: ["book", "trade", "memory"],
    side: "buy",
  },
  {
    name: "Clerk",
    purpose: "Read the book and write what moved. Do not queue a trade.",
    tools: ["book", "memory"],
    side: "buy",
  },
  {
    name: "Blank",
    purpose: "",
    tools: ["book"],
    side: "buy",
  },
];

export function AgentWorkspace({ names }: { names: HouseListing[] }) {
  const book = useMemo(() => names.filter((n) => n.venue === "prestocks" && n.last > 0), [names]);
  const wallet = useWallet();
  const [rows, setRows] = useState<Worker[]>(() => (typeof window === "undefined" ? [] : listWorkers()));
  const [id, setId] = useState<string | null>(rows[0]?.id ?? null);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [tools, setTools] = useState<ToolId[]>(["book"]);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [usd, setUsd] = useState("25");
  const [symbols, setSymbols] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const selected = rows.find((r) => r.id === id) ?? null;

  function refresh(nextId?: string) {
    const all = listWorkers();
    setRows(all);
    setId(nextId ?? all[0]?.id ?? null);
  }

  function toggleTool(tool: ToolId) {
    setTools((cur) => (cur.includes(tool) ? cur.filter((t) => t !== tool) : [...cur, tool]));
  }

  function toggleSymbol(symbol: string) {
    setSymbols((cur) => (cur.includes(symbol) ? cur.filter((s) => s !== symbol) : [...cur, symbol]));
  }

  function make() {
    if (!purpose.trim()) return toast.error("Write what this agent is for.");
    const row = createWorker({
      name,
      purpose,
      tools,
      symbols,
      maxUsd: Number(usd) || 25,
      side,
    });
    setName("");
    setPurpose("");
    refresh(row.id);
    toast.success(`${row.name} is in the workspace. Nothing signs until you do.`);
  }

  function run(row: Worker) {
    const pool = row.symbols.length ? book.filter((n) => row.symbols.includes(n.symbol)) : book;
    const lines: string[] = [row.purpose || "No purpose written."];
    if (row.tools.includes("book")) {
      if (!pool.length) lines.push("The book is empty.");
      else lines.push(pool.map((n) => `${n.symbol} ${formatUsd(n.last)} ${formatPremium(n.premium)}`).join(" · "));
    }
    let queue = row.queue;
    if (row.tools.includes("trade")) {
      const out = think(
        {
          id: row.id,
          name: row.name,
          mandate: row.purpose,
          symbols: row.symbols,
          maxUsd: row.maxUsd,
          side: row.side,
          job: row.side === "sell" ? "rich" : "discount",
          armed: true,
          lastTick: "",
          queue: null,
          log: [],
        },
        book,
      );
      if (out?.log) lines.push(out.log);
      if (out?.queue) {
        queue = out.queue;
        lines.push(`Queued ${out.queue.side} ${out.queue.symbol} $${out.queue.usd}. Waiting for a signature.`);
      }
    }
    if (row.tools.includes("memory")) {
      const name = pool[0];
      if (name) {
        remember({
          at: new Date().toISOString(),
          symbol: name.symbol,
          side: row.side,
          usd: row.maxUsd,
          premium: name.premium ?? 0,
          change24h: name.change24h ?? 0,
          drawdown: 0,
        });
        lines.push(`Remembered ${name.symbol}.`);
      }
    }
    for (const line of lines) logWorker(row.id, line);
    patchWorker(row.id, { queue });
    refresh(row.id);
  }

  async function sign(row: Worker) {
    if (!row.queue) return toast.error("Nothing is queued.");
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
      const done = await runPrestock({
        owner: who,
        mint: name.mint,
        side: row.queue.side,
        usd: row.queue.usd,
        price: name.last,
      });
      logWorker(row.id, `Signed ${row.queue.side} ${name.symbol} $${row.queue.usd}. ${done.signature.slice(0, 8)}.`);
      patchWorker(row.id, { queue: null });
      refresh(row.id);
      toast.success(`Signed. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-[calc(100dvh-88px)] lg:grid-cols-[260px_minmax(0,1fr)_320px]">
      <aside className="border-white/10 lg:border-r">
        <div className="flex items-center justify-between px-4 py-4">
          <p className="text-[11px] tracking-[0.16em] text-white/40 uppercase">Agents</p>
          <button type="button" onClick={() => setId(null)} className="text-sm text-accent">
            New
          </button>
        </div>
        <ul>
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setId(row.id)}
                className={cn("block w-full px-4 py-3 text-left", id === row.id ? "bg-white/8" : "hover:bg-white/5")}
              >
                <span className="block text-sm font-medium">{row.name}</span>
                <span className="mt-1 block truncate text-xs text-white/40">{row.purpose || "No purpose yet"}</span>
              </button>
            </li>
          ))}
          {rows.length === 0 ? <li className="px-4 py-6 text-sm text-white/40">None yet.</li> : null}
        </ul>
      </aside>

      <section className="px-5 py-5 lg:px-8">
        {selected ? (
          <>
            <p className="text-[11px] tracking-[0.16em] text-white/40 uppercase">Workspace</p>
            <h1 className="mt-2 font-display text-4xl tracking-tight">{selected.name}</h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/70">{selected.purpose}</p>
            <dl className="mt-6 grid gap-3 sm:grid-cols-3">
              <Stat k="Size" v={`$${selected.maxUsd}`} />
              <Stat k="Side" v={selected.side} />
              <Stat k="Watches" v={selected.symbols.length ? selected.symbols.join(" ") : "The whole book"} />
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              {selected.tools.map((t) => (
                <span key={t} className="rounded-full bg-white/8 px-3 py-1 text-xs">
                  {TOOLS.find((x) => x.id === t)?.label}
                </span>
              ))}
            </div>
            <div className="mt-8">
              <p className="text-[11px] tracking-[0.16em] text-white/40 uppercase">Run log</p>
              {selected.log.length === 0 ? <p className="mt-3 text-sm text-white/40">No run yet.</p> : null}
              <ul className="mt-3 space-y-2">
                {selected.log.map((line, i) => (
                  <li key={`${line.at}-${i}`} className="rounded-2xl bg-[#14141c] px-4 py-3 text-sm text-white/75">
                    {line.text}
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={() => {
                dropWorker(selected.id);
                refresh();
              }}
              className="mt-6 text-sm text-white/40"
            >
              Delete this agent
            </button>
          </>
        ) : (
          <>
            <h1 className="font-display text-4xl tracking-tight xl:text-5xl">Make an agent for whatever you need.</h1>
            <p className="mt-3 max-w-xl text-[15px] text-white/55">
              Write what it is for. Pick what it is allowed to do. A run reads the live book. A trade waits for your signature.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => {
                    setName(s.name === "Blank" ? "" : s.name);
                    setPurpose(s.purpose);
                    setTools(s.tools);
                    setSide(s.side);
                  }}
                  className="min-h-10 rounded-full bg-white/8 px-4 text-sm"
                >
                  {s.name}
                </button>
              ))}
            </div>
            <label className="mt-6 block">
              <span className="text-[11px] tracking-[0.16em] text-white/40 uppercase">Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Buyer, clerk, fund watcher" className="mt-2 min-h-12 w-full rounded-2xl bg-[#14141c] px-4 text-sm outline-none" />
            </label>
            <label className="mt-3 block">
              <span className="text-[11px] tracking-[0.16em] text-white/40 uppercase">What it is for</span>
              <textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                rows={5}
                placeholder="Watch OpenAI. If it is cheap, queue a buy. Or: write the book every time I open this. Or anything else you want it to do with the tools below."
                className="mt-2 w-full rounded-2xl bg-[#14141c] px-4 py-3 text-sm leading-relaxed outline-none"
              />
            </label>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {TOOLS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTool(t.id)}
                  className={cn("rounded-2xl px-4 py-3 text-left", tools.includes(t.id) ? "bg-accent text-accent-fg" : "bg-[#14141c]")}
                >
                  <span className="block text-sm font-medium">{t.label}</span>
                  <span className="mt-1 block text-xs opacity-70">{t.line}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {book.map((n) => (
                <button
                  key={n.symbol}
                  type="button"
                  onClick={() => toggleSymbol(n.symbol)}
                  className={cn("min-h-9 rounded-full px-3 text-xs", symbols.includes(n.symbol) ? "bg-white text-black" : "bg-white/8")}
                >
                  {n.symbol}
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <input value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal" aria-label="Max size" className="min-h-11 w-24 rounded-2xl bg-[#14141c] px-3 font-mono text-sm outline-none" />
              <button type="button" onClick={() => setSide("buy")} className={cn("min-h-11 rounded-full px-4 text-sm", side === "buy" ? "bg-white text-black" : "bg-white/8")}>
                Buy
              </button>
              <button type="button" onClick={() => setSide("sell")} className={cn("min-h-11 rounded-full px-4 text-sm", side === "sell" ? "bg-white text-black" : "bg-white/8")}>
                Sell
              </button>
              <button type="button" onClick={make} className="min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">
                Create agent
              </button>
            </div>
          </>
        )}
      </section>

      <aside className="border-white/10 px-5 py-5 lg:border-l">
        <p className="text-[11px] tracking-[0.16em] text-white/40 uppercase">Run</p>
        {selected ? (
          <>
            <p className="mt-3 text-sm text-white/60">
              {selected.queue
                ? `Ready to sign ${selected.queue.side} ${selected.queue.symbol} for $${selected.queue.usd}.`
                : "A run writes the log. It does not sign."}
            </p>
            <button type="button" onClick={() => run(selected)} className="mt-4 min-h-11 w-full rounded-full bg-white text-sm font-semibold text-black">
              Run
            </button>
            <button
              type="button"
              disabled={!selected.queue || busy}
              onClick={() => void sign(selected)}
              className="mt-2 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40"
            >
              {busy ? "Waiting on the wallet" : "Sign the queued trade"}
            </button>
          </>
        ) : (
          <p className="mt-3 text-sm text-white/45">Create an agent, then run it from here.</p>
        )}
        <div className="mt-6">
          <p className="text-[11px] tracking-[0.16em] text-white/40 uppercase">Live book</p>
          <ul className="mt-2 space-y-2">
            {book.slice(0, 8).map((n) => (
              <li key={n.symbol} className="flex items-baseline justify-between text-sm">
                <span>{n.symbol}</span>
                <span className="font-mono text-xs text-white/50">{formatUsd(n.last)}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </main>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl bg-[#14141c] px-4 py-3">
      <dt className="text-[11px] tracking-[0.14em] text-white/40 uppercase">{k}</dt>
      <dd className="mt-1 text-sm">{v}</dd>
    </div>
  );
}
