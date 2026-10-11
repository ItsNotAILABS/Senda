import { activeSolProvider, rememberWallet, type WalletId } from "@/lib/wallets";
import { humanWalletError, canSignHere, isPhoneBrowser, openInWallet } from "@/lib/mobile-wallet";
import { unlockSeal } from "@/lib/seal";

type Pub = { toString: () => string };

export type PhantomProvider = {
  isPhantom?: boolean;
  isSolflare?: boolean;
  isBackpack?: boolean;
  publicKey?: Pub;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey?: Pub }>;
  signAndSendTransaction?: (
    tx: unknown,
    opts?: { skipPreflight?: boolean },
  ) => Promise<{ signature: string | Uint8Array }>;
  signTransaction?: (tx: unknown) => Promise<{ serialize: () => Uint8Array }>;
  signMessage?: (message: Uint8Array, display?: "utf8" | "hex") => Promise<Uint8Array | { signature: Uint8Array }>;
  on?: (event: string, cb: (pk?: Pub | null) => void) => void;
  off?: (event: string, cb: (pk?: Pub | null) => void) => void;
};

export function phantomProvider(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { phantom?: { solana?: PhantomProvider }; solana?: PhantomProvider };
  const p = w.phantom?.solana ?? w.solana;
  if (!p?.connect) return null;
  return p;
}

function currentSolProvider(): PhantomProvider | null {
  return (activeSolProvider() as PhantomProvider | null) ?? phantomProvider();
}

/** Phantom injects late inside its own browser. Poll, and listen for phantom#initialized. */
export function waitForInjected(ms = 2500): Promise<PhantomProvider | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const now = currentSolProvider();
  if (now?.connect) return Promise.resolve(now);
  return new Promise((resolve) => {
    let done = false;
    const finish = (p: PhantomProvider | null) => {
      if (done) return;
      done = true;
      window.clearInterval(id);
      window.clearTimeout(timer);
      window.removeEventListener("phantom#initialized", onReady);
      resolve(p);
    };
    const onReady = () => finish(currentSolProvider());
    window.addEventListener("phantom#initialized", onReady);
    const id = window.setInterval(() => {
      const p = currentSolProvider();
      if (p?.connect) finish(p);
    }, 120);
    const timer = window.setTimeout(() => finish(currentSolProvider()), ms);
  });
}

function rememberInjected(p: PhantomProvider) {
  const w = window as unknown as {
    phantom?: { solana?: PhantomProvider };
    solflare?: PhantomProvider;
    backpack?: PhantomProvider;
  };
  let id: WalletId = "phantom";
  if (p === w.solflare || p.isSolflare) id = "solflare";
  else if (p === w.backpack || p.isBackpack) id = "backpack";
  rememberWallet(id);
}

function addressOf(p: PhantomProvider, res?: { publicKey?: Pub }, eventKey?: Pub | null): string {
  return eventKey?.toString() || res?.publicKey?.toString() || p.publicKey?.toString() || "";
}

/** Connect from a tap. Also listens, because Phantom on a phone sometimes never resolves the promise. */
function approve(p: PhantomProvider): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer = 0;
    const cleanup = () => {
      window.clearTimeout(timer);
      p.off?.("connect", onConnect);
      p.off?.("accountChanged", onAccount);
    };
    const ok = (addr: string) => {
      if (settled || !addr) return;
      settled = true;
      cleanup();
      resolve(addr);
    };
    const fail = (e: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(e instanceof Error ? e : new Error("The wallet did not connect."));
    };
    const onConnect = (pk?: Pub | null) => ok(addressOf(p, undefined, pk));
    const onAccount = (pk?: Pub | null) => {
      if (pk) ok(pk.toString());
    };
    p.on?.("connect", onConnect);
    p.on?.("accountChanged", onAccount);
    const timerId = window.setTimeout(() => fail(new Error("Phantom did not return the account. Tap Show my account again.")), 20000);
    timer = timerId;
    const ready = p.publicKey?.toString();
    if (ready) {
      ok(ready);
      return;
    }
    void p.connect().then((res) => ok(addressOf(p, res))).catch(fail);
  });
}

let inflight: Promise<string> | null = null;

export async function connectPhantom(): Promise<string> {
  if (inflight) return inflight;
  inflight = runConnect().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function runConnect(): Promise<string> {
  const here = canSignHere();
  const injected = await waitForInjected(here ? 8000 : isPhoneBrowser() ? 900 : 200);
  if (injected?.connect) {
    const addr = await approve(injected);
    rememberInjected(injected);
    void unlockSeal(addr).catch(() => {
      /* The account can show before the vault message is signed. */
    });
    return addr;
  }
  if (!here && isPhoneBrowser() && openInWallet("phantom")) return new Promise(() => {});
  throw new Error(
    humanWalletError(
      here
        ? "Phantom is open. Tap Show my account again. This page signs here."
        : "No Solana wallet in this browser. On a phone, Phantom opens this page to approve.",
    ),
  );
}

async function providerOrLeave(): Promise<PhantomProvider | null> {
  const here = canSignHere();
  const p = await waitForInjected(here ? 8000 : 300);
  if (p?.signAndSendTransaction || p?.signTransaction) return p;
  if (!here && isPhoneBrowser() && openInWallet("phantom")) return null;
  throw new Error(
    humanWalletError(
      here
        ? "Phantom is open. Tap Show my account, then sign again. This page signs here."
        : "Connect a Solana wallet. On a phone, Phantom opens this page to sign.",
    ),
  );
}

export async function sendVersioned(tx: { serialize: () => Uint8Array }): Promise<string> {
  const p = await providerOrLeave();
  if (!p) return new Promise(() => {});
  await simulateFirst(tx);
  if (p.signAndSendTransaction) {
    const out = await p.signAndSendTransaction(tx);
    const sig = out.signature;
    if (typeof sig === "string") return sig;
    return bytesToBase58(sig);
  }
  if (!p.signTransaction) throw new Error("This Phantom cannot send a transaction.");
  const signed = await p.signTransaction(tx);
  return broadcastSigned(signed);
}

/** Simulate and submit a transaction that is already signed. Does not ask the wallet again. */
export async function broadcastSigned(tx: { serialize: () => Uint8Array }): Promise<string> {
  await simulateFirst(tx);
  const raw = tx.serialize();
  const body = await rpc("sendTransaction", [bytesToBase64(raw), { encoding: "base64", skipPreflight: false }]);
  if (typeof body !== "string") throw new Error("RPC did not return a signature.");
  return body;
}

async function simulateFirst(tx: { serialize: () => Uint8Array }): Promise<void> {
  const raw = bytesToBase64(tx.serialize());
  const result = (await rpc("simulateTransaction", [
    raw,
    { encoding: "base64", sigVerify: false, replaceRecentBlockhash: true, commitment: "processed" },
  ])) as { value?: { err?: unknown; logs?: string[] } };
  if (result?.value?.err) {
    const logs = (result.value.logs ?? []).filter((l) => /error|failed|insufficient/i.test(l)).slice(-2).join(" ");
    throw new Error(logs || "The chain rejected this before your wallet was asked to sign.");
  }
}

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function bytesToBase58(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  const digits = [0];
  for (let i = zeros; i < bytes.length; i += 1) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j += 1) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "1".repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i -= 1) out += ALPHABET[digits[i]];
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

const RPCS = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  let last = "RPC failed";
  for (const url of RPCS) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const j = (await r.json()) as { result?: unknown; error?: { message?: string } };
      if (j.error) {
        last = j.error.message || last;
        continue;
      }
      return j.result;
    } catch (e) {
      last = e instanceof Error ? e.message : last;
    }
  }
  throw new Error(last);
}

export async function mintDecimals(mint: string): Promise<number> {
  const result = (await rpc("getAccountInfo", [mint, { encoding: "jsonParsed" }])) as {
    value?: { data?: { parsed?: { info?: { decimals?: number } } } };
  };
  const d = result?.value?.data?.parsed?.info?.decimals;
  return typeof d === "number" ? d : 9;
}

export async function splHolding(owner: string, mint: string): Promise<{ ui: number; raw: string; decimals: number }> {
  const result = (await rpc("getTokenAccountsByOwner", [
    owner,
    { mint },
    { encoding: "jsonParsed" },
  ])) as {
    value?: Array<{
      account?: { data?: { parsed?: { info?: { tokenAmount?: { uiAmount?: number | null; amount?: string; decimals?: number } } } } };
    }>;
  };
  const rows = result?.value ?? [];
  let ui = 0;
  let raw = 0n;
  let decimals = 9;
  for (const row of rows) {
    const t = row.account?.data?.parsed?.info?.tokenAmount;
    ui += t?.uiAmount || 0;
    if (t?.amount) raw += BigInt(t.amount);
    if (typeof t?.decimals === "number") decimals = t.decimals;
  }
  return { ui, raw: raw.toString(), decimals };
}

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

const NAMES: Record<string, string> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
  PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB: "ANDURIL",
  Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw: "ANTHROPIC",
  PreZad18qfPtbxNpMtMuAuX2zVpvkEU8DnJx56faCWd: "FIGUREAI",
  PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua: "KALSHI",
  PrekqLJvJ3qVdXmBGDiexvwUTF4rLFDa6HJbw9S: "NEURALINK",
  PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF: "OPENAI",
  Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP: "POLYMARKET",
  PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh: "SPACEX",
};

export const PRESTOCK_MINTS = [
  ["ANDURIL", "PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB"],
  ["ANTHROPIC", "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw"],
  ["FIGUREAI", "PreZad18qfPtbxNpMtMuAuX2zVpvkEU8DnJx56faCWd"],
  ["KALSHI", "PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua"],
  ["NEURALINK", "PrekqLJvJ3qVdXmBGDiexvwUTF4rLFDa6HJbw9S"],
  ["OPENAI", "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF"],
  ["POLYMARKET", "Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP"],
  ["SPACEX", "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh"],
] as const;

export type ChainToken = { mint: string; symbol: string; ui: number; decimals: number };
export type ChainTx = { signature: string; err: boolean; time: number | null };
export type ChainWallet = { sol: number; tokens: ChainToken[]; txs: ChainTx[] };

type ParsedAccounts = {
  value?: Array<{
    account?: {
      data?: { parsed?: { info?: { mint?: string; tokenAmount?: { uiAmount?: number | null; decimals?: number } } } };
    };
  }>;
};

async function tokenAccounts(owner: string, programId: string): Promise<ChainToken[]> {
  const result = (await rpc("getTokenAccountsByOwner", [owner, { programId }, { encoding: "jsonParsed" }])) as ParsedAccounts;
  const out: ChainToken[] = [];
  for (const row of result?.value ?? []) {
    const info = row.account?.data?.parsed?.info;
    const mint = info?.mint ?? "";
    const ui = info?.tokenAmount?.uiAmount || 0;
    if (!mint || !(ui > 0)) continue;
    out.push({
      mint,
      symbol: NAMES[mint] || `${mint.slice(0, 4)}…${mint.slice(-4)}`,
      ui,
      decimals: info?.tokenAmount?.decimals ?? 0,
    });
  }
  return out;
}

/** What this address holds on Solana right now. Keys never move. */
function asLamports(result: unknown): number {
  if (typeof result === "number" && Number.isFinite(result)) return result;
  if (result && typeof result === "object" && "value" in result) {
    const value = (result as { value?: unknown }).value;
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}

export async function readChain(owner: string): Promise<ChainWallet> {
  const [balance, classic, extra, sigs] = await Promise.all([
    rpc("getBalance", [owner, { commitment: "confirmed" }]),
    tokenAccounts(owner, TOKEN_PROGRAM),
    tokenAccounts(owner, TOKEN_2022).catch(() => [] as ChainToken[]),
    rpc("getSignaturesForAddress", [owner, { limit: 8 }]) as Promise<
      Array<{ signature?: string; err?: unknown; blockTime?: number | null }> | { value?: Array<{ signature?: string; err?: unknown; blockTime?: number | null }> }
    >,
  ]);
  const merged = new Map<string, ChainToken>();
  for (const t of [...classic, ...extra]) merged.set(t.mint, t);
  const tokens = [...merged.values()].sort((a, b) => Number(b.symbol === "USDC") - Number(a.symbol === "USDC") || b.ui - a.ui);
  const rows = Array.isArray(sigs) ? sigs : sigs?.value ?? [];
  return {
    sol: asLamports(balance) / 1e9,
    tokens,
    txs: rows.map((s) => ({
      signature: String(s.signature || ""),
      err: Boolean(s.err),
      time: s.blockTime ?? null,
    })),
  };
}
