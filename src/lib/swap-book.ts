/** Jupiter-swappable Solana mints. No mint here means it is not offered on Swap. */

import { BACKPACK } from "@/lib/backpack";
import { BOOK } from "@/lib/sol-books";
import { STABLES } from "@/lib/stables";
import { PRESTOCK_MINTS } from "@/lib/phantom";

export type SwapGroup = "Cash" | "DeFi" | "Memes" | "Staked" | "Stocks" | "Metals" | "FX" | "Commodities" | "PreStocks";

export type SwapCoin = {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  group: SwapGroup;
};

const SOL = "So11111111111111111111111111111111111111112";

const EXTRA: SwapCoin[] = [
  { symbol: "CASH", name: "Phantom Cash", mint: "CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH", decimals: 6, group: "Cash" },
  { symbol: "SOL", name: "Solana", mint: SOL, decimals: 9, group: "Cash" },
  { symbol: "USDS", name: "Sky dollar", mint: "USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA", decimals: 6, group: "Cash" },
  { symbol: "JupUSD", name: "Jupiter dollar", mint: "JuprjznTrTSp2UFa3ZBUFgwdAmtZCq4MQCwysN55USD", decimals: 6, group: "Cash" },
  { symbol: "WBTC", name: "Bitcoin", mint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", decimals: 8, group: "DeFi" },
  { symbol: "cbBTC", name: "Coinbase Bitcoin", mint: "cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij", decimals: 8, group: "DeFi" },
  { symbol: "ETH", name: "Ether", mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", decimals: 8, group: "DeFi" },
  { symbol: "wXRP", name: "XRP", mint: "6UpQcMAb5xMzxc7ZfPaVMgx3KqsvKZdT5U718BzD5We2", decimals: 6, group: "DeFi" },
  { symbol: "LINK", name: "Chainlink", mint: "LinkhB3afbBKb2EQQu7s7umdZceV3wcvAUJhQAfQ23L", decimals: 6, group: "DeFi" },
  { symbol: "JUP", name: "Jupiter", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", decimals: 6, group: "DeFi" },
  { symbol: "JLP", name: "Jupiter LP", mint: "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4", decimals: 6, group: "DeFi" },
  { symbol: "PYTH", name: "Pyth", mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", decimals: 6, group: "DeFi" },
  { symbol: "RAY", name: "Raydium", mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", decimals: 6, group: "DeFi" },
  { symbol: "ORCA", name: "Orca", mint: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE", decimals: 6, group: "DeFi" },
  { symbol: "JTO", name: "Jito", mint: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL", decimals: 9, group: "DeFi" },
  { symbol: "KMNO", name: "Kamino", mint: "KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS", decimals: 6, group: "DeFi" },
  { symbol: "PUMP", name: "Pump", mint: "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn", decimals: 6, group: "DeFi" },
  { symbol: "MET", name: "Meteora", mint: "METvsvVRapdj9cFLzq4Tr43xK4tAjQfwX76z3n6mWQL", decimals: 6, group: "DeFi" },
  { symbol: "W", name: "Wormhole", mint: "85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ", decimals: 6, group: "DeFi" },
  { symbol: "RENDER", name: "Render", mint: "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof", decimals: 8, group: "DeFi" },
  { symbol: "AAVE", name: "Aave", mint: "AavE1kKKnesPw4MuRJmJ9jZs9QzEE8CPxQ3ViczUDfc1", decimals: 8, group: "DeFi" },
  { symbol: "BONK", name: "Bonk", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", decimals: 5, group: "Memes" },
  { symbol: "WIF", name: "dogwifhat", mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", decimals: 6, group: "Memes" },
  { symbol: "PENGU", name: "Pudgy Penguins", mint: "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv", decimals: 6, group: "Memes" },
  { symbol: "POPCAT", name: "Popcat", mint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", decimals: 9, group: "Memes" },
  { symbol: "MEW", name: "cat in a dogs world", mint: "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5", decimals: 5, group: "Memes" },
  { symbol: "FARTCOIN", name: "Fartcoin", mint: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump", decimals: 6, group: "Memes" },
  { symbol: "TRUMP", name: "Official Trump", mint: "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN", decimals: 6, group: "Memes" },
  { symbol: "JitoSOL", name: "Jito staked SOL", mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", decimals: 9, group: "Staked" },
  { symbol: "JupSOL", name: "Jupiter staked SOL", mint: "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v", decimals: 9, group: "Staked" },
  { symbol: "mSOL", name: "Marinade SOL", mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", decimals: 9, group: "Staked" },
  { symbol: "INF", name: "Sanctum Infinity", mint: "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm", decimals: 9, group: "Staked" },
  { symbol: "bSOL", name: "Blaze SOL", mint: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1", decimals: 9, group: "Staked" },
  { symbol: "SPYx", name: "S&P 500 xStock", mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W", decimals: 8, group: "Stocks" },
  { symbol: "QQQx", name: "Nasdaq xStock", mint: "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ", decimals: 8, group: "Stocks" },
  { symbol: "NVDAx", name: "NVIDIA xStock", mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", decimals: 8, group: "Stocks" },
  { symbol: "AAPLx", name: "Apple xStock", mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp", decimals: 8, group: "Stocks" },
  { symbol: "TSLAx", name: "Tesla xStock", mint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB", decimals: 8, group: "Stocks" },
  { symbol: "MSFTx", name: "Microsoft xStock", mint: "XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX", decimals: 8, group: "Stocks" },
  { symbol: "AMZNx", name: "Amazon xStock", mint: "Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg", decimals: 8, group: "Stocks" },
  { symbol: "METAx", name: "Meta xStock", mint: "Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu", decimals: 8, group: "Stocks" },
  { symbol: "MSTRx", name: "MicroStrategy xStock", mint: "XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ", decimals: 8, group: "Stocks" },
  { symbol: "GOOGL", name: "Alphabet", mint: "GooGLMvZtJZXHdNZy95RUrAMCCKxV6ghK3qE5ddBgVm5", decimals: 6, group: "Stocks" },
  { symbol: "AMDx", name: "AMD xStock", mint: "XsXcJ6GZ9kVnjqGsjBnktRcuwMBmvKWh8S93RefZ1rF", decimals: 8, group: "Stocks" },
  { symbol: "AVGOx", name: "Broadcom xStock", mint: "XsgSaSvNSqLTtFuyWPBhK9196Xb9Bbdyjj4fH3cPJGo", decimals: 8, group: "Stocks" },
  { symbol: "NFLXx", name: "Netflix xStock", mint: "XsEH7wWfJJu2ZT3UCFeVfALnVA6CP5ur7Ee11KmzVpL", decimals: 8, group: "Stocks" },
  { symbol: "COINx", name: "Coinbase xStock", mint: "Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu", decimals: 8, group: "Stocks" },
  { symbol: "HOODx", name: "Robinhood xStock", mint: "XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg", decimals: 8, group: "Stocks" },
  { symbol: "PLTRx", name: "Palantir xStock", mint: "XsoBhf2ufR8fTyNSjqfU71DYGaE6Z3SUGAidpzriAA4", decimals: 8, group: "Stocks" },
  { symbol: "VCHF", name: "Swiss franc", mint: "AhhdRu5YZdjVkKR3wbnUDaymVQL2ucjMQ63sZ3LFHsch", decimals: 6, group: "FX" },
  { symbol: "VGBP", name: "Pound", mint: "5H4voZhzySsVvwVYDAKku8MZGuYBC7cXaBKDPW4YHWW1", decimals: 6, group: "FX" },
  { symbol: "CRCLx", name: "Circle xStock", mint: "XsueG8BtpquVJX9LVLLEGuViXUungE6WmK5YZ3p3bd1", decimals: 8, group: "Stocks" },
  { symbol: "SQQQx", name: "Short Nasdaq xStock", mint: "XsSPkcE4GbHiBacr8awTTHpwFBuznazcwEKgdvBCkoz", decimals: 8, group: "Stocks" },
  { symbol: "USOx", name: "Oil xStock", mint: "XsXJBom7kFSxA6hc2ArzUwe6o6zyRU1AdHTfvev1HkG", decimals: 8, group: "Stocks" },
  { symbol: "EWZx", name: "Brazil xStock", mint: "XsvsSHRUz5dAmUGH9jvVnkEZRcLkgo7uJf1VWhSuVLk", decimals: 8, group: "Stocks" },
  { symbol: "EWJx", name: "Japan xStock", mint: "XsaXKP7GaPDA3bLwtuFoZ2oGsaukfeS1v2U1xUeqwrp", decimals: 8, group: "Stocks" },
  { symbol: "SPCXx", name: "SpaceX xStock", mint: "Xs3oZwbHvqis4NYcf4YKWmEia2eC84wSiVrcYcTqpH8", decimals: 8, group: "Stocks" },
  { symbol: "hSOL", name: "Helius staked SOL", mint: "he1iusmfkpAdwvxLNGV8Y1iSbj4rUy6yMhEA3fotn9A", decimals: 9, group: "Staked" },
  { symbol: "dSOL", name: "Drift staked SOL", mint: "Dso1bDeDjCQxTrWHqUUi63oBvV7Mdm6WaobLbQ7gnPQ", decimals: 9, group: "Staked" },
  { symbol: "PSOL", name: "Phantom staked SOL", mint: "pSo1f9nQXWgXibFtKf7NWYxb5enAM4qfP6UJSiXRQfL", decimals: 9, group: "Staked" },
  { symbol: "bbSOL", name: "Bybit staked SOL", mint: "Bybit2vBJGhPF52GBdNaQfUJ6ZpThSgHBobjWZpLPb4B", decimals: 9, group: "Staked" },
  { symbol: "vSOL", name: "The Vault staked SOL", mint: "vSoLxydx6akxyMD9XEcPvGYNGq6Nn66oqVb3UkGkei7", decimals: 9, group: "Staked" },
  { symbol: "JSOL", name: "JPool staked SOL", mint: "7Q2afV64in6N6SeZsAAB81TJzwDoD6zpqmHkzi9Dcavn", decimals: 9, group: "Staked" },
  { symbol: "BNSOL", name: "Binance staked SOL", mint: "BNso1VUJnh4zcfpZa6986Ea66P6TCp59hvtNJ8b1X85", decimals: 9, group: "Staked" },
  { symbol: "bonkSOL", name: "Bonk staked SOL", mint: "BonK1YhkXEGLZzwtcvRTip3gAL9nCeQD7ppZBLXhtTs", decimals: 9, group: "Staked" },
  { symbol: "bpSOL", name: "Backpack staked SOL", mint: "BPSoLzmLQn47EP5aa7jmFngRL8KC3TWAeAwXwZD8ip3P", decimals: 9, group: "Staked" },
  { symbol: "hyloSOL", name: "Hylo staked SOL", mint: "hy1oXYgrBW6PVcJ4s6s2FKavRdwgWTXdfE69AxT7kPT", decimals: 9, group: "Staked" },
];

const GROUP_FOR_LANE: Record<string, SwapGroup> = {
  majors: "DeFi",
  metals: "Metals",
  fx: "FX",
  commodities: "Commodities",
  mexico: "FX",
};

function push(into: Map<string, SwapCoin>, coin: SwapCoin) {
  if (coin.mint.length < 32 || into.has(coin.mint)) return;
  into.set(coin.mint, coin);
}

const book = new Map<string, SwapCoin>();
for (const coin of EXTRA) push(book, coin);
for (const stable of STABLES) {
  push(book, { symbol: stable.symbol, name: stable.issuer, mint: stable.mint, decimals: stable.decimals, group: "Cash" });
}
for (const row of BOOK) {
  if (!row.mint || row.trade === false) continue;
  push(book, {
    symbol: row.symbol,
    name: row.name,
    mint: row.mint,
    decimals: row.decimals,
    group: GROUP_FOR_LANE[row.lane] ?? "DeFi",
  });
}
for (const row of BACKPACK) {
  push(book, { symbol: row.symbol, name: row.name, mint: row.mint, decimals: row.decimals, group: "Stocks" });
}
for (const [symbol, mint] of PRESTOCK_MINTS) {
  push(book, { symbol, name: symbol, mint, decimals: 6, group: "PreStocks" });
}

export const SWAP_BOOK: SwapCoin[] = [...book.values()];

export const SWAP_GROUPS: SwapGroup[] = ["Cash", "DeFi", "Memes", "Staked", "Stocks", "Metals", "FX", "Commodities", "PreStocks"];

export function swapCoin(mint: string): SwapCoin | undefined {
  return book.get(mint);
}

export function swapDecimals(mint: string): number | null {
  if (mint === SOL) return 9;
  return book.get(mint)?.decimals ?? null;
}
