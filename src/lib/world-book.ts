/** Metals, FX, and the large coins. Each row is a mint Jupiter can fill. The token stays in the wallet. */

import { createServerFn } from "@tanstack/react-start";

export type WorldLane = "crypto" | "metals" | "fx";

export type WorldAsset = {
  id: string;
  mint: string;
  symbol: string;
  name: string;
  lane: WorldLane;
  chain: string;
  via: string;
  note: string;
};

export const WORLD: WorldAsset[] = [
  { id: "sol", mint: "So11111111111111111111111111111111111111112", symbol: "SOL", name: "Solana", lane: "crypto", chain: "Solana", via: "Native", note: "The coin itself." },
  { id: "btc", mint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", symbol: "BTC", name: "Bitcoin", lane: "crypto", chain: "Bitcoin", via: "Portal", note: "Bitcoin, held here through Portal. It does not expire." },
  { id: "cbbtc", mint: "cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij", symbol: "cbBTC", name: "Coinbase BTC", lane: "crypto", chain: "Bitcoin", via: "Coinbase", note: "Coinbase wrapped bitcoin. Same idea, a second door." },
  { id: "eth", mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", symbol: "ETH", name: "Ether", lane: "crypto", chain: "Ethereum", via: "Portal", note: "Ether brought across Portal." },
  { id: "jitosol", mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", symbol: "JitoSOL", name: "Jito staked SOL", lane: "crypto", chain: "Solana", via: "Jito", note: "Staked SOL. It keeps working while you hold it." },
  { id: "paxg", mint: "5GgRAEmv8ZxF2PR5hY72Qs5x1bnQ6UK2RbTPoqJ3wSwW", symbol: "PAXG", name: "PAX Gold", lane: "metals", chain: "Gold", via: "Paxos", note: "One token tracks one ounce." },
  { id: "xaut", mint: "AymATz4TCL9sWNEEV9Kvyz45CHVhDZ6kUgjTJPzLpU9P", symbol: "XAUt", name: "Tether Gold", lane: "metals", chain: "Gold", via: "Tether", note: "One ounce, Tether's gold." },
  { id: "gldx", mint: "Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re", symbol: "GLDx", name: "Gold share", lane: "metals", chain: "Gold", via: "xStock", note: "A gold share, not an ounce. The last is the share." },
  { id: "slv", mint: "iy11ytbSGcUnrjE6Lfv78TFqxKyUESfku1FugS9ondo", symbol: "SLV", name: "Silver", lane: "metals", chain: "Silver", via: "Ondo", note: "The silver trust. The book is thinner than gold." },
  { id: "copx", mint: "CzLTZppPdZtTjyq3WGpHLstoc3GLhu7zH5Zg6xUa6Gv5", symbol: "COPX", name: "Copper miners", lane: "metals", chain: "Copper", via: "Backpack", note: "The copper miners fund, not a bar of copper." },
  { id: "eurc", mint: "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr", symbol: "EUR", name: "Euro", lane: "fx", chain: "EUR/USD", via: "Circle", note: "One euro. The last price is the FX rate." },
  { id: "europ", mint: "euro5sNHrZC2wu2RoLvy6xxoVMc3Qnd1vjxoWf4MftA", symbol: "EURØP", name: "Euro", lane: "fx", chain: "EUR/USD", via: "EURØP", note: "A second euro, a different issuer." },
  { id: "jup", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", symbol: "JUP", name: "Jupiter", lane: "crypto", chain: "Solana", via: "Jupiter", note: "The swap token. It stays in the wallet." },
  { id: "jto", mint: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL", symbol: "JTO", name: "Jito", lane: "crypto", chain: "Solana", via: "Jito", note: "Jito. A Jupiter swap, not a stake." },
  { id: "pyth", mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", symbol: "PYTH", name: "Pyth", lane: "crypto", chain: "Solana", via: "Pyth", note: "The oracle token." },
  { id: "ray", mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", symbol: "RAY", name: "Raydium", lane: "crypto", chain: "Solana", via: "Raydium", note: "Raydium. Bought with USDC." },
  { id: "orca", mint: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE", symbol: "ORCA", name: "Orca", lane: "crypto", chain: "Solana", via: "Orca", note: "Orca. Bought with USDC." },
  { id: "bonk", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", symbol: "BONK", name: "Bonk", lane: "crypto", chain: "Solana", via: "Jupiter", note: "A small coin. A dollar still quotes." },
  { id: "wif", mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", symbol: "WIF", name: "dogwifhat", lane: "crypto", chain: "Solana", via: "Jupiter", note: "A small coin. A dollar still quotes." },
  { id: "render", mint: "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof", symbol: "RENDER", name: "Render", lane: "crypto", chain: "Solana", via: "Jupiter", note: "Render on Solana." },
  { id: "msol", mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", symbol: "mSOL", name: "Marinade SOL", lane: "crypto", chain: "Solana", via: "Marinade", note: "Staked SOL. A different pool from Jito." },
  { id: "bsol", mint: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1", symbol: "bSOL", name: "Blaze SOL", lane: "crypto", chain: "Solana", via: "Blaze", note: "Staked SOL. A third pool." },
  { id: "pyusd", mint: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo", symbol: "PYUSD", name: "PayPal USD", lane: "fx", chain: "USD", via: "PayPal", note: "A dollar token. Not USDC." },
  { id: "usdt", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", symbol: "USDT", name: "Tether", lane: "fx", chain: "USD", via: "Tether", note: "A dollar token. Not USDC." },
  { id: "vgbp", mint: "5H4voZhzySsVvwVYDAKku8MZGuYBC7cXaBKDPW4YHWW1", symbol: "GBP", name: "Pound", lane: "fx", chain: "GBP/USD", via: "VNX", note: "A pound token. Jupiter quotes it." },
  { id: "vchf", mint: "AhhdRu5YZdjVkKR3wbnUDaymVQL2ucjMQ63sZ3LFHsch", symbol: "CHF", name: "Swiss franc", lane: "fx", chain: "USD/CHF", via: "VNX", note: "A franc token. Jupiter quotes it." },
  { id: "mxne", mint: "6zYgzrT7X2wi9a9NeMtUvUWLLmf2a8vBsbYkocYdB9wa", symbol: "MXN", name: "Mexican peso", lane: "fx", chain: "USD/MXN", via: "Brale", note: "A peso token. The book is thin." },
  { id: "xrp", mint: "6UpQcMAb5xMzxc7ZfPaVMgx3KqsvKZdT5U718BzD5We2", symbol: "XRP", name: "XRP", lane: "crypto", chain: "XRP Ledger", via: "Portal", note: "XRP on Solana. Not the ledger itself." },
  { id: "link", mint: "LinkhB3afbBKb2EQQu7s7umdZceV3wcvAUJhQAfQ23L", symbol: "LINK", name: "Chainlink", lane: "crypto", chain: "Ethereum", via: "Portal", note: "Chainlink on Solana." },
];

export type WorldMark = { usd: number; chg: number };

export const worldPrices = createServerFn({ method: "GET" }).handler(async () => {
  const ids = WORLD.map((a) => a.mint).join(",");
  const r = await fetch(`https://api.jup.ag/price/v3?ids=${ids}`, {
    headers: { accept: "application/json", "user-agent": "Senda" },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) return {} as Record<string, WorldMark>;
  const raw = (await r.json()) as Record<string, { usdPrice?: number; priceChange24h?: number }>;
  const out: Record<string, WorldMark> = {};
  for (const asset of WORLD) {
    const row = raw[asset.mint];
    const usd = Number(row?.usdPrice);
    if (usd > 0) out[asset.id] = { usd, chg: Number(row?.priceChange24h) || 0 };
  }
  return out;
});
