/** Aave Pool on Ethereum and Base. The wallet signs. Senda does not hold the tokens. */

import { keccak_256 } from "@noble/hashes/sha3.js";

export type AaveNet = {
  id: "ethereum" | "base";
  name: string;
  chainId: string;
  chainIdNum: number;
  rpc: string;
  pool: string;
  usdc: string;
  rpcUrls: string[];
};

export const AAVE: AaveNet[] = [
  {
    id: "ethereum",
    name: "Ethereum",
    chainId: "0x1",
    chainIdNum: 1,
    rpc: "https://ethereum.publicnode.com",
    pool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    rpcUrls: ["https://ethereum.publicnode.com"],
  },
  {
    id: "base",
    name: "Base",
    chainId: "0x2105",
    chainIdNum: 8453,
    rpc: "https://mainnet.base.org",
    pool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    rpcUrls: ["https://mainnet.base.org"],
  },
];

export type AaveAccount = {
  collateral: number;
  debt: number;
  available: number;
  health: number;
};

type Evm = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown>; providers?: Evm[] };

function selector(sig: string): string {
  const hash = keccak_256(new TextEncoder().encode(sig));
  return [...hash.slice(0, 4)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function word(hex: string): string {
  return hex.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

function u256(n: bigint): string {
  return n.toString(16).padStart(64, "0");
}

function call(sig: string, words: string[]): string {
  return "0x" + selector(sig) + words.join("");
}

export async function aaveAccount(net: AaveNet, user: string): Promise<AaveAccount> {
  const data = call("getUserAccountData(address)", [word(user)]);
  const res = await fetch(net.rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: net.pool, data }, "latest"] }),
  });
  const body = (await res.json()) as { result?: string };
  const raw = (body.result || "0x").slice(2);
  if (raw.length < 64 * 6) return { collateral: 0, debt: 0, available: 0, health: 0 };
  const num = (i: number, dec: number) => Number(BigInt("0x" + raw.slice(i * 64, (i + 1) * 64))) / 10 ** dec;
  return { collateral: num(0, 8), debt: num(1, 8), available: num(2, 8), health: num(5, 18) };
}

function providers(): Evm[] {
  const w = window as unknown as { ethereum?: Evm; phantom?: { ethereum?: Evm } };
  const out: Evm[] = [];
  if (w.phantom?.ethereum) out.push(w.phantom.ethereum);
  if (w.ethereum?.providers?.length) out.push(...w.ethereum.providers);
  else if (w.ethereum) out.push(w.ethereum);
  return out;
}

async function providerFor(from: string): Promise<Evm> {
  const list = providers();
  if (!list.length) throw new Error("No Ethereum wallet is open in this browser.");
  for (const candidate of list) {
    const accounts = (await candidate.request({ method: "eth_accounts" }).catch(() => [])) as string[];
    if (accounts.some((a) => a.toLowerCase() === from.toLowerCase())) return candidate;
  }
  return list[0];
}

async function send(net: AaveNet, from: string, to: string, data: string): Promise<string> {
  const provider = await providerFor(from);
  await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: net.chainId }] }).catch(async (err: { code?: number }) => {
    if (err?.code !== 4902) throw err;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{ chainId: net.chainId, chainName: net.name, nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: net.rpcUrls }],
    });
  });
  const hash = await provider.request({ method: "eth_sendTransaction", params: [{ from, to, data, value: "0x0" }] });
  if (typeof hash !== "string") throw new Error("The wallet did not return a transaction.");
  return hash;
}

export async function aaveSupply(net: AaveNet, from: string, usd: number): Promise<string> {
  const atoms = BigInt(Math.round(usd * 1_000_000));
  if (atoms <= 0n) throw new Error("Enter an amount.");
  const approve = call("approve(address,uint256)", [word(net.pool), u256(atoms)]);
  await send(net, from, net.usdc, approve);
  const supply = call("supply(address,uint256,address,uint16)", [word(net.usdc), u256(atoms), word(from), u256(0n)]);
  return send(net, from, net.pool, supply);
}

export async function aaveBorrow(net: AaveNet, from: string, usd: number): Promise<string> {
  const atoms = BigInt(Math.round(usd * 1_000_000));
  if (atoms <= 0n) throw new Error("Enter an amount.");
  const data = call("borrow(address,uint256,uint256,uint16,address)", [word(net.usdc), u256(atoms), u256(2n), u256(0n), word(from)]);
  return send(net, from, net.pool, data);
}

export async function aaveRepay(net: AaveNet, from: string, usd: number): Promise<string> {
  const atoms = BigInt(Math.round(usd * 1_000_000));
  if (atoms <= 0n) throw new Error("Enter an amount.");
  const approve = call("approve(address,uint256)", [word(net.pool), u256(atoms)]);
  await send(net, from, net.usdc, approve);
  const data = call("repay(address,uint256,uint256,address)", [word(net.usdc), u256(atoms), u256(2n), word(from)]);
  return send(net, from, net.pool, data);
}
