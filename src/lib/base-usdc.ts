/** USDC on Base. MetaMask signs. Phantom does not. */

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE = "0x2105";

type Evm = {
  request: (a: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMetaMask?: boolean;
  isBraveWallet?: boolean;
  providers?: Evm[];
};

function metamask(): Evm {
  const eth = (window as unknown as { ethereum?: Evm }).ethereum;
  const list = eth?.providers?.length ? eth.providers : eth ? [eth] : [];
  const mm = list.find((p) => p.isMetaMask && !p.isBraveWallet) || list[0];
  if (!mm) throw new Error("MetaMask is not in this browser.");
  return mm;
}

export async function sendBaseUsdc(from: string, to: string, usd: number): Promise<string> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(to)) throw new Error("That is not a Base address.");
  const units = Math.round(usd * 1_000_000);
  if (!(units > 0)) throw new Error("Set an amount.");
  const provider = metamask();
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BASE }] });
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code !== 4902) throw err;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: BASE,
        chainName: "Base",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: ["https://mainnet.base.org"],
      }],
    });
  }
  const data = `0xa9059cbb${to.slice(2).toLowerCase().padStart(64, "0")}${units.toString(16).padStart(64, "0")}`;
  const hash = await provider.request({
    method: "eth_sendTransaction",
    params: [{ from, to: USDC, data, value: "0x0" }],
  });
  if (typeof hash !== "string") throw new Error("MetaMask did not return a transaction.");
  return hash;
}
