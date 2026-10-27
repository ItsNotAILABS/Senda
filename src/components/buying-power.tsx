import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { readChain, type ChainWallet } from "@/lib/phantom";
import { onTrades } from "@/lib/trade-log";
import { robinhoodBuyingPowerUrl } from "@/lib/robinhood";

/** USDC in the connected wallet is what a buy or a prediction can sign. SOL is not buying power until it is converted. */
export function BuyingPower({ owner }: { owner: string }) {
  const [chain, setChain] = useState<ChainWallet | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setReady(true);
    if (!owner) {
      setChain(null);
      return;
    }
    let live = true;
    const pull = () => {
      readChain(owner)
        .then((s) => {
          if (!live) return;
          setChain(s);
          setErr("");
        })
        .catch((e: unknown) => {
          if (!live) return;
          setErr(e instanceof Error ? e.message : "Could not read this wallet.");
        });
    };
    pull();
    const id = window.setInterval(pull, 20_000);
    const stop = onTrades(pull);
    return () => {
      live = false;
      window.clearInterval(id);
      stop();
    };
  }, [owner]);

  if (!ready) {
    return <p className="text-sm text-muted">Reading the wallet.</p>;
  }

  const usdc = chain?.tokens.find((t) => t.symbol === "USDC")?.ui ?? 0;
  const held = (chain?.tokens ?? []).filter((t) => t.ui > 0 && t.symbol !== "USDC").slice(0, 8);

  if (!owner) {
    return <p className="text-sm text-muted">Connect Phantom. Buying power is the USDC in that wallet.</p>;
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.16em] text-white/40 uppercase">Buying power</p>
          <p className="font-mono text-2xl tabular-nums">{err && !chain ? "—" : `$${usdc.toFixed(2)}`}</p>
          <p className="text-xs text-white/45">
            {err
              ? err
              : chain
                ? `${chain.sol.toLocaleString("en-US", { maximumFractionDigits: 4 })} SOL in this wallet. SOL is not buying power until you convert it.`
                : "Reading the wallet."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.open(robinhoodBuyingPowerUrl(owner, Math.max(25, Math.ceil(usdc))), "_blank", "noopener,noreferrer")}
          className="inline-flex min-h-10 items-center rounded-full bg-white px-3 text-xs font-semibold text-black"
        >
          Use Robinhood buying power
        </button>
      </div>
      {held.length ? (
        <ul className="mt-2 flex flex-wrap gap-1">
          {held.map((t) => (
            <li key={t.mint} className="rounded-full bg-white/8 px-2 py-1 font-mono text-[11px] text-white/70">
              {t.ui < 1 ? t.ui.toFixed(4) : t.ui.toLocaleString("en-US", { maximumFractionDigits: 2 })} {t.symbol}
            </li>
          ))}
        </ul>
      ) : null}
      {chain && usdc < 1 && chain.sol > 0 ? (
        <Link to="/wallet" className="mt-2 inline-block text-xs text-accent">You have SOL. Convert it, then come back.</Link>
      ) : null}
    </div>
  );
}
