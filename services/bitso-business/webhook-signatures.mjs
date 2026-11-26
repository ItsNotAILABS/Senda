/**
 * Bitso Webhooks API verifier, server only.
 * Contract: https://docs.bitso.com/bitso-payouts-funding/docs/webhook-event-signatures
 * The RSA-SHA256 signature covers compact JSON of payload ONLY, not outer event.
 * A verified event is only a reconciliation signal: NEVER a payout receipt.
 */
import {createHash,createPublicKey,verify as verifySignature} from "node:crypto";
const KEY_URL="https://api.bitso.com/v4/webhooks/public-key";
const TYPES=Object.freeze(["funding","withdrawal"]);
const STATUSES=new Set(["pending","processing","complete","failed"]);
function validBase64(s){
 return typeof s==="string" && s.length>0 && s.length<2048 &&
  s.length%4===0 && /^[A-Za-z0-9+/]+={0,2}$/.test(s);
}
function header(headers,name){
 if(headers?.get)return headers.get(name);
 const entry=Object.entries(headers??{}).find(([k])=>k.toLowerCase()===name);
 return entry?.[1]??null;
}
function extractKeys(json){
 const rows=Array.isArray(json)?json:
  Array.isArray(json?.payload)?json.payload:
  Array.isArray(json?.keys)?json.keys:
  Array.isArray(json?.data)?json.data:null;
 if(!rows)throw new Error("Unsupported Bitso public key response");
 return rows;
}
export function createBitsoWebhookVerifier({
 fetchImpl=globalThis.fetch, now=()=>Date.now(),cacheTtlMs=15*60*1000,maxBodyBytes=131072
}={}){
 if(typeof fetchImpl!=="function")throw new Error("fetch required");
 if(typeof now!=="function"||!Number.isSafeInteger(cacheTtlMs)||cacheTtlMs<1 ||
   !Number.isSafeInteger(maxBodyBytes)||maxBodyBytes<1024||maxBodyBytes>1048576)
  throw new Error("Invalid verifier configuration");
 const keyCache=new Map();
 async function lookupKey(keyId){
  const cached=keyCache.get(keyId);
  if(cached && cached.expires>now())return cached.key;
  // Only the official fixed endpoint may supply key material. No client key URL.
  const r=await fetchImpl(KEY_URL,{
   method:"GET",headers:{Accept:"application/json"},redirect:"error",
   cache:"no-store",signal:AbortSignal.timeout(5000)
  });
  if(!r.ok)throw new Error("Bitso public key retrieval failed: "+r.status);
  const keys=extractKeys(await r.json());
  let found=null;
  for(const item of keys){
   if(!item || typeof item.key_id!=="string" || !validBase64(item.public_key))continue;
   try{
    const key=createPublicKey({key:Buffer.from(item.public_key,"base64"),format:"der",type:"spki"});
    if(key.asymmetricKeyType!=="rsa" || (key.asymmetricKeyDetails?.modulusLength??0)<2048)continue;
    keyCache.set(item.key_id,{key,expires:now()+cacheTtlMs});
    if(item.key_id===keyId)found=key;
   }catch{continue;}
  }
  if(!found)throw new Error("Unrecognized Bitso webhook key ID");
  return found;
 }
 return Object.freeze({
  async verify({rawBody,headers}={}){
   if(!Buffer.isBuffer(rawBody) && typeof rawBody!=="string")
    throw new Error("Raw webhook body required");
   const bytes=Buffer.isBuffer(rawBody)?rawBody:Buffer.from(rawBody,"utf8");
   if(!bytes.length||bytes.length>maxBodyBytes)throw new Error("Webhook body size invalid");
   const keyId=header(headers,"x-bitso-key-id");
   const signature=header(headers,"x-bitso-webhook-event-signature");
   if(typeof keyId!=="string" || !/^[A-Za-z0-9_-]{1,128}$/.test(keyId) ||
      !validBase64(signature))
    throw new Error("Missing or invalid Bitso signature headers");
   let message;
   try{message=JSON.parse(bytes.toString("utf8"));}
   catch{throw new Error("Webhook body is not valid JSON");}
   if(!message || typeof message!=="object"||Array.isArray(message) ||
      !TYPES.includes(message.event) || !message.payload ||
      typeof message.payload!=="object"||Array.isArray(message.payload))
    throw new Error("Unsupported Bitso webhook envelope");
   const p=message.payload;
   // Critical: Bitso signs payload but NOT event. Bind event type to its resource id.
   if(message.event==="funding" && (typeof p.fid!=="string"||!p.fid||p.wid!==undefined))
    throw new Error("Funding resource mismatch");
   if(message.event==="withdrawal" && (typeof p.wid!=="string"||!p.wid||p.fid!==undefined))
    throw new Error("Withdrawal resource mismatch");
   const status=String(p.status??"").toLowerCase();
   if(!STATUSES.has(status) || typeof p.currency!=="string" || typeof p.amount!=="string" ||
      !/^\d+(\.\d+)?$/.test(p.amount))
    throw new Error("Unsupported Bitso webhook resource");
   const payloadBytes=Buffer.from(JSON.stringify(p),"utf8");
   const publicKey=await lookupKey(keyId);
   const signatureBytes=Buffer.from(signature,"base64");
   if(!verifySignature("RSA-SHA256",payloadBytes,publicKey,signatureBytes))
    throw new Error("Bitso webhook signature mismatch");
   const entityId=message.event==="funding"?p.fid:p.wid;
   // This digest is for idempotent inbox storage, not approval or settlement.
   const digest=createHash("sha256").update(message.event).update("\0").update(payloadBytes).digest("hex");
   return Object.freeze({
    eventType:message.event,providerId:entityId,status,
    currency:p.currency.toLowerCase(),amount:p.amount,keyId,
    payloadSha256:digest,authenticatedPayload:true,
    requiresProviderReconciliation:true
   });
  },
 });
}
export const BITSO_WEBHOOK_KEY_SOURCE=KEY_URL;
