/** Private server-to-server SDK. Never bundle this module with a browser key. */
const ticker=/^[A-Z0-9][A-Z0-9._-]{2,119}$/;
export function createSendaEventClient({baseUrl,apiKey,fetchImpl=fetch,allowInsecureLocalhost=false,timeoutMs=9500}={}){
 if(typeof baseUrl!=="string"||!baseUrl.trim())throw Error("Service baseUrl required.");
 const root=new URL(baseUrl);
 const local=allowInsecureLocalhost&&root.protocol==="http:"&&["127.0.0.1","localhost"].includes(root.hostname);
 if((root.protocol!=="https:"&&!local)||root.username||root.password||root.search||root.hash||root.pathname!=="/")
  throw Error("Use a secure origin without path, query or embedded credentials.");
 if(typeof apiKey!=="string"||apiKey.length<32||apiKey.length>200)
  throw Error("Server-side Senda event service credential required.");
 if(!Number.isInteger(timeoutMs)||timeoutMs<2000||timeoutMs>30000)
  throw Error("Invalid client request timeout");
 async function call(method,path,payload=null){
  if(!/^\/v1\/[a-zA-Z0-9/?._=&%+\-]+$/.test(path)||path.includes(".."))
   throw Error("Unsupported service route.");
  const url=new URL(path,root);
  if(url.origin!==root.origin)throw Error("Cross-origin service request denied.");
  const res=await fetchImpl(url.toString(),{
   method,redirect:"error",signal:AbortSignal.timeout(timeoutMs),
   headers:{authorization:"Bearer "+apiKey,accept:"application/json",
    ...(payload===null?{}:{"content-type":"application/json"})},
   ...(payload===null?{}:{body:JSON.stringify(payload)})
  });
  let body;try{body=await res.json()}catch{throw Error("Event service returned no valid JSON response.");}
  if(!res.ok){
   const code=typeof body?.error?.code==="string"?body.error.code:"SERVICE_UNAVAILABLE";
   const error=new Error("Event service refused the request: "+code);
   error.code=code;error.status=res.status;throw error;
  }
  if(body?.schema!=="senda.events.response.v1"||body.execution!=="disabled"||body.insurance!==false)
   throw Error("Unexpected event service response schema or financial permissions.");
  return body;
 }
 const id=value=>{if(!ticker.test(value||""))throw Error("Invalid event ticker");return value;};
 return Object.freeze({
  capabilities:()=>call("GET","/v1/capabilities"),
  readiness:()=>call("GET","/v1/ready"),
  listMarkets:({q="",lane="all",sort="activity",limit=30,cursor=""}={})=>{
   const params=new URLSearchParams({q,lane,sort,limit:String(limit)});
   if(cursor)params.set("cursor",cursor);
   return call("GET","/v1/markets?"+params.toString());
  },
  market:ticker=>call("GET","/v1/markets/"+id(ticker)),
  book:ticker=>call("GET","/v1/markets/"+id(ticker)+"/book"),
  history:(ticker,window="7d")=>call("GET","/v1/markets/"+id(ticker)+"/history?window="+window),
  scenario:input=>call("POST","/v1/contingency/scenario",input),
  reserve:input=>call("POST","/v1/contingency/reserve",input)
 });
}
