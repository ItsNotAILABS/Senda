/**
 * Wallet engine. Phone Safari hands the page to the Phantom app.
 * Inside that app, the injected wallet connects and signs.
 * A user with no wallet gets one the first time Phantom opens.
 * Nothing here creates or stores a key.
 */

export const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const CASH = "CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH";
export const USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
export const SOL = "So11111111111111111111111111111111111111112";

export const DOLLARS = [
  { mint: USDC, symbol: "USDC" },
  { mint: CASH, symbol: "CASH" },
  { mint: USDT, symbol: "USDT" },
] as const;

export type DollarSymbol = (typeof DOLLARS)[number]["symbol"];

export function isPhone(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export function insidePhantom(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { phantom?: { solana?: { isPhantom?: boolean } } };
  if (w.phantom?.solana?.isPhantom) return true;
  return /Phantom/i.test(navigator.userAgent);
}

const PUBLIC = "https://senda.pocketnova.app";

function onPublicDesk(): boolean {
  if (typeof location === "undefined") return false;
  return location.hostname === "senda.pocketnova.app" || location.hostname === "www.senda.pocketnova.app";
}

/** The page Phantom should open. Never a preview, sandbox, or login host. */
export function deskUrl(page?: string): string {
  if (page) {
    try {
      const u = new URL(page);
      if (u.hostname === "senda.pocketnova.app" || u.hostname === "www.senda.pocketnova.app") return u.toString();
    } catch {
      /* fall through */
    }
  }
  if (typeof location === "undefined") return `${PUBLIC}/`;
  if (onPublicDesk()) return page || location.href;
  const path = `${location.pathname}${location.search}`;
  return `${PUBLIC}${path.startsWith("/") ? path : `/${path}`}`;
}

/** The link Phantom uses to open a page in its own browser. */
export function phantomBrowseUrl(page?: string): string {
  const target = deskUrl(page);
  return `https://phantom.app/ul/browse/${encodeURIComponent(target)}?ref=${encodeURIComponent(PUBLIC)}`;
}

function leaveFor(url: string) {
  try {
    if (window.top && window.top !== window) {
      window.open(url, "_top");
      return;
    }
  } catch {
    /* cross-origin frame */
  }
  window.location.assign(url);
}

/** Leave this browser for the Phantom app. No-op when Phantom is already injected. */
export function openInPhantom(page?: string): boolean {
  if (typeof window === "undefined") return false;
  if (insidePhantom()) return false;
  if (!isPhone()) return false;
  leaveFor(phantomBrowseUrl(page));
  return true;
}

export function dollarOf(tokens: Array<{ mint?: string; symbol?: string; ui: number }>): {
  total: number;
  lines: Array<{ symbol: string; ui: number }>;
} {
  const lines = DOLLARS.map((d) => {
    const hit = tokens.find((t) => t.mint === d.mint || t.symbol === d.symbol);
    return { symbol: d.symbol, ui: hit?.ui ?? 0 };
  }).filter((l) => l.ui > 0);
  return { total: lines.reduce((s, l) => s + l.ui, 0), lines };
}
