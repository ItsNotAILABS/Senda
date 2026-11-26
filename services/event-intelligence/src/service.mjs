import {createHash,randomUUID,timingSafeEqual} from "node:crypto";
import {createKalshiProvider,requireTicker} from "./provider.mjs";
import {contingencyScenario,contingencyReservePlan} from "./contingency-analysis.mjs";
import {analyzeEventEvidence} from "./event-risk-intelligence.mjs";

const routes=["/v1/markets","/v1/markets/:ticker","/v1/markets/:ticker/book","/v1/markets/:ticker/history",
 "/v1/contingency/scenario","/v1/contingency/reserve","/v1/capabilities",
 "/v1/intelligence/:ticker"];
const response=(data,status=200,headers={})=>new Response(JSON.stringify(data),{
 status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",
 "x-content-type-options":"nosniff","referrer-policy":"no-referrer",...headers}
});
const err=(status,code,message,requestId)=>response({schema:"senda.events.error.v1",requestId,error:{code,message}},status);
const inputError=(code,message)=>Object.assign(new Error(message),{code,status:400});
const sha256=value=>createHash("sha256").update(value).digest("hex");
const validNumber=(x,min,max)=>typeof x==="number"&&Number.isFinite(x)&&x>=min&&x<=max;
const cleanText=(x,max)=>typeof x==="string"&&x.length<=max?x:null;
function requireBody(raw){
 if(typeof raw!=="string"||raw.length>15000)throw inputError("PAYLOAD_TOO_LARGE","Request body exceeds allowed size.");
 let obj;try{obj=JSON.parse(raw)}catch{throw inputError("INVALID_JSON","Request must be a JSON object.");}
 if(!obj||typeof obj!=="object"||Array.isArray(obj))throw inputError("INVALID_BODY","Expected JSON object.");
 return obj;
}
function safeKeys(env){
 const values=String(env.SENDA_EVENT_API_KEYS??"").split(",").map(x=>x.trim()).filter(Boolean);
 if(!values.length||values.some(x=>x.length<32||x.length>200))return null;
 return values.map(sha256);
}
function authorized(auth,keys){
 if(typeof auth!=="string"||!auth.startsWith("Bearer ")||auth.length>230)return null;
 const token=auth.slice(7);
 if(token.length<32||token.length>200)return null;
 const digest=Buffer.from(sha256(token),"hex");
 let found=false;
 for(const encoded of keys)found=timingSafeEqual(digest,Buffer.from(encoded,"hex"))||found;
 return found?sha256(token):null;
}
const decimal=x=>typeof x==="number"&&Number.isFinite(x)?x:null;
const windowNames=new Set(["24h","7d","30d"]);
export function createEventService({env=process.env,fetchImpl=fetch,now=Date.now}={}){
 const provider=createKalshiProvider({fetchImpl,now});
 const keyHashes=safeKeys(env);
 let globalWindow={at:0,count:0};
 const perToken=new Map();
 function allowRequest(tokenId){
  const t=now();
  if(t-globalWindow.at>=60000)globalWindow={at:t,count:0};
  if(globalWindow.count>=120)return false;
  const old=perToken.get(tokenId),row=!old||t-old.at>=60000?{at:t,count:0}:old;
  if(row.count>=40)return false;
  globalWindow.count++;row.count++;perToken.set(tokenId,row);
  if(perToken.size>200)for(const [k,v] of perToken){if(t-v.at>=60000)perToken.delete(k)}
  return true;
 }
 const envelope=(data,requestId)=>{
  const observedAt=new Date(now()).toISOString();
  const facts={schema:"senda.events.response.v1",requestId,observedAt,execution:"disabled",insurance:false,data};
  return {...facts,receipt:{type:"sha256-local-response-digest",sha256:sha256(JSON.stringify(facts)),
   durable:false,onchainAnchored:false}};
 };
 async function handleRequest(request){
  const id=randomUUID();
  try{
   if(!(request instanceof Request))return err(500,"INVALID_REQUEST","Internal request contract error.",id);
   const url=new URL(request.url);
   if(url.pathname==="/v1/health"&&request.method==="GET")
    return response({schema:"senda.events.health.v1",status:"ready",role:"research-only",
     integrations:"configuration-dependent",timestamp:new Date(now()).toISOString()});
   if(!keyHashes)return err(503,"NOT_CONFIGURED","Event service requires secure server-side API credentials.",id);
   const tokenId=authorized(request.headers.get("authorization"),keyHashes);
   if(!tokenId)return err(401,"UNAUTHORIZED","Valid server-to-server bearer credentials required.",id);
   if(!allowRequest(tokenId))return err(429,"RATE_LIMITED","Event research quota exceeded for this instance.",id);
   const path=url.pathname,method=request.method;
   if(method==="GET"&&path==="/v1/capabilities")
    return response(envelope({service:"senda-event-intelligence",version:"v1",routes,
     capabilities:{publicMarkets:"source-dependent",marketRules:"source-dependent",
      marketHistory:"source-dependent",contingency:"research-only",cashReserves:"deterministic",
      eventEvidenceQuality:"research-only",
      phantomOrderSigning:false,kalshiAccountOrders:false,dflowOrderExecution:false,
      sendapayMoneyMovement:false,insuranceIssuance:false},
     financialExecution:"not-available",serviceBoundary:"No wallet keys, no transfers, no Kalshi order authority."},id));
   if(method==="GET"&&path==="/v1/markets"){
    const query=url.searchParams.get("q")??"";
    const lane=url.searchParams.get("lane")??"all";
    const sort=url.searchParams.get("sort")??"activity";
    const cursor=url.searchParams.get("cursor")??"";
    const limitRaw=url.searchParams.get("limit")??"30",limit=Number(limitRaw);
    if(!Number.isInteger(limit)||limit<1||limit>60||query.length>80||cursor.length>512)
     throw inputError("INVALID_QUERY","Query, pagination or limit exceeds allowed bounds.");
    if(!["all","sports","economy","crypto","weather","world","technology","culture"].includes(lane)||
       !["activity","closing","tight-spread"].includes(sort))
     throw inputError("INVALID_FILTER","Unsupported market filter.");
    const data=await provider.markets({query,lane,sort,limit,cursor});
    return response(envelope(data,id));
   }
   const match=/^\/v1\/markets\/([^/]+)(?:\/(book|history))?$/.exec(path);
   if(method==="GET"&&match){
    const ticker=requireTicker(decodeURIComponent(match[1]));
    if(!match[2])return response(envelope(await provider.detail(ticker),id));
    if(match[2]==="book"){
     const book=await provider.book(ticker);
     return response(envelope({...book,execution:"disabled",
      hasOpposingOrders:book.yesBids.length>0||book.noBids.length>0},id));
    }
    const win=url.searchParams.get("window")??"7d";
    if(!windowNames.has(win))throw inputError("INVALID_TIMEFRAME","Choose 24h, 7d or 30d.");
    return response(envelope(await provider.history(ticker,win),id));
   }
   const intelligenceMatch=/^\/v1\/intelligence\/([^/]+)$/.exec(path);
   if(method==="GET"&&intelligenceMatch){
    const ticker=requireTicker(decodeURIComponent(intelligenceMatch[1]));
    const win=url.searchParams.get("window")??"7d";
    if(!windowNames.has(win))throw inputError("INVALID_TIMEFRAME","Choose 24h, 7d or 30d.");
    const [detail,book,history]=await Promise.all([
     provider.detail(ticker),provider.book(ticker),provider.history(ticker,win)
    ]);
    return response(envelope(analyzeEventEvidence({detail,book,history,now:now()}),id));
   }
   if(method==="POST"&&path==="/v1/contingency/reserve"){
    const obj=requireBody(await request.text());
    for(const [key,min,max] of [["potentialExpenseUsd",0,10000000],["availableCashUsd",0,10000000],["targetCoveragePct",0,100]]){
     if(!validNumber(obj[key],min,max))throw inputError("INVALID_AMOUNT",key+" out of range.");
    }
    return response(envelope(contingencyReservePlan({
     potentialExpenseUsd:obj.potentialExpenseUsd,availableCashUsd:obj.availableCashUsd,
     targetCoveragePct:obj.targetCoveragePct
    }),id));
   }
   if(method==="POST"&&path==="/v1/contingency/scenario"){
    const obj=requireBody(await request.text());
    const ticker=requireTicker(obj.ticker);
    if(!["yes","no"].includes(obj.side)||!Number.isInteger(obj.contracts)||obj.contracts<1||obj.contracts>1000||
       !validNumber(obj.possibleLossUsd,0,10000000)||!validNumber(obj.budgetUsd,0.01,10000000))
     throw inputError("INVALID_SCENARIO","Provide a bounded ticker, outcome, contracts, expense and budget.");
    const book=await provider.book(ticker),clock=now();
    const quote=provider.planEventSide(book,obj.side,obj.contracts,clock);
    const scenario=contingencyScenario({quote,possibleLossUsd:obj.possibleLossUsd,budgetUsd:obj.budgetUsd,
     marketTicker:ticker,now:clock});
    return response(envelope({scenario,quote,source:{marketTicker:ticker,
     name:"Kalshi public opposing bid depth",observedAt:new Date(book.asOf).toISOString(),
     marketVerified:book.yesBids.length>0||book.noBids.length>0},
     warnings:["Event contracts do not insure or reimburse actual losses.","No transaction was signed or submitted."]},id));
   }
   if(method==="OPTIONS")return err(405,"CORS_DISABLED","Service-to-service only.",id);
   return err(404,"UNKNOWN_ROUTE","No matching event-intelligence route.",id);
  }catch(e){
   const status=Number.isInteger(e?.status)&&e.status>=400&&e.status<600?e.status:503;
   const code=typeof e?.code==="string"?e.code:"PROVIDER_UNAVAILABLE";
   const message=status===400?String(e.message):status===404?String(e.message):"Verified service data unavailable. Try again.";
   return err(status,code,message,id);
  }
 }
 return {handleRequest};
}
