/** A vault wraps a wallet. The tokens stay in that wallet. The wrap is the claim. */

const KEY = "senda.vaultwrap.v1";

type Row = { label: string; usdc: number };
type Book = Record<string, Row>;

function load(): Book {
  if (typeof window === "undefined") return {};
  try {
    const p = JSON.parse(window.localStorage.getItem(KEY) || "") as Book;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function save(b: Book) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    /* quota */
  }
}

export function wrappedUsdc(address: string): number {
  return load()[address]?.usdc || 0;
}

export function wrapUsdc(address: string, label: string, amount: number, onChain: number): number {
  const b = load();
  const cur = b[address]?.usdc || 0;
  const next = Math.round((cur + amount) * 100) / 100;
  if (next - onChain > 0.001) throw new Error("You can't wrap more USDC than this wallet holds.");
  b[address] = { label, usdc: next };
  save(b);
  return next;
}

export function unwrapUsdc(address: string, amount: number): number {
  const b = load();
  const cur = b[address]?.usdc || 0;
  if (amount - cur > 0.001) throw new Error("The vault doesn't have that much wrapped.");
  const next = Math.max(0, Math.round((cur - amount) * 100) / 100);
  b[address] = { label: b[address]?.label || "Wallet", usdc: next };
  save(b);
  return next;
}
