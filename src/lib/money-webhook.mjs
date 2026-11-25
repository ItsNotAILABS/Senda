/**
 * Provider settlement webhook handler (route: src/routes/api/money/webhook.ts).
 * The raw request body is verified before it is parsed; monetary state only moves through
 * applyProviderWebhook. Disabled (503) unless both env vars are set:
 *   SENDA_SETTLEMENT_PROVIDER        provider id, e.g. "acquirer:example" (8-128 chars)
 *   SENDA_SETTLEMENT_WEBHOOK_SECRET  HMAC-SHA256 secret, >= 32 chars
 * Responses never echo provider or internal error text.
 */
import {applyProviderWebhook,createHmacWebhookVerifier,createSqlIntentStore,publicMoneyState} from "./money-settlement-core.mjs";

const MAX_BODY=65536;
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});

export function settlementVerifierFromEnv(env){
 const provider=String(env.SENDA_SETTLEMENT_PROVIDER||"").trim();
 const secret=String(env.SENDA_SETTLEMENT_WEBHOOK_SECRET||"");
 if(!provider||!secret)return null;
 return createHmacWebhookVerifier({provider,secret});
}

export async function handleMoneyWebhook(request,{env,getQuery,log=console}){
 if(request.method!=="POST")return json(405,{error:"Method not allowed"});
 let verifier;
 try{verifier=settlementVerifierFromEnv(env);}
 catch(e){log.error("[money-webhook] bad verifier config",e instanceof Error?e.message:e);return json(503,{error:"Settlement webhooks are not configured"});}
 if(!verifier)return json(503,{error:"Settlement webhooks are not configured"});
 const length=Number(request.headers.get("content-length")||0);
 if(length>MAX_BODY)return json(413,{error:"Body too large"});
 const rawBody=await request.text();
 if(!rawBody||rawBody.length>MAX_BODY)return json(400,{error:"Invalid webhook body"});
 let query;
 try{query=await getQuery();}
 catch(e){log.error("[money-webhook] database unavailable",e instanceof Error?e.message:e);return json(503,{error:"Try again later"});}
 try{
  const {intent,outcome}=await applyProviderWebhook({store:createSqlIntentStore(query),rawBody,headers:request.headers,verifier});
  return json(200,{ok:true,outcome,...publicMoneyState(intent)});
 }catch(e){
  const message=e instanceof Error?e.message:String(e);
  if(/did not verify|verifier is required/.test(message))return json(401,{error:"Signature did not verify"});
  if(/^Unknown money intent/.test(message))return json(404,{error:"Unknown transfer"});
  if(/^Concurrent settlement update/.test(message))return json(409,{error:"Retry"});
  if(/Invalid webhook body|not JSON|Invalid settlement event|mismatch|does not match|Illegal money-state|Conflicting replay|Too many out-of-order|timestamp|Cleared money movements/.test(message)){
   log.warn("[money-webhook] rejected event",message.slice(0,200));
   return json(422,{error:"Event rejected"});
  }
  log.error("[money-webhook] failed",message.slice(0,200));
  return json(500,{error:"Webhook failed"});
 }
}
