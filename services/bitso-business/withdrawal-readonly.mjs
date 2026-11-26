/**
 * Bitso Payouts/Funding API: read-only withdrawal reconciliation by origin_id.
 * Source: https://docs.bitso.com/bitso-payouts-funding/docs/list-your-withdrawals
 * HMAC: https://docs.bitso.com/bitso-payouts-funding/docs/create-signed-requests
 * This cannot create, retry, or settle any withdrawal.
 */
import {createHmac} from "node:crypto";
const HOSTS=Object.freeze({stage:"https://api-stage.bitso.com",production:"https://api.bitso.com"});
export function withdrawalQueryPath(originId){
 if(typeof originId!=="string" || !/^[A-Za-z0-9_-]{1,40}$/.test(originId))
   throw new Error("Invalid withdrawal origin ID");
 return "/v3/withdrawals?origin_ids="+encodeURIComponent(originId);
}
export function signWithdrawalQuery({key,secret,nonce,path}){
 if(typeof key!=="string"||!key||typeof secret!=="string"||!secret||!/^[0-9]+$/.test(String(nonce)))
   throw new Error("Invalid Bitso query credentials or nonce");
 if(typeof path!=="string"|| !/^\/v3\/withdrawals\?origin_ids=[A-Za-z0-9_-]{1,40}$/.test(path))
   throw new Error("Withdrawal path not allowed");
 const hash=createHmac("sha256",secret).update(String(nonce)+"GET"+path).digest("hex");
 return "Bitso "+key+":"+nonce+":"+hash;
}
export function createBitsoWithdrawalReader({environment="stage",key,secret,nonceFactory,fetchImpl=globalThis.fetch}={}){
 if(!Object.hasOwn(HOSTS,environment))throw new Error("Unknown Bitso environment");
 if(typeof nonceFactory!=="function")throw new Error("Shared monotonic nonce allocator required");
 if(typeof fetchImpl!=="function")throw new Error("HTTP transport missing");
 return Object.freeze({
  async byOriginId(originId){
   const path=withdrawalQueryPath(originId);
   const authorization=signWithdrawalQuery({key,secret,nonce:nonceFactory(),path});
   const response=await fetchImpl(HOSTS[environment]+path,{
    method:"GET",headers:{Authorization:authorization,Accept:"application/json"},
    cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000)
   });
   if(!response.ok)throw new Error("Bitso withdrawal lookup failed: "+response.status);
   const data=await response.json();
   if(data?.success!==true || !Array.isArray(data.payload))
     throw new Error("Bitso withdrawal response schema mismatch");
   // Only metadata needed for reconciliation; redact beneficiary PII.
   return data.payload.map(item=>({
    wid:item.wid??null,status:item.status??null,currency:item.currency??null,
    amount:item.amount??null,originId:item.details?.origin_id??null,
    createdAt:item.created_at??null,
    // Never equate provider 'complete' with Senda final receipt until independently matched.
    settlementEvidenceComplete:false
   }));
  }
 });
}