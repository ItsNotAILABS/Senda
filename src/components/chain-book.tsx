import { useEffect, useState } from "react";
import { toast } from "sonner";
import { coinPx } from "@/components/coin-ticker";
import { USDC } from "@/lib/jup-exec";
import { raceRoute, signRoute } from "@/lib/jup-sign";
import { routePro } from "@/lib/route-pro";
import { connectPhantom, readChain, type ChainWallet } from "@/lib/phantom";
import { rememberTrade } from "@/lib/trade-log";
import { bookOf, BOOK, type BookAsset, type BookLane } from "@/lib/sol-books";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const LANES: Array<[BookLane, string]> = [
  ["majors", "Majors"],
  ["metals", "Metals"],
  ["fx", "FX"],
  ["commodities", "Commodities"],
  ["mexico", "Mexico"],
];
const SIZES = [1, 5, 25, 100] as const;
const PRICE = "https://lite-api.jup.ag/price/v3?ids=";

export function ChainBook() {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [lane, setLane] = useState<BookLane>("majors");
  const [pick, setPick] = useState(BOOK[0].mint);
  const [usd, setUsd] = useState<(typeof SIZES)[number]>(5);
  const [px, setPx] = useState<Record<string, number>>({});
  const [chain, setChain] = useState<ChainWallet | null>(null);
  const [line, setLine] = useState("");
  const [busy, setBusy] = useState("");
  const rows = bookOf(lane);
  const chosen = BOOK.find((a) => a.mint === pick) ?? rows[0];

  useEffect(() => {
    let live = true;
    const pull = () => {
      void fetch(`${PRICE}${BOOK.map((a) => a.mint).filter(Boolean).join(",")}`, { headers: { accept: "application/json" } })
        .then((r) => r.json() as Promise<Record<string, { usdPrice?: number }>>)
        .then((body) => {
          if (!live) return;
          const next: Record<string, number> = {};
          for (const a of BOOK) next[a.mint] = Number(body[a.mint]?.usdPrice) || 0;
          setPx(next);
        })
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 20_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!owner) {
      setChain(null);
      return;
    }
    let live = true;
    readChain(owner)
      .then((s) => live && setChain(s))
      .catch(() => live && setChain(null));
    return () => {
      live = false;
    };
  }, [owner]);

  async function who() {
    const addr = owner || (await connectPhantom());
    if (!owner) {
      const linked = wallet.linkChain(addr, "Phantom", "phantom");
      if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "The wallet did not stay.");
    }
    return addr;
  }

  async function trade(asset: BookAsset, side: "buy" | "sell") {
    if (asset.trade === false) {
      toast.error(asset.line);
      return;
    }
    const price = px[asset.mint] || 0;
    if (side === "sell" && !(price > 0)) {
      toast.error("No live price. Nothing was sent.");
      return;
    }
    setBusy(side);
    try {
      const addr = await who();
      const held = chain?.tokens.find((t) => t.mint === asset.mint);
      const amountRaw = side === "buy" ? Math.round(usd * 1_000_000) : Math.max(1, Math.round((usd / price) * 10 ** (held?.decimals || asset.decimals)));
      const pro = routePro();
      const quote = await raceRoute({
        inputMint: side === "buy" ? USDC : asset.mint,
        outputMint: side === "buy" ? asset.mint : USDC,
        amountRaw,
        outDecimals: side === "buy" ? asset.decimals : 6,
        pro,
      });
      setLine(`${side === "buy" ? "Buy" : "Sell"} $${usd} ${asset.symbol} · out ${quote.outUi.toLocaleString("en-US", { maximumFractionDigits: 4 })} · ${quote.why} · impact ${quote.impact.toFixed(2)}%`);
      const done = await signRoute({
        owner: addr,
        inputMint: side === "buy" ? USDC : asset.mint,
        outputMint: side === "buy" ? asset.mint : USDC,
        amountRaw,
        outDecimals: side === "buy" ? asset.decimals : 6,
        usd,
        slippageBps: pro.slippageBps,
        onlyDirect: quote.direct,
        maxImpact: pro.maxImpact,
      });
      toast.success(`${asset.symbol} signed. ${done.signature.slice(0, 8)}…`);
      rememberTrade({ symbol: asset.symbol, side, usd, mint: asset.mint, signature: done.signature });
      readChain(addr).then(setChain).catch(() => undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not sign.");
    } finally {
      setBusy("");
    }
  }

  const have = chosen ? chain?.tokens.find((t) => t.mint === chosen.mint)?.ui ?? 0 : 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d14]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="flex gap-1">
          {LANES.map(([id, label]) => (
            <button key={id} type="button" onClick={() => { setLane(id); const first = bookOf(id)[0]; if (first) setPick(first.mint); setLine(""); }} className={cn("min-h-9 rounded-full px-3 text-sm font-semibold", lane === id ? "bg-white text-black" : "text-white/60")}>
              {label}
            </button>
          ))}
        </div>
        <p className="font-mono text-[11px] text-white/40">{rows.length} live</p>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
        <table className="w-full text-left text-sm">
          <tbody>
            {rows.map((row) => {
              const on = row.mint === chosen?.mint;
              const held = chain?.tokens.find((t) => t.mint === row.mint)?.ui ?? 0;
              return (
                <tr key={row.mint || row.symbol} onClick={() => { setPick(row.mint); setLine(""); }} className={cn("cursor-pointer border-t border-white/5", on ? "bg-white/10" : "hover:bg-white/[0.04]")}>
                  <td className="px-3 py-2.5">
                    <span className="font-semibold">{row.symbol}</span>
                    <span className="mt-0.5 block text-[11px] text-white/40">{row.name}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{px[row.mint] ? coinPx(px[row.mint]) : "—"}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-white/50">{held > 0 ? held.toLocaleString("en-US", { maximumFractionDigits: 4 }) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <aside className="border-t border-white/10 p-4 lg:border-t-0 lg:border-l">
          <p className="text-3xl tracking-tight">{chosen?.symbol ?? "—"}</p>
          <p className="mt-1 font-mono text-sm tabular-nums text-white/70">{chosen && px[chosen.mint] ? coinPx(px[chosen.mint]) : "—"}</p>
          <p className="mt-2 text-xs leading-relaxed text-white/55">{chosen?.line}</p>
          <p className="mt-2 font-mono text-[11px] text-white/40">Held {have > 0 ? have.toLocaleString("en-US", { maximumFractionDigits: 4 }) : "none"}</p>
          {chosen && px[chosen.mint] > 0 ? (
            <p className="mt-1 font-mono text-sm tabular-nums text-white/80">
              ${usd} ≈ {(usd / px[chosen.mint]).toLocaleString("en-US", { maximumFractionDigits: 2 })} {chosen.symbol}
            </p>
          ) : null}
          <div className="mt-3 flex gap-1">
            {SIZES.map((n) => (
              <button key={n} type="button" onClick={() => { setUsd(n); setLine(""); }} className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold", usd === n ? "bg-white text-black" : "border border-white/15 text-white/70")}>
                ${n}
              </button>
            ))}
          </div>
          <button type="button" disabled={!chosen || chosen.trade === false || busy !== ""} onClick={() => chosen && void trade(chosen, "buy")} className="mt-3 min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
            {chosen?.trade === false ? "No market" : busy === "buy" ? "Waiting on Phantom" : `Buy $${usd}`}
          </button>
          <button type="button" disabled={!chosen || chosen.trade === false || busy !== "" || !(have > 0)} onClick={() => chosen && void trade(chosen, "sell")} className="mt-2 min-h-11 w-full rounded-full border border-white/15 text-sm font-semibold disabled:opacity-40">
            {busy === "sell" ? "Waiting on Phantom" : `Sell $${usd}`}
          </button>
          {line ? <p className="mt-3 font-mono text-[11px] leading-relaxed text-white/60">{line}</p> : null}
        </aside>
      </div>
    </div>
  );
}
