import { useEffect, useState } from "react";
import { listFills, type AccountFill } from "@/lib/account-book";

export function FillReceipt() {
  const [row, setRow] = useState<AccountFill | null>(null);

  useEffect(() => {
    const on = () => {
      const next = listFills()[0];
      if (!next || Date.now() - next.at > 20_000) return;
      setRow(next);
    };
    window.addEventListener("senda-account", on);
    return () => window.removeEventListener("senda-account", on);
  }, []);

  useEffect(() => {
    if (!row) return;
    const id = window.setTimeout(() => setRow(null), 8000);
    return () => window.clearTimeout(id);
  }, [row]);

  if (!row) return null;
  const verb = row.side === "sell" ? "Sold" : row.side === "send" ? "Sent" : "Bought";
  return (
    <aside className="fixed inset-x-4 z-50 rounded-[22px] border border-white/10 bg-[#101114] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.45)] bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] lg:bottom-6 lg:left-auto lg:right-6 lg:w-96">
      <p className="text-[11px] tracking-[0.16em] text-[#c6f56a] uppercase">Filled</p>
      <p className="mt-1 text-lg font-semibold">
        {verb} ${row.usd.toLocaleString("en-US", { maximumFractionDigits: 2 })} {row.symbol}
      </p>
      <p className="mt-1 text-sm text-white/55">It is in the wallet that signed. Portfolio rereads the chain.</p>
      {row.sig ? (
        <a href={`https://solscan.io/tx/${row.sig}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-[#d7e36a]">
          {row.sig.slice(0, 8)}… on Solscan
        </a>
      ) : null}
    </aside>
  );
}
