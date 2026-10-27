import { avantisOpen } from "@/lib/deriv-book";

type Evm = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown>; isMetaMask?: boolean; isBraveWallet?: boolean; providers?: Evm[] };

function metamask(): Evm {
  const eth = (window as unknown as { ethereum?: Evm }).ethereum;
  const list = eth?.providers?.length ? eth.providers : eth ? [eth] : [];
  const mm = list.find((p) => p.isMetaMask && !p.isBraveWallet) || list[0];
  if (!mm) throw new Error("MetaMask is not in this browser.");
  return mm;
}

async function sendBase(from: string, tx: { to: string; data: string }) {
  const provider = metamask();
  await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x2105" }] }).catch(async (err: { code?: number }) => {
    if (err?.code !== 4902) throw err;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{ chainId: "0x2105", chainName: "Base", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://mainnet.base.org"] }],
    });
  });
  const hash = await provider.request({ method: "eth_sendTransaction", params: [{ from, to: tx.to, data: tx.data, value: "0x0" }] });
  if (typeof hash !== "string") throw new Error("MetaMask did not return a transaction.");
  return hash;
}

/** A market long or short on Base. MetaMask signs. Leverage stays at 2×. */
export async function openBase(input: { trader: string; pair: string; side: "long" | "short"; usd: number }) {
  const built = await avantisOpen({
    data: { pair: input.pair, trader: input.trader, side: input.side, collateral: input.usd, leverage: 2 },
  });
  if (built.approve) await sendBase(input.trader, built.approve);
  const hash = await sendBase(input.trader, built.trade);
  return { hash, openPrice: built.openPrice };
}
