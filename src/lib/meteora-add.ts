/** A Meteora DLMM position. Phantom signs it. The position key is created here and signs once. */

import { broadcastSigned, requirePhantom } from "@/lib/phantom";

const RPC = "https://solana-rpc.publicnode.com";

type Side = { decimals: number; usd: boolean };

/** A side marked usd is that many dollars of the token. Otherwise it is that many dollars of SOL. */
export async function addMeteora(input: {
  owner: string;
  pool: string;
  usd: number;
  x: Side;
  y: Side;
  solPrice: number;
}): Promise<{ signature: string; position: string }> {
  if (!(input.usd >= 5)) throw new Error("Add at least $5 of each side.");
  const { Connection, Keypair, PublicKey } = await import("@solana/web3.js");
  const { default: DLMM, StrategyType } = await import("@meteora-ag/dlmm");
  const { BN } = await import("@coral-xyz/anchor");
  const connection = new Connection(RPC, "confirmed");
  const pool = await DLMM.create(connection, new PublicKey(input.pool));
  const active = await pool.getActiveBin();
  const px = Number(active.pricePerToken);
  if (!(px > 0)) throw new Error("Meteora did not name a price.");
  const yTokens = input.y.usd ? input.usd : input.usd / (input.solPrice || 1);
  const xTokens = input.y.usd ? input.usd / px : yTokens / px;
  const user = new PublicKey(input.owner);
  const position = Keypair.generate();
  const tx = await pool.initializePositionAndAddLiquidityByStrategy({
    positionPubKey: position.publicKey,
    user,
    totalXAmount: new BN(Math.round(xTokens * 10 ** input.x.decimals)),
    totalYAmount: new BN(Math.round(yTokens * 10 ** input.y.decimals)),
    strategy: {
      minBinId: active.binId - 5,
      maxBinId: active.binId + 5,
      strategyType: StrategyType.Spot,
    },
    slippage: 1,
  });
  const hash = await connection.getLatestBlockhash("confirmed");
  tx.feePayer = user;
  tx.recentBlockhash = hash.blockhash;
  tx.partialSign(position);
  const provider = await requirePhantom();
  const signed = await provider.signTransaction(tx);
  const signature = await broadcastSigned(signed);
  return { signature, position: position.publicKey.toBase58() };
}
