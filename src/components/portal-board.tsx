import { useEffect, useState } from "react";
import { toast } from "sonner";
import { loadPortalCoins, type PortalCoin, type PortalListing } from "@/lib/portal-coins";
import { signRoute } from "@/lib/jup-sign";
import { connectPhantom } from "@/lib/phantom";
import { quoteSameChain, signSameChain, evmSender } from "@/lib/chain-swap";
import { buyCmesh } from "@/lib/pons";
import { fileFill } from "@/lib/trade-log";

function money(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

/** Published coins on the chains we already sign, plus CipherMesh on Robinhood Chain. */
export function PortalBoard() {
  const [rows, setRows] = useState<PortalCoin[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    loadPortalCoins().then(setRows).catch(() => setRows([]));
  }, []);

  const shown = rows.filter((row) => !q.trim() || `${row.symbol} ${row.name}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 24);

  async function buy(row: PortalCoin, venue: PortalListing) {
    const key = `${row.symbol}-${venue.chain}`;
    setBusy(key);
    try {
      if (venue.chain === "Solana") {
        const owner = await connectPhantom();
        await signRoute({
          owner,
          inputMint: venue.pay,
          outputMint: venue.address,
          amountRaw: 10_000_000,
          outDecimals: venue.decimals,
          inDecimals: 6,
          usd: 10,
          symbol: row.symbol,
        });
        toast.success(`${row.symbol} signed on Solana. This is the published token, not a same-ticker copy.`);
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
      fileFill({ symbol: row.symbol, side: "buy", usd: 10, mint: venue.address, signature: hash, route: venue.chain });
      toast.success(`${row.symbol} signed on ${venue.chain}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That coin did not sign.");
    } finally {
      setBusy("");
    }
  }

  async function mesh() {
    setBusy("CMESH");
    try {
      const done = await buyCmesh("0.002");
      fileFill({ symbol: "CMESH", side: "buy", usd: 0, mint: "0xBD7a6f4aCC4E9369fB9Ec7875e6e4273D5b40977", signature: done.hash, route: "Robinhood Chain" });
      toast.success(`CMESH signed on Robinhood Chain. ${done.hash.slice(0, 10)}…`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "CMESH did not sign.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="px-3 py-3">
      <p className="font-mono text-[11px] tracking-[0.14em] text-white/40 uppercase">Coins we can sign</p>
      <h2 className="mt-1 text-lg font-semibold">The published token. Not a copy with the same ticker.</h2>
      <p className="mt-1 text-sm leading-relaxed text-white/55">
        These are on Solana, Ethereum, BNB, Polygon, Arbitrum, Optimism, Avalanche, or Base, because Wormhole published the address. Cardano, Aptos, TON, Polkadot, Cosmos, Litecoin, Tron, Hedera, and ICP are not here. No one published a token for them on a chain this desk signs.
      </p>
      <div className="mt-3 rounded-2xl border border-white/10 px-3 py-2">
        <p className="text-sm font-semibold">CMESH</p>
        <p className="text-[12px] text-white/50">Robinhood Chain. The wallet signs 0.002 ETH on the curve. Other Robinhood launches are not on a public list, so they are not given a button.</p>
        <button type="button" disabled={busy === "CMESH"} onClick={() => void mesh()} className="mt-2 h-8 rounded-full bg-white px-3 text-[11px] font-semibold text-black disabled:opacity-40">
          {busy === "CMESH" ? "Signing" : "Buy CMESH"}
        </button>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a coin" className="mt-3 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-3 text-sm outline-none" />
      <ul className="mt-3 space-y-2">
        {shown.map((row) => (
          <li key={row.symbol} className="rounded-2xl border border-white/10 px-3 py-2">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold">{row.symbol}</p>
              <p className="font-mono text-sm tabular-nums">{row.price != null ? `$${money(row.price)}` : "—"}</p>
            </div>
            <p className="text-[11px] text-white/40">{row.name}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {row.listings.map((venue) => {
                const key = `${row.symbol}-${venue.chain}`;
                return (
                  <button key={venue.chain} type="button" disabled={busy === key} onClick={() => void buy(row, venue)} className="h-8 rounded-full bg-white px-3 text-[11px] font-semibold text-black disabled:opacity-40">
                    {busy === key ? "Signing" : `$10 · ${venue.chain}`}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
