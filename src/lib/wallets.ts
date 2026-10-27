/** Injected wallets. On a phone with no extension, Phantom, Solflare, or Backpack opens this page. */

import { insideWalletApp, isPhoneBrowser, openInWallet, type MobileWallet } from "@/lib/mobile-wallet";
import { unlockSeal } from "@/lib/seal";

type SolProvider = {
  isPhantom?: boolean;
  isSolflare?: boolean;
  isBackpack?: boolean;
  connect: () => Promise<{ publicKey?: { toString: () => string } }>;
  signAndSendTransaction?: (tx: unknown) => Promise<{ signature: string | Uint8Array }>;
  signTransaction?: (tx: unknown) => Promise<{ serialize: () => Uint8Array }>;
};

type EvmProvider = {
  request: (a: { method: string }) => Promise<unknown>;
  isMetaMask?: boolean;
  isRabby?: boolean;
  isCoinbaseWallet?: boolean;
  isBraveWallet?: boolean;
  isPhantom?: boolean;
  isOkxWallet?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
};

export type WalletId =
  | "phantom"
  | "solflare"
  | "backpack"
  | "glow"
  | "okx"
  | "bitget"
  | "trust"
  | "coinbase-sol"
  | "nightly"
  | "exodus"
  | "metamask"
  | "rabby"
  | "coinbase"
  | "brave"
  | "phantom-evm"
  | "okx-evm"
  | "trust-evm";

export type WalletChoice = {
  id: WalletId;
  name: string;
  chain: "solana" | "evm";
  installed: boolean;
};

const SOL: { id: WalletId; name: string; pick: (w: Window) => SolProvider | undefined }[] = [
  { id: "phantom", name: "Phantom", pick: (w) => (w as Win).phantom?.solana },
  { id: "solflare", name: "Solflare", pick: (w) => (w as Win).solflare },
  { id: "backpack", name: "Backpack", pick: (w) => (w as Win).backpack },
  { id: "glow", name: "Glow", pick: (w) => (w as Win).glowSolana },
  { id: "okx", name: "OKX", pick: (w) => (w as Win).okxwallet?.solana },
  { id: "bitget", name: "Bitget", pick: (w) => (w as Win).bitkeep?.solana },
  { id: "trust", name: "Trust", pick: (w) => (w as Win).trustwallet?.solana },
  { id: "coinbase-sol", name: "Coinbase", pick: (w) => (w as Win).coinbaseSolana },
  { id: "nightly", name: "Nightly", pick: (w) => (w as Win).nightly?.solana },
  { id: "exodus", name: "Exodus", pick: (w) => (w as Win).exodus?.solana },
];

const EVM: { id: WalletId; name: string; pick: (e: EvmProvider) => boolean }[] = [
  { id: "metamask", name: "MetaMask", pick: (e) => Boolean(e.isMetaMask && !e.isBraveWallet) },
  { id: "rabby", name: "Rabby", pick: (e) => Boolean(e.isRabby) },
  { id: "coinbase", name: "Coinbase Wallet", pick: (e) => Boolean(e.isCoinbaseWallet) },
  { id: "brave", name: "Brave Wallet", pick: (e) => Boolean(e.isBraveWallet) },
  { id: "phantom-evm", name: "Phantom", pick: (e) => Boolean(e.isPhantom) },
  { id: "okx-evm", name: "OKX", pick: (e) => Boolean(e.isOkxWallet) },
  { id: "trust-evm", name: "Trust", pick: (e) => Boolean(e.isTrust || e.isTrustWallet) },
];

type Win = Window & {
  phantom?: { solana?: SolProvider };
  solflare?: SolProvider;
  backpack?: SolProvider;
  glowSolana?: SolProvider;
  okxwallet?: { solana?: SolProvider; request?: EvmProvider["request"]; isOkxWallet?: boolean };
  bitkeep?: { solana?: SolProvider };
  trustwallet?: { solana?: SolProvider };
  coinbaseSolana?: SolProvider;
  nightly?: { solana?: SolProvider };
  exodus?: { solana?: SolProvider };
  ethereum?: EvmProvider & { providers?: EvmProvider[] };
};

function ethereumProviders(): EvmProvider[] {
  if (typeof window === "undefined") return [];
  const w = window as Win;
  const eth = w.ethereum;
  const list: EvmProvider[] = eth ? (eth.providers?.length ? [...eth.providers] : [eth]) : [];
  const okx = w.okxwallet;
  if (okx?.request && !list.some((p) => p === (okx as EvmProvider))) {
    list.push({ ...okx, request: okx.request, isOkxWallet: true } as EvmProvider);
  }
  return list;
}

export function detectWallets(): WalletChoice[] {
  if (typeof window === "undefined") {
    return [...SOL.map((s) => ({ id: s.id, name: s.name, chain: "solana" as const, installed: false })), ...EVM.map((e) => ({ id: e.id, name: e.name, chain: "evm" as const, installed: false }))];
  }
  const sol = SOL.map((s) => ({
    id: s.id,
    name: s.name,
    chain: "solana" as const,
    installed: Boolean(s.pick(window)?.connect),
  }));
  const evms = ethereumProviders();
  const evm = EVM.map((e) => ({
    id: e.id,
    name: e.name,
    chain: "evm" as const,
    installed: evms.some((p) => e.pick(p)),
  }));
  return [...sol, ...evm];
}

const ACTIVE = "senda.activeWallet";

export function rememberWallet(id: WalletId) {
  try {
    sessionStorage.setItem(ACTIVE, id);
  } catch {
    /* private mode */
  }
}

/** The wallet the person connected. Swaps sign there, not in a Senda key. */
export function activeSolProvider(): SolProvider | null {
  if (typeof window === "undefined") return null;
  let id: string | null = null;
  try {
    id = sessionStorage.getItem(ACTIVE);
  } catch {
    id = null;
  }
  const ordered = SOL.filter((s) => s.id === id).concat(SOL.filter((s) => s.id !== id));
  for (const s of ordered) {
    const p = s.pick(window);
    if (p?.connect && (p.signAndSendTransaction || p.signTransaction)) return p;
  }
  return null;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitChoice(id: WalletId, ms: number): Promise<WalletChoice | undefined> {
  const started = Date.now();
  const found = () => detectWallets().find((w) => w.id === id);
  const first = found();
  if (first?.installed) return first;
  while (Date.now() - started < ms) {
    await wait(120);
    const row = found();
    if (row?.installed) return row;
  }
  return found();
}

export async function connectWallet(id: WalletId): Promise<{ address: string; label: string; chain: "solana" | "evm" }> {
  const inApp = insideWalletApp();
  const canOpen = id === "phantom" || id === "solflare" || id === "backpack";
  let choice = detectWallets().find((w) => w.id === id);
  if (!choice?.installed && (inApp || (isPhoneBrowser() && canOpen))) {
    choice = await waitChoice(id, inApp ? 4000 : 600);
  }
  if (!choice?.installed && !inApp && isPhoneBrowser() && canOpen) {
    openInWallet(id as MobileWallet);
    return new Promise(() => {});
  }
  if (!choice?.installed) {
    throw new Error(
      inApp
        ? "This page is already inside the wallet. Tap Connect again."
        : `${choice?.name ?? "That wallet"} is not in this browser. On a phone, Phantom, Solflare, or Backpack opens this page.`,
    );
  }
  if (choice.chain === "solana") {
    const spec = SOL.find((s) => s.id === id);
    const provider = spec?.pick(window);
    if (!provider) throw new Error(`${choice.name} is not in this browser.`);
    const res = await provider.connect();
    const address = res?.publicKey?.toString();
    if (!address) throw new Error(`${choice.name} returned no account.`);
    rememberWallet(id);
    await unlockSeal(address);
    return { address, label: choice.name, chain: "solana" };
  }
  const spec = EVM.find((e) => e.id === id);
  const provider = ethereumProviders().find((p) => spec?.pick(p));
  if (!provider) throw new Error(`${choice.name} is not in this browser.`);
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts?.[0];
  if (!address) throw new Error(`${choice.name} returned no account.`);
  rememberWallet(id);
  return { address, label: choice.name, chain: "evm" };
}
