import { useEffect, useState } from "react";
import { toast } from "sonner";
import { setIntent } from "@/lib/book";
import { LTV, loadLoans, borrow, repay } from "@/lib/lend";
import { getEquityBook, listedMarks, type ListedStock, type StockReserve } from "@/lib/equities";
import { connectPhantom, mintDecimals, readChain, splHolding } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { USDC } from "@/lib/jup-exec";
import { signRoute } from "@/lib/jup-sign";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { formatUsd, type HouseListing } from "@/lib/sol-house";
import { formatMoney } from "@/lib/wallet";

export function LendDesk({ house }: { house: HouseListing[] }) {
  const wallet = useWallet();
  const [loans, setLoans] = useState(loadLoans);
  const names = house.filter((h) => h.venue === "prestocks" && h.last > 0);
  const [listed, setListed] = useState<{ stock: ListedStock; ui: number; price: number }[]>([]);
  const [rates, setRates] = useState<StockReserve[]>([]);
  const [bags, setBags] = useState<{ id: string; mint: string; symbol: string; ui: number; last: number }[]>([]);

  useEffect(() => {
    const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
    if (!owner) return;
    let live = true;
    Promise.all([getEquityBook().catch(() => null), readChain(owner).catch(() => null)])
      .then(async ([book, chain]) => {
        if (!live || !book || !chain) return;
        const held = book.stocks
          .map((stock) => ({ stock, ui: chain.tokens.find((t) => t.mint === stock.mint)?.ui ?? 0 }))
          .filter((row) => row.ui > 0)
          .slice(0, 12);
        if (held.length === 0) {
          setListed([]);
          return;
        }
        const marks = await listedMarks({ data: held.map((row) => row.stock.mint) }).catch(() => ({} as Record<string, number>));
        if (!live) return;
        setListed(held.map((row) => ({ ...row, price: marks[row.stock.mint] || 0 })));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [wallet.w.links, loans]);

  useEffect(() => {
    let live = true;
    getEquityBook()
      .then((book) => {
        if (!live) return;
        setRates(
          book.reserves
            .filter((row) => row.borrowApy > 0)
            .sort((a, b) => a.borrowApy - b.borrowApy),
        );
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
    if (!owner) {
      setBags([]);
      return;
    }
    let live = true;
    readChain(owner)
      .then((chain) => {
        if (!live) return;
        setBags(
          names
            .map((name) => ({
              id: name.id,
              mint: name.mint,
              symbol: name.symbol,
              last: name.last,
              ui: chain.tokens.find((token) => token.mint === name.mint)?.ui ?? 0,
            }))
            .filter((row) => row.ui > 0),
        );
      })
      .catch(() => live && setBags([]));
    return () => {
      live = false;
    };
  }, [wallet.w.links, house]);

  async function take(h: HouseListing) {
    try {
      const existing = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      const owner = existing || (await connectPhantom());
      if (!existing) {
        const linked = wallet.linkChain(owner, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      const held = await splHolding(owner, h.mint);
      const full = Math.round(held.ui * h.last * LTV * 100) / 100;
      const already = loans.find((l) => l.stockId === h.id)?.borrowed ?? 0;
      const draw = Math.round((full - already) * 100) / 100;
      if (draw < 0.5) {
        toast.error(full < 0.5 ? `No ${h.symbol} in this wallet.` : `${h.symbol} is already drawn.`);
        return;
      }
      setIntent("trade");
      const done = await runPrestock({ owner, mint: h.mint, side: "sell", usd: draw, price: h.last });
      const next = borrow(loans, h.id, h.symbol, held.ui, h.last);
      if (!Array.isArray(next)) {
        toast.error(next.error);
        return;
      }
      setLoans(next);
      toast.success(`Sold $${draw.toFixed(2)} of ${h.symbol} for USDC. ${done.signature.slice(0, 8)}… Repay buys it back.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The loan did not open.");
    }
  }

  async function takeListed(stock: ListedStock, ui: number, price: number) {
    if (!(price > 0)) return toast.error("No live price. Nothing was sent.");
    try {
      const existing = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      const owner = existing || (await connectPhantom());
      if (!existing) {
        const linked = wallet.linkChain(owner, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      const full = Math.round(ui * price * LTV * 100) / 100;
      const already = loans.find((l) => l.stockId === stock.mint)?.borrowed ?? 0;
      const draw = Math.round((full - already) * 100) / 100;
      if (draw < 0.5) {
        toast.error(full < 0.5 ? `No ${stock.symbol} in this wallet.` : `${stock.symbol} is already drawn.`);
        return;
      }
      const dec = await mintDecimals(stock.mint);
      const tokens = draw / price;
      const done = await signRoute({
        owner,
        inputMint: stock.mint,
        outputMint: USDC,
        amountRaw: Math.max(1, Math.floor(tokens * 10 ** dec)),
        outDecimals: 6,
        usd: draw,
      });
      const next = borrow(loans, stock.mint, stock.symbol, ui, price, stock.mint);
      if (!Array.isArray(next)) {
        toast.error(next.error);
        return;
      }
      setLoans(next);
      window.dispatchEvent(new Event("senda-chain"));
      toast.success(`Sold $${draw.toFixed(2)} of ${stock.symbol} for USDC. ${done.signature.slice(0, 8)}… Repay buys it back.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The loan did not open.");
    }
  }

  async function pay(id: string) {
    const loan = loans.find((l) => l.id === id);
    if (!loan) return;
    try {
      const existing = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      const owner = existing || (await connectPhantom());
      const name = names.find((n) => n.symbol === loan.symbol) ?? names.find((n) => n.id === loan.stockId);
      if (loan.mint && !name) {
        const dec = await mintDecimals(loan.mint);
        const done = await signRoute({
          owner,
          inputMint: USDC,
          outputMint: loan.mint,
          amountRaw: Math.max(1, Math.round(loan.borrowed * 1e6)),
          outDecimals: dec,
          usd: loan.borrowed,
        });
        setLoans(repay(loans, id));
        toast.success(`Bought ${loan.symbol} back. ${done.signature.slice(0, 8)}…`);
        window.dispatchEvent(new Event("senda-chain"));
        return;
      }
      if (!name) throw new Error("That name is not on the book.");
      setIntent("hold");
      const done = await runPrestock({ owner, mint: name.mint, side: "buy", usd: loan.borrowed, price: name.last });
      setLoans(repay(loans, id));
      toast.success(`Bought ${loan.symbol} back. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The repay did not send.");
    }
  }

  function openRoom(stockId: string, ui: number, last: number) {
    const cap = Math.round(ui * last * LTV * 100) / 100;
    const already = loans.find((loan) => loan.stockId === stockId)?.borrowed ?? 0;
    return { cap, already, left: Math.max(0, Math.round((cap - already) * 100) / 100) };
  }

  return (
    <div className="space-y-3 px-1 pb-8">
      <section className="rounded-[28px] border border-white/10 bg-[#101114] p-4">
        <p className="text-[11px] tracking-[0.16em] text-[#c6f56a]">LOANS</p>
        <h2 className="mt-1 text-2xl font-semibold">Borrow against what you already hold.</h2>
        <p className="mt-2 text-sm text-white/55">A draw sells up to half that holding for USDC. Phantom signs it. Repay buys the same slice back at the live price. There is no separate interest line.</p>
        <p className="mt-3 font-mono text-sm text-[#c6f56a]">{loans.length ? `${loans.length} open · ${formatMoney(loans.reduce((sum, loan) => sum + loan.borrowed, 0))}` : "Nothing drawn"}</p>
      </section>
      <div className="grid gap-2">
        <article className="rounded-[24px] border border-[#c6f56a]/25 bg-[#070b08] p-4">
          <p className="text-[11px] tracking-[0.14em] text-[#c6f56a]">PRE-IPO NAMES</p>
          <h3 className="mt-1 text-lg font-semibold">Up to half the holding</h3>
          <p className="mt-2 text-sm text-white/70">Half the tokens are sold for USDC. The rest stays in the wallet. Repay buys that slice back.</p>
          <p className="mt-3 font-mono text-sm">Limit 50% · No APR · Repay = live price</p>
        </article>
        <article className="rounded-[24px] border border-white/10 bg-[#101114] p-4">
          <p className="text-[11px] tracking-[0.14em] text-white/40">LISTED SHARES</p>
          <h3 className="mt-1 text-lg font-semibold">Same loan, on a share you hold</h3>
          <p className="mt-2 text-sm text-white/70">SPYx and the other xStocks show up here only after this wallet holds them. Jupiter sells the slice. Repay buys the share back.</p>
          <p className="mt-3 font-mono text-sm">Limit 50% · No APR · You must hold it</p>
        </article>
      </div>
      {loans.length > 0 ? (
        <section className="rounded-[24px] border border-white/10 bg-[#101114] p-4">
          <p className="text-sm font-semibold">Open</p>
          <ul className="mt-2">
            {loans.map((loan) => {
              const name = names.find((row) => row.id === loan.stockId);
              const back = name ? name.last : listed.find((row) => row.stock.mint === loan.mint)?.price ?? 0;
              return (
                <li key={loan.id} className="flex items-center justify-between gap-3 border-t border-white/10 py-3">
                  <span>
                    <span className="block text-sm font-semibold">{loan.symbol}</span>
                    <span className="block font-mono text-[11px] text-white/45">
                      Drew {formatMoney(loan.borrowed)}
                      {back > 0 ? ` · buy back near ${formatUsd(back)}` : ""}
                    </span>
                  </span>
                  <button type="button" onClick={() => void pay(loan.id)} className="min-h-10 rounded-full bg-white px-4 text-xs font-semibold text-black">
                    Repay
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="rounded-[24px] border border-white/10 bg-[#101114] p-4">
        <p className="text-sm font-semibold">You can draw</p>
        <p className="mt-1 text-xs text-white/45">Only tokens this wallet holds. The dollar is half the live value, minus what is already open.</p>
        {bags.length === 0 && listed.length === 0 ? <p className="mt-3 text-sm text-white/50">Buy a name or a listed share first. A loan does not open against an empty wallet.</p> : null}
        <ul>
          {bags.map((row) => {
            const quote = openRoom(row.id, row.ui, row.last);
            return (
              <li key={row.mint} className="flex items-center justify-between gap-3 border-t border-white/10 py-3">
                <span>
                  <span className="block text-sm font-semibold">{row.symbol}</span>
                  <span className="block font-mono text-[11px] text-white/45">
                    {row.ui.toLocaleString("en-US", { maximumFractionDigits: 4 })} · {formatUsd(row.last)} · {quote.left >= 0.5 ? `draw ${formatMoney(quote.left)}` : "already drawn"}
                  </span>
                </span>
                <button type="button" disabled={quote.left < 0.5} onClick={() => { const name = names.find((item) => item.id === row.id); if (name) void take(name); }} className="min-h-10 rounded-full bg-[#d7e36a] px-4 text-xs font-semibold text-black disabled:opacity-40">
                  Draw
                </button>
              </li>
            );
          })}
          {listed.map((row) => {
            const quote = openRoom(row.stock.mint, row.ui, row.price);
            return (
              <li key={row.stock.mint} className="flex items-center justify-between gap-3 border-t border-white/10 py-3">
                <span>
                  <span className="block text-sm font-semibold">{row.stock.symbol}</span>
                  <span className="block font-mono text-[11px] text-white/45">
                    {row.ui.toLocaleString("en-US", { maximumFractionDigits: 4 })} · {row.price > 0 ? formatUsd(row.price) : "no price"} · {quote.left >= 0.5 ? `draw ${formatMoney(quote.left)}` : "already drawn"}
                  </span>
                </span>
                <button type="button" disabled={quote.left < 0.5} onClick={() => void takeListed(row.stock, row.ui, row.price)} className="min-h-10 rounded-full bg-[#d7e36a] px-4 text-xs font-semibold text-black disabled:opacity-40">
                  Draw
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {rates.length > 0 ? (
        <section className="rounded-[24px] border border-white/10 bg-[#101114] p-4">
          <p className="text-sm font-semibold">Kamino rates</p>
          <p className="mt-1 text-xs text-white/45">Published borrow rates on listed shares. Senda does not sign that market. A draw above uses Jupiter on a token this wallet holds.</p>
          <ul className="mt-2 max-h-80 overflow-auto">
            {rates.map((row) => (
              <li key={row.mint} className="flex items-baseline justify-between gap-3 border-t border-white/10 py-2">
                <span className="text-sm font-semibold">{row.symbol}</span>
                <span className="font-mono text-xs text-white/70">
                  {(row.borrowApy * 100).toFixed(2)}% · max {(row.maxLtv * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
