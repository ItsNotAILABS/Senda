import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PrintChart } from "@/components/print-chart";
import { PrintTape } from "@/components/print-tape";
import {
  dropPaperAgent,
  hirePaperAgent,
  listPaperAgents,
  listPaperFills,
  paperPnl,
  patchPaperAgent,
  recordPaperFill,
  type PaperAgent,
  type PaperFill,
  type PaperRule,
} from "@/lib/paper-book";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { LiveAgent } from "@/components/live-agent";
import { cn } from "@/lib/utils";

const RULES: { id: PaperRule; label: string; line: string }[] = [
  { id: "cheap", label: "Buy cheap", line: "Paper buy when the print is under the mark." },
  { id: "rich", label: "Sell rich", line: "Paper sell when the print is over the mark." },
  { id: "either", label: "Either", line: "Buy the cheap print. Sell the rich one." },
];

function hit(rule: PaperRule, premium: number | null): "buy" | "sell" | null {
  if (premium == null) return null;
  if ((rule === "cheap" || rule === "either") && premium <= -0.01) return "buy";
  if ((rule === "rich" || rule === "either") && premium >= 0.01) return "sell";
  return null;
}

export function TradeAgents({ names }: { names: HouseListing[] }) {
  const book = useMemo(() => names.filter((n) => n.last > 0), [names]);
  const [agents, setAgents] = useState<PaperAgent[]>([]);
  const [fills, setFills] = useState<PaperFill[]>([]);
  const [id, setId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [rule, setRule] = useState<PaperRule>("cheap");
  const [size, setSize] = useState(25);
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"live" | "paper">("live");

  function load(next?: string | null) {
    const rows = listPaperAgents();
    setAgents(rows);
    setFills(listPaperFills());
    setId(next === undefined ? (id && rows.some((r) => r.id === id) ? id : (rows[0]?.id ?? null)) : next);
  }

  useEffect(() => {
    const rows = listPaperAgents();
    setAgents(rows);
    setFills(listPaperFills());
    setId(rows[0]?.id ?? null);
    if (book[0] && !symbol) setSymbol(book[0].symbol);
  }, [book, symbol]);

  const selected = agents.find((a) => a.id === id) ?? null;
  const focus = book.find((n) => n.symbol === (selected?.symbol || symbol)) ?? null;

  function take(agent: PaperAgent, side: "buy" | "sell", why: string) {
    const row = book.find((n) => n.symbol === agent.symbol);
    if (!row || !(row.last > 0)) {
      setNote("No live print.");
      return;
    }
    recordPaperFill({ agentId: agent.id, agent: agent.name, symbol: row.symbol, side, usd: agent.size, px: row.last });
    load(agent.id);
    setNote(`${why} Paper ${side} $${agent.size} of ${row.symbol} at ${formatUsd(row.last)}. Not signed.`);
  }

  useEffect(() => {
    const t = window.setInterval(() => {
      for (const agent of listPaperAgents()) {
        if (!agent.armed) continue;
        if (Date.now() - agent.lastFillAt < 15 * 60 * 1000) continue;
        const row = book.find((n) => n.symbol === agent.symbol);
        const side = hit(agent.rule, row?.premium ?? null);
        if (!row || !side) continue;
        recordPaperFill({ agentId: agent.id, agent: agent.name, symbol: row.symbol, side, usd: agent.size, px: row.last });
      }
      setAgents(listPaperAgents());
      setFills(listPaperFills());
    }, 60_000);
    return () => window.clearInterval(t);
  }, [book]);

  const equity = 10_000 + fills.reduce((s, f) => s + (paperPnl(f.side, f.px, book.find((n) => n.symbol === f.symbol)?.last || 0, f.usd) || 0), 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#05060a] text-white">
      <div className="flex gap-1 border-b border-white/10 px-3 py-2">
        <button type="button" onClick={() => setMode("live")} className={cn("h-8 rounded-full px-3 text-xs font-semibold", mode === "live" ? "bg-white text-black" : "text-white/50")}>Live $5</button>
        <button type="button" onClick={() => setMode("paper")} className={cn("h-8 rounded-full px-3 text-xs font-semibold", mode === "paper" ? "bg-white text-black" : "text-white/50")}>Paper</button>
      </div>
      {mode === "live" ? <LiveAgent /> : (
      <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid min-h-0 flex-1 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
        <aside className="border-r border-white/10 p-3">
          <p className="font-mono text-[10px] tracking-[0.16em] text-white/35 uppercase">Hired</p>
          <div className="mt-2 space-y-1">
            {agents.map((a) => (
              <button key={a.id} type="button" onClick={() => setId(a.id)} className={cn("flex w-full items-center justify-between rounded-xl px-2 py-2 text-left", a.id === id ? "bg-white/10" : "hover:bg-white/5")}>
                <span>
                  <span className="block text-sm font-semibold">{a.name}</span>
                  <span className="font-mono text-[11px] text-white/40">{a.symbol} · {a.rule}</span>
                </span>
                <span className={cn("h-1.5 w-1.5 rounded-full", a.armed ? "bg-accent" : "bg-white/20")} />
              </button>
            ))}
            {!agents.length ? <p className="px-2 py-3 text-sm text-white/40">No one hired.</p> : null}
          </div>
        </aside>
        <div className="min-w-0 p-3">
          {focus ? <PrintChart mint={focus.mint} symbol={focus.symbol} className="h-[380px]" /> : <div className="flex h-[380px] items-center justify-center text-sm text-white/40">The book has no print.</div>}
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-3xl tabular-nums">{focus ? formatUsd(focus.last) : "—"}</p>
              <p className="mt-1 text-sm text-white/45">{focus ? `${formatPremium(focus.premium)} versus the mark. Paper equity ${formatUsd(equity)}.` : "Waiting on the book."}</p>
            </div>
            {selected ? (
              <div className="flex gap-2">
                <button type="button" onClick={() => take(selected, "sell", "You.")} className="h-12 rounded-2xl bg-[#ff5a5a] px-5 text-sm font-semibold text-white">Paper sell</button>
                <button type="button" onClick={() => take(selected, "buy", "You.")} className="h-12 rounded-2xl bg-[#14f195] px-5 text-sm font-semibold text-black">Paper buy</button>
              </div>
            ) : null}
          </div>
          {note ? <p className="mt-2 text-xs text-white/50">{note}</p> : null}
        </div>
        <aside className="border-l border-white/10">
          {focus?.mint ? <PrintTape mint={focus.mint} symbol={focus.symbol} /> : null}
          <div className="p-3">
          <p className="font-mono text-[10px] tracking-[0.16em] text-white/35 uppercase">Hire</p>
          <form
            className="mt-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              const row = book.find((n) => n.symbol === symbol);
              if (!row) return toast.error("Pick a name that has a print.");
              const hired = hirePaperAgent({ name: name || row.symbol, symbol: row.symbol, mint: row.mint, rule, size });
              setName("");
              load(hired.id);
              toast.success(`${hired.name} is on the tape.`);
            }}
          >
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm outline-none" />
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm outline-none">
              {book.map((n) => (
                <option key={n.symbol} value={n.symbol}>{n.symbol}</option>
              ))}
            </select>
            <div className="grid grid-cols-3 gap-1">
              {RULES.map((r) => (
                <button key={r.id} type="button" onClick={() => setRule(r.id)} className={cn("h-10 rounded-full text-[11px] font-semibold", rule === r.id ? "bg-white text-black" : "bg-white/8 text-white/60")}>{r.label}</button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-1">
              {[5, 25, 100, 500].map((n) => (
                <button key={n} type="button" onClick={() => setSize(n)} className={cn("h-10 rounded-full font-mono text-[11px]", size === n ? "bg-accent text-accent-fg" : "bg-white/8 text-white/60")}>${n}</button>
              ))}
            </div>
            <p className="text-[11px] leading-relaxed text-white/40">{RULES.find((r) => r.id === rule)?.line} Armed agents check the live print every minute and fill at most once each fifteen.</p>
            <button type="submit" className="h-11 w-full rounded-xl bg-white text-sm font-semibold text-black">Hire</button>
          </form>
          {selected ? (
            <div className="mt-4 flex items-center justify-between">
              <button type="button" onClick={() => { patchPaperAgent(selected.id, { armed: !selected.armed }); load(selected.id); }} className="text-xs text-white/60">{selected.armed ? "Armed" : "Paused"}</button>
              <button type="button" onClick={() => { dropPaperAgent(selected.id); load(null); }} className="text-xs text-white/35">Remove</button>
            </div>
          ) : null}
          </div>
        </aside>
      </div>
      <div className="max-h-52 overflow-auto border-t border-white/10">
        <table className="w-full text-left text-xs">
          <thead className="font-mono text-[10px] tracking-[0.14em] text-white/35 uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">Agent</th>
              <th className="px-3 py-2 font-medium">Side</th>
              <th className="px-3 py-2 font-medium">Size</th>
              <th className="px-3 py-2 font-medium">Fill</th>
              <th className="px-3 py-2 font-medium">Mark</th>
              <th className="px-3 py-2 font-medium">Open pnl</th>
            </tr>
          </thead>
          <tbody>
            {fills.map((f) => {
              const mark = book.find((n) => n.symbol === f.symbol)?.last || 0;
              const pnl = paperPnl(f.side, f.px, mark, f.usd);
              return (
                <tr key={f.id} className="border-t border-white/5 font-mono">
                  <td className="px-3 py-1.5 text-white/50">{new Date(f.at).toLocaleString()}</td>
                  <td className="px-3 py-1.5">{f.agent}</td>
                  <td className="px-3 py-1.5">{f.side} {f.symbol}</td>
                  <td className="px-3 py-1.5">${f.usd}</td>
                  <td className="px-3 py-1.5">{formatUsd(f.px)}</td>
                  <td className="px-3 py-1.5">{mark ? formatUsd(mark) : "—"}</td>
                  <td className={cn("px-3 py-1.5", pnl != null && pnl < 0 ? "text-[#ff5a5a]" : "text-accent")}>{pnl == null ? "—" : `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!fills.length ? <p className="px-3 py-3 text-sm text-white/40">The tape is empty. A paper fill lands here, at the live print, and stays for the forward test.</p> : null}
      </div>
      </div>
      )}
    </div>
  );
}
