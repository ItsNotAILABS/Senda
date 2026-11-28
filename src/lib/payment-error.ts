/** What a person should read when a payment stops. It does not send anything. */

export function explainPayment(error: unknown): string {
  const text = (error instanceof Error ? error.message : String(error || "")).replace(/\s+/g, " ").trim();
  if (!text) return "The payment did not send.";
  if (/do not send it again/i.test(text)) return text;
  if (/user rejected|rejected the request|user denied|closed the prompt/i.test(text)) return "The wallet declined. Nothing was sent.";
  if (/not a solana address|invalid public key|non-base58|invalid character/i.test(text)) return "That is not a Solana address. Nothing was sent.";
  if (/same account|pay someone else/i.test(text)) return "The sender and the receiver are the same account. Nothing was sent.";
  if (/not enough|insufficient|custom program error: 0x1\b/i.test(text)) return text.includes("Nothing was sent") ? text : "The account does not have enough for the amount and the fee. Nothing was sent.";
  if (/spend cap|no usdc|enter an amount/i.test(text)) return text;
  if (/timeout|timed out|etimedout|aborted|network/i.test(text)) return "The cluster did not answer. Check the account before trying again.";
  if (/blockhash not found|blockhash expired/i.test(text)) return "The quote expired. Nothing was sent. Try again.";
  if (/coffer|401|unauthorized/i.test(text)) return text.includes("Nothing was sent") ? text : "Coffer did not open the wallet. Nothing was sent.";
  if (/expected|invalid_type|too_small|too_big/i.test(text)) return "That payment was not a valid amount or address. Nothing was sent.";
  if (text.length > 220) return `${text.slice(0, 220)} Check it before trying again.`;
  return text;
}

export function coverCheck(haveLamports: number, sendSol: number, feeLamports = 10_000): { ok: true } | { ok: false; why: string } {
  if (!Number.isFinite(haveLamports) || haveLamports < 0) return { ok: false, why: "The balance could not be read. Nothing was sent." };
  if (!Number.isFinite(sendSol) || sendSol <= 0) return { ok: false, why: "That amount is not a payment. Nothing was sent." };
  const need = Math.round(sendSol * 1_000_000_000) + feeLamports;
  if (haveLamports < need) {
    return { ok: false, why: `The account has ${(haveLamports / 1_000_000_000).toFixed(4)} SOL. That is not enough for ${sendSol} SOL and the fee. Nothing was sent.` };
  }
  return { ok: true };
}
