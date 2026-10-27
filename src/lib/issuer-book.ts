/** Issuer tokens on the chain they actually live on. Addresses come from the issuer, not from a ticker guess. */

import { createServerFn } from "@tanstack/react-start";
import { BACKPACK } from "@/lib/backpack";

export type IssuerVenue = {
  chain: string;
  chainId: number;
  address: string;
  decimals: number;
  pay: string;
  payDecimals: number;
};

export type IssuerToken = {
  issuer: "Ondo" | "xStocks" | "Backpack";
  symbol: string;
  name: string;
  venues: IssuerVenue[];
};

const PAY: Record<number, { pay: string; payDecimals: number }> = {
  1: { pay: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", payDecimals: 6 },
  56: { pay: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", payDecimals: 18 },
  42161: { pay: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", payDecimals: 6 },
  10: { pay: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", payDecimals: 6 },
};

const CHAIN_NAME: Record<number, string> = { 1: "Ethereum", 56: "BNB", 42161: "Arbitrum", 10: "Optimism" };

const X_NET: Record<string, number> = {
  Ethereum: 1,
  BinanceSmartChain: 56,
  Arbitrum: 42161,
  Optimism: 10,
};

const FIRST = ["AAPLon", "TSLAon", "NVDAon", "MSFTon", "GOOGLon", "AMZNon", "METAon", "SPYon", "QQQon", "COINon"];

type OndoTok = { chainId?: number; address?: string; symbol?: string; name?: string; decimals?: number };
type XDep = { network?: string; address?: string };
type XNode = { symbol?: string; name?: string; deployments?: XDep[] };

function rank(symbol: string): number {
  const i = FIRST.indexOf(symbol);
  return i < 0 ? 100 : i;
}

async function ondo(): Promise<IssuerToken[]> {
  const res = await fetch("https://raw.githubusercontent.com/ondoprotocol/ondo-global-markets-token-list/main/tokenlist.json", {
    headers: { accept: "application/json" },
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { tokens?: OndoTok[] };
  const by = new Map<string, IssuerToken>();
  for (const tok of body.tokens || []) {
    const chainId = tok.chainId || 0;
    const pay = PAY[chainId];
    if (!tok.symbol || !tok.address || !pay || !CHAIN_NAME[chainId]) continue;
    const row = by.get(tok.symbol) || { issuer: "Ondo" as const, symbol: tok.symbol, name: tok.name || tok.symbol, venues: [] };
    if (!row.venues.some((v) => v.chainId === chainId)) {
      row.venues.push({ chain: CHAIN_NAME[chainId], chainId, address: tok.address, decimals: tok.decimals || 18, ...pay });
    }
    by.set(tok.symbol, row);
  }
  return [...by.values()].sort((a, b) => rank(a.symbol) - rank(b.symbol) || a.symbol.localeCompare(b.symbol));
}

async function xstocks(): Promise<IssuerToken[]> {
  const pages = await Promise.all(
    [0, 1, 2].map(async (page) => {
      const res = await fetch(`https://api.xstocks.fi/api/v2/public/assets?page=${page}`, {
        headers: { accept: "application/json", "user-agent": "Senda" },
      });
      if (!res.ok) return [] as XNode[];
      const body = (await res.json()) as { nodes?: XNode[] };
      return body.nodes || [];
    }),
  );
  const out: IssuerToken[] = [];
  for (const node of pages.flat()) {
    const venues: IssuerVenue[] = [];
    for (const dep of node.deployments || []) {
      if (dep.network === "Solana" && dep.address) {
        venues.push({
          chain: "Solana",
          chainId: 7565164,
          address: dep.address,
          decimals: 8,
          pay: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          payDecimals: 6,
        });
        continue;
      }
      const chainId = dep.network ? X_NET[dep.network] : 0;
      const pay = PAY[chainId];
      if (!dep.address || !pay) continue;
      venues.push({ chain: CHAIN_NAME[chainId], chainId, address: dep.address, decimals: 18, ...pay });
    }
    if (!node.symbol || !venues.length) continue;
    out.push({ issuer: "xStocks", symbol: node.symbol, name: node.name || node.symbol, venues });
  }
  return out;
}

function backpack(): IssuerToken[] {
  return BACKPACK.map((row) => ({
    issuer: "Backpack" as const,
    symbol: row.symbol,
    name: row.name,
    venues: [
      {
        chain: "Solana",
        chainId: 7565164,
        address: row.mint,
        decimals: row.decimals,
        pay: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        payDecimals: 6,
      },
    ],
  }));
}

export const loadIssuerBook = createServerFn({ method: "GET" }).handler(async (): Promise<IssuerToken[]> => {
  const [ondoRows, xRows] = await Promise.all([ondo().catch(() => [] as IssuerToken[]), xstocks().catch(() => [] as IssuerToken[])]);
  return [...backpack(), ...xRows, ...ondoRows];
});
