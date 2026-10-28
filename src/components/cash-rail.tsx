import { useEffect, useState } from "react";
import { toast } from "sonner";
import { quoteRoute, signRoute } from "@/lib/jup-sign";
import { STABLES, USDC_MINT, type Stable } from "@/lib/stables";
import { cn } from "@/lib/utils";

const SPEND = [
  { name: "This desk", line: "Swap the stable to USDC here. Jupiter quotes it. Then it trades or sends like any other USDC." },
  { name: "Phantom Cash Visa", line: "A different Solana address inside Phantom, not this one. Lead Bank issues the Visa. Bridge runs the program. A store sees Visa. United States except New York." },
  { name: "Kraken and Coinbase", line: "They accept CASH on Solana. Binance, OKX, Bybit, Robinhood, Fidelity, Schwab, Webull, and eToro do not. Swap to USDC before those." },
];

/** Swap a Solana stable to USDC, and say where CASH can actually be spent. */
export function CashRail({ owner }: { owner: string }) {
  const [symbol, setSymbol] = useState("CASH");
  const [usd, setUsd] = useState("25");
  const [out, setOut] = useState("");
  const [route, setRoute] = useState("");
  const [busy, setBusy] = useState(false);
  const picked = STABLES.find((row) => row.symbol === symbol) ?? STABLES[5];
  const amount = Number(usd);

  useEffect(() => {
    if (picked.symbol === "USDC" || !(amount >= 1)) {
      setOut("");
      setRoute("");
      return;
    }
    let live = true;
    const raw = Math.round(amount * 10 ** picked.decimals);
    quoteRoute({ inputMint: picked.mint, outputMint: USDC_MINT, amountRaw: raw, outDecimals: 6 })
      .then((q) => {
        if (!live) return;
        setOut(q.outUi.toFixed(4));
        setRoute(q.route);
      })
      .catch(() => {
        if (!live) return;
        setOut("");
        setRoute("");
      });
    return () => {
      live = false;
    };
  }, [picked, amount]);

  async function swap(row: Stable) {
    if (!owner) {
      toast.error("Connect the wallet that holds it.");
      return;
    }
    setBusy(true);
    try {
      const raw = Math.round(amount * 10 ** row.decimals);
      const done = await signRoute({
        owner,
        inputMint: row.mint,
        outputMint: USDC_MINT,
        amountRaw: raw,
        outDecimals: 6,
        usd: amount,
      });
      toast.success(`Signed. About ${done.outUi.toFixed(2)} USDC.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The wallet did not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">Cash</p>
      <h3 className="mt-1 text-lg font-semibold">Swap a stable. Spend it where it actually clears.</h3>
      <p className="mt-1 text-sm text-white/50">Phantom’s Cash account is its own Solana address. This page cannot read it. Withdraw CASH into the wallet above, then swap. The cheapest same-chain path is Jupiter. A cross-chain USDC move is the Mayan rail, not this button.</p>
      <div className="mt-3 flex gap-1.5 overflow-x-auto">
        {STABLES.map((row) => (
          <button key={row.symbol} type="button" onClick={() => setSymbol(row.symbol)} className={cn("h-9 shrink-0 rounded-full px-3 text-xs font-semibold", symbol === row.symbol ? "bg-white text-black" : "bg-white/10 text-white/70")}>
            {row.symbol}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-white/40">{picked.issuer}{picked.peg === "eur" ? " · this one is euros, not a dollar" : ""} · {picked.mint.slice(0, 4)}…{picked.mint.slice(-4)}</p>
      {picked.symbol === "USDC" ? (
        <p className="mt-2 text-sm text-white/55">USDC is already the rail. Nothing to swap.</p>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <input value={usd} onChange={(e) => setUsd(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="Amount to swap" className="min-h-11 w-24 rounded-2xl border border-white/10 bg-black px-3 font-mono outline-none" />
          <p className="min-w-0 flex-1 text-sm text-white/60">{out ? `About ${out} USDC · ${route}` : "Asking Jupiter…"}</p>
          <button type="button" disabled={busy || !(amount >= 1)} onClick={() => void swap(picked)} className="min-h-11 shrink-0 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40">
            {busy ? "Waiting" : "Swap"}
          </button>
        </div>
      )}
      <ul className="mt-3 divide-y divide-white/10 rounded-2xl border border-white/10">
        {SPEND.map((row) => (
          <li key={row.name} className="px-3 py-2">
            <p className="text-sm font-semibold">{row.name}</p>
            <p className="text-xs leading-snug text-white/45">{row.line}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
