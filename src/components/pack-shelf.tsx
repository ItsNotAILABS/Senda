import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TokenMark } from "@/components/token-mark";
import { signStockSwap } from "@/lib/jup-sign";
import { connectPhantom } from "@/lib/phantom";
import { getHouse, formatUsd, type HouseListing } from "@/lib/sol-house";
import { rememberTrade } from "@/lib/trade-log";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const PRICE = 1;

type Opened = { symbol: string; mint: string; sig: string; at: number };

/** A pack is a one-dollar buy of the token printed on the card. The token is what lands in the wallet. */
export function PackShelf() {
  const wallet = useWallet();
  const [cards, setCards] = useState<HouseListing[]>([]);
  const [pick, setPick] = useState<HouseListing | null>(null);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getHouse()
      .then((rows) => {
        const tradable = rows.filter((row) => row.mint && row.last > 0);
        setCards(tradable.slice(0, 12));
      })
      .catch(() => undefined);
  }, []);

  async function buy(row: HouseListing) {
    setBusy(true);
    try {
      const have = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      const who = have || (await connectPhantom());
      if (!have) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep Phantom.");
      }
      const done = await signStockSwap({ owner: who, mint: row.mint, side: "buy", usd: PRICE, symbol: row.symbol, refPrice: row.last });
      rememberTrade({ symbol: row.symbol, side: "buy", usd: PRICE, mint: row.mint, signature: done.signature });
      setOpened({ symbol: row.symbol, mint: row.mint, sig: done.signature, at: Date.now() });
      setPick(null);
      toast.success(`${row.symbol} is in the wallet. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The pack did not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border-b border-white/10 px-3 py-4">
      <p className="font-mono text-[10px] tracking-[0.16em] text-white/40 uppercase">Packs</p>
      <h2 className="mt-1 text-2xl tracking-tight">A card is the token.</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/50">
        A pack is ${PRICE} of the asset on the card. Phantom signs a Jupiter buy, and that token is what shows up in the wallet. It is not an option, and it is not a separate picture NFT. A picture would be a different asset and a rent fee. These are the shares and listed tokens already on the book.
      </p>
      {opened ? (
        <div className="mt-4 w-[220px] rounded-2xl border border-accent/40 bg-[#12151c] p-4">
          <TokenMark stock={cards.find((c) => c.symbol === opened.symbol) ?? { symbol: opened.symbol, image: "" }} className="size-16" />
          <p className="mt-3 font-mono text-xl">{opened.symbol}</p>
          <p className="text-xs text-white/45">Opened. ${PRICE} bought.</p>
          <p className="mt-1 font-mono text-[10px] text-white/35">{opened.sig.slice(0, 12)}…</p>
        </div>
      ) : null}
      <ul className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {cards.map((row) => (
          <li key={row.mint}>
            <button
              type="button"
              onClick={() => setPick(row)}
              className={cn("w-[168px] rounded-2xl border bg-[#10131c] p-3 text-left", pick?.mint === row.mint ? "border-accent" : "border-white/10")}
            >
              <TokenMark stock={row} className="size-14" />
              <p className="mt-3 text-sm font-semibold">{row.symbol}</p>
              <p className="font-mono text-[11px] text-white/40">{formatUsd(row.last)}</p>
              <p className="mt-2 text-[10px] tracking-wide text-white/35 uppercase">{row.venue === "prestocks" ? "Pre-IPO" : "Token"} · ${PRICE}</p>
            </button>
          </li>
        ))}
      </ul>
      {pick ? (
        <div className="mt-3 rounded-2xl border border-white/10 p-3">
          <p className="text-sm font-semibold">Open {pick.symbol}</p>
          <p className="mt-1 text-xs text-white/45">You pay ${PRICE} USDC. You receive {pick.symbol}. Nothing else is minted.</p>
          <button type="button" disabled={busy} onClick={() => void buy(pick)} className="mt-3 h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg disabled:opacity-40">
            {busy ? "Waiting on Phantom" : `Buy the ${pick.symbol} pack`}
          </button>
        </div>
      ) : null}
      {!cards.length ? <p className="mt-3 text-sm text-white/40">The book has no priced card yet.</p> : null}
    </section>
  );
}
