/** CipherMesh on the Pons curve. Robinhood Chain. The wallet signs the buy. */

export const CMESH = "0xBD7a6f4aCC4E9369fB9Ec7875e6e4273D5b40977";
const FACTORY = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";
const CHAIN = "0x1237";
const RPC = "https://robinhood-rpc.publicnode.com";

type Evm = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };

function word(n: bigint): string {
  return n.toString(16).padStart(64, "0");
}

function addrWord(address: string): string {
  return address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = (await res.json()) as { result?: unknown; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message || "Robinhood Chain did not answer.");
  return body.result;
}

export async function cmeshCurve(): Promise<{ curve: string; phase: number }> {
  const data = `0x3cf28b5a${addrWord(CMESH)}`;
  const raw = await rpc("eth_call", [{ to: FACTORY, data }, "latest"]);
  if (typeof raw !== "string" || raw.length < 2 + 64 * 15) throw new Error("CMesh is not on this Pons factory.");
  const words = raw.slice(2).match(/.{64}/g) || [];
  const curve = `0x${words[1].slice(24)}`;
  const phase = Number(BigInt(`0x${words[10]}`));
  const exists = words[14].endsWith("1");
  if (!exists || !/^0x[a-f0-9]{40}$/.test(curve) || curve.endsWith("0".repeat(40))) {
    throw new Error("CMesh has no curve.");
  }
  return { curve, phase };
}

function evmWallet(): { provider: Evm; name: string } {
  const w = window as unknown as { ethereum?: Evm; phantom?: { ethereum?: Evm } };
  if (w.phantom?.ethereum) return { provider: w.phantom.ethereum, name: "Phantom" };
  if (w.ethereum) return { provider: w.ethereum, name: "MetaMask" };
  throw new Error("Open this in Phantom. CMesh buys with the Ethereum side of the wallet.");
}

export async function robinhoodEth(address: string): Promise<bigint> {
  const raw = await rpc("eth_getBalance", [address, "latest"]);
  return typeof raw === "string" ? BigInt(raw) : 0n;
}

function short(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function ethToWei(amount: string): bigint {
  const [whole, frac = ""] = amount.split(".");
  const padded = (frac + "0".repeat(18)).slice(0, 18);
  const wei = BigInt(whole || "0") * 10n ** 18n + BigInt(padded || "0");
  if (wei <= 0n) throw new Error("Set an amount of ETH.");
  return wei;
}

/** Phantom signs. ETH goes to the curve. CMESH comes back to the same account. */
export async function buyCmesh(eth: string): Promise<{ hash: string; wallet: string; from: string }> {
  const quoteIn = ethToWei(eth);
  const { curve, phase } = await cmeshCurve();
  if (phase !== 0) throw new Error("CMesh has left the curve. This buy only signs while it is still there.");
  const { provider, name } = evmWallet();
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  const from = Array.isArray(accounts) ? String(accounts[0] || "") : "";
  if (!/^0x[a-fA-F0-9]{40}$/.test(from)) throw new Error("The wallet did not give an account.");
  await provider.request({
    method: "wallet_addEthereumChain",
    params: [{
      chainId: CHAIN,
      chainName: "Robinhood Chain",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: [RPC],
      blockExplorerUrls: ["https://robinhoodchain.blockscout.com"],
    }],
  }).catch(() => undefined);
  await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN }] });
  const have = await robinhoodEth(from);
  if (have < quoteIn) {
    const held = (Number(have) / 1e18).toFixed(4);
    throw new Error(`${short(from)} has ${held} ETH on Robinhood Chain. CMESH is bought with ETH there. SOL in Phantom does not pay it. Send ETH to this address on Robinhood Chain, then buy.`);
  }
  const probe = `0x59a87bc1${word(quoteIn)}${word(1n)}${addrWord(from)}`;
  const quoted = await rpc("eth_call", [{ from, to: curve, data: probe, value: `0x${quoteIn.toString(16)}` }, "latest"]);
  const out = typeof quoted === "string" ? BigInt(quoted) : 0n;
  if (out <= 0n) throw new Error("The curve did not quote any CMESH for that ETH.");
  const minOut = out * 85n / 100n;
  const data = `0x59a87bc1${word(quoteIn)}${word(minOut > 0n ? minOut : 1n)}${addrWord(from)}`;
  const hash = await provider.request({
    method: "eth_sendTransaction",
    params: [{ from, to: curve, data, value: `0x${quoteIn.toString(16)}` }],
  });
  if (typeof hash !== "string") throw new Error("The wallet did not return a transaction.");
  return { hash, wallet: name, from };
}
