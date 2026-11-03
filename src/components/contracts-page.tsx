import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { listChainCovers } from "@/lib/cover-chain";
import { listFills } from "@/lib/account-book";
import { loadGifts } from "@/lib/gift-vault";
import { listJobs } from "@/lib/work-jobs";
import { cn } from "@/lib/utils";

type Lane = "option" | "pay" | "work" | "gift" | "invest" | "pair";

type Row = { id: string; lane: Lane; name: string; detail: string; amount: string; open: boolean };

const LANES: { id: Lane; label: string }[] = [
  { id: "option", label: "Option" },
  { id: "pay", label: "Payment" },
  { id: "work", label: "Work" },
  { id: "gift", label: "Gift" },
  { id: "invest", label: "Invest" },
  { id: "pair", label: "Pair" },
];

function readRows(): Row[] {
  const rows: Row[] = [];
  for (const c of listChainCovers()) {
    rows.push({
      id: c.id,
      lane: "option",
      name: `${c.symbol} ${c.kind === "drop" ? "Put" : "Call"}`,
      detail: `Strike ${c.strike.toFixed(2)} · size $${c.cover.toFixed(2)}`,
      amount: `$${c.premium.toFixed(2)} debit`,
      open: c.status === "open",
    });
  }
  for (const j of listJobs()) {
    rows.push({ id: j.id, lane: "work", name: j.title, detail: j.brief, amount: `$${j.pay.toFixed(2)}`, open: j.status === "open" });
  }
  for (const g of loadGifts()) {
    rows.push({ id: g.pubkey, lane: "gift", name: g.memo || "Gift", detail: "USDC sits until it is claimed.", amount: `$${g.usd.toFixed(2)}`, open: g.status === "open" });
  }
  for (const f of listFills()) {
    const lane: Lane = f.side === "send" ? "pay" : f.desk === "pair" ? "pair" : "invest";
    rows.push({
      id: f.id,
      lane,
      name: f.symbol,
      detail: `${f.desk} · ${f.side}`,
      amount: `$${f.usd.toFixed(2)}`,
      open: true,
    });
  }
  return rows;
}

const OPEN_TO: Record<Lane, string> = {
  option: "/cover",
  pay: "/payments",
  work: "/work",
  gift: "/payments/gift",
  invest: "/pre",
  pair: "/wallet",
};

export function ContractsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [lane, setLane] = useState<Lane | "all">("all");

  useEffect(() => {
    const pull = () => setRows(readRows());
    pull();
    window.addEventListener("senda-account", pull);
    return () => window.removeEventListener("senda-account", pull);
  }, []);

  const open = rows.filter((r) => r.open);
  const closed = rows.length - open.length;
  const counts = useMemo(() => {
    const n: Record<Lane, number> = { option: 0, pay: 0, work: 0, gift: 0, invest: 0, pair: 0 };
    for (const r of open) n[r.lane] += 1;
    return n;
  }, [open]);
  const shown = lane === "all" ? open : open.filter((r) => r.lane === lane);

  return (
    <div className="px-3 py-3 lg:px-4">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Contracts</p>
      <h1 className="mt-1 text-3xl tracking-tight">All contracts</h1>
      <h2 className="mt-1 text-2xl tracking-tight">{open.length} open</h2>
      <p className="mt-1 text-sm text-muted">{closed} already closed in this browser. USDC on a payment, gift, or invest contract is read from the chain.</p>
      <div className="mt-4 flex gap-1 overflow-x-auto">
        <button type="button" onClick={() => setLane("all")} className={cn("min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold", lane === "all" ? "bg-white text-black" : "bg-white/10 text-white/70")}>
          All {open.length}
        </button>
        {LANES.map((item) => (
          <button key={item.id} type="button" onClick={() => setLane(item.id)} className={cn("min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold", lane === item.id ? "bg-white text-black" : "bg-white/10 text-white/70")}>
            {item.label} {counts[item.id]}
          </button>
        ))}
      </div>
      <ul className="mt-4 divide-y divide-white/10">
        {shown.length === 0 ? <li className="py-6 text-sm text-muted">Nothing open yet. Pick a type above and sign one.</li> : null}
        {shown.map((row) => (
          <li key={`${row.lane}:${row.id}`} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{row.name}</p>
              <p className="mt-0.5 truncate text-xs text-muted">
                {row.lane} · {row.detail}
              </p>
            </div>
            <p className="shrink-0 font-mono text-sm tabular-nums">{row.amount}</p>
            <button type="button" onClick={() => void navigate({ href: OPEN_TO[row.lane] })} className="min-h-10 shrink-0 rounded-full border border-white/15 px-3 text-xs font-semibold">
              Open
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
