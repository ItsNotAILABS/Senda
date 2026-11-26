export type ConfirmedUsdcSendRow = {
  owner: string; signature: string; kind: "send"; asset: "USDC";
  status: "confirmed" | "finalized"; amountRaw: string; destination: string;
};
export type RecoveredUsdcReceipt = {
  signature: string; cents: number; to: string;
};
export function verifiedSendReceipt(input: {
  owner: string;
  signature: string;
  rows: ReadonlyArray<unknown>;
}): Readonly<RecoveredUsdcReceipt>;
