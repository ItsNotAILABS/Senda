/** Phone browsers have no wallet extension. Open the wallet's own browser. Sign there. */

import bs58 from "bs58";
import nacl from "tweetnacl";

export type MobileWallet = "phantom" | "solflare";

const SECRET = "senda.mobile.dapp.v1";
const SESSION = "senda.mobile.session.v1";
const PENDING = "senda.mobile.pending.v1";
const BACK = "senda.mobile.back.v1";
const HINT = "senda.mobile.hint.v1";

const HOST: Record<MobileWallet, string> = {
  // phantom.app is the app link. phantom.com/ul/v1/connect is a KMS login and returns an OIDC error.
  phantom: "https://phantom.app/ul/browse",
  solflare: "https://solflare.com/ul/v1/browse",
};

export type SignJob =
  | { kind: "broadcast"; note: string }
  | { kind: "perp"; action: "increase-position" | "decrease-position" };

type Session = {
  wallet: MobileWallet;
  publicKey: string;
  session: string;
  peerPublic: string;
};

type Pending = {
  wallet: MobileWallet;
  job: SignJob | null;
  txB64: string | null;
};

export function isPhoneBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/** True when this page is already the wallet's in-app browser. Do not open another link from here. */
export function insideWalletApp(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Phantom|Solflare|Backpack/i.test(navigator.userAgent);
}

function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function dappSecret(): Uint8Array {
  const saved = localStorage.getItem(SECRET);
  if (saved) return fromB64(saved);
  const pair = nacl.box.keyPair();
  localStorage.setItem(SECRET, b64(pair.secretKey));
  return pair.secretKey;
}

export function mobileSession(): Session | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const row = JSON.parse(localStorage.getItem(SESSION) || "null") as Session | null;
    if (!row?.publicKey || !row.session || !row.peerPublic) return null;
    return row;
  } catch {
    return null;
  }
}

function saveSession(row: Session) {
  localStorage.setItem(SESSION, JSON.stringify(row));
}

function sharedSecret(peerPublic: string): Uint8Array {
  return nacl.box.before(bs58.decode(peerPublic), dappSecret());
}

function decrypt(data: string, nonce: string, peerPublic: string): Record<string, string> {
  const opened = nacl.box.open.after(bs58.decode(data), bs58.decode(nonce), sharedSecret(peerPublic));
  if (!opened) throw new Error("The wallet reply could not be read. Connect again.");
  return JSON.parse(new TextDecoder().decode(opened)) as Record<string, string>;
}

function here(): string {
  return `${location.pathname}${location.search}`;
}

function rememberBack() {
  if (!location.pathname.startsWith("/wallets/app")) localStorage.setItem(BACK, here());
}

export function returnPath(): string {
  return localStorage.getItem(BACK) || "/wallets";
}

export function takeHint(): string {
  const hint = localStorage.getItem(HINT) || "";
  localStorage.removeItem(HINT);
  return hint;
}

function leave(url: string) {
  rememberBack();
  window.location.assign(url);
}

function pageToOpen(): string {
  const path = location.pathname.startsWith("/wallets/app") ? "/wallets" : `${location.pathname}${location.search}`;
  return `${location.origin}${path}`;
}

/** Opens the wallet's own browser on this page. The buy signs there. No KMS connect link. */
export function openWalletBrowser(wallet: MobileWallet) {
  if (insideWalletApp() || location.pathname.startsWith("/wallets/app")) return;
  const host = location.hostname;
  if (/grok|sandbox|preview/i.test(host)) {
    throw new Error("This preview opens an X login inside Phantom. Connect on senda.pocketnova.app, or use the Phantom extension.");
  }
  const target = pageToOpen();
  const ref = encodeURIComponent(location.origin);
  leave(`${HOST[wallet]}/${encodeURIComponent(target)}?ref=${ref}`);
}

/** Opens the wallet app on this page. The encrypted connect link is not used. */
export function startMobileConnect(wallet: MobileWallet, _keepTx = false) {
  localStorage.removeItem(PENDING);
  openWalletBrowser(wallet);
}

/** The phone browser cannot sign. Open the wallet on this same page and buy again there. */
export function startMobileSign(_bytes: Uint8Array, _job: SignJob) {
  if (insideWalletApp()) return;
  const wallet = mobileSession()?.wallet ?? readPending()?.wallet ?? "phantom";
  localStorage.setItem(PENDING, JSON.stringify({ wallet, job: null, txB64: null } satisfies Pending));
  localStorage.setItem(HINT, "Tap buy again. This window can see the wallet.");
  openWalletBrowser(wallet);
}

/** Backpack has no Phantom-style sign link. The page opens inside the app, where the buy button can see the wallet. */
export function openInsideBackpack() {
  if (insideWalletApp()) return;
  const url = pageToOpen();
  leave(`https://backpack.app/ul/v1/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(location.origin)}`);
}

function readPending(): Pending | null {
  try {
    return JSON.parse(localStorage.getItem(PENDING) || "null") as Pending | null;
  } catch {
    return null;
  }
}

export type MobileReturn =
  | { type: "connect"; publicKey: string; label: string; resume: boolean }
  | { type: "signed"; bytes: Uint8Array; job: SignJob; label: string }
  | { type: "error"; message: string }
  | { type: "none" };

/** Wallet and KMS errors are not a Senda balance or a failed trade. Never print the raw text. */
export function walletErrorLine(raw: string): string {
  const text = raw || "";
  if (/oidc|kms|accountidentifier|organizationid|turnkey|token/i.test(text) || text.length > 180 || text.includes("{")) {
    return "Phantom is already open. Tap Connect Phantom. This page can sign once that wallet is connected. The earlier link was a login page, not the signer.";
  }
  if (/reject|cancel|denied/i.test(text)) return "The wallet closed the request. Tap Connect Phantom to try again.";
  return "The wallet did not finish connecting. Tap Connect Phantom. You stay in this app to approve.";
}

/** Read a signed reply if a wallet still sends one. A KMS error is not shown raw. */
export function takeMobileReturn(search: string): MobileReturn {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const error = q.get("errorMessage") || q.get("errorCode");
  if (error && !q.get("data")) {
    localStorage.removeItem(PENDING);
    return { type: "error", message: walletErrorLine(error) };
  }
  const data = q.get("data");
  const nonce = q.get("nonce");
  if (!data || !nonce) return { type: "none" };
  const peer = q.get("phantom_encryption_public_key") || q.get("solflare_encryption_public_key");
  const pending = readPending();
  const wallet = pending?.wallet ?? "phantom";
  const label = wallet === "solflare" ? "Solflare" : "Phantom";
  try {
    if (peer) {
      const body = decrypt(data, nonce, peer);
      if (!body.public_key || !body.session) throw new Error("The wallet did not return an address.");
      saveSession({ wallet, publicKey: body.public_key, session: body.session, peerPublic: peer });
      const resume = Boolean(pending?.txB64 && pending.job);
      return { type: "connect", publicKey: body.public_key, label, resume };
    }
    const session = mobileSession();
    if (!session || !pending?.job) throw new Error("The sign came back without a session. Connect again.");
    const body = decrypt(data, nonce, session.peerPublic);
    if (!body.transaction) throw new Error("The wallet did not return a signed transaction.");
    localStorage.removeItem(PENDING);
    return { type: "signed", bytes: bs58.decode(body.transaction), job: pending.job, label };
  } catch (e) {
    localStorage.removeItem(PENDING);
    return { type: "error", message: walletErrorLine(e instanceof Error ? e.message : "") };
  }
}

/** Old encrypted sign jobs are not resumed. Signing happens on the injected provider. */
export function resumeMobileSign() {
  localStorage.removeItem(PENDING);
}
