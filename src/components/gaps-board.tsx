import { useEffect, useState } from "react";
import { toast } from "sonner";
import { loadTwoListings, type Listing, type TwoProduct } from "@/lib/two-listings";
import { signRoute } from "@/lib/jup-sign";
import { connectPhantom } from "@/lib/phantom";
import { quoteSameChain, signSameChain, evmSender } from "@/lib/chain-swap";
import { fileFill } from "@/lib/trade-log";

function money(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

/** Same product, more than one listing. A buy signs one side. It does not lock the other. */
export function GapsBoard() {
  const [rows, setRows] = useState<TwoProduct[]>([]);
  const [busy, setBusy] = useState("");
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / 20));
  const safe = Math.min(page, pages - 1);
  const shown = rows.slice(safe * 20, safe * 20 + 20);

  useEffect(() => {
    loadTwoListings().then(setRows).catch(() => setRows([]));
  }, []);

  async function buy(product: TwoProduct, venue: Listing) {
    if (!venue.signs || !venue.address) return;
    const key = `${product.id}-${venue.chain}`;
    setBusy(key);
    try {
      if (venue.chain === "Solana") {
        const owner = await connectPhantom();
        await signRoute({
          owner,
          inputMint: venue.pay,
          outputMint: venue.address,
          amountRaw: 10 * 10 ** venue.payDecimals,
          outDecimals: venue.decimals,
          inDecimals: venue.payDecimals,
          usd: 10,
          symbol: product.symbol,
        });
        toast.success(`${product.symbol} signed on Solana. The other listing was not touched.`);
        return;
      }
      const from = await evmSender();
      const quote = await quoteSameChain({
        chainId: venue.chainId,
        tokenIn: venue.pay,
        tokenInDecimals: venue.payDecimals,
        tokenOut: venue.address,
        usd: 10,
        sender: from,
      });
      const hash = await signSameChain(quote, from, venue.chainId);
      fileFill({ symbol: product.symbol, side: "buy", usd: 10, mint: venue.address, signature: hash, route: venue.chain });
      toast.success(`${product.symbol} signed on ${venue.chain}. The other listing was not touched.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That listing did not sign.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="px-3 py-3">
      <p className="font-mono text-[11px] tracking-[0.14em] text-white/40 uppercase">Same product</p>
      <h2 className="mt-1 text-lg font-semibold">More than one listing.</h2>
      <p className="mt-1 text-sm leading-relaxed text-white/55">
        {rows.length} products are listed twice. The gap is the difference between those prices. A buy signs one side. It does not sell the other, so it is not an arbitrage yet.
      </p>
      <ul className="mt-3 space-y-2">
        {shown.map((row) => (
          <li key={row.id} className="rounded-2xl border border-white/10 px-3 py-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold">{row.symbol}</p>
              <p className="font-mono text-[12px] text-white/70">{row.gapBps == null ? "One price" : `${row.gapBps} bps`}</p>
            </div>
            <p className="text-[12px] leading-snug text-white/45">{row.note}</p>
            <ul className="mt-2 space-y-1">
              {row.listings.map((venue) => {
                const key = `${row.id}-${venue.chain}`;
                return (
                  <li key={key} className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="text-white/70">{venue.label} · {venue.chain}{venue.signs ? "" : " · not signed here"}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono tabular-nums">{venue.price != null ? `$${money(venue.price)}` : "—"}</span>
                      {venue.signs ? (
                        <button type="button" disabled={busy === key} onClick={() => void buy(row, venue)} className="h-7 rounded-full bg-white px-2 text-[11px] font-semibold text-black disabled:opacity-40">
                          {busy === key ? "…" : "$10"}
                        </button>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
      {!rows.length ? <p className="mt-3 text-sm text-white/40">The listings have not loaded.</p> : rows.length > 20 ? (
        <div className="mt-3 flex items-center justify-between text-xs text-white/45">
          <button type="button" disabled={safe <= 0} onClick={() => setPage(Math.max(0, safe - 1))} className="h-9 rounded-full bg-white/10 px-3 disabled:opacity-40">Back</button>
          <span className="font-mono">{rows.length} products · {safe + 1} / {pages}</span>
          <button type="button" disabled={safe + 1 >= pages} onClick={() => setPage(safe + 1)} className="h-9 rounded-full bg-white/10 px-3 disabled:opacity-40">Next</button>
        </div>
      ) : null}
    </section>
  );
}
