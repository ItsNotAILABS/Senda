/**
 * Senda Mexico payout lifecycle contract. NO HTTP endpoints / transfers here.
 * "submitted" is not "settled"; webhook claims are never sufficient on their own.
 */
export const STATES=Object.freeze([
 "unavailable","eligibility_review","quote_requested","quote_received",
 "user_approved","wallet_signed","chain_confirmed","provider_credited",
 "fx_executed","payout_submitted","payout_processing","payout_settled",
 "failed","expired","returned","reconciliation_required"
]);
const NEXT=Object.freeze({
 unavailable:["eligibility_review"],
 eligibility_review:["quote_requested","failed"],
 quote_requested:["quote_received","expired","failed"],
 quote_received:["user_approved","expired","failed"],
 user_approved:["wallet_signed","expired","failed"],
 wallet_signed:["chain_confirmed","reconciliation_required","failed"],
 chain_confirmed:["provider_credited","reconciliation_required"],
 provider_credited:["fx_executed","reconciliation_required"],
 fx_executed:["payout_submitted","reconciliation_required"],
 payout_submitted:["payout_processing","payout_settled","failed","returned","reconciliation_required"],
 payout_processing:["payout_settled","failed","returned","reconciliation_required"],
 payout_settled:["reconciliation_required"],
 failed:["reconciliation_required"],
 expired:[],
 returned:["reconciliation_required"],
 reconciliation_required:["payout_processing","payout_settled","failed","returned"]
});
const FIELDS=["quoteId","quoteExpiresAt","sourceWallet","sourceMint","sourceNetwork",
 "sourceAmount","destinationCurrency","recipientFingerprint","minimumDestinationAmount",
 "feeDisclosure","providerDisclosure","refundDisclosure"];
export function validMexicoConsent(a,now=Date.now()){
 if(!a || FIELDS.some(k=>typeof a[k]!=="string" || !a[k].trim()))return false;
 if(a.explicitUserConsent!==true || a.sourceNetwork!=="solana" || a.destinationCurrency!=="MXN")return false;
 if(!/^\d+(\.\d+)?$/.test(a.sourceAmount) || Number(a.sourceAmount)<=0)return false;
 if(!/^\d+(\.\d+)?$/.test(a.minimumDestinationAmount))return false;
 return Number.isFinite(Date.parse(a.quoteExpiresAt))&&Date.parse(a.quoteExpiresAt)>now;
}
export function mexicoProductionGate(config={}){
 const fields=["signedCommercialAgreement","businessKybApproved","mxnCorridorActivated",
  "apiScopesVerified","recipientComplianceApproved","fundingNetworkVerified",
  "fxContractVerified","webhooksVerified","reconciliationReady","livePayoutSettled"];
 const missing=fields.filter(k=>config[k]!==true);
 return Object.freeze({enabled:missing.length===0,missing});
}
export function advanceMexicoPayout(from,to,{evidence,consent,providerEnabled=false,now=Date.now()}={}){
 if(!STATES.includes(from)||!STATES.includes(to)||!NEXT[from].includes(to))
  throw new Error("Invalid Mexico payout state transition");
 if(to==="user_approved"&&!validMexicoConsent(consent,now))
  throw new Error("Explicit, unexpired quote consent required");
 if(["wallet_signed","chain_confirmed"].includes(to) && 
  (!evidence?.solanaSignature || evidence?.network!=="solana"))
  throw new Error("Verified chain evidence required");
 if(["provider_credited","fx_executed","payout_submitted","payout_processing","payout_settled"].includes(to)){
  if(!providerEnabled)throw new Error("Provider not activated");
  if(!evidence?.providerId || evidence?.verifiedBy!=="authenticated-provider-query")
   throw new Error("Authenticated provider query evidence required");
 }
 if(to==="payout_settled" && (!evidence?.settlementId || evidence?.beneficiaryMatches!==true))
  throw new Error("Provider-confirmed settlement and beneficiary match required");
 return Object.freeze({status:to,evidence:evidence??null});
}