import { useEffect, useState } from "react";
import { toast } from "sonner";
import { kaminoMarkets, signKamino, type KaminoReserve } from "@/lib/kamino-lend";
import { holdTrade } from "@/lib/offline-rail";
import { connectPhantom } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { shortBook, signMarketShort } from "@/lib/short-market";
import { useWalletCtx } from "@/lib/wallet-context";
import { connectWallet } from "@/lib/wallets";
import { deskFeeLine } from "@/lib/desk-fee";
import { cn } from "@/lib/utils";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

type Act = "" | "buy" | "sell" | "short" | "post" | "borrow";

/** Buy, sell, short, or post the holding to Kamino. The wallet signs each one. */
export function PositionActions({
  symbol,
  mint,
  price,
  qty,
  usd,
  owner,
}: {
  symbol: string;
  mint: string;
  price: number;
  qty: number;
  usd: number;
  owner: string;
}) {
  const wallet = useWalletCtx();
  const [act, setAct] = useState<Act>("");
  const [busy, setBusy] = useState(false);
  const [reserves, setReserves] = useState<KaminoReserve[]>([]);

  useEffect(() => {
    let live = true;
    kaminoMarkets()
      .then((rows) => {
        if (live) setReserves(rows);
      })
      .catch(() => {
        if (live) setReserves([]);
      });
    return () => {
      live = false;
    };
  }, []);

  const book = shortBook(symbol);
  const reserve = reserves.find((row) => row.mint === mint);
  const cash = reserve ? reserves.find((row) => row.market === reserve.market && (row.symbol === "USDC" || row.mint === USDC)) : undefined;
  const held = qty > 0 && symbol !== "USDC";

  async function who(): Promise<string> {
    const addr = owner || (await connectPhantom());
    if (!owner) {
      const linked = wallet.linkChain(addr, "Phantom", "phantom");
      if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
    }
    return addr;
  }

  async function run(next: Act) {
    if (!mint || !(usd > 0)) return;
    setBusy(true);
    try {
      const addr = await who();
      if (typeof navigator !== "undefined" && !navigator.onLine && (next === "buy" || next === "sell")) {
        const heldTrade = holdTrade({ kind: "spot", mint, symbol, side: next, usd, sol: 0, pool: "auto", price, decimals: 6 });
        if ("error" in heldTrade) throw new Error(heldTrade.error);
        toast.success(`${symbol} is held on this phone. It signs when the network is back.`);
        return;
      }
      if (next === "buy" || next === "sell") {
        if (next === "sell" && !held) throw new Error("This wallet holds none of that.");
        const done = await runPrestock({ owner: addr, mint, side: next, usd, price, symbol });
        toast.success(`${next === "buy" ? "Bought" : "Sold"} ${symbol}. ${done.signature.slice(0, 8)}…`);
        return;
      }
      if (next === "short") {
        if (!book) throw new Error("No short market on this name. Selling the token is not a short.");
        if (book.kind === "base") {
          const have = wallet.w.links.find((l) => l.kind === "evm")?.address ?? "";
          const trader = have || (await connectWallet("metamask")).address;
          if (!have) {
            const linked = wallet.linkChain(trader, "MetaMask", "evm");
            if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep MetaMask.");
          }
          const opened = await signMarketShort({ book, usd, owner: addr, trader });
          toast.success(`${symbol} short signed on ${opened.where}. ${opened.id.slice(0, 8)}…`);
          return;
        }
        const opened = await signMarketShort({ book, usd, owner: addr, trader: addr });
        toast.success(`${symbol} short signed on ${opened.where}. ${opened.id.slice(0, 8)}…`);
        return;
      }
      if (!reserve) throw new Error("Kamino does not lend against this mint.");
      if (next === "post") {
        const tokens = price > 0 ? Math.min(qty, usd / price) : 0;
        if (!(tokens > 0)) throw new Error("Nothing of this holding to post.");
        const sig = await signKamino({ action: "deposit", wallet: addr, market: reserve.market, reserve: reserve.reserve, amount: tokens.toFixed(6) });
        toast.success(`Posted ${symbol} on Kamino. ${sig.slice(0, 8)}…`);
        return;
      }
      if (!cash) throw new Error("That market has no USDC to borrow.");
      const sig = await signKamino({ action: "borrow", wallet: addr, market: reserve.market, reserve: cash.reserve, amount: usd.toFixed(2) });
      toast.success(`Borrowed $${usd.toFixed(2)} USDC. ${sig.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not sign.");
    } finally {
      setBusy(false);
      setAct("");
    }
  }

  const note = book
    ? `Short is ${book.label}.`
    : "No short market. A sell is not a short.";
  const loan = reserve
    ? `Kamino lends against it, up to ${(reserve.maxLtv * 100).toFixed(0)}% LTV. Post it first, then borrow USDC.`
    : "Kamino does not list this mint.";

  return (
    <div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {(
          [
            ["buy", "Buy"],
            ["sell", "Sell"],
            ["short", "Short"],
            ["post", "Loan"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            disabled={busy || !mint || (id === "sell" && !held) || (id === "short" && !book) || (id === "post" && !reserve)}
            onClick={() => setAct((cur) => (cur === id ? "" : id))}
            className={cn("min-h-10 rounded-xl text-xs font-semibold disabled:opacity-40", act === id ? "bg-white text-black" : id === "short" ? "bg-[#e11d48] text-white" : id === "buy" ? "bg-accent text-accent-fg" : "bg-white/10")}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-white/45">{note} {loan}</p>
      <p className="mt-1 text-[10px] leading-snug text-white/35">{deskFeeLine(usd)}</p>
      {act ? (
        <button type="button" disabled={busy} onClick={() => void run(act === "post" ? "post" : act)} className="mt-2 min-h-11 w-full rounded-xl bg-white text-sm font-semibold text-black disabled:opacity-50">
          {busy ? "Waiting for the wallet…" : act === "post" ? `Sign posting $${usd} of ${symbol}` : act === "borrow" ? `Sign borrowing $${usd}` : `Sign ${act} $${usd} ${symbol}`}
        </button>
      ) : null}
      {act === "post" && cash ? (
        <button type="button" disabled={busy} onClick={() => void run("borrow")} className="mt-2 min-h-11 w-full rounded-xl border border-white/15 text-sm font-semibold disabled:opacity-50">
          Borrow ${usd} USDC
        </button>
      ) : null}
    </div>
  );
}
