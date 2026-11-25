/**
 * Senda money settlement state machine.
 * This is a server-side provider integration contract, never permission to debit a card.
 * It cannot generate a settled status from a UI click or quote: monetary state only moves on
 * provider webhooks whose raw body was verified by a provider verifier (see verifyProviderWebhook).
 */
const ID=/^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,127}$/;
const CURRENCIES=new Set(["USD","USDC","MXN","EUR","GBP"]);
const STEPS={
 created:["funding-pending","cancelled"],
 "funding-pending":["authorized","failed","cancelled"],
 authorized:["settled","failed","reversed"],
 settled:["conversion-pending","payout-pending","reversed"],
 "conversion-pending":["converted","failed"],
 converted:["payout-pending","reversed"],
 "payout-pending":["delivered","failed","reversed"],
 delivered:["reversed"],
 failed:[],cancelled:[],reversed:[]
};
/** No further transitions are possible. */
export const TERMINAL=new Set(["failed","cancelled","reversed"]);
/** Money has moved but a provider can still claw it back (chargeback/return). */
export const REVERSIBLE=new Set(["authorized","settled","converted","payout-pending","delivered"]);
const MAX_HELD=16;
const VERIFIED=new WeakSet();

function needsConversion(intent){return intent.sourceCurrency!==intent.destinationCurrency;}
function allowed(intent,from,next){
 if(!STEPS[from]?.includes(next))return false;
 // A settlement may skip conversion only when no currency changes hands.
 if(from==="settled"&&next==="payout-pending"&&needsConversion(intent))return false;
 if(from==="settled"&&next==="conversion-pending"&&!needsConversion(intent))return false;
 return true;
}
function reachableFrom(intent,from){
 const seen=new Set(),queue=[from];
 while(queue.length){const s=queue.shift();for(const n of STEPS[s]||[])if(allowed(intent,s,n)&&!seen.has(n)){seen.add(n);queue.push(n);}}
 return seen;
}

export function createMoneyIntent({id,source,recipient,amountCents,sourceCurrency="USD",destinationCurrency="USD",createdAt=Date.now()}){
 if(!ID.test(id)||!ID.test(source)||!ID.test(recipient)||!CURRENCIES.has(sourceCurrency)||!CURRENCIES.has(destinationCurrency)||
 !Number.isSafeInteger(amountCents)||amountCents<=0||amountCents>10000000||!Number.isSafeInteger(createdAt)||createdAt<=0)
 throw Error("Invalid authenticated money transfer intent");
 return {id,source,recipient,amountCents,sourceCurrency,destinationCurrency,status:"created",history:[],evidence:[],held:[],createdAt,version:0,terminal:false,reversible:false};
}

// ---------- webhook verification ----------
const enc=new TextEncoder();
function header(headers,name){
 if(!headers)return null;
 if(typeof headers.get==="function")return headers.get(name);
 const key=Object.keys(headers).find(k=>k.toLowerCase()===name.toLowerCase());
 return key==null?null:headers[key];
}
function timingSafeEqualHex(a,b){
 if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;
 let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
 return diff===0;
}
async function hmacHex(secret,message){
 const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const sig=new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode(message)));
 return Array.from(sig,b=>b.toString(16).padStart(2,"0")).join("");
}
/**
 * Generic HMAC-SHA256 verifier over `${timestamp}.${rawBody}`. Provider adapters with their own
 * scheme (Stripe, Marqeta, Bridge...) implement the same {provider, verify(rawBody, headers)} shape.
 */
export function createHmacWebhookVerifier({provider,secret,signatureHeader="x-senda-signature",timestampHeader="x-senda-timestamp",toleranceMs=300000,now=()=>Date.now()}){
 if(!ID.test(String(provider||"")))throw Error("Verifier needs a provider id");
 if(typeof secret!=="string"||secret.length<32)throw Error("Webhook secret must be at least 32 characters");
 return {provider,async verify(rawBody,headers){
  const ts=Number(header(headers,timestampHeader));
  const sig=String(header(headers,signatureHeader)||"").toLowerCase().replace(/^sha256=/,"");
  if(!Number.isSafeInteger(ts)||Math.abs(now()-ts)>toleranceMs)return false;
  if(!/^[a-f0-9]{64}$/.test(sig))return false;
  return timingSafeEqualHex(await hmacHex(secret,`${ts}.${rawBody}`),sig);
 }};
}
/** Verify the raw request body, then parse it. The provider identity comes from the verifier, not the payload. */
export async function verifyProviderWebhook(rawBody,headers,verifier){
 if(typeof rawBody!=="string"||rawBody.length===0||rawBody.length>65536)throw Error("Invalid webhook body");
 if(!verifier||typeof verifier.verify!=="function"||!ID.test(String(verifier.provider||"")))throw Error("A provider webhook verifier is required");
 if((await verifier.verify(rawBody,headers))!==true)throw Error("Webhook signature did not verify");
 let body;try{body=JSON.parse(rawBody);}catch{throw Error("Webhook body is not JSON");}
 const event={id:String(body?.id??""),transferId:String(body?.transferId??""),next:String(body?.next??""),occurredAt:body?.occurredAt,
  reference:body?.reference==null?"":String(body.reference),provider:verifier.provider,
  amountCents:body?.amountCents==null?null:body.amountCents};
 if(!ID.test(event.id)||!ID.test(event.transferId)||!Number.isSafeInteger(event.occurredAt)||!(event.next in STEPS))
  throw Error("Invalid settlement event");
 if(event.amountCents!==null&&!Number.isSafeInteger(event.amountCents))throw Error("Invalid settlement event amount");
 Object.freeze(event);VERIFIED.add(event);
 return event;
}

// ---------- transitions ----------
function sameEvent(a,b){
 return a.next===b.next&&a.reference===b.reference&&a.provider===b.provider&&a.occurredAt===b.occurredAt;
}
function applyOne(intent,event){
 const evidence={id:event.id,provider:event.provider,reference:event.reference,next:event.next,occurredAt:event.occurredAt};
 return {...intent,status:event.next,evidence:[...intent.evidence,evidence],
  history:[...intent.history,{from:intent.status,to:event.next,at:event.occurredAt}],
  terminal:TERMINAL.has(event.next),reversible:REVERSIBLE.has(event.next)};
}
/**
 * Apply one verified provider event. Returns {intent, outcome}:
 *  applied   – state advanced (held events that became legal are drained too)
 *  duplicate – exact replay of an already-recorded event id (no change)
 *  held      – a later-stage event arrived early; kept until its predecessor arrives
 *  stale     – an earlier-stage event arrived late; acknowledged, no change
 * Conflicting replays, wrong transfer/amount and impossible transitions throw.
 */
export function recordProviderTransition(intent,event){
 if(!intent||!STEPS[intent.status]||!Array.isArray(intent.evidence))throw Error("Invalid settlement intent");
 if(!event||!VERIFIED.has(event))throw Error("Only verified provider webhooks may advance monetary state");
 if(event.transferId!==intent.id)throw Error("Provider receipt and money intent mismatch");
 if(event.amountCents!==null&&event.amountCents!==intent.amountCents)throw Error("Provider amount does not match the money intent");
 const held=Array.isArray(intent.held)?intent.held:[];
 const prior=intent.evidence.find(e=>e.id===event.id)||held.find(e=>e.id===event.id);
 if(prior){
  if(!sameEvent(prior,event))throw Error("Conflicting replay of provider event "+event.id);
  return {intent,outcome:"duplicate"};
 }
 if(event.occurredAt<intent.createdAt||event.occurredAt>Date.now()+300000)throw Error("Invalid provider receipt timestamp");
 if(["settled","converted","delivered"].includes(event.next)&&(!ID.test(event.provider)||!ID.test(event.reference)))
  throw Error("Cleared money movements need real provider identity and transfer reference");
 const record={id:event.id,provider:event.provider,reference:event.reference,next:event.next,occurredAt:event.occurredAt};
 if(allowed(intent,intent.status,event.next)){
  let next=applyOne(intent,record);
  // Drain held events that are now legal, in arrival order.
  let queue=[...held];
  for(let progressed=true;progressed;){
   progressed=false;
   for(const h of queue){
    if(allowed(next,next.status,h.next)){next=applyOne(next,h);queue=queue.filter(x=>x!==h);progressed=true;break;}
   }
   // Drop held events that can no longer ever apply (e.g. a payout after a reversal).
   const reach=reachableFrom(next,next.status);
   queue=queue.filter(h=>reach.has(h.next));
  }
  return {intent:{...next,held:queue,version:intent.version+1},outcome:"applied"};
 }
 if(reachableFrom(intent,intent.status).has(event.next)){
  if(held.length>=MAX_HELD)throw Error("Too many out-of-order provider events held for "+intent.id);
  return {intent:{...intent,held:[...held,record],version:intent.version+1},outcome:"held"};
 }
 const past=new Set(["created",...intent.history.map(h=>h.to)]);
 if(past.has(event.next))return {intent,outcome:"stale"};
 throw Error("Illegal money-state transition: "+intent.status+" → "+String(event.next));
}

// ---------- persistence with optimistic concurrency ----------
/**
 * Store contract: get(id) -> intent|null; compareAndSet(id, expectedVersion, next) -> boolean.
 * A SQL implementation is one statement:
 *   UPDATE money_intent SET body=$3, version=$4 WHERE id=$1 AND version=$2   -- rowCount===1
 */
export function createMemoryIntentStore(){
 const rows=new Map();
 return {
  async create(intent){if(rows.has(intent.id))throw Error("Intent exists");rows.set(intent.id,structuredClone(intent));},
  async get(id){const r=rows.get(id);return r?structuredClone(r):null;},
  async compareAndSet(id,expectedVersion,next){
   const cur=rows.get(id);
   if(!cur||cur.version!==expectedVersion||next.version!==expectedVersion+1)return false;
   rows.set(id,structuredClone(next));return true;
  },
 };
}
/**
 * Postgres/PGLite store (table: migrations/0010_money_intent.sql).
 * `query(text, params)` must resolve to an array of row objects (src/lib/db.ts `sql.query`).
 */
export function createSqlIntentStore(query){
 const parse=row=>{if(!row)return null;const body=typeof row.body==="string"?JSON.parse(row.body):row.body;
  if(!body||body.id!==row.id||body.version!==Number(row.version))throw Error("Corrupt money intent row "+row.id);return body;};
 return {
  async create(intent){
   const rows=await query("insert into money_intent (id, version, body) values ($1, $2, $3) on conflict (id) do nothing returning id",
    [intent.id,intent.version,JSON.stringify(intent)]);
   if(!Array.isArray(rows)||rows.length!==1)throw Error("Intent exists");
  },
  async get(id){
   const rows=await query("select id, version, body from money_intent where id = $1",[id]);
   return parse(Array.isArray(rows)?rows[0]:null);
  },
  async compareAndSet(id,expectedVersion,next){
   if(!next||next.id!==id||next.version!==expectedVersion+1)return false;
   const rows=await query("update money_intent set body = $3, version = $4, updated_at = now() where id = $1 and version = $2 returning id",
    [id,expectedVersion,JSON.stringify(next),next.version]);
   return Array.isArray(rows)&&rows.length===1;
  },
 };
}
/** Verify -> load -> transition -> compare-and-set, retrying on concurrent writers. */
export async function applyProviderWebhook({store,rawBody,headers,verifier,maxAttempts=5}){
 const event=await verifyProviderWebhook(rawBody,headers,verifier);
 for(let attempt=0;attempt<maxAttempts;attempt++){
  const current=await store.get(event.transferId);
  if(!current)throw Error("Unknown money intent "+event.transferId);
  const {intent,outcome}=recordProviderTransition(current,event);
  if(intent===current)return {intent:current,outcome};
  if(await store.compareAndSet(current.id,current.version,intent))return {intent,outcome};
 }
 throw Error("Concurrent settlement update; provider should retry the webhook");
}

export function canDisplayDelivered(intent){
 return Boolean(intent&&intent.status==="delivered"&&intent.evidence.some(e=>e.next==="delivered"&&ID.test(e.reference)&&ID.test(e.provider)));
}
export function publicMoneyState(intent){
 const delivered=canDisplayDelivered(intent);
 return {state:intent?.status||"unknown",delivered,reversible:Boolean(intent?.reversible),terminal:Boolean(intent?.terminal),
  notification:delivered?"Payment delivered by verified provider.":intent?.status==="failed"?"Payment failed; check provider receipt.":intent?.status==="reversed"?"Payment was reversed by the provider.":"Not delivered. Await verified funding and settlement evidence."};
}
