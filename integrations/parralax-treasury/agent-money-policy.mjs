/** Deterministic preflight for an agent money request, not a transfer authorization. */
const ADDRESS=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const U64=18446744073709551615n;
function minor(value,allowZero=false){
 if(typeof value!=="string"||!/^(?:0|[1-9]\d{0,19})$/.test(value))return null;
 const n=BigInt(value);
 return n<=U64&&(allowZero||n>0n)?n:null;
}
function validPolicy(p){
 if(!p||typeof p!=="object"||!ID.test(p.policyId||"")||
 !ADDRESS.test(p.owner||"")||!ADDRESS.test(p.agent||"")||!ADDRESS.test(p.mint||"")||
 p.owner===p.agent||!["devnet","mainnet-beta"].includes(p.network)||
 !Array.isArray(p.allowedRecipients)||!p.allowedRecipients.length||p.allowedRecipients.length>100||
 !p.allowedRecipients.every(x=>ADDRESS.test(x))||
 !Number.isSafeInteger(p.expiresAt)||p.expiresAt<1)return false;
 const per=minor(p.perTxMinor),daily=minor(p.dailyMinor),total=minor(p.lifetimeMinor);
 return per!==null&&daily!==null&&total!==null&&per<=daily&&daily<=total;
}
/**
 * State is supplied by the trusted PARRALAX/ledger authority, not browser localStorage.
 * "review" is NOT an executable grant; a verified treasury program must enforce spending caps.
 * All amounts use integer minor units. Rejected requests have no side effects.
 */
export function reviewAgentMoneyRequest({policy,request,state,nowSec=Math.floor(Date.now()/1000)}={}){
 const deny=(reason)=>({schema:"senda.agent-money.review.v1",status:"denied",reason,
  canExecute:false,requiresOwnerSignature:false,requiresOnchainPolicy:true});
 if(!validPolicy(policy))return deny("INVALID_POLICY");
 if(!request||!ID.test(request.requestId||"")||
 !ADDRESS.test(request.agent||"")||!ADDRESS.test(request.recipient||"")||
 !ADDRESS.test(request.mint||"")||!["devnet","mainnet-beta"].includes(request.network))
  return deny("INVALID_REQUEST");
 if(request.network!==policy.network||request.agent!==policy.agent||request.mint!==policy.mint)
  return deny("SCOPE_MISMATCH");
 if(!policy.allowedRecipients.includes(request.recipient))return deny("RECIPIENT_NOT_ALLOWED");
 if(!Number.isSafeInteger(nowSec)||nowSec<=0||nowSec>=policy.expiresAt)return deny("POLICY_EXPIRED");
 if(state?.paused===true||state?.revoked===true)return deny("POLICY_INACTIVE");
 if(!state||!Array.isArray(state.recentRequestIds)||state.recentRequestIds.length>1000||
  !Number.isSafeInteger(state.periodStartSec)||state.periodStartSec>nowSec||
  nowSec-state.periodStartSec>=86400)return deny("LEDGER_STATE_UNVERIFIED");
 if(state.recentRequestIds.includes(request.requestId))return deny("REQUEST_REPLAY");
 const amount=minor(request.amountMinor),spentDay=minor(state.dailySpentMinor,true),
  spentLife=minor(state.lifetimeSpentMinor,true),pendingDay=minor(state.pendingDailyMinor,true),
  pendingLife=minor(state.pendingLifetimeMinor,true);
 if([amount,spentDay,spentLife,pendingDay,pendingLife].some(x=>x===null))return deny("INVALID_AMOUNT_OR_COUNTER");
 if(amount>minor(policy.perTxMinor))return deny("PER_TX_LIMIT");
 if(spentDay+pendingDay+amount>minor(policy.dailyMinor))return deny("DAILY_LIMIT");
 if(spentLife+pendingLife+amount>minor(policy.lifetimeMinor))return deny("LIFETIME_LIMIT");
 if(!Number.isSafeInteger(state.nextNonce)||state.nextNonce<0)return deny("UNVERIFIED_NONCE");
 return {schema:"senda.agent-money.review.v1",status:"review",
  policyId:policy.policyId,requestId:request.requestId,network:policy.network,
  owner:policy.owner,agent:policy.agent,recipient:request.recipient,mint:request.mint,
  amountMinor:amount.toString(),nonce:String(state.nextNonce),expiresAt:policy.expiresAt,
  requiresOwnerSignature:false,requiresOnchainPolicy:true,
  requiresVerifiedTreasuryAccount:true,requiresConfirmedTransferReceipt:true,
  canExecute:false,authority:"NONE",
  note:"Review only. No funds moved or reserved. Independently verify treasury program, vault state, nonce, on-chain caps and finality before any agent signer is enabled."};
}
