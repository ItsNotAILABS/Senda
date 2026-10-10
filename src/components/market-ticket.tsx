import { useState } from "react";
import { outUi, quoteJup, type JupQuote } from "@/lib/jup-exec";
import { signStockSwap } from "@/lib/jup-sign";
import { getLifiQuote } from "@/lib/lifi";
import { signLifi } from "@/lib/lifi-sign";
import { evmMarketFor, solanaDecimals, type LifiQuote } from "@/lib/trade-book.mjs";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import type { TapeRow } from "@/lib/chain-tape-map.mjs";

function amountText(raw: string, decimals: number): string {
  const value = Number(raw) / 10 ** decimals;
  if (!(value > 0)) return "—";
  if (value >= 1) return value.toLocaleString("en-US", { maximumFractionDigits: 6 });
  return value.toPrecision(4);
}

export function MarketTicket({ row, onClose }: { row: TapeRow; onClose: () => void }) {
  const wallet = useWallet();
  const sol = wallet.w.links.find((link) => link.kind === "phantom" || link.kind === "solana");
  const evm = wallet.w.links.find((link) => link.kind === "evm");
  const market = row.lane === "chain" ? evmMarketFor(row.symbol) : null;
  const decimals = row.mint ? solanaDecimals(row.mint) : market?.decimals ?? null;
  const [usd, setUsd] = useState(25);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [jup, setJup] = useState<JupQuote | null>(null);
  const [lifi, setLifi] = useState<LifiQuote | null>(null);
  const tradable = row.symbol !== "USDC" && (row.lane === "solana" ? Boolean(row.mint && decimals != null) : Boolean(market));

  async function quote() {
    setBusy(true);
    setNote("");
    setJup(null);
    setLifi(null);
    try {
      if (row.lane === "solana" && row.mint) {
        const quoted = await quoteJup({ data: { mint: row.mint, usd, side: "buy" } });
        if ("error" in quoted) throw new Error(quoted.error);
        setJup(quoted);
      } else if (market) {
        const quoted = await getLifiQuote({
          data: evm?.address ? { tape: row.symbol, usd, fromAddress: evm.address } : { tape: row.symbol, usd },
        });
        if ("error" in quoted) throw new Error(quoted.error);
        setLifi(quoted);
      }
    } catch (error) {
      setNote(error instanceof Error ? error.message : "No quote.");
    } finally {
      setBusy(false);
    }
  }

  async function sign() {
    setBusy(true);
    setNote("");
    try {
      if (row.lane === "solana" && row.mint && decimals != null) {
        if (!sol) throw new Error("Connect a Solana wallet. It signs the Jupiter route.");
        const done = await signStockSwap({ owner: sol.address, mint: row.mint, usd, side: "buy", decimals });
        setNote(`Signed ${done.signature}`);
      } else if (market && lifi) {
        if (!evm) throw new Error("Connect an Ethereum wallet. It signs this chain.");
        const fresh = await getLifiQuote({ data: { tape: row.symbol, usd, fromAddress: evm.address } });
        if ("error" in fresh) throw new Error(fresh.error);
        const hash = await signLifi(market, fresh, usd);
        setNote(`Signed ${hash}`);
      }
    } catch (error) {
      setNote(error instanceof Error ? error.message : "The wallet did not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl">{market ? market.symbol : row.symbol}</h3>
          <p className="mt-1 text-sm text-muted">
            {row.lane === "solana"
              ? "Jupiter builds the route. Your Solana wallet signs. Senda does not take the tokens."
              : market
                ? `${market.name} on ${market.chain}. LI.FI builds the route. Your Ethereum wallet signs.`
                : "This row is a price. This desk has no signer for that chain."}
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-subtle">Close</button>
      </div>
      {tradable ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="text-sm text-muted">
            USDC
            <input
              type="number"
              min={1}
              value={usd}
              onChange={(event) => setUsd(Number(event.target.value))}
              className="ml-2 min-h-10 w-28 rounded-lg bg-white/5 px-3 font-mono"
            />
          </label>
          <button type="button" disabled={busy} onClick={quote} className="min-h-10 rounded-full bg-white/10 px-4 text-sm font-semibold">Quote</button>
          <button type="button" disabled={busy || (!jup && !lifi)} onClick={sign} className="min-h-10 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">Sign</button>
        </div>
      ) : null}
      {jup && decimals != null ? (
        <p className="mt-3 font-mono text-sm">
          {amountText(jup.outAmount, decimals)} {row.symbol} · {(jup.route || []).join(" → ") || "Jupiter"}
        </p>
      ) : null}
      {lifi && market ? (
        <p className="mt-3 font-mono text-sm">
          {amountText(lifi.toAmount, market.decimals)} {market.symbol} · {lifi.tool}
          {lifi.toAmountUSD ? ` · about $${Number(lifi.toAmountUSD).toFixed(2)}` : ""}
        </p>
      ) : null}
      {note ? <p className="mt-3 break-all text-sm text-muted">{note}</p> : null}
    </section>
  );
}
