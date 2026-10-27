import { useEffect, useState } from "react";
import { listChainCovers, type ChainCover } from "@/lib/cover-chain";
import { listHolds } from "@/lib/hold-contract";
import { listPairs } from "@/lib/pair-contract";
import { splHolding } from "@/lib/phantom";
import { listJobs, type WorkJob } from "@/lib/work-escrow";
import { cn } from "@/lib/utils";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export type BoardLane = "all" | "option" | "pay" | "work" | "gift" | "invest" | "pair";

type Row = {
  id: string;
  lane: Exclude<BoardLane, "all">;
  type: string;
  name: string;
  detail: string;
  amount: string;
};

function optionLabel(row: ChainCover): string {
  if (row.kind === "drop") return "10% cover";
  if (row.kind === "drop5") return "5% cover";
  return row.title.toLowerCase().includes("put") ? "Put" : "Call";
}

export function ContractBoard({ onOpen }: { onOpen: (lane: BoardLane) => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [closed, setClosed] = useState(0);

  useEffect(() => {
    let live = true;
    const options = listChainCovers();
    const holds = listHolds();
    const jobs = listJobs();
    const pairs = listPairs().filter((row) => !row.closed);
    const openJobs = jobs.filter((job) => job.status === "open");
    const openOptions = options.filter((row) => row.status === "open");
    setClosed(
      options.filter((row) => row.status !== "open").length + jobs.filter((job) => job.status !== "open").length,
    );
    void Promise.all(
      holds.map(async (hold) => {
        const held = await splHolding(hold.id, USDC).catch(() => ({ ui: 0 }));
        return { hold, usdc: held.ui };
      }),
    ).then((funded) => {
      if (!live) return;
      const next: Row[] = [
        ...openOptions.map((row) => ({
          id: row.id,
          lane: "option" as const,
          type: "Option",
          name: `${optionLabel(row)} ${row.symbol}`,
          detail: `Strike ${row.strike.toFixed(2)} · size $${row.cover.toFixed(2)}`,
          amount: `$${row.premium.toFixed(2)} debit`,
        })),
        ...funded.map(({ hold, usdc }) => ({
          id: hold.id,
          lane: hold.kind,
          type: hold.kind === "pay" ? "Payment" : hold.kind === "gift" ? "Gift" : "Invest",
          name: hold.name,
          detail: hold.purpose,
          amount: `${usdc.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC`,
        })),
        ...openJobs.map((job: WorkJob) => ({
          id: job.id,
          lane: "work" as const,
          type: "Work",
          name: job.title,
          detail: job.brief,
          amount: `$${job.usd.toFixed(2)}`,
        })),
        ...pairs.map((row) => ({
          id: row.id,
          lane: "pair" as const,
          type: "Pair",
          name: row.pair,
          detail: `${row.symbol} in the wallet`,
          amount: `${row.got > 0 ? row.got.toLocaleString("en-US", { maximumFractionDigits: 4 }) : "—"} ${row.symbol}`,
        })),
      ];
      setRows(next);
    });
    return () => {
      live = false;
    };
  }, []);

  const counts = {
    option: rows.filter((row) => row.lane === "option").length,
    pay: rows.filter((row) => row.lane === "pay").length,
    work: rows.filter((row) => row.lane === "work").length,
    gift: rows.filter((row) => row.lane === "gift").length,
    invest: rows.filter((row) => row.lane === "invest").length,
    pair: rows.filter((row) => row.lane === "pair").length,
  };

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
      <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">All contracts</p>
      <h2 className="mt-1 text-2xl tracking-tight">{rows.length} open</h2>
      <p className="mt-1 text-sm text-muted">{closed} already closed in this browser. USDC on a payment, gift, or invest contract is read from the chain.</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(
          [
            ["option", "Option"],
            ["pay", "Payment"],
            ["work", "Work"],
            ["gift", "Gift"],
            ["invest", "Invest"],
            ["pair", "Pair"],
          ] as const
        ).map(([lane, label]) => (
          <button key={lane} type="button" onClick={() => onOpen(lane)} className="rounded-2xl border border-white/10 px-3 py-3 text-left hover:bg-white/5">
            <span className="block font-mono text-xl tabular-nums">{counts[lane]}</span>
            <span className="text-xs text-muted">{label}</span>
          </button>
        ))}
      </div>
      <ul className="mt-4 divide-y divide-white/10">
        {rows.length === 0 ? <li className="py-6 text-sm text-muted">Nothing open yet. Pick a type above and sign one.</li> : null}
        {rows.map((row) => (
          <li key={`${row.lane}:${row.id}`} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{row.name}</p>
              <p className="mt-0.5 truncate text-xs text-muted">{row.type} · {row.detail}</p>
            </div>
            <p className="shrink-0 font-mono text-sm tabular-nums">{row.amount}</p>
            <button type="button" onClick={() => onOpen(row.lane)} className={cn("min-h-10 shrink-0 rounded-full border border-white/15 px-3 text-xs font-semibold")}>
              Open
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
