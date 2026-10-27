/** Jupiter's own perpetual. The API builds the transaction. Phantom signs it. Not the cash ticket on Trade. */

import { broadcastSigned, signSerializedTx } from "@/lib/phantom";

const ROOT = "https://perps-api.jup.ag/v1";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export type PerpQuote = {
  entry: number;
  liq: number;
  leverage: number;
  fee: number;
  collateral: number;
};

type Increase = {
  serializedTxBase64?: string;
  requireKeeperSignature?: boolean;
  quote?: {
    entryPriceUsd?: string;
    liquidationPriceUsd?: string;
    leverage?: string;
    openFeeUsd?: string;
    positionCollateralSizeUsd?: string;
  };
  message?: string;
  code?: string;
};

export async function openJupPerp(input: {
  owner: string;
  side: "long" | "short";
  usd: number;
  leverage: number;
  marketMint: string;
  marketDecimals: number;
  marketPrice: number;
}): Promise<{ signature: string; quote: PerpQuote }> {
  if (input.usd < 10) throw new Error("Jupiter asks for at least $10 of collateral on a new position.");
  if (input.leverage > 20) throw new Error("Leverage stops at 20×. The wallet was not asked to sign.");
  const leverage = Math.min(20, Math.max(1.1, input.leverage));
  const collateralMint = input.side === "long" ? input.marketMint : USDC;
  const raw = input.side === "long"
    ? String(Math.ceil((input.usd / (input.marketPrice || 1)) * 10 ** input.marketDecimals))
    : String(Math.round(input.usd * 1_000_000));
  const res = await fetch(`${ROOT}/positions/increase`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      walletAddress: input.owner,
      side: input.side,
      leverage: String(leverage),
      maxSlippageBps: "100",
      collateralMint,
      inputMint: collateralMint,
      marketMint: input.marketMint,
      collateralTokenDelta: raw,
    }),
  });
  const body = (await res.json()) as Increase;
  if (!res.ok || !body.serializedTxBase64) throw new Error(body.message || "Jupiter did not build the position.");
  const signed = await signSerializedTx(body.serializedTxBase64);
  const quote: PerpQuote = {
    entry: Number(body.quote?.entryPriceUsd) || 0,
    liq: Number(body.quote?.liquidationPriceUsd) || 0,
    leverage: Number(body.quote?.leverage) || leverage,
    fee: Number(body.quote?.openFeeUsd) || 0,
    collateral: Number(body.quote?.positionCollateralSizeUsd) || input.usd,
  };
  if (quote.leverage > 20) throw new Error("Jupiter quoted more than 20×. The wallet was not asked to sign.");
  if (signed.length < 120) return { signature: signed, quote };
  const done = await fetch(`${ROOT}/transaction/execute`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ action: "increase-position", serializedTxBase64: signed }),
  });
  const out = (await done.json()) as { txid?: string; signature?: string; message?: string };
  if (done.ok) {
    const signature = out.txid || out.signature;
    if (signature) return { signature, quote };
  }
  const { Buffer } = await import("buffer");
  const { VersionedTransaction } = await import("@solana/web3.js");
  const signature = await broadcastSigned(VersionedTransaction.deserialize(Buffer.from(signed, "base64")));
  return { signature, quote };
}
