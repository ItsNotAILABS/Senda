import { createHash } from "node:crypto";
const SOLANA_ADDRESS=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const decimal=/^(?:0|[1-9][0-9]{0,12})(?:\.[0-9]+)?$/;
export function minorUnits(value,decimals){
 if(typeof value!=="string"||!decimal.test(value)||!Number.isInteger(decimals)||decimals<0||decimals>18)return null;
 const [a,b=""]=value.split(".");
 if(b.length>decimals)return null;
 const n=BigInt(a)*(10n**BigInt(decimals))+BigInt(b.padEnd(decimals,"0"));
 return n>0n&&n<=18446744073709551615n?n.toString():null;
}
export function treasuryProposal(input){
 const deny=reason=>({status:"denied",reason,canExecute:false});
 if(!input||typeof input!=="object"||!SOLANA_ADDRESS.test(input.owner||"")||
   !SOLANA_ADDRESS.test(input.agent||"")||!SOLANA_ADDRESS.test(input.beneficiary||"")||
   !SOLANA_ADDRESS.test(input.mint||"")||input.owner===input.agent||
   !Number.isInteger(input.decimals)||input.decimals<0||input.decimals>18)return deny("INVALID_ACCOUNTS");
 const perTx=minorUnits(input.perTx,input.decimals),daily=minorUnits(input.daily,input.decimals),lifetime=minorUnits(input.lifetime,input.decimals);
 if(!perTx||!daily||!lifetime||BigInt(perTx)>BigInt(daily)||BigInt(daily)>BigInt(lifetime))
  return deny("INVALID_LIMITS");
 if(!Number.isSafeInteger(input.expiresAt)||input.expiresAt<=Date.now()/1000)return deny("INVALID_EXPIRATION");
 return {status:"review",kind:"treasury.create",owner:input.owner,agent:input.agent,
  beneficiary:input.beneficiary,mint:input.mint,decimals:input.decimals,
  perTxMinor:perTx,dailyMinor:daily,lifetimeMinor:lifetime,expiresAt:input.expiresAt,
  requiresOwnerSignature:true,requiresOnchainProgramVerification:true,canExecute:false};
}
export function machinePaymentReceiptDraft(input){
 if(!input||typeof input.serviceId!=="string"||!/^[a-zA-Z0-9._:-]{1,128}$/.test(input.serviceId)||
   typeof input.requestId!=="string"||!/^[a-zA-Z0-9._:-]{1,128}$/.test(input.requestId)||
   typeof input.txSignature!=="string"||input.txSignature.length<64||input.txSignature.length>100||
   typeof input.payloadHash!=="string"||!/^[0-9a-f]{64}$/.test(input.payloadHash)||
   !SOLANA_ADDRESS.test(input.payer||"")||!SOLANA_ADDRESS.test(input.recipient||""))
   return {status:"denied",reason:"INVALID_RECEIPT_EVIDENCE"};
 const digest=createHash("sha256").update(JSON.stringify({
  schema:"senda.machine-payment.v1",serviceId:input.serviceId,requestId:input.requestId,
  txSignature:input.txSignature,payloadHash:input.payloadHash,payer:input.payer,recipient:input.recipient
 })).digest("hex");
 return {schema:"senda.machine-payment.v1",status:"unverified",digest,
  txSignature:input.txSignature,requestId:input.requestId,
  requiresOnchainConfirmation:true,requiresExactTransferVerification:true,
  requiresServiceFulfillmentEvidence:true};
}
export function provenanceCommitment(input){
 if(!input||!["model-output","dataset","tool-receipt"].includes(input.kind)||
   typeof input.contentSha256!=="string"||!/^[0-9a-f]{64}$/.test(input.contentSha256)||
   typeof input.publisher!=="string"||input.publisher.length<1||input.publisher.length>128)
   return {status:"denied",reason:"INVALID_PROVENANCE"};
 return {schema:"senda.provenance.v1",status:"local-commitment-only",kind:input.kind,
  publisher:input.publisher,contentSha256:input.contentSha256,
  commitmentSha256:createHash("sha256").update("senda.provenance.v1|"+input.kind+"|"+input.publisher+"|"+input.contentSha256).digest("hex"),
  onchainAnchored:false};
}
