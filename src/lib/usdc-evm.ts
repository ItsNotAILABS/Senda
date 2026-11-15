/** A plain USDC transfer on a chain this wallet can be asked to switch to. Monad has no USDC address here, so it is refused. */

export type EvmPayChain = "Ethereum" | "Base" | "Arbitrum" | "Polygon" | "Optimism" | "Avalanche" | "BNB";

const BOOK: Record<EvmPayChain, { chainId: string; token: string; decimals: number; name: string }> = {
  Ethereum: { chainId: "0x1", token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6, name: "Ethereum" },
  Base: { chainId: "0x2105", token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6, name: "Base" },
  Arbitrum: { chainId: "0xa4b1", token: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6, name: "Arbitrum" },
  Polygon: { chainId: "0x89", token: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6, name: "Polygon" },
  Optimism: { chainId: "0xa", token: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6, name: "Optimism" },
  Avalanche: { chainId: "0xa86a", token: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", decimals: 6, name: "Avalanche" },
  BNB: { chainId: "0x38", token: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18, name: "BNB Smart Chain" },
};

type Eth = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

function provider(): Eth {
  const w = window as unknown as {
    phantom?: { ethereum?: Eth };
    ethereum?: Eth & { isMetaMask?: boolean; providers?: Array<Eth & { isMetaMask?: boolean }> };
  };
  if (w.phantom?.ethereum) return w.phantom.ethereum;
  const list = w.ethereum?.providers;
  const mask = list?.find((p) => p.isMetaMask);
  if (mask) return mask;
  if (w.ethereum) return w.ethereum;
  throw new Error("Open this page in Phantom or MetaMask and use the Ethereum account.");
}

function pad(n: bigint): string {
  return n.toString(16).padStart(64, "0");
}

/** transfer(address,uint256) of USDC. The wallet signs. Senda does not hold it. */
export async function payUsdcEvm(chain: EvmPayChain, to: string, usd: number): Promise<string> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(to)) throw new Error("That is not an Ethereum address.");
  if (!(usd > 0) || usd > 5000) throw new Error("The amount is between $0.01 and $5,000.");
  const book = BOOK[chain];
  const eth = provider();
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const from = accounts[0];
  if (!from) throw new Error("The wallet did not give an account.");
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: book.chainId }] });
  } catch {
    throw new Error(`Switch the wallet to ${book.name}, then sign again.`);
  }
  const units = BigInt(Math.round(usd * 10 ** Math.min(book.decimals, 6))) * 10n ** BigInt(Math.max(0, book.decimals - 6));
  const data = `0xa9059cbb${to.toLowerCase().replace(/^0x/, "").padStart(64, "0")}${pad(units)}`;
  const hash = (await eth.request({
    method: "eth_sendTransaction",
    params: [{ from, to: book.token, data, value: "0x0" }],
  })) as string;
  if (!hash?.startsWith("0x")) throw new Error("The wallet did not return a transaction.");
  return hash;
}
