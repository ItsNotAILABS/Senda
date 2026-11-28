import { useEffect, useState } from "react";
import { readMoneyVenues, type MoneyVenue } from "@/lib/money-venues";
import { listPaperAgents } from "@/lib/paper-book";
import { spendCap } from "@/lib/spend-cap";
import { useCover } from "@/components/private-cover";
import { cn } from "@/lib/utils";

const PRESETS = [10, 25, 100];

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function compact(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return money(n);
}

function px(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function Row({ row }: { row: MoneyVenue }) {
  return (
    <li className="rounded-2xl border border-white/10 px-3 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">{row.name}</p>
        <p className="font-mono text-[11px] tracking-wide text-white/40 uppercase">{row.kind}</p>
      </div>
      {row.ok && row.solPx != null ? <p className="mt-1 font-mono text-lg tabular-nums">{px(row.solPx)}</p> : null}
      {row.ok && row.kind === "lend" && row.apy != null ? (
        <p className="mt-1 font-mono text-lg tabular-nums">{(row.apy * 100).toFixed(2)}% supply</p>
      ) : null}
      {!row.ok ? <p className="mt-1 text-sm text-[#ff5d73]">{row.error}</p> : null}
      <p className="mt-1 text-xs leading-snug text-white/50">
        {row.note}
        {row.solOut != null ? ` ${row.solOut.toFixed(4)} SOL out.` : ""}
        {row.impactPct != null ? ` Impact ${row.impactPct.toFixed(3)}%.` : ""}
        {row.tvl != null ? ` ${row.kind === "lend" ? "Supplied" : "Depth"} ${compact(row.tvl)}.` : ""}
      </p>
    </li>
  );
}

/** Chain USDC, a paper score, and live venue evidence. The three numbers are not added together. */
export function MoneyVenues({ usdc }: { usdc: number | null }) {
  const cover = useCover();
  const [usd, setUsd] = useState("10");
  const [rows, setRows] = useState<MoneyVenue[] | null>(null);
  const [fault, setFault] = useState("");
  const [busy, setBusy] = useState(false);
  const [paper, setPaper] = useState(0);

  useEffect(() => {
    setPaper(listPaperAgents().reduce((sum, row) => sum + (row.armed ? row.size : 0), 0));
  }, []);

  async function read(next = usd) {
    const amount = Number(next);
    if (!(amount > 0)) {
      setFault("Enter an amount.");
      return;
    }
    if (amount > spendCap()) {
      setFault(`That is over the spend cap of ${spendCap()}.`);
      return;
    }
    setBusy(true);
    setFault("");
    try {
      const tape = await readMoneyVenues({ data: { usd: amount } });
      setRows(tape.rows);
    } catch (e) {
      setRows(null);
      setFault(e instanceof Error ? e.message : "The venues did not answer.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void read("10");
  }, []);

  return (
    <div>
      <p className="text-sm text-white/55">
        Same dollars, separate venues. Jupiter is a route. Raydium, Orca, and Meteora are pool prints. Kamino is a supply rate. A miss stays a miss. Nothing on this rail signs.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-white/[0.04] px-3 py-2">
          <p className="text-[11px] text-white/40">Chain</p>
          <p className="mt-1 font-mono text-sm tabular-nums">{cover ? "Hidden" : usdc == null ? "—" : money(usdc)}</p>
          <p className="text-[10px] text-white/35">USDC Phantom can sign</p>
        </div>
        <div className="rounded-2xl bg-white/[0.04] px-3 py-2">
          <p className="text-[11px] text-white/40">Paper</p>
          <p className="mt-1 font-mono text-sm tabular-nums">{cover ? "Hidden" : paper > 0 ? paper.toLocaleString("en-US") : "—"}</p>
          <p className="text-[10px] text-white/35">Score. Not USDC</p>
        </div>
        <div className="rounded-2xl bg-white/[0.04] px-3 py-2">
          <p className="text-[11px] text-white/40">House token</p>
          <p className="mt-1 text-sm font-semibold">Not launched</p>
          <p className="text-[10px] text-white/35">No mint. No price</p>
        </div>
      </div>
      <div className="mt-3 flex gap-1.5 overflow-x-auto">
        {PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => {
              setUsd(String(n));
              void read(String(n));
            }}
            className={cn("min-h-10 shrink-0 rounded-full px-3 font-mono text-sm", Number(usd) === n ? "bg-[#d6ff4a] text-black" : "border border-white/10 text-white/70")}
          >
            ${n}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-white/40">{busy ? "Asking each venue." : rows ? `Read at $${Number(usd) || 10} USDC into SOL, except Kamino.` : "Not read yet."}</p>
      {fault ? <p className="mt-2 text-sm text-[#ff5d73]">{fault}</p> : null}
      {rows ? (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <Row key={row.id} row={row} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
