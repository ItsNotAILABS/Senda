/**
 * Senda ecosystem 2026 interoperability: pure, non-signing policy utilities.
 * These validators are additional application guards, not replacements for
 * trusted x402/MPP SDK verification or Solana transaction simulation.
 */
export const SOLANA_MAINNET_CAIP2 = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
export const SOLANA_DEVNET_CAIP2 = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
export const MAINNET_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const mint = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const positive = /^[1-9][0-9]{0,19}$/;
const uint64 = 18446744073709551615n;
const knownRouters = new Set(["metis", "jupiterz", "dflow", "okx"]);
const denial = reason => ({ decision: "DENY", reason, canSign: false, executionAuthorized: false });
export function validRawAmount(value, maximum=1000000000000n) {
  if (typeof value!=="string" || !positive.test(value)) return false;
  try { const n=BigInt(value); return n>0n && n<=uint64 && n<=maximum; } catch { return false; }
}
export function validateSwapV2Preview(request, raw, observedAt=Date.now()) {
  if (!request || !mint.test(request.inputMint||"") || !mint.test(request.outputMint||"") ||
    request.inputMint===request.outputMint || !validRawAmount(request.amount)) throw Error("INVALID_QUOTE_REQUEST");
  if (!raw || typeof raw!=="object" || Array.isArray(raw) ||
    raw.errorCode!=null || raw.errorMessage!=null || raw.error!=null ||
    raw.transaction!=null || raw.inAmount!==request.amount ||
    !validRawAmount(String(raw.outAmount??""),uint64) ||
    !knownRouters.has(String(raw.router||"").toLowerCase()) ||
    !Number.isInteger(raw.feeBps) || raw.feeBps<0 || raw.feeBps>10000) {
    throw Error("JUPITER_V2_UNVERIFIED_QUOTE");
  }
  if (!Number.isSafeInteger(observedAt) || observedAt<=0) throw Error("INVALID_OBSERVATION_TIME");
  return Object.freeze({
    schema: "senda.jupiter.swap-quote.v2", status: "indicative-only",
    inputMint: request.inputMint, outputMint: request.outputMint,
    inAmount: request.amount, outAmount: String(raw.outAmount),
    router: String(raw.router).toLowerCase(), mode: String(raw.mode||"unknown").slice(0,24),
    feeBps: raw.feeBps, observedAt, requiresFreshOrder: true,
    requiresWalletReview: true, canSign: false, transaction: null
  });
}
export function evaluateAgentPaymentRequirement(policy, offer) {
  if (!policy || !offer) return denial("MISSING_POLICY_OR_OFFER");
  if (!["x402-v2","mpp"].includes(offer.protocol)) return denial("UNSUPPORTED_PAYMENT_PROTOCOL");
  if (offer.protocol==="x402-v2" && offer.scheme!=="exact") return denial("SCHEME_NOT_ENABLED");
  if (offer.protocol==="mpp" && offer.intent!=="charge") return denial("SESSION_NOT_ENABLED");
  if (offer.network!==policy.network ||
      ![SOLANA_MAINNET_CAIP2,SOLANA_DEVNET_CAIP2].includes(offer.network))
    return denial("NETWORK_NOT_ALLOWED");
  if (!mint.test(offer.asset||"") || !mint.test(offer.payTo||"")) return denial("INVALID_ASSET_OR_RECIPIENT");
  if (!Array.isArray(policy.allowedAssets) || !policy.allowedAssets.includes(offer.asset)) return denial("ASSET_NOT_ALLOWED");
  if (!Array.isArray(policy.allowedRecipients) || !policy.allowedRecipients.includes(offer.payTo)) return denial("RECIPIENT_NOT_ALLOWED");
  if (!validRawAmount(offer.amount, uint64) || !validRawAmount(policy.maxPerCallMinor, uint64))
    return denial("INVALID_AMOUNT_OR_CAP");
  if (BigInt(offer.amount)>BigInt(policy.maxPerCallMinor)) return denial("PER_CALL_CAP_EXCEEDED");
  if (!Number.isSafeInteger(offer.expiresAtMs) || offer.expiresAtMs<=Date.now() ||
    offer.expiresAtMs>Date.now()+5*60*1000) return denial("EXPIRED_OR_OVERLONG_CHALLENGE");
  if (typeof offer.challengeId!=="string" || !/^[a-zA-Z0-9._:-]{8,128}$/.test(offer.challengeId))
    return denial("MISSING_CHALLENGE_BINDING");
  if (offer.verifiedByProtocolSdk!==true) return denial("UNVERIFIED_PROTOCOL_REQUIREMENT");
  if (offer.verifiedByPolicyStore!==true) return denial("UNVERIFIED_SPENDING_POLICY");
  return {
    decision: "REVIEW_REQUIRED", reason: "POLICY_PRECHECK_PASSED",
    protocol: offer.protocol, amountMinor: offer.amount, network: offer.network,
    challengeId: offer.challengeId, canSign: false, executionAuthorized: false,
    requiresIndependentSettlementVerification: true,
    requiresAtomicReplayProtection: true
  };
}
export function classifySolanaMintAccount(value) {
  // RPC source must be trusted, cluster checked, and confirmed independently.
  const owner=value?.owner;
  const info=value?.data?.parsed?.info;
  if (!value || value.data?.parsed?.type!=="mint" ||
    ![TOKEN_PROGRAM,TOKEN_2022_PROGRAM].includes(owner) ||
    !Number.isInteger(info?.decimals) || info.decimals<0 || info.decimals>18)
    return denial("MINT_ACCOUNT_UNVERIFIED");
  const extensions=Array.isArray(info.extensions) ? info.extensions : [];
  const names=extensions.map(e=>String(e.extension||"")).filter(Boolean);
  const blockers=names.filter(n=>/transferfee|transferhook|confidential|permanentdelegate|nontransferable|defaultaccountstate/i.test(n));
  if (owner===TOKEN_2022_PROGRAM && !Array.isArray(info.extensions))
    return denial("TOKEN_2022_EXTENSIONS_NOT_DECODED");
  return {
    decision: blockers.length?"REVIEW_REQUIRED":"READ_ONLY_INSPECTED",
    tokenProgram: owner, decimals: info.decimals, mintAuthorityPresent: info.mintAuthority!=null,
    freezeAuthorityPresent: info.freezeAuthority!=null, extensions:names.slice(0,32),
    requiresExtensionAwareExecution:owner===TOKEN_2022_PROGRAM,
    transferRisks:blockers, canSign:false, executionAuthorized:false
  };
}
