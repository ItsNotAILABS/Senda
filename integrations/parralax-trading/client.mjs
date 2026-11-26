/** Private, non-executing PARRALAX risk client for Senda's authenticated server. */
const id=x=>typeof x==="string"&&/^[a-zA-Z0-9._:-]{1,128}$/.test(x);
const address=x=>typeof x==="string"&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(x);
export function createPretradeClient({origin,serviceToken,fetchImpl=globalThis.fetch,timeoutMs=7500}={}){
 if(typeof origin!=="string"||typeof serviceToken!=="string"||serviceToken.length<32)
  throw Error("PRIVATE_PARRALAX_CONFIGURATION_REQUIRED");
 const base=new URL(origin);
 if(base.protocol!=="https:" && !(base.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(base.hostname)))
  throw Error("PRIVATE_HTTPS_OR_LOOPBACK_REQUIRED");
 if(base.username||base.password||base.search||base.hash)throw Error("UNSAFE_PARRALAX_ORIGIN");
 return Object.freeze({
  async review({order,quoteId,principal}){
   if(!order||!id(order.requestId)||!id(order.tenantId)||!id(order.agentId)||
    !id(order.venue)||!address(order.mint)||!id(quoteId)||!id(principal))
    throw Error("INVALID_PRETRADE_REQUEST");
   // Do not allow caller-supplied portfolio, limits, market, or evidence objects.
   const body={schema:"senda.pretrade.request.v1",quoteId,order:{
    requestId:order.requestId,tenantId:order.tenantId,agentId:order.agentId,venue:order.venue,
    mint:order.mint,side:order.side,notionalUsd:order.notionalUsd,
    leverage:order.leverage,priceImpactBps:order.priceImpactBps,slippageBps:order.slippageBps
   }};
   const response=await fetchImpl(new URL("/v1/agents/pretrade",base),{
    method:"POST",headers:{"authorization":"Bearer "+serviceToken,
     "content-type":"application/json","x-service-principal":principal},
    body:JSON.stringify(body),redirect:"error",signal:AbortSignal.timeout(timeoutMs)
   });
   if(!response.ok)throw Error("PARRALAX_REVIEW_UNAVAILABLE");
   const result=await response.json();
   if(result?.schema!=="parralax.pretrade.response.v1"||
    result.requestId!==order.requestId||result.executionAuthorized!==false||
    !["DENY","APPROVAL_REQUIRED"].includes(result.decision))
    throw Error("PARRALAX_RESPONSE_CONTRACT_MISMATCH");
   return Object.freeze({...result,kind:"non-executing-review",signed:false,filled:false});
  }
 });
}
