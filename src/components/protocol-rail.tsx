import { useEffect, useState } from "react";
import { toast } from "sonner";
import { signRoute, SOL } from "@/lib/jup-sign";
import { connectPhantom } from "@/lib/phantom";
import { solanaRails, type LiveRail } from "@/lib/solana-rails";
import { cn } from "@/lib/utils";

function usd(n: number): string {
  if (!(n > 0)) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${Math.round(n / 1e6)}M`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function ProtocolRail({ owner, solPx }: { owner: string; solPx: number }) {
  const [rows, setRows] = useState<LiveRail[]>([]);
  const [line, setLine] = useState("Pulling twenty Solana rates.");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let live = true;
    solanaRails()
      .then((list) => {
        if (!live) return;
        setRows([...list].sort((a, b) => b.apy - a.apy));
        setLine(list.length ? "" : "The rate book came back empty.");
      })
      .catch(() => live && setLine("The rate book did not answer."));
    return () => {
      live = false;
    };
  }, []);

  async function buy(row: LiveRail) {
    if (!row.mint) return;
    setBusy(row.id);
    try {
      const who = owner || (await connectPhantom());
      const usdSize = 25;
      const lamports = Math.floor((usdSize / (solPx || 1)) * 1e9);
      const done = await signRoute({
        owner: who,
        inputMint: SOL,
        outputMint: row.mint,
        amountRaw: lamports,
        outDecimals: 9,
        inDecimals: 9,
        usd: usdSize,
        symbol: row.symbol || row.name,
        refPrice: solPx || undefined,
      });
      toast.success(`${row.symbol} filled. ${done.outUi.toFixed(4)} out.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The swap did not send.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="rounded-[22px] bg-[#101114] p-4">
      <p className="text-[11px] tracking-[0.14em] text-white/45 uppercase">Twenty more</p>
      <p className="mt-1 text-sm text-white/55">Live Solana rates Senda was not already running. The deepest pool sets the rate. A swap is $25 of SOL into that token, and you sign it.</p>
      {line ? <p className="mt-2 text-sm text-white/50">{line}</p> : null}
      <ul className="mt-3 divide-y divide-white/10">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-3 py-3">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{row.name}</span>
              <span className="block text-[11px] text-white/40">{row.line} {row.pool ? `· ${row.pool}` : ""}</span>
            </span>
            <span className="text-right">
              <span className={cn("block font-mono text-sm", row.apy > 0 ? "text-[#c6f56a]" : "text-white/50")}>{row.apy > 0 ? `${row.apy.toFixed(2)}%` : "—"}</span>
              <span className="block font-mono text-[11px] text-white/40">{usd(row.tvl)}</span>
            </span>
            {row.mint ? (
              <button type="button" disabled={busy !== ""} onClick={() => void buy(row)} className="min-h-10 shrink-0 rounded-full bg-white px-3 text-xs font-semibold text-black disabled:opacity-40">
                {busy === row.id ? "…" : "Swap"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
