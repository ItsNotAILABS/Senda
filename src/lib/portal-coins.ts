/** Coins published by Wormhole on a chain this desk already signs. A ticker with no published mint is not added. */

import { createServerFn } from "@tanstack/react-start";

export type PortalListing = {
  chain: string;
  chainId: number;
  address: string;
  decimals: number;
  pay: string;
  payDecimals: number;
};

export type PortalCoin = {
  symbol: string;
  name: string;
  price: number | null;
  listings: PortalListing[];
};

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const PAY: Record<number, { chain: string; pay: string; payDecimals: number }> = {
  1: { chain: "Ethereum", pay: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", payDecimals: 6 },
  56: { chain: "BNB", pay: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", payDecimals: 18 },
  137: { chain: "Polygon", pay: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", payDecimals: 6 },
  42161: { chain: "Arbitrum", pay: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", payDecimals: 6 },
  10: { chain: "Optimism", pay: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", payDecimals: 6 },
  43114: { chain: "Avalanche", pay: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", payDecimals: 6 },
  8453: { chain: "Base", pay: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", payDecimals: 6 },
};

const SKIP = /^(USDC|USDT|BUSD|DAI|FRAX|UST|USD)/;

function hex(value: string | undefined): string {
  const v = (value || "").trim();
  return /^0x[a-fA-F0-9]{40}$/.test(v) ? v : "";
}

function parse(csv: string): PortalCoin[] {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const head = lines[0].split(",");
  const col = (name: string) => head.indexOf(name);
  const ix = {
    source: col("source"),
    symbol: col("symbol"),
    name: col("name"),
    sourceAddress: col("sourceAddress"),
    sol: col("solAddress"),
    solDec: col("solDecimals"),
    ethDec: col("ethDecimals"),
    bsc: col("bscAddress"),
    bscDec: col("bscDecimals"),
    matic: col("maticAddress"),
    maticDec: col("maticDecimals"),
    avax: col("avaxAddress"),
    avaxDec: col("avaxDecimals"),
    op: col("optimismAddress"),
    opDec: col("optimismDecimals"),
    arb: col("arbitrumAddress"),
    arbDec: col("arbitrumDecimals"),
    base: col("baseAddress"),
    baseDec: col("baseDecimals"),
  };
  const out: PortalCoin[] = [];
  for (const line of lines.slice(1)) {
    const c = line.split(",");
    const symbol = c[ix.symbol] || "";
    const sol = c[ix.sol] || "";
    if (!symbol || SKIP.test(symbol) || sol.length < 32) continue;
    const listings: PortalListing[] = [
      { chain: "Solana", chainId: 7565164, address: sol, decimals: Number(c[ix.solDec]) || 8, pay: USDC, payDecimals: 6 },
    ];
    const add = (chainId: number, address: string, decimals: number) => {
      const pay = PAY[chainId];
      if (!pay || !hex(address) || listings.some((row) => row.chainId === chainId)) return;
      listings.push({ chain: pay.chain, chainId, address, decimals: decimals || 18, pay: pay.pay, payDecimals: pay.payDecimals });
    };
    const source = c[ix.source];
    const sourceAddress = c[ix.sourceAddress];
    if (source === "eth") add(1, sourceAddress, Number(c[ix.ethDec]));
    if (source === "bsc") add(56, sourceAddress, Number(c[ix.bscDec]));
    if (source === "avax") add(43114, sourceAddress, Number(c[ix.avaxDec]));
    add(56, c[ix.bsc], Number(c[ix.bscDec]));
    add(137, c[ix.matic], Number(c[ix.maticDec]));
    add(43114, c[ix.avax], Number(c[ix.avaxDec]));
    add(10, c[ix.op], Number(c[ix.opDec]));
    add(42161, c[ix.arb], Number(c[ix.arbDec]));
    add(8453, c[ix.base], Number(c[ix.baseDec]));
    out.push({ symbol, name: c[ix.name] || symbol, price: null, listings });
  }
  return out;
}

async function prices(mints: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let i = 0; i < mints.length; i += 40) {
    const ids = mints.slice(i, i + 40);
    const res = await fetch(`https://api.jup.ag/price/v3?ids=${ids.join(",")}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (!res?.ok) continue;
    const body = (await res.json()) as Record<string, { usdPrice?: number }>;
    for (const id of ids) {
      const px = Number(body[id]?.usdPrice);
      if (px > 0) out.set(id, px);
    }
  }
  return out;
}

export const loadPortalCoins = createServerFn({ method: "GET" }).handler(async (): Promise<PortalCoin[]> => {
  const res = await fetch("https://raw.githubusercontent.com/wormhole-foundation/wormhole-token-list/main/content/by_source.csv", {
    headers: { accept: "text/csv" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return [];
  const rows = parse(await res.text());
  const px = await prices(rows.map((row) => row.listings[0]?.address || "").filter(Boolean));
  for (const row of rows) {
    const mint = row.listings[0]?.address;
    row.price = mint ? px.get(mint) ?? null : null;
  }
  return rows
    .sort((a, b) => (b.price ?? 0) - (a.price ?? 0) || b.listings.length - a.listings.length)
    .slice(0, 48);
});
