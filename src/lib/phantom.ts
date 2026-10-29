import { PublicKey } from "@solana/web3.js";
import { activeSolProvider, rememberWallet, type WalletId } from "@/lib/wallets";
import { humanWalletError, injectedWallet, insideWalletApp, isPhoneBrowser, openInWallet } from "@/lib/mobile-wallet";
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
  request?: (args: { method: string; params?: unknown }) => Promise<unknown>;
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

export async function connectPhantom(): Promise<string> {
  const here = insideWalletApp() || injectedWallet();
  const wait = here ? 5000 : isPhoneBrowser() ? 5000 : 400;
  const injected = await waitForInjected(wait);
  if (injected?.connect) {
    const res = await injected.connect();
    const addr = res?.publicKey?.toString() || injected.publicKey?.toString();
    if (!addr) throw new Error("The wallet returned no account.");
    rememberInjected(injected);
    await unlockSeal(addr);
    return addr;
  }
  if (isPhoneBrowser() && !injectedWallet() && openInWallet("phantom")) return new Promise(() => {});
  throw new Error(
    humanWalletError(
      here
        ? "Phantom is open. Tap Connect again. This page signs here."
        : "No Solana wallet in this browser. On a phone, Phantom opens this page to approve.",
    ),
  );
}

export async function requirePhantom(): Promise<PhantomProvider & { signTransaction: (tx: unknown) => Promise<{ serialize: () => Uint8Array }> }> {
  const here = insideWalletApp() || injectedWallet();
  const signer = await waitForInjected(here || isPhoneBrowser() ? 5000 : 800);
  if (!signer?.signTransaction) throw new Error("Connect Phantom in this window. It has to sign.");
  return signer as PhantomProvider & { signTransaction: (tx: unknown) => Promise<{ serialize: () => Uint8Array }> };
}

async function providerOrLeave(): Promise<PhantomProvider | null> {
  const wait = insideWalletApp() ? 2500 : 300;
  const p = await waitForInjected(wait);
  if (p?.signAndSendTransaction || p?.signTransaction) return p;
  if (isPhoneBrowser() && openInWallet("phantom")) return null;
  throw new Error(
    humanWalletError(
      insideWalletApp()
        ? "Phantom is open. Tap Connect, then buy again. This page signs here."
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

/** A transaction that already carries another signature. Phantom signs second, then it is broadcast. */
export async function sendPartial(tx: { serialize: () => Uint8Array }): Promise<string> {
  const p = await providerOrLeave();
  if (!p) return new Promise(() => {});
  await simulateFirst(tx);
  if (p.signTransaction) {
    const signed = await p.signTransaction(tx);
    return broadcastSigned(signed);
  }
  if (!p.signAndSendTransaction) throw new Error("This Phantom cannot send a transaction.");
  const out = await p.signAndSendTransaction(tx);
  const sig = out.signature;
  if (typeof sig === "string") return sig;
  return bytesToBase58(sig);
}

/** Sign a Jupiter transaction and hand back the bytes. Jupiter submits it. */
export async function signSerializedTx(b64: string): Promise<string> {
  const { Buffer } = await import("buffer");
  if (!globalThis.Buffer) globalThis.Buffer = Buffer;
  const raw = Buffer.from(b64, "base64");
  const { VersionedTransaction, Transaction } = await import("@solana/web3.js");
  const p = await providerOrLeave();
  if (!p?.signTransaction && !p?.signAndSendTransaction) return new Promise(() => {});
  let tx: { serialize: () => Uint8Array };
  try {
    tx = VersionedTransaction.deserialize(raw);
  } catch {
    tx = Transaction.from(raw);
  }
  if (p.signTransaction) {
    const signed = await p.signTransaction(tx);
    return Buffer.from(signed.serialize()).toString("base64");
  }
  const sent = await p.signAndSendTransaction!(tx);
  const sig = sent.signature;
  if (typeof sig === "string") return sig;
  return bytesToBase58(sig);
}

/** Simulate and submit a transaction that is already signed. Does not ask the wallet again. */
export async function broadcastSigned(tx: { serialize: () => Uint8Array }): Promise<string> {
  await simulateFirst(tx);
  const raw = tx.serialize();
  const body = await chainRpc("sendTransaction", [bytesToBase64(raw), { encoding: "base64", skipPreflight: false }]);
  if (typeof body !== "string") throw new Error("RPC did not return a signature.");
  await confirmSig(body);
  return body;
}

export async function confirmSig(signature: string): Promise<void> {
  const start = Date.now();
  let last = "The transaction was sent. The chain has not confirmed it. Do not send it again.";
  while (Date.now() - start < 22_000) {
    try {
      const result = (await chainRpc("getSignatureStatuses", [[signature]])) as {
        value?: Array<{ err?: unknown; confirmationStatus?: string } | null>;
      };
      const row = result?.value?.[0];
      if (row?.err) throw new Error("The chain rejected the transaction.");
      const status = row?.confirmationStatus;
      if (status === "processed" || status === "confirmed" || status === "finalized") return;
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("The chain rejected")) throw e;
      last = e instanceof Error ? e.message : last;
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  throw new Error(last);
}

async function simulateFirst(tx: { serialize: (opts?: { requireAllSignatures?: boolean; verifySignatures?: boolean }) => Uint8Array }): Promise<void> {
  let raw: string;
  try {
    raw = bytesToBase64(tx.serialize());
  } catch {
    raw = bytesToBase64(tx.serialize({ requireAllSignatures: false, verifySignatures: false }));
  }
  let result: { value?: { err?: unknown; logs?: string[] } } | null = null;
  try {
    result = (await chainRpc("simulateTransaction", [
      raw,
      { encoding: "base64", sigVerify: false, replaceRecentBlockhash: true, commitment: "processed" },
    ])) as { value?: { err?: unknown; logs?: string[] } };
  } catch {
    return;
  }
  if (result?.value?.err) {
    const logs = (result.value.logs ?? []).filter((l) => /error|failed|insufficient/i.test(l)).slice(-3).join(" ");
    const blob = `${logs} ${JSON.stringify(result.value.err)}`;
    if (/insufficient lamports|insufficient funds for (rent|fee)|no record of a prior credit|debit an account/i.test(blob)) {
      throw new Error("This wallet needs a little SOL for the network fee. CASH and USDC do not pay that fee.");
    }
    if (/0x1788|6024|insufficient funds/i.test(blob)) {
      throw new Error("This account does not hold enough of the token being sold for that size.");
    }
    if (/0x1789|6025/.test(blob)) {
      throw new Error("Jupiter could not use that token account. The buy will pay with SOL when USDC is not on this wallet. Try the same size again.");
    }
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

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? B64[n & 63] : "=";
  }
  return out;
}

const RPCS = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];

export async function chainRpc(method: string, params: unknown[]): Promise<unknown> {
  if (typeof window !== "undefined") {
    const r = await fetch("/api/chain", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method, params }),
    });
    const j = (await r.json()) as { result?: unknown; error?: string };
    if (!r.ok || j.error) throw new Error(j.error || "Could not read the chain.");
    return j.result ?? null;
  }
  let last = "The chain did not answer.";
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

/** The Phantom that is actually injected in this window, if it already has a key. */
export function liveSolAddress(): string {
  try {
    return currentSolProvider()?.publicKey?.toString() || "";
  } catch {
    return "";
  }
}

/** Prefer the open Phantom. Otherwise the Phantom link, then any Solana link. */
export function pickOwner(links: Array<{ kind?: string; address?: string }>): string {
  const live = liveSolAddress();
  if (live) return live;
  return (
    links.find((l) => l.kind === "phantom" && l.address)?.address ||
    links.find((l) => l.kind === "solana" && l.address)?.address ||
    ""
  );
}

type TokenAmount = { uiAmount?: number | null; uiAmountString?: string; amount?: string; decimals?: number };

function tokenUi(t?: TokenAmount): number {
  if (!t) return 0;
  if (typeof t.uiAmount === "number" && Number.isFinite(t.uiAmount)) return t.uiAmount;
  if (t.uiAmountString) {
    const n = Number(t.uiAmountString);
    if (Number.isFinite(n)) return n;
  }
  if (t.amount && typeof t.decimals === "number") return Number(t.amount) / 10 ** t.decimals;
  return 0;
}

export async function mintDecimals(mint: string): Promise<number> {
  const result = (await chainRpc("getAccountInfo", [mint, { encoding: "jsonParsed" }])) as {
    value?: { data?: { parsed?: { info?: { decimals?: number } } } };
  };
  const d = result?.value?.data?.parsed?.info?.decimals;
  return typeof d === "number" ? d : 9;
}

const shownMints = new Set<string>();

/** Ask Phantom to put this mint on the home list. The list hides a new PreStock until it is added. */
export async function showInPhantom(mint: string): Promise<void> {
  if (!mint || shownMints.has(mint)) return;
  const provider = currentSolProvider();
  if (!provider?.request) return;
  shownMints.add(mint);
  try {
    await provider.request({
      method: "wallet_watchAsset",
      params: { type: "SPL", options: { mint } },
    });
  } catch {
    shownMints.delete(mint);
  }
}

export async function splHolding(owner: string, mint: string): Promise<{ ui: number; raw: string; decimals: number }> {
  const result = (await chainRpc("getTokenAccountsByOwner", [
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
    ui += tokenUi(t);
    if (t?.amount) raw += BigInt(t.amount);
    if (typeof t?.decimals === "number") decimals = t.decimals;
  }
  return { ui, raw: raw.toString(), decimals };
}

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const CASH_MINT = "CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH";

const NAMES: Record<string, string> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH: "CASH",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
  "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo": "PYUSD",
  "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH": "USDG",
  USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB: "USD1",
  HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr: "EURC",
  "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr": "POPCAT",
  MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5: "MEW",
  "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv": "PENGU",
  "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump": "FARTCOIN",
  "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN": "TRUMP",
  PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB: "ANDURIL",
  Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw: "ANTHROPIC",
  PreZad18qfPtbxNpMtMuAuX2zVpvkEU8DnJx56faCWd: "FIGUREAI",
  PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua: "KALSHI",
  PrekqLJvJ3qVdXmBGDiexvwUTF4rLFDa6HWS4HJbw9S: "NEURALINK",
  PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF: "OPENAI",
  Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP: "POLYMARKET",
  PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh: "SPACEX",
  Pre9atBqkocK1QngFy7Q7zvyQictEFpXdLi6bZ2qnYy: "OURA",
};

export const PRESTOCK_MINTS = [
  ["ANDURIL", "PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB"],
  ["ANTHROPIC", "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw"],
  ["FIGUREAI", "PreZad18qfPtbxNpMtMuAuX2zVpvkEU8DnJx56faCWd"],
  ["KALSHI", "PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua"],
  ["NEURALINK", "PrekqLJvJ3qVdXmBGDiexvwUTF4rLFDa6HWS4HJbw9S"],
  ["OPENAI", "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF"],
  ["OURA", "Pre9atBqkocK1QngFy7Q7zvyQictEFpXdLi6bZ2qnYy"],
  ["POLYMARKET", "Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP"],
  ["SPACEX", "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh"],
] as const;

export function symbolFor(mint: string): string {
  if (mint === "So11111111111111111111111111111111111111112") return "SOL";
  return NAMES[mint] || `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

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

async function tokenAccounts(owner: string, filter: { programId: string } | { mint: string }): Promise<ChainToken[]> {
  const result = (await chainRpc("getTokenAccountsByOwner", [owner, filter, { encoding: "jsonParsed" }])) as ParsedAccounts;
  const out: ChainToken[] = [];
  for (const row of result?.value ?? []) {
    const info = row.account?.data?.parsed?.info;
    const mint = info?.mint ?? ("mint" in filter ? filter.mint : "");
    const ui = tokenUi(info?.tokenAmount);
    if (!mint || !(ui > 0)) continue;
    const prev = out.find((t) => t.mint === mint);
    if (prev) {
      prev.ui += ui;
      continue;
    }
    out.push({
      mint,
      symbol: NAMES[mint] || `${mint.slice(0, 4)}…${mint.slice(-4)}`,
      ui,
      decimals: info?.tokenAmount?.decimals ?? 0,
    });
  }
  return out;
}

type SigRow = { signature?: string; err?: unknown; blockTime?: number | null };

function mapSigs(rows: SigRow[]): ChainTx[] {
  return rows.map((s) => ({
    signature: String(s.signature || ""),
    err: Boolean(s.err),
    time: s.blockTime ?? null,
  }));
}

const chainBag = new Map<string, { at: number; data?: ChainWallet; pending?: Promise<ChainWallet> }>();

export function invalidateChain(owner?: string) {
  if (owner) chainBag.delete(owner);
  else chainBag.clear();
}

function scannedOf(
  classic: PromiseSettledResult<ChainToken[]>,
  extra: PromiseSettledResult<ChainToken[]>,
): ChainToken[] {
  return [
    ...(classic.status === "fulfilled" ? classic.value : []),
    ...(extra.status === "fulfilled" ? extra.value : []),
  ];
}

async function readChainFresh(owner: string): Promise<ChainWallet> {
  const [heldResult, usdcAccounts, cashAccounts, balResult, classic, extra] = await Promise.allSettled([
    chainRpc("holdings", [owner]) as Promise<{ sol?: number; tokens?: ChainToken[] } | null>,
    tokenAccounts(owner, { mint: USDC_MINT }),
    tokenAccounts(owner, { mint: CASH_MINT }),
    chainRpc("getBalance", [owner, { commitment: "confirmed" }]) as Promise<{ value?: number } | number>,
    tokenAccounts(owner, { programId: TOKEN_PROGRAM }),
    tokenAccounts(owner, { programId: TOKEN_2022 }),
  ]);
  const dollars = [
    ...(usdcAccounts.status === "fulfilled" ? usdcAccounts.value : []),
    ...(cashAccounts.status === "fulfilled" ? cashAccounts.value : []),
  ];
  const balValue = balResult.status === "fulfilled" ? balResult.value : 0;
  const lamports = typeof balValue === "number" ? balValue : Number(balValue?.value ?? 0);
  const chainSol = (Number.isFinite(lamports) ? lamports : 0) / 1e9;
  if (heldResult.status === "fulfilled") {
    const held = heldResult.value;
    if (held && typeof held.sol === "number" && Array.isArray(held.tokens)) {
      let txs: ChainTx[] = [];
      try {
        const sigs = (await chainRpc("getSignaturesForAddress", [owner, { limit: 25 }])) as SigRow[] | null;
        if (Array.isArray(sigs)) txs = mapSigs(sigs);
      } catch {
        txs = [];
      }
      return { sol: held.sol > 0 ? held.sol : chainSol, tokens: mergeTokens(mergeTokens(held.tokens, dollars), scannedOf(classic, extra)), txs };
    }
  }
  const [sigs] = await Promise.allSettled([
    chainRpc("getSignaturesForAddress", [owner, { limit: 25 }]) as Promise<SigRow[]>,
  ]);
  if (balResult.status === "rejected" && usdcAccounts.status === "rejected" && classic.status === "rejected") {
    const reason = balResult.reason ?? usdcAccounts.reason;
    throw new Error(reason instanceof Error ? reason.message : "Could not read this wallet.");
  }
  const scanned = scannedOf(classic, extra);
  const sigRows = sigs.status === "fulfilled" && Array.isArray(sigs.value) ? sigs.value : [];
  return {
    sol: (Number.isFinite(lamports) ? lamports : 0) / 1e9,
    tokens: mergeTokens(scanned, dollars),
    txs: mapSigs(sigRows),
  };
}

function mergeTokens(base: ChainToken[], extra: ChainToken[]): ChainToken[] {
  const merged = new Map<string, ChainToken>();
  for (const t of base) merged.set(t.mint, t);
  for (const t of extra) merged.set(t.mint, t);
  return [...merged.values()].sort(
    (a, b) => Number(b.symbol === "USDC" || b.symbol === "CASH") - Number(a.symbol === "USDC" || a.symbol === "CASH") || b.ui - a.ui,
  );
}

/** What this address holds on Solana right now. Keys never move. */
export async function readChain(owner: string): Promise<ChainWallet> {
  const hit = chainBag.get(owner);
  if (hit?.data && Date.now() - hit.at < 10_000) return hit.data;
  if (hit?.pending) return hit.pending;
  const pending = readChainFresh(owner)
    .then((data) => {
      chainBag.set(owner, { at: Date.now(), data });
      return data;
    })
    .catch((err) => {
      const cur = chainBag.get(owner);
      if (cur) chainBag.set(owner, { at: cur.at, data: cur.data });
      throw err;
    });
  chainBag.set(owner, { at: hit?.at ?? 0, data: hit?.data, pending });
  return pending;
}

const ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

export type UsdcMove = {
  signature: string;
  delta: number;
  other: string;
  time: number | null;
  err: boolean;
};

type BalRow = { mint?: string; owner?: string; uiTokenAmount?: TokenAmount };

/** USDC in and out of this address, read from the chain. */
export async function readUsdcMoves(owner: string): Promise<UsdcMove[]> {
  const ata = PublicKey.findProgramAddressSync(
    [new PublicKey(owner).toBytes(), new PublicKey(TOKEN_PROGRAM).toBytes(), new PublicKey(USDC_MINT).toBytes()],
    new PublicKey(ATA_PROGRAM),
  )[0];
  const listed = (await chainRpc("getSignaturesForAddress", [ata.toBase58(), { limit: 12 }])) as
    | Array<{ signature?: string; err?: unknown; blockTime?: number | null }>
    | null;
  const out: UsdcMove[] = [];
  for (const row of listed ?? []) {
    if (!row.signature) continue;
    const tx = (await chainRpc("getTransaction", [row.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }])) as {
      blockTime?: number | null;
      meta?: { err?: unknown; preTokenBalances?: BalRow[]; postTokenBalances?: BalRow[] };
    } | null;
    const pre = (tx?.meta?.preTokenBalances ?? []).filter((b) => b.mint === USDC_MINT && b.owner === owner);
    const post = (tx?.meta?.postTokenBalances ?? []).filter((b) => b.mint === USDC_MINT && b.owner === owner);
    const before = pre.reduce((s, b) => s + tokenUi(b.uiTokenAmount), 0);
    const after = post.reduce((s, b) => s + tokenUi(b.uiTokenAmount), 0);
    const delta = Math.round((after - before) * 1e6) / 1e6;
    const other =
      (tx?.meta?.postTokenBalances ?? []).find((b) => b.mint === USDC_MINT && b.owner && b.owner !== owner)?.owner ?? "";
    if (delta === 0 && !tx?.meta?.err) continue;
    out.push({ signature: row.signature, delta, other, time: tx?.blockTime ?? row.blockTime ?? null, err: Boolean(tx?.meta?.err || row.err) });
  }
  return out;
}
