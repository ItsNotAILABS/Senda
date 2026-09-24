/** Injected wallets. We only connect what is actually in this browser. */

type SolProvider = {
  isPhantom?: boolean;
  isSolflare?: boolean;
  isBackpack?: boolean;
  connect: () => Promise<{ publicKey?: { toString: () => string } }>;
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
