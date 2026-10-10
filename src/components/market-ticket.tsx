import { useEffect, useState } from "react";
import { USDC } from "@/lib/jup-exec";
import { quoteRoute } from "@/lib/jup-sign";
import { signStockSwap } from "@/lib/jup-sign";
import { getLifiQuote, readEvmBalance } from "@/lib/lifi";
import { signLifi } from "@/lib/lifi-sign";
import { splHolding } from "@/lib/phantom";
import { evmMarketFor, rawAmount, sellRaw, solanaDecimals, solTxLink, txLink, type LifiQuote } from "@/lib/trade-book.mjs";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import type { TapeRow } from "@/lib/chain-tape-map.mjs";

function amountText(raw: string, decimals: number): string {
  const value = Number(raw) / 10 ** decimals;
  if (!(value > 0)) return "—";
  if (value >= 1) return value.toLocaleString("en-US", { maximumFractionDigits: 6 });
  return value.toPrecision(4);
}

type Preview = { out: string; min: string; route: string };

export function MarketTicket({ row, onClose }: { row: TapeRow; onClose: () => void }) {
  const wallet = useWallet();
  const sol = wallet.w.links.find((link) => link.kind === "phantom" || link.kind === "solana");
  const evm = wallet.w.links.find((link) => link.kind === "evm");
  const market = row.lane === "chain" ? evmMarketFor(row.symbol) : null;
  const decimals = row.mint ? solanaDecimals(row.mint) : market?.decimals ?? null;
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [usd, setUsd] = useState(25);
  const [held, setHeld] = useState("0");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [href, setHref] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const tradable = row.symbol !== "USDC" && (row.lane === "solana" ? Boolean(row.mint && decimals != null) : Boolean(market));
  const symbol = market ? market.symbol : row.symbol;

  useEffect(() => {
    let live = true;
    setHeld("0");
    if (row.lane === "solana" && row.mint && sol) {
      splHolding(sol.address, row.mint)
        .then((bag) => live && setHeld(bag.raw))
        .catch(() => live && setHeld("0"));
    } else if (market && evm) {
      readEvmBalance({ data: { chainId: market.chainId, token: market.token, owner: evm.address } })
        .then((bag) => live && setHeld(bag.raw))
        .catch(() => live && setHeld("0"));
    }
    return () => {
      live = false;
    };
  }, [row.id, row.lane, row.mint, sol?.address, evm?.address, market]);

  function resize(next: number) {
    setUsd(next);
    setPreview(null);
    setHref("");
  }

  function flip(next: "buy" | "sell") {
    setSide(next);
    setPreview(null);
    setHref("");
    setNote("");
  }

  async function quote() {
    setBusy(true);
    setNote("");
    setHref("");
    setPreview(null);
    try {
      if (decimals == null) throw new Error("No quote.");
      if (row.lane === "solana" && row.mint) {
        const raw = side === "buy" ? Number(rawAmount(usd, 6)) : Number(sellRaw(usd, row.usd, decimals, held));
        if (!(raw > 0)) throw new Error("This wallet holds none of that token.");
        const quoted = await quoteRoute({
          inputMint: side === "buy" ? USDC : row.mint,
          outputMint: side === "buy" ? row.mint : USDC,
          amountRaw: raw,
          outDecimals: side === "buy" ? decimals : 6,
        });
        setPreview({
          out: quoted.outUi.toLocaleString("en-US", { maximumFractionDigits: 6 }),
          min: quoted.minUi.toLocaleString("en-US", { maximumFractionDigits: 6 }),
          route: quoted.route,
        });
      } else if (market) {
        const tokenRaw = side === "sell" ? sellRaw(usd, row.usd, market.decimals, held).toString() : undefined;
        if (side === "sell" && tokenRaw === "0") throw new Error("This wallet holds none of that token.");
        const quoted = await getLifiQuote({
          data: {
            tape: row.symbol,
            usd,
            side,
            ...(tokenRaw ? { tokenRaw } : {}),
            ...(evm?.address ? { fromAddress: evm.address } : {}),
          },
        });
        if ("error" in quoted) throw new Error(quoted.error);
        setPreview({
          out: amountText(quoted.toAmount, side === "buy" ? market.decimals : market.usdcDecimals),
          min: amountText(quoted.toAmountMin, side === "buy" ? market.decimals : market.usdcDecimals),
          route: quoted.tool,
        });
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
    setHref("");
    try {
      if (decimals == null) throw new Error("No quote.");
      if (row.lane === "solana" && row.mint) {
        if (!sol) throw new Error("Connect a Solana wallet. It signs the Jupiter route.");
        const tokenAmount = side === "sell" ? sellRaw(usd, row.usd, decimals, held) : undefined;
        if (side === "sell" && (!tokenAmount || tokenAmount <= 0n)) throw new Error("This wallet holds none of that token.");
        const done = await signStockSwap({ owner: sol.address, mint: row.mint, usd, side, decimals, tokenAmount });
        setHref(solTxLink(done.signature));
        setNote(done.signature);
      } else if (market) {
        if (!evm) throw new Error("Connect an Ethereum wallet. It signs this chain.");
        const amount = side === "sell" ? sellRaw(usd, row.usd, market.decimals, held) : rawAmount(usd, market.usdcDecimals);
        if (amount <= 0n) throw new Error("This wallet holds none of that token.");
        const fresh = await getLifiQuote({
          data: {
            tape: row.symbol,
            usd,
            side,
            ...(side === "sell" ? { tokenRaw: amount.toString() } : {}),
            fromAddress: evm.address,
          },
        });
        if ("error" in fresh) throw new Error(fresh.error);
        const hash = await signLifi(market, fresh as LifiQuote, {
          token: side === "sell" ? market.token : market.usdc,
          amount,
          usd,
        });
        setHref(txLink(market.chainId, hash));
        setNote(hash);
      }
    } catch (error) {
      setNote(error instanceof Error ? error.message : "The wallet did not sign.");
    } finally {
      setBusy(false);
    }
  }

  const outName = side === "buy" ? symbol : "USDC";
  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl">{symbol}</h3>
          <p className="mt-1 text-sm text-muted">
            {row.lane === "solana"
              ? "Jupiter builds the route. Your Solana wallet signs. Senda does not take the tokens."
              : market
                ? `${market.name} on ${market.chain}. LI.FI builds the route. Your Ethereum wallet signs.`
                : "This row is a price. This desk has no signer for that chain."}
          </p>
          {tradable && decimals != null ? (
            <p className="mt-2 font-mono text-xs text-subtle">Wallet holds {amountText(held, decimals)} {symbol}</p>
          ) : null}
        </div>
        <button type="button" onClick={onClose} className="text-sm text-subtle">Close</button>
      </div>
      {tradable ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => flip("buy")} className={`min-h-10 rounded-full px-4 text-sm font-semibold ${side === "buy" ? "bg-accent text-accent-fg" : "bg-white/10"}`}>Buy</button>
          <button type="button" onClick={() => flip("sell")} className={`min-h-10 rounded-full px-4 text-sm font-semibold ${side === "sell" ? "bg-accent text-accent-fg" : "bg-white/10"}`}>Sell</button>
          <label className="text-sm text-muted">
            USDC
            <input
              type="number"
              min={1}
              value={usd}
              onChange={(event) => resize(Number(event.target.value))}
              className="ml-2 min-h-10 w-28 rounded-lg bg-white/5 px-3 font-mono"
            />
          </label>
          <button type="button" disabled={busy} onClick={quote} className="min-h-10 rounded-full bg-white/10 px-4 text-sm font-semibold">Quote</button>
          <button type="button" disabled={busy || !preview} onClick={sign} className="min-h-10 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">Sign</button>
        </div>
      ) : null}
      {preview ? (
        <p className="mt-3 font-mono text-sm">
          {preview.out} {outName} · min {preview.min} · {preview.route}
        </p>
      ) : null}
      {note ? <p className="mt-3 break-all text-sm text-muted">{note}</p> : null}
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-accent">
          View the transaction
        </a>
      ) : null}
    </section>
  );
}
