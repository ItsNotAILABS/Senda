import { DERIVS } from "@/lib/deriv-book";
import { buildPerpIncrease, executePerpTx } from "@/lib/jup-venues";
import { openBase } from "@/lib/open-base";
import { signSerializedTx } from "@/lib/phantom";

export type ShortBook =
  | { kind: "jup"; asset: "SOL" | "ETH" | "BTC"; label: string }
  | { kind: "base"; pair: string; label: string };

const ALIAS: Record<string, string> = {
  SPY: "US500",
  SPYX: "US500",
  SPX: "US500",
  QQQ: "US100",
  QQQX: "US100",
  NDX: "US100",
  NASDAQ: "US100",
  WBTC: "BTC",
  BTCB: "BTC",
  WETH: "ETH",
  WSOL: "SOL",
  GOLD: "XAU",
  XAUUSD: "XAU",
  SILVER: "XAG",
  OIL: "WTI",
  USOIL: "WTI",
};

function namesFor(symbol: string): string[] {
  const raw = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const names = raw.endsWith("X") && raw.length > 2 ? [raw, raw.slice(0, -1)] : [raw];
  const aliased = names.flatMap((name) => (ALIAS[name] ? [name, ALIAS[name]] : [name]));
  return [...new Set(aliased)];
}

/** Where a market short actually signs. Null means there is no short, and a token sale is not one. */
export function shortBook(symbol: string): ShortBook | null {
  const names = namesFor(symbol);
  for (const name of names) {
    if (name === "SOL" || name === "ETH" || name === "BTC") return { kind: "jup", asset: name, label: `${name} perpetual` };
  }
  for (const name of names) {
    const hit = DERIVS.find((row) => row.avantis && row.base.toUpperCase() === name);
    if (hit?.avantis) return { kind: "base", pair: hit.avantis, label: hit.avantis };
  }
  return null;
}

export async function signMarketShort(input: { book: ShortBook; usd: number; owner: string; trader: string }): Promise<{ id: string; where: string }> {
  if (!(input.usd >= 10)) throw new Error("A short needs at least $10 of collateral.");
  if (input.book.kind === "jup") {
    const built = await buildPerpIncrease({
      data: { owner: input.owner, asset: input.book.asset, side: "short", usd: input.usd, leverage: 2 },
    });
    const signed = await signSerializedTx(built.tx);
    const done = await executePerpTx({ data: { action: "increase-position", serializedTxBase64: signed } });
    return { id: done.txid, where: "Jupiter" };
  }
  const opened = await openBase({ trader: input.trader, pair: input.book.pair, side: "short", usd: input.usd });
  return { id: opened.hash, where: "Base" };
}
