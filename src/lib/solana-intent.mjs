/** Strict plain-English intent parser. Intent is NEVER authority to sign. */
const ADDRESS = "[1-9A-HJ-NP-Za-km-z]{32,44}";
const ADDRESS_RE = new RegExp("^" + ADDRESS + "$");
const MAX_MICRO = BigInt("18446744073709551615");
function minor(raw, decimals) {
 if (!/^(?:0|[1-9][0-9]{0,12})(?:\.[0-9]+)?$/.test(raw)) return null;
 const [whole, fraction = ""] = raw.split(".");
 if (fraction.length > decimals) return null;
 const amount = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0"));
 return amount > 0n && amount <= MAX_MICRO ? amount.toString() : null;
}
function deny(error) { return { status:"unsupported", error, canSign:false }; }
export function parseSolanaIntent(text) {
 if (typeof text !== "string" || !text.trim() || text.length > 240) return deny("INVALID_INPUT");
 const s=text.trim().replace(/\s+/g," ");
 if (/\b(?:ignore|override|bypass|without confirmation|without signing|automatically|secret key|seed phrase)\b/i.test(s))
   return deny("UNSAFE_OR_AMBIGUOUS_INSTRUCTION");
 const payment = s.match(new RegExp("^(?:send|pay|transfer)\\s+(?:\\$)?([0-9]+(?:\\.[0-9]+)?)\\s+(USDC|SOL)\\s+(?:to)\\s+(" + ADDRESS + ")$", "i"));
 if(payment){
   const [, decimal, assetRaw, to]=payment;
   const asset=assetRaw.toUpperCase(), amountMinor=minor(decimal,asset==="USDC"?6:9);
   if(!amountMinor || !ADDRESS_RE.test(to)) return deny("INVALID_AMOUNT_OR_ADDRESS");
   return { status:"draft", kind:"transfer", asset, amount:decimal, amountMinor, destination:to,
     network:"solana-mainnet-beta", canSign:false, requiresExplicitReview:true, requiresWalletSignature:true };
 }
 const swap=s.match(/^swap\s+(half|50%|all|100%|[0-9]+(?:\.[0-9]+)?)\s*(?:my\s+)?(SOL|USDC)\s+(?:to|for|into)\s+(SOL|USDC)$/i);
 if(swap){
   const [,quant,fromRaw,toRaw]=swap, from=fromRaw.toUpperCase(),to=toRaw.toUpperCase();
   if(from===to)return deny("SAME_ASSET");
   const portion=/^(?:half|50%)$/i.test(quant)?"0.5":/^(?:all|100%)$/i.test(quant)?"1":null;
   const amountMinor=portion?null:minor(quant,from==="SOL"?9:6);
   if(!portion && !amountMinor)return deny("INVALID_SWAP_SIZE");
   return {status:"draft",kind:"swap",from,to,portion,amountMinor,
     network:"solana-mainnet-beta",canSign:false,requiresBalance:true,requiresLiveQuote:true,
     requiresExplicitReview:true,requiresWalletSignature:true};
 }
 return deny("UNSUPPORTED_REQUEST");
}
export function transferReview(draft, connectedWallet) {
 if(draft?.status!=="draft"||draft.kind!=="transfer")return deny("NOT_A_TRANSFER");
 if(typeof connectedWallet!=="string"||!ADDRESS_RE.test(connectedWallet))return deny("CONNECT_WALLET");
 if(draft.destination===connectedWallet)return deny("SELF_TRANSFER");
 return {status:"ready-for-confirmation",network:draft.network,
  from:connectedWallet,to:draft.destination,asset:draft.asset,amount:draft.amount,
  amountMinor:draft.amountMinor,requiresWalletSignature:true,canSign:false};
}
