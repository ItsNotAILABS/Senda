import { activeSolProvider } from "@/lib/wallets";
import { insideWalletApp, isPhoneBrowser, mobileSession, startMobileConnect, startMobileSign, type SignJob } from "@/lib/mobile-wallet";
import { sealOpen, unlockSeal } from "@/lib/seal";
import { PublicKey } from "@solana/web3.js";

type Pub = { toString: () => string };

export type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: Pub;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey?: Pub }>;
  signAndSendTransaction?: (
    tx: unknown,
    opts?: { skipPreflight?: boolean },
  ) => Promise<{ signature: string | Uint8Array }>;
  signTransaction?: (tx: unknown) => Promise<{ serialize: () => Uint8Array }>;
};

export function phantomProvider(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { phantom?: { solana?: PhantomProvider }; solana?: PhantomProvider };
  const p = w.phantom?.solana ?? w.solana;
  if (!p?.connect) return null;
  return p;
}

/** Phantom injects late inside its own browser. Wait for it instead of opening another link. */
export function waitForInjected(ms = 2500): Promise<PhantomProvider | null> {
  const now = (activeSolProvider() as PhantomProvider | null) ?? phantomProvider();
  if (now?.connect) return Promise.resolve(now);
  if (typeof window === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    let done = false;
    const finish = (p: PhantomProvider | null) => {
      if (done) return;
      done = true;
      window.removeEventListener("phantom#initialized", onReady);
      resolve(p);
    };
    const onReady = () => finish((activeSolProvider() as PhantomProvider | null) ?? phantomProvider());
    window.addEventListener("phantom#initialized", onReady);
    const started = Date.now();
    const tick = () => {
      const p = (activeSolProvider() as PhantomProvider | null) ?? phantomProvider();
      if (p?.connect) {
        finish(p);
        return;
      }
      if (Date.now() - started >= ms) {
        finish(null);
        return;
      }
      window.setTimeout(tick, 120);
    };
    tick();
  });
}

export async function connectPhantom(): Promise<string> {
  const injected = await waitForInjected(insideWalletApp() ? 4000 : 400);
  if (injected?.connect) {
    const res = await injected.connect();
    const addr = res?.publicKey?.toString() || injected.publicKey?.toString();
    if (!addr) throw new Error("The wallet returned no account.");
    if (!sealOpen()) await unlockSeal(addr);
    return addr;
  }
  const known = mobileSession();
  if (known && !insideWalletApp()) {
    if (!sealOpen()) await unlockSeal(known.publicKey);
    return known.publicKey;
  }
  if (isPhoneBrowser() && !insideWalletApp() && !location.pathname.startsWith("/wallets/app")) {
    startMobileConnect("phantom");
    return new Promise(() => {});
  }
  throw new Error(
    insideWalletApp()
      ? "Phantom is open, but this page cannot see the wallet yet. Tap Connect Phantom."
      : "No Solana wallet in this browser. On a phone, Phantom or Solflare opens to approve.",
  );
}

function unsignedBytes(tx: { serialize: (...args: never[]) => Uint8Array }): Uint8Array {
  const serialize = tx.serialize as (config?: { requireAllSignatures?: boolean; verifySignatures?: boolean }) => Uint8Array;
  try {
    return serialize({ requireAllSignatures: false, verifySignatures: false });
  } catch {
    return serialize();
  }
}

function phoneSign(tx: { serialize: (...args: never[]) => Uint8Array }, job: SignJob): Promise<string> {
  startMobileSign(unsignedBytes(tx), job);
  return new Promise(() => {});
}

async function providerOrThrow(): Promise<PhantomProvider | null> {
  const p = await waitForInjected(insideWalletApp() ? 4000 : 400);
  if (p?.signAndSendTransaction || p?.signTransaction) return p;
  if (isPhoneBrowser() && !insideWalletApp() && !location.pathname.startsWith("/wallets/app")) return null;
  throw new Error(
    insideWalletApp()
      ? "Phantom is open. Tap Connect Phantom, then buy again. This page signs here."
      : "Connect a Solana wallet. On a phone, Phantom or Solflare opens to sign.",
  );
}

export function liveSolAddress(): string {
  try {
    return phantomProvider()?.publicKey?.toString() || "";
  } catch {
    return "";
  }
}

export function pickOwner(links: Array<{ kind?: string; address?: string }>): string {
  const live = liveSolAddress();
  if (live) return live;
  return (
    links.find((l) => l.kind === "phantom" && l.address)?.address ||
    links.find((l) => l.kind === "solana" && l.address)?.address ||
    ""
  );
}

export async function signSerializedTx(b64: string): Promise<string> {
  const { Buffer } = await import("buffer");
  if (!globalThis.Buffer) globalThis.Buffer = Buffer;
  const raw = Buffer.from(b64, "base64");
  const { VersionedTransaction, Transaction } = await import("@solana/web3.js");
  const p = await providerOrThrow();
  if (!p?.signTransaction) throw new Error("Connect a Solana wallet. A limit needs the signature before it is sent.");
  let tx: { serialize: () => Uint8Array };
  try {
    tx = VersionedTransaction.deserialize(raw);
  } catch {
    tx = Transaction.from(raw);
  }
  const signed = await p.signTransaction(tx);
  return Buffer.from(signed.serialize()).toString("base64");
}

export async function sendVersioned(tx: { serialize: () => Uint8Array }): Promise<string> {
  await simulateFirst(tx);
  const p = await providerOrThrow();
  if (!p) return phoneSign(tx, { kind: "broadcast", note: "Swap" });
  if (p.signAndSendTransaction) {
    const out = await p.signAndSendTransaction(tx);
    const sig = out.signature;
    if (typeof sig === "string") return sig;
    return bytesToBase58(sig);
  }
  if (!p.signTransaction) throw new Error("This wallet cannot send a transaction.");
  const signed = await p.signTransaction(tx);
  return broadcastSigned(signed);
}

/** One key has already signed. The wallet adds its signature. A send-and-sign call is not used, so the first signature stays. */
export async function sendPartial(tx: { serialize: () => Uint8Array }): Promise<string> {
  const p = await providerOrThrow();
  if (!p) return phoneSign(tx, { kind: "broadcast", note: "Create" });
  if (!p.signTransaction) throw new Error("This wallet cannot add a signature. Nothing was sent.");
  const signed = await p.signTransaction(tx);
  return broadcastSigned(signed);
}

/** Legacy USDC transfer. The phone opens the wallet app when there is no extension. */
export async function signAndBroadcast(tx: { serialize: (...args: never[]) => Uint8Array }): Promise<string> {
  const p = await providerOrThrow();
  if (!p) return phoneSign(tx, { kind: "broadcast", note: "USDC" });
  if (p.signTransaction) {
    const signed = await p.signTransaction(tx);
    return broadcastSigned(signed);
  }
  const out = await p.signAndSendTransaction!(tx);
  const sig = out.signature;
  if (typeof sig === "string") return sig;
  return bytesToBase58(sig);
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

export async function rpc(method: string, params: unknown[]): Promise<unknown> {
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

export type ChainToken = {
  mint: string;
  symbol: string;
  ui: number;
  decimals: number;
};

export type ChainTx = {
  signature: string;
  err: boolean;
  time: number | null;
};

export type ChainWallet = {
  sol: number;
  tokens: ChainToken[];
  txs: ChainTx[];
};

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

const NAMES: Record<string, string> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
  "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo": "PYUSD",
  "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH": "USDG",
  USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB: "USD1",
  CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH: "CASH",
  USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA: "USDS",
  JuprjznTrTSp2UFa3ZBUFgwdAmtZCq4MQCwysN55USD: "JupUSD",
  KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS: "KMNO",
  pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn: "PUMP",
  METvsvVRapdj9cFLzq4Tr43xK4tAjQfwX76z3n6mWQL: "MET",
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: "JUP",
  "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4": "JLP",
  HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3: "PYTH",
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R": "RAY",
  orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE: "ORCA",
  jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL: "JTO",
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
};

export const PRESTOCK_MINTS: Array<[string, string]> = [
  ["ANDURIL", "PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB"],
  ["ANTHROPIC", "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw"],
  ["FIGUREAI", "PreZad18qfPtbxNpMtMuAuX2zVpvkEU8DnJx56faCWd"],
  ["KALSHI", "PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua"],
  ["NEURALINK", "PrekqLJvJ3qVdXmBGDiexvwUTF4rLFDa6HWS4HJbw9S"],
  ["OPENAI", "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF"],
  ["POLYMARKET", "Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP"],
  ["SPACEX", "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh"],
];

export async function mintDecimals(mint: string): Promise<number> {
  const info = (await rpc("getAccountInfo", [mint, { encoding: "jsonParsed" }])) as {
    value?: { data?: { parsed?: { info?: { decimals?: number } } } };
  } | null;
  const d = info?.value?.data?.parsed?.info?.decimals;
  return typeof d === "number" ? d : 9;
}

export async function splHolding(owner: string, mint: string): Promise<{ ui: number; raw: string; decimals: number }> {
  const rows = (await rpc("getTokenAccountsByOwner", [owner, { mint }, { encoding: "jsonParsed" }])) as {
    value?: Array<{ account?: { data?: { parsed?: { info?: { tokenAmount?: { uiAmount?: number; amount?: string; decimals?: number } } } } } }>;
  } | null;
  let ui = 0;
  let raw = 0n;
  let decimals = 9;
  for (const row of rows?.value ?? []) {
    const t = row.account?.data?.parsed?.info?.tokenAmount;
    ui += t?.uiAmount || 0;
    if (t?.amount) raw += BigInt(t.amount);
    if (typeof t?.decimals === "number") decimals = t.decimals;
  }
  return { ui, raw: raw.toString(), decimals };
}

async function tokenAccounts(owner: string, programId: string): Promise<ChainToken[]> {
  const result = (await rpc("getTokenAccountsByOwner", [owner, { programId }, { encoding: "jsonParsed" }])) as {
    value?: Array<{ account?: { data?: { parsed?: { info?: { mint?: string; tokenAmount?: { uiAmount?: number; decimals?: number } } } } } }>;
  } | null;
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
export async function readChain(owner: string): Promise<ChainWallet> {
  const [lamports, classic, extra, sigs] = await Promise.all([
    rpc("getBalance", [owner]),
    tokenAccounts(owner, TOKEN_PROGRAM),
    tokenAccounts(owner, TOKEN_2022).catch(() => [] as ChainToken[]),
    rpc("getSignaturesForAddress", [owner, { limit: 8 }]),
  ]);
  const merged = new Map<string, ChainToken>();
  for (const t of [...classic, ...extra]) merged.set(t.mint, t);
  const tokens = [...merged.values()].sort((a, b) => Number(b.symbol === "USDC") - Number(a.symbol === "USDC") || b.ui - a.ui);
  const list = Array.isArray(sigs) ? (sigs as Array<{ signature?: string; err?: unknown; blockTime?: number | null }>) : [];
  return {
    sol: (Number(lamports) || 0) / 1e9,
    tokens,
    txs: list.map((s) => ({
      signature: String(s.signature || ""),
      err: Boolean(s.err),
      time: s.blockTime ?? null,
    })),
  };
}

/** The same chain read the desks already use. */
export function chainRpc(method: string, params: unknown[]): Promise<unknown> {
  return rpc(method, params);
}

/** Wait until the chain has seen this signature. Do not send it again while this is running. */
export async function confirmSig(signature: string): Promise<void> {
  const start = Date.now();
  let last = "The transaction was sent. The chain has not confirmed it. Do not send it again.";
  while (Date.now() - start < 22_000) {
    try {
      const result = (await rpc("getSignatureStatuses", [[signature]])) as {
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

export async function requirePhantom(): Promise<PhantomProvider & { signTransaction: (tx: unknown) => Promise<{ serialize: () => Uint8Array }> }> {
  const signer = phantomProvider() ?? (await waitForInjected(800));
  if (!signer?.signTransaction) throw new Error("Connect Phantom in this window. It has to sign.");
  return signer as PhantomProvider & { signTransaction: (tx: unknown) => Promise<{ serialize: () => Uint8Array }> };
}

export function invalidateChain(_owner?: string) {
  /* This reader does not keep a wallet cache. */
}

const shownMints = new Set<string>();

export async function showInPhantom(mint: string): Promise<void> {
  if (!mint || shownMints.has(mint)) return;
  const provider = phantomProvider() as (PhantomProvider & { request?: (args: { method: string; params: unknown }) => Promise<unknown> }) | null;
  if (!provider?.request) return;
  shownMints.add(mint);
  try {
    await provider.request({ method: "wallet_watchAsset", params: { type: "SPL", options: { mint } } });
  } catch {
    shownMints.delete(mint);
  }
}

export type UsdcMove = {
  signature: string;
  delta: number;
  other: string;
  time: number | null;
  err: boolean;
};

/** USDC in and out of this address, read from the chain. */
export async function readUsdcMoves(owner: string): Promise<UsdcMove[]> {
  const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const ata = PublicKey.findProgramAddressSync(
    [new PublicKey(owner).toBytes(), new PublicKey(TOKEN_PROGRAM).toBytes(), new PublicKey(USDC).toBytes()],
    new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
  )[0];
  const listed = (await rpc("getSignaturesForAddress", [ata.toBase58(), { limit: 12 }])) as
    | Array<{ signature?: string; err?: unknown; blockTime?: number | null }>
    | null;
  const out: UsdcMove[] = [];
  for (const row of listed ?? []) {
    if (!row.signature) continue;
    const tx = (await rpc("getTransaction", [row.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }])) as {
      blockTime?: number | null;
      meta?: { err?: unknown; preTokenBalances?: Array<{ mint?: string; owner?: string; uiTokenAmount?: { uiAmount?: number; uiAmountString?: string; amount?: string; decimals?: number } }>; postTokenBalances?: Array<{ mint?: string; owner?: string; uiTokenAmount?: { uiAmount?: number; uiAmountString?: string; amount?: string; decimals?: number } }> };
    } | null;
    const ui = (rowBal: { uiAmount?: number; uiAmountString?: string; amount?: string; decimals?: number } | undefined) => {
      if (!rowBal) return 0;
      if (typeof rowBal.uiAmount === "number") return rowBal.uiAmount;
      if (rowBal.uiAmountString) return Number(rowBal.uiAmountString) || 0;
      if (rowBal.amount && typeof rowBal.decimals === "number") return Number(rowBal.amount) / 10 ** rowBal.decimals;
      return 0;
    };
    const pre = (tx?.meta?.preTokenBalances ?? []).filter((b) => b.mint === USDC && b.owner === owner);
    const post = (tx?.meta?.postTokenBalances ?? []).filter((b) => b.mint === USDC && b.owner === owner);
    const before = pre.reduce((s, b) => s + ui(b.uiTokenAmount), 0);
    const after = post.reduce((s, b) => s + ui(b.uiTokenAmount), 0);
    const delta = Math.round((after - before) * 1e6) / 1e6;
    const other = (tx?.meta?.postTokenBalances ?? []).find((b) => b.mint === USDC && b.owner && b.owner !== owner)?.owner ?? "";
    if (delta === 0 && !tx?.meta?.err) continue;
    out.push({ signature: row.signature, delta, other, time: tx?.blockTime ?? row.blockTime ?? null, err: Boolean(tx?.meta?.err || row.err) });
  }
  return out;
}

