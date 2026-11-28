import { useEffect, useState } from "react";
import { accountPositions, listNtry, seedBooked, type Ntry } from "@/lib/agent-ledger";

function money(row: Ntry): string {
  const n = row.Amt.Ccy === "SOL" ? Number(row.Amt.value) / 1e9 : Number(row.Amt.value) / 1e6;
  return `${row.Amt.Ccy === "USDC" ? "$" : ""}${n.toFixed(row.Amt.Ccy === "SOL" ? 4 : 2)} ${row.Amt.Ccy}`;
}

export function AgentBook({ acct }: { acct?: string }) {
  const [rows, setRows] = useState<Ntry[]>([]);
  const [pick, setPick] = useState("");

  useEffect(() => {
    const load = () => setRows(listNtry());
    void seedBooked().then(load).catch(load);
    window.addEventListener("senda-ntry", load);
    return () => window.removeEventListener("senda-ntry", load);
  }, []);

  const books = accountPositions(rows);
  const open = acct || pick || books[0]?.acct || "";
  const mine = rows.filter((row) => row.Acct.Id.Othr.Id === open);
  const held = books.find((row) => row.acct === open);

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
      <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Ntry</p>
      <h2 className="mt-1 text-lg font-semibold">Agent accounts</h2>
      <p className="mt-1 text-sm text-muted">Book balance is credits minus debits. The chain balance can differ until the next entry. Nm is who it is. Acct is the wallet. The same NtryRef is on the main journal.</p>
      <div className="mt-3 flex gap-2 overflow-x-auto">
        {books.map((row) => (
          <button key={row.acct} type="button" onClick={() => setPick(row.acct)} className={`min-w-36 shrink-0 rounded-2xl px-3 py-2 text-left ${open === row.acct ? "bg-white text-black" : "bg-white/[0.04] text-white"}`}>
            <p className="text-sm font-semibold">{row.nm}</p>
            <p className="mt-1 font-mono text-[11px] tabular-nums">{row.sol.toFixed(4)} SOL</p>
            {row.usdc ? <p className="font-mono text-[11px] tabular-nums">${row.usdc.toFixed(2)}</p> : null}
          </button>
        ))}
      </div>
      {held ? <p className="mt-3 break-all font-mono text-[11px] text-white/45">{held.nm} · {held.acct}</p> : null}
      <ul className="mt-3 space-y-2">
        {mine.slice(0, 8).map((row, index) => {
          const other = row.CdtDbtInd === "DBIT" ? row.NtryDtls.TxDtls.RltdPties.Cdtr.Nm : row.NtryDtls.TxDtls.RltdPties.Dbtr.Nm;
          return (
            <li key={`${row.NtryRef}-${row.CdtDbtInd}-${index}`} className="rounded-2xl bg-white/[0.04] px-3 py-3">
              <p className="text-sm font-semibold">{row.CdtDbtInd} {money(row)} · {row.Sts.Cd}</p>
              <p className="mt-1 text-xs text-white/70">{row.CdtDbtInd === "DBIT" ? `To ${other}` : `From ${other}`} · {row.BookgDt.Dt} · {row.NtryDtls.TxDtls.Purp.Prtry}</p>
              <p className="mt-1 break-all font-mono text-[11px] text-white/40">NtryRef {row.NtryRef}</p>
            </li>
          );
        })}
        {mine.length === 0 ? <li className="text-sm text-white/45">No entry on this account.</li> : null}
      </ul>
    </section>
  );
}
