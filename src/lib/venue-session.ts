/**
 * Session links to real venues. Public addresses persist locally.
 * Kalshi private keys stay in this tab only — never written to the ledger.
 */

export type SolLink = {
  address: string;
  linkedAt: number;
};

export type PolyLink = {
  address: string;
  linkedAt: number;
};

export type KalshiLink = {
  keyId: string;
  linkedAt: number;
  balance: number | null;
};

export type VenueSession = {
  sol: SolLink | null;
  poly: PolyLink | null;
  kalshi: KalshiLink | null;
};

const SOL_KEY = "the-pit.sol.address";
const POLY_KEY = "the-pit.poly.address";
const KALSHI_KEY = "the-pit.kalshi.link";
const KALSHI_PEM_KEY = "the-pit.kalshi.pem";

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadVenueSession(): VenueSession {
  if (typeof window === "undefined") return { sol: null, poly: null, kalshi: null };
  const sol = readJson<SolLink>(SOL_KEY);
  const poly = readJson<PolyLink>(POLY_KEY);
  const kalshi = readJson<KalshiLink>(KALSHI_KEY);
  return {
    sol: sol?.address ? sol : null,
    poly: poly?.address ? poly : null,
    kalshi: kalshi?.keyId ? kalshi : null,
  };
}

export function saveSolLink(address: string): SolLink {
  const link: SolLink = { address, linkedAt: Date.now() };
  window.localStorage.setItem(SOL_KEY, JSON.stringify(link));
  return link;
}

export function clearSolLink(): void {
  window.localStorage.removeItem(SOL_KEY);
}

export function savePolyLink(address: string): PolyLink {
  const link: PolyLink = { address: address.toLowerCase(), linkedAt: Date.now() };
  window.localStorage.setItem(POLY_KEY, JSON.stringify(link));
  return link;
}

export function clearPolyLink(): void {
  window.localStorage.removeItem(POLY_KEY);
}

export function saveKalshiLink(keyId: string, balance: number | null, pem: string): KalshiLink {
  const link: KalshiLink = { keyId, linkedAt: Date.now(), balance };
  window.localStorage.setItem(KALSHI_KEY, JSON.stringify(link));
  try {
    window.sessionStorage.setItem(KALSHI_PEM_KEY, pem);
  } catch {
    /* private key stays in memory only if sessionStorage is blocked */
  }
  return link;
}

export function loadKalshiPem(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(KALSHI_PEM_KEY) ?? "";
  } catch {
    return "";
  }
}

export function clearKalshiLink(): void {
  window.localStorage.removeItem(KALSHI_KEY);
  try {
    window.sessionStorage.removeItem(KALSHI_PEM_KEY);
  } catch {
    /* ignore */
  }
}

export function shortAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export async function requestSolanaWallet(): Promise<string> {
  const w = window as unknown as {
    solana?: {
      connect: () => Promise<{ publicKey?: { toString: () => string } }>;
    };
    phantom?: {
      solana?: {
        connect: () => Promise<{ publicKey?: { toString: () => string } }>;
      };
    };
  };
  const provider = w.phantom?.solana ?? w.solana;
  if (!provider) {
    throw new Error("No Phantom in this browser. Open in a window with Phantom.");
  }
  const res = await provider.connect();
  const addr = res?.publicKey?.toString();
  if (!addr) throw new Error("Wallet returned no account.");
  return addr;
}

export async function requestPolyWallet(): Promise<string> {
  const eth = (window as unknown as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
  if (!eth) {
    throw new Error("No wallet in this browser. Open in a window with MetaMask or Rabby.");
  }
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const addr = accounts?.[0];
  if (!addr) throw new Error("Wallet returned no account.");
  return addr;
}
