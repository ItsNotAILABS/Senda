import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BASKETS_PROGRAM, quoteBasket, RECIPES, type BasketQuote, type RecipeId } from "@/lib/baskets";

const PRESETS = [50, 100, 250, 1000];

export function BasketsDesk() {
  const [id, setId] = useState<RecipeId>("universes");
  const [raw, setRaw] = useState("100");
  const [quote, setQuote] = useState<BasketQuote | null>(null);
  const [error, setError] = useState("");
  const usd = Number(raw) || 0;
  const recipe = RECIPES.find((row) => row.id === id) ?? RECIPES[0];

  useEffect(() => {
    if (!(usd > 0) || usd > 5000) {
      setQuote(null);
      setError(usd > 5000 ? "The receipt stops at $5,000." : "");
      return;
    }
    let live = true;
    const handle = window.setTimeout(() => {
      void quoteBasket({ data: { id, usd } })
        .then((next) => {
          if (!live) return;
          setQuote(next);
          setError("");
        })
        .catch((err: unknown) => {
          if (!live) return;
          setQuote(null);
          setError(err instanceof Error ? err.message : "The basket did not price.");
        });
    }, 280);
    return () => {
      live = false;
      window.clearTimeout(handle);
    };
  }, [id, usd]);

  const carry = quote ? Number(quote.carryBps) / 100 : 0;

  return (
    <div className="grid gap-3 p-3">
      <section className="rounded-2xl border border-white/10 bg-[#07080d] p-4">
        <div className="h-px w-full bg-[#d6ff4a]" />
        <p className="mt-3 font-mono text-[10px] tracking-[0.16em] text-[#d6ff4a] uppercase">Baskets</p>
        <h2 className="mt-1 text-lg font-semibold">One receipt across the universes</h2>
        <p className="mt-1 text-xs leading-relaxed text-white/45">
          The recipe bundles offerings you already list. Carry is a published rate on a sleeve. A sleeve with no rate is a mark, not a payout. The program does not hold the tokens, and it does not spend mainnet USDC.
        </p>
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {RECIPES.map((row) => (
            <button key={row.id} type="button" onClick={() => setId(row.id)} className={id === row.id ? "min-h-10 shrink-0 rounded-full bg-white px-3 text-sm font-semibold text-black" : "min-h-10 shrink-0 rounded-full bg-white/10 px-3 text-sm font-semibold text-white/70"}>
              {row.name}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-white/45">{recipe.line}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((n) => (
            <button key={n} type="button" onClick={() => setRaw(String(n))} className={usd === n ? "min-h-9 rounded-full bg-[#d6ff4a] px-3 text-xs font-semibold text-black" : "min-h-9 rounded-full border border-white/15 px-3 text-xs text-white/70"}>
              ${n}
            </button>
          ))}
          <input value={raw} onChange={(e) => setRaw(e.target.value.replace(/[^0-9.]/g, "").slice(0, 8))} inputMode="decimal" className="min-h-9 w-24 rounded-full border border-white/15 bg-black px-3 font-mono text-xs text-white" />
        </div>
      </section>
      <section className="rounded-2xl border border-white/10 bg-[#10131c] p-4">
        {error ? <p className="text-sm text-[#ff5d73]">{error}</p> : null}
        {quote ? (
          <>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] tracking-[0.16em] text-white/35 uppercase">Published carry</p>
                <p className="mt-1 font-mono text-2xl tabular-nums text-[#d6ff4a]">${quote.income}</p>
                <p className="text-xs text-white/45">a year on ${quote.usd} · {carry.toFixed(2)}%. Not a payment from this program.</p>
              </div>
              <p className="text-right font-mono text-[10px] text-white/35">{quote.engine === "python" ? "Priced in Python." : "Priced on this host."}</p>
            </div>
            <ul className="mt-4 space-y-3">
              {quote.legs.map((leg) => (
                <li key={leg.mint} className="border-b border-white/10 pb-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold">
                      {leg.symbol}
                      <span className="ml-2 font-mono text-[10px] tracking-[0.14em] text-white/35 uppercase">{leg.group} · {leg.bps / 100}%</span>
                    </p>
                    <p className="font-mono text-xs tabular-nums">{leg.kind === "carry" ? <span className="text-[#d6ff4a]">${leg.income}</span> : <span className="text-white/40">mark</span>}</p>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-white/40">
                    ${leg.usd} · {leg.qty} @ ${leg.price}
                    {leg.apy ? ` · rate ${(Number(leg.apy) * 100).toFixed(2)}%` : " · no published rate"}
                  </p>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={!BASKETS_PROGRAM || !quote.instruction}
              onClick={() => toast.error("Baskets has no devnet address. The recipe is not sent.")}
              className="mt-4 min-h-11 w-full rounded-full bg-[#d6ff4a] text-sm font-semibold text-black disabled:opacity-40"
            >
              Record on devnet
            </button>
            <p className="mt-2 text-[11px] leading-relaxed text-white/35">
              {BASKETS_PROGRAM
                ? `Program ${BASKETS_PROGRAM}. Phantom would sign the rent. Mainnet USDC does not move.`
                : "Baskets has no devnet address yet. Recording it would invent an account, so the button stays off."}
              {quote.instruction ? ` The Open instruction is ${quote.instruction.length / 2} bytes. The account is ${quote.accountBytes} bytes.` : " The instruction bytes were not built."}
            </p>
            <p className="mt-1 text-[11px] text-white/30">{quote.proof}</p>
          </>
        ) : error ? null : (
          <p className="text-sm text-white/45">Pricing the recipe…</p>
        )}
      </section>
    </div>
  );
}
