import { deskUrl } from "@/lib/wallet-engine";

export type MobileWallet = "phantom" | "solflare" | "backpack" | "coinbase";

const HOST: Record<Exclude<MobileWallet, "coinbase">, string> = {
  // phantom.app/ul/browse is the in-app browser. phantom.com/ul/v1/connect is a KMS login.
  phantom: "https://phantom.app/ul/browse",
  solflare: "https://solflare.com/ul/v1/browse",
  backpack: "https://backpack.app/ul/v1/browse",
};

const HINT = "senda.mobile.hint.v1";
const MARK = "senda.inWallet";

type SolWin = Window & {
  phantom?: { solana?: { connect?: unknown } };
  solana?: { connect?: unknown };
  solflare?: { connect?: unknown };
  backpack?: { connect?: unknown };
  coinbaseSolana?: { connect?: unknown };
};

function captureLanding() {
  if (typeof window === "undefined") return;
  const q = new URLSearchParams(window.location.search).get("sendaIn");
  const h = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("in");
  const flag = q || h;
  if (flag === "phantom" || flag === "solflare" || flag === "backpack" || flag === "coinbase") {
    try {
      sessionStorage.setItem(MARK, flag);
    } catch {
      /* private mode */
    }
  }
}

captureLanding();

export function isPhoneBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/** The wallet app has injected a signer. Desktop extensions count too. */
export function injectedSolana(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as SolWin;
  return Boolean(w.phantom?.solana?.connect || w.solflare?.connect || w.backpack?.connect || w.coinbaseSolana?.connect || w.solana?.connect);
}

/** True when this page was opened from a phone into the wallet's own browser. */
export function landedInWallet(): boolean {
  captureLanding();
  if (typeof sessionStorage === "undefined") return false;
  try {
    const flag = sessionStorage.getItem(MARK);
    return flag === "phantom" || flag === "solflare" || flag === "backpack" || flag === "coinbase";
  } catch {
    return false;
  }
}

/** User-agent only. Phantom's in-app browser often looks like Safari, so also check landedInWallet. */
export function insideWalletApp(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Phantom|Solflare|Backpack|CoinbaseWallet|CBWallet/i.test(navigator.userAgent) || landedInWallet();
}

/** This page can ask for a signature. Do not deeplink away from it. */
export function canSignHere(): boolean {
  return insideWalletApp() || injectedSolana();
}

export function walletBrowseUrl(wallet: MobileWallet, page: string, origin: string): string {
  if (wallet === "coinbase") return `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(page)}`;
  return `${HOST[wallet]}/${encodeURIComponent(page)}?ref=${encodeURIComponent(origin)}`;
}

/** Opens the wallet's browser on the public desk. Never the preview, which asks for X. */
export function openInWallet(wallet: MobileWallet): boolean {
  if (typeof window === "undefined") return false;
  if (canSignHere()) return false;
  try {
    sessionStorage.setItem(HINT, "Tap Show my account. This window can sign.");
  } catch {
    /* private mode */
  }
  const url = new URL(deskUrl());
  url.searchParams.set("sendaIn", wallet);
  url.hash = `in=${wallet}`;
  const next = walletBrowseUrl(wallet, url.toString(), url.origin);
  try {
    if (window.top && window.top !== window) {
      window.open(next, "_top");
      return true;
    }
  } catch {
    /* cross-origin frame */
  }
  window.location.assign(next);
  return true;
}

export function takeBuyAgain(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const line = sessionStorage.getItem(HINT);
    if (!line) return null;
    sessionStorage.removeItem(HINT);
    return line;
  } catch {
    return null;
  }
}

/** Never show a wallet login payload as if Senda wrote it. */
export function humanWalletError(message: string): string {
  const raw = message.trim();
  if (/oidc|kms|accountidentifier|phantom\.com\/ul\/v1\/connect|\{/.test(raw.toLowerCase()) || raw.length > 180) {
    return canSignHere()
      ? "Phantom is already open. Tap Show my account. This page signs here."
      : "That link was a wallet login page, not the signer. Open Phantom, then tap Show my account.";
  }
  return raw || "The wallet did not connect.";
}
