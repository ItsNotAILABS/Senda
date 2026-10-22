/** Add a market by appending a row. A mint makes Buy and Sell sign. No mint stays a print. */

export type MarketGroup = "metal" | "crypto" | "fx";

export type CatalogMarket = {
  id: string;
  group: MarketGroup;
  symbol: string;
  name: string;
  mint: string | null;
  ostium?: string;
};

export const PAIR_MARKETS: CatalogMarket[] = [
  { id: "xau", group: "metal", symbol: "PAXG", name: "Gold", mint: "5GgRAEmv8ZxF2PR5hY72Qs5x1bnQ6UK2RbTPoqJ3wSwW", ostium: "XAU-USD" },
  { id: "xag", group: "metal", symbol: "SLV", name: "Silver", mint: "iy11ytbSGcUnrjE6Lfv78TFqxKyUESfku1FugS9ondo", ostium: "XAG-USD" },
  { id: "sol", group: "crypto", symbol: "SOL", name: "Solana", mint: "So11111111111111111111111111111111111111112", ostium: "SOL-USD" },
  { id: "btc", group: "crypto", symbol: "WBTC", name: "Bitcoin", mint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", ostium: "BTC-USD" },
  { id: "cbbtc", group: "crypto", symbol: "cbBTC", name: "Coinbase Bitcoin", mint: "cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij", ostium: "BTC-USD" },
  { id: "eth", group: "crypto", symbol: "ETH", name: "Ether", mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", ostium: "ETH-USD" },
  { id: "xrp", group: "crypto", symbol: "wXRP", name: "XRP", mint: "6UpQcMAb5xMzxc7ZfPaVMgx3KqsvKZdT5U718BzD5We2", ostium: "XRP-USD" },
  { id: "link", group: "crypto", symbol: "LINK", name: "Chainlink", mint: "LinkhB3afbBKb2EQQu7s7umdZceV3wcvAUJhQAfQ23L" },
  { id: "jup", group: "crypto", symbol: "JUP", name: "Jupiter", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" },
  { id: "bonk", group: "crypto", symbol: "BONK", name: "Bonk", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
  { id: "wif", group: "crypto", symbol: "WIF", name: "dogwifhat", mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm" },
  { id: "jto", group: "crypto", symbol: "JTO", name: "Jito", mint: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL" },
  { id: "pyth", group: "crypto", symbol: "PYTH", name: "Pyth", mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3" },
  { id: "ray", group: "crypto", symbol: "RAY", name: "Raydium", mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R" },
  { id: "orca", group: "crypto", symbol: "ORCA", name: "Orca", mint: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE" },
  { id: "eur", group: "fx", symbol: "EURC", name: "Euro", mint: "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr", ostium: "EUR-USD" },
  { id: "gbp", group: "fx", symbol: "VGBP", name: "Pound", mint: "5H4voZhzySsVvwVYDAKku8MZGuYBC7cXaBKDPW4YHWW1", ostium: "GBP-USD" },
  { id: "chf", group: "fx", symbol: "VCHF", name: "Swiss franc", mint: "AhhdRu5YZdjVkKR3wbnUDaymVQL2ucjMQ63sZ3LFHsch", ostium: "USD-CHF" },
  { id: "mxn", group: "fx", symbol: "MXNe", name: "Mexican peso", mint: "6zYgzrT7X2wi9a9NeMtUvUWLLmf2a8vBsbYkocYdB9wa", ostium: "USD-MXN" },
  { id: "jpy", group: "fx", symbol: "JPY", name: "Yen", mint: null, ostium: "USD-JPY" },
  { id: "aud", group: "fx", symbol: "AUD", name: "Australian dollar", mint: null, ostium: "AUD-USD" },
  { id: "nzd", group: "fx", symbol: "NZD", name: "New Zealand dollar", mint: null, ostium: "NZD-USD" },
  { id: "cad", group: "fx", symbol: "CAD", name: "Canadian dollar", mint: null, ostium: "USD-CAD" },
];
