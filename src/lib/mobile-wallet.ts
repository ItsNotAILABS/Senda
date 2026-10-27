/** Phone browsers have no extension. Open this page inside the wallet app. Never use a connect/login link. */

export type MobileWallet = "phantom" | "solflare" | "backpack";

const HOST: Record<MobileWallet, string> = {
  // phantom.app/ul/browse is the in-app browser. phantom.com/ul/v1/connect is a KMS login.
  phantom: "https://phantom.app/ul/browse",
  solflare: "https://solflare.com/ul/v1/browse",
  backpack: "https://backpack.app/ul/v1/browse",
};

const HINT = "senda.mobile.hint.v1";

export function isPhoneBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/** True when a Solana wallet has injected a signer into this page. */
export function injectedWallet(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    phantom?: { solana?: { connect?: unknown } };
    solana?: { connect?: unknown; isPhantom?: boolean; isSolflare?: boolean; isBackpack?: boolean };
    solflare?: { connect?: unknown };
    backpack?: { connect?: unknown };
  };
  return Boolean(w.phantom?.solana?.connect || w.solflare?.connect || w.backpack?.connect || w.solana?.connect);
}

/** True when this page is already running inside Phantom, Solflare, or Backpack. */
export function insideWalletApp(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/Phantom|Solflare|Backpack/i.test(navigator.userAgent)) return true;
  return injectedWallet();
}

export function walletBrowseUrl(wallet: MobileWallet, page: string, origin: string): string {
  return `${HOST[wallet]}/${encodeURIComponent(page)}?ref=${encodeURIComponent(origin)}`;
}

function pageToOpen(): { page: string; origin: string } {
  const host = location.hostname;
  const preview = host.endsWith("grok-sandbox.com") || host.endsWith(".grok.me") || host === "grok.me";
  const origin = preview ? "https://senda.pocketnova.app" : location.origin;
  return { page: `${origin}${location.pathname}${location.search}`, origin };
}

/** Opens the wallet's browser on this exact page. Returns false if we are already inside one. */
export function openInWallet(wallet: MobileWallet): boolean {
  if (typeof window === "undefined") return false;
  if (insideWalletApp()) return false;
  try {
    sessionStorage.setItem(HINT, "Tap buy again. This window can sign.");
  } catch {
    /* private mode */
  }
  const { page, origin } = pageToOpen();
  window.location.assign(walletBrowseUrl(wallet, page, origin));
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
    return insideWalletApp()
      ? "Phantom is already open. Tap Connect. This page signs here."
      : "That link was a wallet login page, not the signer. Open Phantom and buy on this page.";
  }
  if (/did not match the expected pattern/i.test(raw)) {
    return "The wallet could not read that transfer. Sign the same amount again.";
  }
  return raw || "The wallet did not connect.";
}
