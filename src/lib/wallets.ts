/** Injected wallets. We only connect what is actually in this browser. */

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
  | "metamask"
  | "rabby"
  | "coinbase"
  | "brave";

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
];

const EVM: { id: WalletId; name: string; pick: (e: EvmProvider) => boolean }[] = [
  { id: "metamask", name: "MetaMask", pick: (e) => Boolean(e.isMetaMask && !e.isBraveWallet) },
  { id: "rabby", name: "Rabby", pick: (e) => Boolean(e.isRabby) },
  { id: "coinbase", name: "Coinbase Wallet", pick: (e) => Boolean(e.isCoinbaseWallet) },
  { id: "brave", name: "Brave Wallet", pick: (e) => Boolean(e.isBraveWallet) },
];

type Win = Window & {
  phantom?: { solana?: SolProvider };
  solflare?: SolProvider;
  backpack?: SolProvider;
  glowSolana?: SolProvider;
  okxwallet?: { solana?: SolProvider };
  bitkeep?: { solana?: SolProvider };
  trustwallet?: { solana?: SolProvider };
  coinbaseSolana?: SolProvider;
  ethereum?: EvmProvider & { providers?: EvmProvider[] };
};

function ethereumProviders(): EvmProvider[] {
  if (typeof window === "undefined") return [];
  const eth = (window as Win).ethereum;
  if (!eth) return [];
  return eth.providers?.length ? eth.providers : [eth];
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

export async function connectWallet(id: WalletId): Promise<{ address: string; label: string; chain: "solana" | "evm" }> {
  const choice = detectWallets().find((w) => w.id === id);
  if (!choice?.installed) throw new Error(`${choice?.name ?? "That wallet"} is not in this browser.`);
  if (choice.chain === "solana") {
    const spec = SOL.find((s) => s.id === id);
    const provider = spec?.pick(window);
    if (!provider) throw new Error(`${choice.name} is not in this browser.`);
    const res = await provider.connect();
    const address = res?.publicKey?.toString();
    if (!address) throw new Error(`${choice.name} returned no account.`);
    rememberWallet(id);
    return { address, label: choice.name, chain: "solana" };
  }
  const spec = EVM.find((e) => e.id === id);
  const provider = ethereumProviders().find((p) => spec?.pick(p));
  if (!provider) throw new Error(`${choice.name} is not in this browser.`);
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts?.[0];
  if (!address) throw new Error(`${choice.name} returned no account.`);
  return { address, label: choice.name, chain: "evm" };
}
