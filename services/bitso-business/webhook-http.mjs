/**
 * Senda Bitso webhook HTTP ingestion. Server only. No payout execution.
 * Acknowledge only AFTER signed event and durable inbox/outbox DB transaction.
 * Must be deployed behind WAF/rate limiting; no browser API access.
 */
import pg from "pg";
import {createBitsoWebhookVerifier} from "./webhook-signatures.mjs";
import {createBitsoWebhookInbox} from "./webhook-inbox.mjs";
import {createPostgresBitsoInboxStore} from "./postgres-inbox.mjs";

const MAX_BYTES=131072;
let cachedPool=null;
let cachedVerifier=null;
function getPool(connectionString){
 if(!cachedPool){
  cachedPool=new pg.Pool({connectionString,max:4,connectionTimeoutMillis:3500,
   idleTimeoutMillis:20000,statement_timeout:5000});
 }
 return cachedPool;
}
async function readBounded(request){
 const contentLength=Number(request.headers.get("content-length"));
 if(request.headers.has("content-length") &&
    (!Number.isSafeInteger(contentLength)||contentLength<1||contentLength>MAX_BYTES))
  throw new Error("Request body length rejected");
 if(!request.body)throw new Error("Body missing");
 const reader=request.body.getReader(),parts=[];
 let total=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   total+=value.byteLength;
   if(total>MAX_BYTES)throw new Error("Request too large");
   parts.push(value);
  }
 }catch(e){await reader.cancel().catch(()=>{});throw e;}
 if(total===0)throw new Error("Body missing");
 return Buffer.concat(parts,total);
}
function response(code,body){
 return Response.json(body,{status:code,headers:{"cache-control":"no-store",
   "x-content-type-options":"nosniff"}});
}
export async function handleBitsoWebhook(request,{
 env=process.env,poolFactory=getPool,verifierFactory=()=>cachedVerifier??=createBitsoWebhookVerifier()
}={}){
 if(request.method!=="POST")return response(405,{ok:false});
 // No fallthrough to PGLite (which is process-local and non-durable).
 if(env.SENDA_BITSO_WEBHOOK_ENABLED!=="true"||
    !env.DATABASE_URL?.trim()||
    !env.SENDA_BITSO_PROVIDER_ACCOUNT_ID?.trim())
  return response(503,{ok:false,code:"integration_unavailable"});
 const contentType=request.headers.get("content-type")??"";
 if(!/^application\/json(?:\s*;|$)/i.test(contentType))
  return response(415,{ok:false});
 let rawBody;
 try{rawBody=await readBounded(request);}
 catch{return response(413,{ok:false});}
 const verifier=verifierFactory();
 let event;
 try{event=await verifier.verify({rawBody,headers:request.headers});}
 catch{
  // Bitso key-fetch outages should be monitored and retried by provider.
  return response(401,{ok:false,code:"signature_unverified"});
 }
 try{
  const pool=poolFactory(env.DATABASE_URL);
  const inbox=createBitsoWebhookInbox({verifier:{
    async verify(){return event;}
  },store:createPostgresBitsoInboxStore(pool),
   providerAccountId:env.SENDA_BITSO_PROVIDER_ACCOUNT_ID});
  const result=await inbox.receive({rawBody,headers:request.headers});
  return response(202,{ok:true,accepted:result.accepted,
   duplicate:result.duplicate,reconciliationRequired:true});
 }catch{
  // Return a retryable response if persistence/commit fails; don't acknowledge.
  return response(503,{ok:false,code:"durable_storage_unavailable"});
 }
}
