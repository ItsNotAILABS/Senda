import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { loadIssuerBook, type IssuerToken, type IssuerVenue } from "@/lib/issuer-book";
import { quoteSameChain, signSameChain, evmSender } from "@/lib/chain-swap";
import { signRoute } from "@/lib/jup-sign";
import { connectPhantom } from "@/lib/phantom";
import { deskVolume, fileFill, onTrades } from "@/lib/trade-log";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SIZE = 10;

/** Tokens from the issuer, on the chain they use. A buy signs in the wallet for that chain. */
export function IssuerBoard() {
  const [rows, setRows] = useState<IssuerToken[]>([]);
  const [issuer, setIssuer] = useState<"All" | IssuerToken["issuer"]>("All");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  const [vol, setVol] = useState(deskVolume());

  useEffect(() => {
    loadIssuerBook().then(setRows).catch(() => setRows([]));
    return onTrades(() => setVol(deskVolume()));
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((row) => (issuer === "All" ? true : row.issuer === issuer))
      .filter((row) => !needle || `${row.symbol} ${row.name}`.toLowerCase().includes(needle))
      .slice(0, 40);
  }, [rows, issuer, q]);

  async function buy(row: IssuerToken, venue: IssuerVenue) {
    const key = `${row.symbol}-${venue.chain}`;
    setBusy(key);
    try {
      if (venue.chain === "Solana") {
        const owner = await connectPhantom();
        await signRoute({
          owner,
          inputMint: USDC,
          outputMint: venue.address,
          amountRaw: SIZE * 1_000_000,
          outDecimals: venue.decimals,
          inDecimals: 6,
          usd: SIZE,
          symbol: row.symbol,
        });
        toast.success(`${row.symbol} signed on Solana.`);
        return;
      }
      const from = await evmSender();
      const quote = await quoteSameChain({
        chainId: venue.chainId,
        tokenIn: venue.pay,
        tokenInDecimals: venue.payDecimals,
        tokenOut: venue.address,
        usd: SIZE,
        sender: from,
      });
      const hash = await signSameChain(quote, from, venue.chainId);
      fileFill({ symbol: row.symbol, side: "buy", usd: SIZE, mint: venue.address, signature: hash, route: venue.chain });
      toast.success(`${row.symbol} signed on ${venue.chain}. ${hash.slice(0, 10)}…`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The trade did not send.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="px-3 py-3">
      <p className="font-mono text-[11px] tracking-[0.14em] text-white/40 uppercase">Issuers</p>
      <h2 className="mt-1 text-lg font-semibold">Their token, on their chain. You sign.</h2>
      <p className="mt-1 text-sm text-white/55">
        Signed on this browser: ${vol.usd.toFixed(2)} across {vol.n} {vol.n === 1 ? "trade" : "trades"}. That is this device. It is not another person’s book.
      </p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search a ticker"
        className="mt-3 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-3 text-sm outline-none"
      />
      <div className="mt-2 flex gap-1">
        {(["All", "Backpack", "xStocks", "Ondo"] as const).map((id) => (
          <button key={id} type="button" onClick={() => setIssuer(id)} className={`h-8 rounded-full px-3 text-xs font-semibold ${issuer === id ? "bg-white text-black" : "bg-white/10"}`}>
            {id}
          </button>
        ))}
      </div>
      <ul className="mt-3 space-y-2">
        {shown.map((row) => (
          <li key={`${row.issuer}-${row.symbol}`} className="rounded-2xl border border-white/10 px-3 py-2">
            <p className="text-sm font-semibold">{row.symbol}</p>
            <p className="text-[11px] text-white/40">{row.issuer} · {row.name}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {row.venues.map((venue) => {
                const key = `${row.symbol}-${venue.chain}`;
                return (
                  <button key={venue.chain} type="button" disabled={busy === key} onClick={() => void buy(row, venue)} className="h-8 rounded-full bg-white px-3 text-[11px] font-semibold text-black disabled:opacity-40">
                    {busy === key ? "Signing" : `$${SIZE} · ${venue.chain}`}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      {!shown.length ? <p className="mt-3 text-sm text-white/40">{rows.length ? "Nothing matches." : "The issuer lists did not load."}</p> : null}
    </section>
  );
}
