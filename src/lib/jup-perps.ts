/** Jupiter perpetual markets. The wallet signs. Senda does not hold collateral. */

import { activeSolProvider } from "@/lib/wallets";
import { connectPhantom, phantomProvider, waitForInjected, type PhantomProvider } from "@/lib/phantom";
import { insideWalletApp, isPhoneBrowser, startMobileSign } from "@/lib/mobile-wallet";

const BASE = "https://perps-api.jup.ag/v1";

export const PERP_MARKETS = [
  { asset: "SOL", mint: "So11111111111111111111111111111111111111112", name: "Solana" },
  { asset: "ETH", mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", name: "Ether" },
  { asset: "BTC", mint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", name: "Bitcoin" },
] as const;

export type PerpAsset = (typeof PERP_MARKETS)[number]["asset"];

export type PerpStats = {
  price: number;
  change24h: number;
  high: number;
  low: number;
  volume: number;
};

export type PerpPool = {
  longLiquidity: number;
  shortLiquidity: number;
  longBorrow: number;
  shortBorrow: number;
  openFee: number;
};

export type PerpPosition = {
  pubkey: string;
  asset: string;
  side: "long" | "short";
  leverage: number;
  sizeUsd: number;
  collateralUsd: number;
  entry: number;
  mark: number;
  liq: number;
  pnl: number;
  pnlPct: number;
};

export type PerpQuote = {
  tx: string;
  entry: number;
  liq: number;
  sizeUsd: number;
  collateralUsd: number;
  feeUsd: number;
  leverage: number;
  side: "long" | "short";
};

type ErrBody = { message?: string; code?: string };

function usd6(raw: string | number | null | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return n / 1e6;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-perps-api-version": "v2",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error("Jupiter perps did not answer.");
  }
  if (!res.ok) {
    const err = body as ErrBody | null;
    throw new Error(err?.message || err?.code || `Jupiter perps ${res.status}`);
  }
  return body as T;
}

export async function loadPerpBook(mint: string): Promise<{ stats: PerpStats; pool: PerpPool }> {
  const [stats, pool] = await Promise.all([
    call<{ price: string; priceChange24H: string; priceHigh24H: string; priceLow24H: string; volume: string }>(
      `/market-stats?mint=${mint}`,
    ),
    call<{
      longAvailableLiquidity: string;
      shortAvailableLiquidity: string;
      longBorrowRatePercent: string;
      shortBorrowRatePercent: string;
      openFeePercent: string;
    }>(`/pool-info?mint=${mint}`),
  ]);
  return {
    stats: {
      price: Number(stats.price) || 0,
      change24h: Number(stats.priceChange24H) || 0,
      high: Number(stats.priceHigh24H) || 0,
      low: Number(stats.priceLow24H) || 0,
      volume: Number(stats.volume) || 0,
    },
    pool: {
      longLiquidity: Number(pool.longAvailableLiquidity) || 0,
      shortLiquidity: Number(pool.shortAvailableLiquidity) || 0,
      longBorrow: Number(pool.longBorrowRatePercent) || 0,
      shortBorrow: Number(pool.shortBorrowRatePercent) || 0,
      openFee: Number(pool.openFeePercent) || 0,
    },
  };
}

export async function loadPerpPositions(walletAddress: string): Promise<PerpPosition[]> {
  const res = await call<{
    dataList?: Array<{
      positionPubkey: string;
      asset: string;
      side: "long" | "short";
      leverage: string;
      sizeUsd: string;
      collateralUsd: string;
      entryPriceUsd: string;
      markPriceUsd: string;
      liquidationPriceUsd: string;
      pnlAfterFeesUsd: string;
      pnlAfterFeesPct: string;
    }>;
  }>(`/positions?walletAddress=${encodeURIComponent(walletAddress)}`);
  return (res.dataList ?? []).map((p) => ({
    pubkey: p.positionPubkey,
    asset: p.asset,
    side: p.side,
    leverage: Number(p.leverage) || 0,
    sizeUsd: usd6(p.sizeUsd),
    collateralUsd: usd6(p.collateralUsd),
    entry: usd6(p.entryPriceUsd),
    mark: usd6(p.markPriceUsd),
    liq: usd6(p.liquidationPriceUsd),
    pnl: usd6(p.pnlAfterFeesUsd),
    pnlPct: Number(p.pnlAfterFeesPct) || 0,
  }));
}

export async function quoteIncrease(input: {
  walletAddress: string;
  asset: PerpAsset;
  collateralUsd: number;
  leverage: number;
  side: "long" | "short";
}): Promise<PerpQuote> {
  if (!(input.collateralUsd >= 10)) throw new Error("Collateral starts at $10 of USDC.");
  if (!(input.leverage >= 1.1) || input.leverage > 50) throw new Error("Leverage on this desk is 1.1× to 50×.");
  const res = await call<{
    serializedTxBase64?: string | null;
    quote?: {
      averagePriceUsd: string;
      liquidationPriceUsd: string;
      positionSizeUsd: string;
      positionCollateralUsd: string;
      openFeeUsd: string;
      leverage: string;
      side: "long" | "short";
    };
  }>("/positions/increase", {
    method: "POST",
    body: JSON.stringify({
      walletAddress: input.walletAddress,
      asset: input.asset,
      inputToken: "USDC",
      inputTokenAmount: String(Math.round(input.collateralUsd * 1e6)),
      side: input.side,
      leverage: input.leverage.toFixed(1),
      maxSlippageBps: "100",
    }),
  });
  if (!res.serializedTxBase64 || !res.quote) throw new Error("Jupiter did not build a transaction.");
  return {
    tx: res.serializedTxBase64,
    entry: usd6(res.quote.averagePriceUsd),
    liq: usd6(res.quote.liquidationPriceUsd),
    sizeUsd: usd6(res.quote.positionSizeUsd),
    collateralUsd: usd6(res.quote.positionCollateralUsd),
    feeUsd: usd6(res.quote.openFeeUsd),
    leverage: Number(res.quote.leverage) || input.leverage,
    side: res.quote.side,
  };
}

export async function quoteClose(positionPubkey: string): Promise<string> {
  const res = await call<{ serializedTxBase64?: string | null }>("/positions/decrease", {
    method: "POST",
    body: JSON.stringify({
      positionPubkey,
      receiveToken: "USDC",
      entirePosition: true,
      maxSlippageBps: "100",
    }),
  });
  if (!res.serializedTxBase64) throw new Error("Jupiter did not build a close.");
  return res.serializedTxBase64;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

/** Sign the request Jupiter built, then hand it back so their keeper can fill it. */
export async function signPerpRequest(b64: string, action: "increase-position" | "decrease-position"): Promise<string> {
  const { Buffer } = await import("buffer");
  if (!globalThis.Buffer) globalThis.Buffer = Buffer;
  const { VersionedTransaction } = await import("@solana/web3.js");
  const tx = VersionedTransaction.deserialize(b64ToBytes(b64));
  const p = (await waitForInjected(insideWalletApp() ? 4000 : 400)) ?? ((activeSolProvider() as PhantomProvider | null) ?? phantomProvider());
  if (!p?.signTransaction && !p?.signAndSendTransaction) {
    if (isPhoneBrowser() && !insideWalletApp() && !location.pathname.startsWith("/wallets/app")) {
      startMobileSign(tx.serialize(), { kind: "perp", action });
      return new Promise(() => {});
    }
    throw new Error(
      insideWalletApp()
        ? "Phantom is open. Tap Connect Phantom, then open the position again. It signs in this window."
        : "Connect a Solana wallet. On a phone, Phantom or Solflare opens to sign.",
    );
  }
  if (p.signTransaction) {
    const signed = await p.signTransaction(tx);
    const raw = bytesToBase64(signed.serialize());
    const out = await call<{ txid?: string }>("/transaction/execute", {
      method: "POST",
      body: JSON.stringify({ action, serializedTxBase64: raw }),
    });
    if (!out.txid) throw new Error("Jupiter took the signature and did not return a transaction.");
    return out.txid;
  }
  const sent = await p.signAndSendTransaction!(tx);
  const sig = sent.signature;
  if (typeof sig === "string") return sig;
  throw new Error("The wallet signed, but did not return a signature.");
}

export async function connectPerpWallet(): Promise<string> {
  return connectPhantom();
}

export async function submitSignedPerp(serializedTxBase64: string, action: "increase-position" | "decrease-position"): Promise<string> {
  const out = await call<{ txid?: string }>("/transaction/execute", {
    method: "POST",
    body: JSON.stringify({ action, serializedTxBase64 }),
  });
  if (!out.txid) throw new Error("Jupiter took the signature and did not return a transaction.");
  return out.txid;
}
