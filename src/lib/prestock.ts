/** Every PreStock is the same object: a mint, a live route, a signed swap. */

import { createServerFn } from "@tanstack/react-start";
import { signStockSwap } from "@/lib/jup-sign";
import { mintDecimals, splHolding } from "@/lib/phantom";

const PRE = "https://prestocks.com/api/prestocks";

export type PreRoute = {
  symbol: string;
  mint: string;
  route: string;
  outRaw: string;
  ok: boolean;
};

export async function runPrestock(input: {
  owner: string;
  mint: string;
  side: "buy" | "sell";
  usd: number;
  /** Token price in USD. Used to size a partial sell. */
  price?: number;
}): Promise<{ signature: string; outUi: number }> {
  const holding = input.side === "sell" ? await splHolding(input.owner, input.mint) : null;
  const decimals = holding?.decimals || (await mintDecimals(input.mint));
  let tokenAmount: bigint | undefined;
  if (input.side === "sell") {
    if (!holding || BigInt(holding.raw) <= 0n) throw new Error("This wallet holds none of that token.");
    const have = BigInt(holding.raw);
    const px = input.price ?? 0;
    if (px > 0 && input.usd > 0) {
      const want = BigInt(Math.max(1, Math.floor((input.usd / px) * 10 ** decimals)));
      tokenAmount = want > have ? have : want;
    } else {
      tokenAmount = have;
    }
  }
  return signStockSwap({
    owner: input.owner,
    mint: input.mint,
    usd: input.usd,
    side: input.side,
    decimals,
    tokenAmount,
  });
}

/** What a sale of the on-chain balance would raise, at the live token price. */
export function spendable(ui: number, price: number): number {
  if (!(ui > 0) || !(price > 0)) return 0;
  return Math.round(ui * price * 100) / 100;
}

export const getPreRoutes = createServerFn({ method: "GET" }).handler(async (): Promise<PreRoute[]> => {
  const res = await fetch(PRE, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`PreStocks ${res.status}`);
  const rows = (await res.json()) as Array<{ symbol?: string; contract_address?: string }>;
  return rows.map((r) => {
    const mint = String(r.contract_address ?? "");
    const symbol = String(r.symbol ?? "");
    return { symbol, mint, route: mint.length >= 32 ? "Jupiter" : "", outRaw: "", ok: mint.length >= 32 };
  });
});
