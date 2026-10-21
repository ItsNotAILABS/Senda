import { activeSolProvider, rememberWallet, type WalletId } from "@/lib/wallets";
import { humanWalletError, canSignHere, isPhoneBrowser, openInWallet } from "@/lib/mobile-wallet";
import { unlockSeal } from "@/lib/seal";
import { clearMove, sealMove } from "@/lib/moves";

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

/** The address Phantom already trusts. Does not open a new connect prompt. */
export async function trustedPhantom(): Promise<string> {
  const p = phantomProvider();
  if (!p) return "";
  const ready = p.publicKey?.toString();
  if (ready) return ready;
  try {
    const res = await p.connect({ onlyIfTrusted: true });
    return res.publicKey?.toString() || p.publicKey?.toString() || "";
  } catch {
    return "";
  }
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
  try {
    const p = await providerOrLeave();
    if (!p) return new Promise(() => {});
    await simulateFirst(tx);
    if (p.signAndSendTransaction) {
      const out = await p.signAndSendTransaction(tx);
      const sig = out.signature;
      const signature = typeof sig === "string" ? sig : bytesToBase58(sig);
      sealMove(signature, true);
      return signature;
    }
    if (!p.signTransaction) throw new Error("This Phantom cannot send a transaction.");
    const signed = await p.signTransaction(tx);
    return broadcastSigned(signed);
  } catch (error) {
    clearMove();
    throw error;
  }
}

/** Simulate and submit a transaction that is already signed. Does not ask the wallet again. */
export async function broadcastSigned(tx: { serialize: () => Uint8Array }): Promise<string> {
  try {
    await simulateFirst(tx);
    const raw = tx.serialize();
    const body = await rpc("sendTransaction", [bytesToBase64(raw), { encoding: "base64", skipPreflight: false }]);
    if (typeof body !== "string") throw new Error("RPC did not return a signature.");
    sealMove(body, true);
    return body;
  } catch (error) {
    clearMove();
    throw error;
  }
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

export async function chainRpc(method: string, params: unknown[]): Promise<unknown> {
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

const rpc = chainRpc;

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
  Pre9atBqkocK1QngFy7Q7zvyQictEFpXdLi6bZ2qnYy: "OURA",
  PreC1KtJ1sBPPqaeeqL6Qb15GTLCYVvyYEwxhdfTwfx: "XAI",
  PrekBgzytydXoDTrH5NW9ABP68c96twxML8oV1NnV8d: "DISCORD",
  PregdTtARmfoDGB7XsbyyZc4RmKbKdmiPFXvinBpjTa: "DATABRICKS",
  PreGJxNkwFp8KmtA5rnvgv2z3zAa8c2UQMfN4FjPh4Z: "EPIC",
  Pres43hQWdY6HaHWckmgzqyQgVwYCXen3VPrXMoKWeY: "KRAKEN",
  PreG98Hxr4GNswTNTQfBVqRQe6DNCjJ9Rg5jqFzmiXA: "PERPLEXITY",
  PreZdBV5d4XDUa7diCGZmyZXQSpbAdrTEzmgvUWY5Dd: "GLEAN",
  Pre8wtN7sLADKn8qekjQipcSiYTGg5tafWqeH49s1wQ: "GROQ",
  PrevLYRs2HreKvo2bEQsAo839m38ws5TH2WHYFzqsWt: "HARVEY",
  Pre2Y4gaf97C4T8ckygDpYbja3w6mH6zmCEs3SA8ALH: "SSI",
  PreJuqZjkL2QFkx78MkEGv8P6Zk8qqpTx9GSjLtfvXW: "SARONIC",
  PrejfFQH6y6aQBfR43zuBqnPXvQrDU5EugwVEBQZVK3: "CHAOS",
  PreZsfo4N5J16vpJWvaTubLpNHrBe1fNgvoFuqZ21xK: "APPTRONIK",
  PreDmU41w1LZaDqiEQdd75ffWaDndMMN8bJPfNno4AM: "ADDEPAR",
  PreQ1REpwo4v5d8QMF58h3jpqKww9k5NMbvBXMVo7A5: "BLABLACAR",
  PreQhJLE9YMSVtJpVLJ3bAWE2BQ5AqBniG7aA2bGRRz: "IMPOSSIBLE",
  PreAYsissANcRXg5uTniKqdCrrUSGdvtrKDVPHS1ib6: "FIGURE",
  Pre5X98d9ZvgGirEcWqeCVDK6wQ52stKkmU3HsH6bfE: "NEURAL",
  Prep57BLk9uKWRzKigtQBbrYFxcDXtHuCjxFRM5UXAS: "ANDURIL-OLD",
  PreGERrFuZAJqTxJ5oC3DeQmfdrniNzJgqKGFb2ZLE6: "ANTHROPIC-OLD",
  PreYKD2kJ5xGgoZ644VPfbEN7sW8bWCUREHr5S3ebV9: "OPENAI-OLD",
  Preb5VKsmKgMGhMKUhDpe7A2AhMDmrZtMMZmvFEhLbU: "SPACEX-OLD",
  PreYPq1LdVBhKsYC3nRmZW5Y9yJXwSuDYmUSikFCwGS: "XAI-OLD",
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
  ["OURA", "Pre9atBqkocK1QngFy7Q7zvyQictEFpXdLi6bZ2qnYy"],
  ["XAI", "PreC1KtJ1sBPPqaeeqL6Qb15GTLCYVvyYEwxhdfTwfx"],
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

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export type UsdcMove = { signature: string; at: number | null; delta: number; err: boolean };

type TokenBal = { owner?: string; mint?: string; uiTokenAmount?: { uiAmount?: number | null } };

function usdcUi(rows: TokenBal[] | undefined, owner: string): number {
  let n = 0;
  for (const row of rows ?? []) {
    if (row.mint === USDC_MINT && row.owner === owner) n += row.uiTokenAmount?.uiAmount || 0;
  }
  return n;
}

/** USDC that entered or left this address. Amounts come from the chain, not from this browser. */
export async function readUsdcMoves(owner: string): Promise<UsdcMove[]> {
  const sigs = (await rpc("getSignaturesForAddress", [owner, { limit: 6 }])) as
    | Array<{ signature?: string }>
    | { value?: Array<{ signature?: string }> };
  const list = (Array.isArray(sigs) ? sigs : sigs?.value ?? []).map((s) => s.signature).filter((s): s is string => Boolean(s));
  const txs = await Promise.all(
    list.map(async (signature) => {
      try {
        const tx = (await rpc("getTransaction", [
          signature,
          { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" },
        ])) as {
          blockTime?: number | null;
          meta?: { err?: unknown; preTokenBalances?: TokenBal[]; postTokenBalances?: TokenBal[] };
        } | null;
        if (!tx?.meta) return { signature, at: null, delta: 0, err: true };
        const before = usdcUi(tx.meta.preTokenBalances, owner);
        const after = usdcUi(tx.meta.postTokenBalances, owner);
        return {
          signature,
          at: tx.blockTime ?? null,
          delta: Math.round((after - before) * 1e6) / 1e6,
          err: Boolean(tx.meta.err),
        };
      } catch {
        return { signature, at: null, delta: 0, err: false };
      }
    }),
  );
  return txs;
}
