/** Private PARRALAX finance client. Server-only; no transaction signing or execution. */
const ENDPOINTS=Object.freeze({
 "market.research":"/v1/market/research",
 "risk.evaluate":"/v1/risk/evaluate",
 "execution.plan":"/v1/execution/plan",
 "execution.exit-plan":"/v1/execution/exit-plan",
 "agents.budget-evaluate":"/v1/agents/budget-evaluate"
});
export function createFinanceClient({ origin, token, fetchImpl=globalThis.fetch, timeoutMs=8000 }={}) {
 if(!origin||!token||token.length<32)throw Error("Private PARRALAX origin and strong service credential required");
 const root=new URL(origin);
 if(root.protocol!=="https:"&&!(root.hostname==="127.0.0.1"||root.hostname==="localhost"))
  throw Error("PARRALAX finance requires TLS or local loopback");
 if(root.username||root.password||root.search||root.hash)throw Error("Unsafe configured origin");
 const call=async(action,requestId,payload)=>{
  if(!Object.hasOwn(ENDPOINTS,action)||typeof requestId!=="string"||!/^[a-zA-Z0-9._:-]{1,128}$/.test(requestId))
   throw Error("Invalid finance action or request ID");
  if(!payload||typeof payload!=="object"||Array.isArray(payload))throw Error("Invalid finance payload");
  const response=await fetchImpl(new URL(ENDPOINTS[action],root),{
   method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},
   body:JSON.stringify({schema:"senda.parralax.request.v1",requestId,payload}),
   redirect:"error",signal:AbortSignal.timeout(timeoutMs)
  });
  if(!response.ok)throw Error(`PARRALAX finance unavailable: HTTP ${response.status}`);
  const data=await response.json();
  if(data?.schema!=="parralax.response.v1"||data.requestId!==requestId||
      data.kind!=="non-executing-analysis"||!data.result||typeof data.result!=="object")
   throw Error("PARRALAX finance response contract mismatch");
  return { ...data, origin:"parralax-finance", signed:false, filled:false };
 };
 return Object.freeze({
  research:(requestId,payload)=>call("market.research",requestId,payload),
  risk:(requestId,payload)=>call("risk.evaluate",requestId,payload),
  plan:(requestId,payload)=>call("execution.plan",requestId,payload),
  exitPlan:(requestId,payload)=>call("execution.exit-plan",requestId,payload),
  budgetEvaluate:(requestId,payload)=>call("agents.budget-evaluate",requestId,payload)
 });
}
