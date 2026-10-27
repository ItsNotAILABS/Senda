import { useState } from "react";
import { toast } from "sonner";
import { BACKPACK } from "@/lib/backpack";
import { signStockSwap } from "@/lib/jup-sign";
import { holdTrade } from "@/lib/offline-rail";
import { connectPhantom } from "@/lib/phantom";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

type Line = { symbol: string; mint: string; usd: number };

function take(symbols: string[], usd: number): Line[] {
  return symbols.flatMap((symbol) => {
    const row = BACKPACK.find((name) => name.symbol === symbol);
    return row ? [{ symbol: row.symbol, mint: row.mint, usd }] : [];
  });
}

const PACKS: { id: string; name: string; line: string; lines: Line[] }[] = [
  { id: "chip", name: "Chip pack", line: "NVDA, AMD, AVGO, INTC. You see the names before you pay.", lines: take(["NVDA", "AMD", "AVGO", "INTC"], 5) },
  { id: "desk", name: "Desk pack", line: "AAPL, META, AMZN, TSLA. Four buys. Four signatures.", lines: take(["AAPL", "META", "AMZN", "TSLA"], 5) },
  { id: "haul", name: "Haul", line: "INTC and SNDK. What you receive is what is listed.", lines: take(["INTC", "SNDK"], 10) },
];

/** A pack is a list of shares you buy and receive. Nothing is hidden, and nothing is rolled. */
export function PackDesk() {
  const wallet = useWallet();
  const [busy, setBusy] = useState("");
  const [haul, setHaul] = useState<Array<{ symbol: string; got: string; sig: string }>>([]);

  async function buy(id: string) {
    const pack = PACKS.find((row) => row.id === id);
    if (!pack) return;
    setBusy(id);
    try {
      const have = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      const who = have || (await connectPhantom());
      if (!have) {
        const linked = wallet.linkChain(who, "Phantom", "phantom");
        if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Could not keep Phantom.");
      }
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      for (const line of pack.lines) {
        if (offline) {
          const held = holdTrade({ kind: "spot", mint: line.mint, symbol: line.symbol, side: "buy", usd: line.usd, sol: 0, pool: "auto", price: 0, decimals: 6 });
          if ("error" in held) throw new Error(held.error);
          setHaul((cur) => [{ symbol: line.symbol, got: `$${line.usd} held`, sig: "phone" }, ...cur]);
          continue;
        }
        const done = await signStockSwap({ owner: who, mint: line.mint, side: "buy", usd: line.usd, decimals: 6, symbol: line.symbol });
        setHaul((cur) => [{ symbol: line.symbol, got: done.outUi > 0 ? done.outUi.toPrecision(4) : "signed", sig: done.signature.slice(0, 8) }, ...cur]);
      }
      toast.success(offline ? `${pack.name} is held on this phone.` : `${pack.name} is in the wallet.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The pack stopped.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-3 p-3">
      <p className="text-sm text-white/60">A pack is shares you buy and receive. The names are on the card. Each name is its own wallet signature. There is no roll.</p>
      {PACKS.map((pack) => (
        <section key={pack.id} className="rounded-2xl border border-white/10 bg-black/30 p-3">
          <p className="text-sm font-semibold">{pack.name}</p>
          <p className="mt-1 text-xs text-white/45">{pack.line}</p>
          <ul className="mt-2 space-y-1">
            {pack.lines.map((line) => (
              <li key={line.mint} className="flex justify-between font-mono text-xs">
                <span>{line.symbol}</span>
                <span>${line.usd}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 font-mono text-sm">${pack.lines.reduce((s, l) => s + l.usd, 0)} USDC</p>
          <button type="button" disabled={busy !== ""} onClick={() => void buy(pack.id)} className="mt-3 min-h-12 w-full rounded-xl bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
            {busy === pack.id ? "Waiting for the wallet…" : `Buy ${pack.name}`}
          </button>
        </section>
      ))}
      {haul.length ? (
        <section className="rounded-2xl border border-white/10 p-3">
          <p className="text-[10px] tracking-[0.14em] text-white/40 uppercase">Received</p>
          <ul className="mt-2 space-y-1">
            {haul.map((row, i) => (
              <li key={`${row.sig}-${i}`} className="flex justify-between font-mono text-xs">
                <span>{row.symbol}</span>
                <span>{row.got} · {row.sig}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
