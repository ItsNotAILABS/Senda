/** Server-only DFlow prediction access. No personal identifiers beyond wallet address are retained.
 * Bounded, fail-closed: no production trades until approved partner and eligibility providers are wired.
 */
import {createServerFn} from "@tanstack/react-start";
import {z} from "zod";
import {USDC,parseDflowMarket,validateDflowOrder,evaluateDflowEligibility,terminalDflowStatus,type DflowMarket,type DflowOrder} from "@/lib/dflow-prediction-core.mjs";
const MINT=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const TICKER=/^[A-Z0-9][A-Z0-9._-]{2,119}$/;
const SIG=/^[1-9A-HJ-NP-Za-km-z]{80,100}$/;
const config=()=>({
 key:process.env.SENDA_DFLOW_API_KEY||"",
 enabled:process.env.SENDA_DFLOW_EXECUTION_ENABLED==="true",
 approved:process.env.SENDA_DFLOW_PARTNER_APPROVED==="true",
 eligibilityUrl:process.env.SENDA_DFLOW_ELIGIBILITY_API_URL||"",
 eligibilityKey:process.env.SENDA_DFLOW_ELIGIBILITY_API_KEY||"",
 allowedProgramIds:(process.env.SENDA_DFLOW_ALLOWED_PROGRAM_IDS||"").split(",").map(x=>x.trim()).filter(x=>MINT.test(x)),
});
const requestSlot=new Map<string,number>();
function throttle(wallet:string){
 const now=Date.now();
 if(requestSlot.size>1000)requestSlot.clear();
 const last=requestSlot.get(wallet)||0;
 if(now-last<1500)throw Error("Please allow a moment before requesting another DFlow quote.");
 requestSlot.set(wallet,now);
}
async function fetchJSON(url:string,headers:Record<string,string>={},timeout=6500):Promise<Record<string,any>>{
 const response=await fetch(url,{headers:{accept:"application/json",...headers},signal:AbortSignal.timeout(timeout),redirect:"error"});
 if(!response.ok)throw Error("Provider HTTP "+response.status);
 const obj=await response.json() as unknown;
 if(!obj||typeof obj!=="object"||Array.isArray(obj))throw Error("Provider returned invalid data");
 return obj as Record<string,any>;
}
async function marketFromDflow(ticker:string,key:string):Promise<DflowMarket>{
 const json=await fetchJSON("https://api.prod.dflow.net/api/v1/market/"+encodeURIComponent(ticker),{"x-api-key":key});
 return parseDflowMarket(ticker,json);
}
async function checkProof(wallet:string){
 try{const proof=await fetchJSON("https://proof.dflow.net/verify/"+wallet,{},5500);
  return {verified:proof.verified===true};}catch{return {verified:false};}
}
// Proof is public and independent of Senda's production trade credentials.
export const getDflowProofStatus=createServerFn({method:"POST"})
 .validator((raw:unknown)=>z.object({wallet:z.string().regex(MINT)}).parse(raw))
 .handler(async({data}):Promise<{verified:boolean}>=>checkProof(data.wallet));
async function checkPartnerJurisdiction(wallet:string,c:ReturnType<typeof config>){
 if(!c.eligibilityUrl||!c.eligibilityKey)return false;
 try{
  const origin=new URL(c.eligibilityUrl);
  if(origin.protocol!=="https:"||origin.username||origin.password||origin.hash||origin.search)return false;
  const endpoint=new URL("/api/v1/dflow/eligibility",origin);
  endpoint.searchParams.set("wallet",wallet);
  const out=await fetchJSON(endpoint.toString(),{"x-senda-eligibility-key":c.eligibilityKey},5500);
  return out.wallet===wallet&&out.approved===true&&out.ageVerified===true&&
   out.jurisdictionApproved===true&&typeof out.expiresAt==="string"&&
   Date.parse(out.expiresAt)>Date.now()&&Date.parse(out.expiresAt)<Date.now()+24*3600_000;
 }catch{return false;}
}
async function capability(wallet:string,ticker:string){
 const c=config();
 if(!c.key||!c.enabled||!c.approved||!c.allowedProgramIds.length)return {ready:false,market:null,proofVerified:false,
  reason:"Senda DFlow production credentials/authorization are not enabled."};
 const [proof,approved,market]=await Promise.all([
   checkProof(wallet),checkPartnerJurisdiction(wallet,c),marketFromDflow(ticker,c.key).catch(()=>null)
 ]);
 const gate=evaluateDflowEligibility({proof,enabled:c.enabled,partnerApproved:c.approved,regionApproved:approved,market});
 return {ready:gate.ready,market,proofVerified:proof.verified,reason:gate.reason};
}
const schema=z.object({wallet:z.string().regex(MINT),ticker:z.string().regex(TICKER)});
export const getDflowPredictionCapability=createServerFn({method:"POST"})
 .validator((raw:unknown)=>schema.parse(raw))
 .handler(async({data})=>capability(data.wallet,data.ticker));
export const prepareDflowPredictionOrder=createServerFn({method:"POST"})
 .validator((raw:unknown)=>schema.extend({side:z.enum(["yes","no"]),usd:z.number().finite().min(1).max(250)}).parse(raw))
 .handler(async({data}):Promise<{ready:boolean;reason:string;order:DflowOrder|null;market:DflowMarket|null}>=>{
  throttle(data.wallet);
  const cap=await capability(data.wallet,data.ticker);
  if(!cap.ready||!cap.market)return {ready:false,reason:cap.reason,order:null,market:cap.market};
  const amount=String(Math.round(data.usd*1e6));
  const mint=data.side==="yes"?cap.market.yesMint:cap.market.noMint;
  const query=new URLSearchParams({
   inputMint:USDC,outputMint:mint,amount,userPublicKey:data.wallet,
   slippageBps:"100",predictionMarketSlippageBps:"100",
   prioritizationFeeLamports:"5000"
  });
  const c=config();
  try{
   const raw=await fetchJSON("https://quote-api.dflow.net/order?"+query.toString(),{"x-api-key":c.key},7000);
   const order={...validateDflowOrder({raw,wallet:data.wallet,inputMint:USDC,outputMint:mint,amountRaw:amount}),allowedProgramIds:c.allowedProgramIds};
   return {ready:true,order,market:cap.market,reason:"DFlow produced a live, short-lived, wallet-specific transaction. Approval in Phantom is still required."};
  }catch(e){return {ready:false,order:null,market:cap.market,reason:e instanceof Error?e.message:"DFlow could not prepare a verified transaction."};}
 });
export const getDflowPredictionStatus=createServerFn({method:"POST"})
 .validator((raw:unknown)=>z.object({signature:z.string().regex(SIG),wallet:z.string().regex(MINT),lastValidBlockHeight:z.number().int().positive()}).parse(raw))
 .handler(async({data})=>{
   const c=config();
   if(!c.enabled||!c.key||!c.approved)return {status:"unavailable",terminal:false,success:false};
   const query=new URLSearchParams({signature:data.signature,lastValidBlockHeight:String(data.lastValidBlockHeight)});
   try{
    const result=await fetchJSON("https://quote-api.dflow.net/order-status?"+query.toString(),{"x-api-key":c.key},5500);
    const status=String(result.status??"unknown");
    const outcome=terminalDflowStatus(status);
    return {status:outcome.unknown?"unavailable":status,terminal:outcome.terminal,success:outcome.success,
      observedAt:new Date().toISOString()};
   }catch{return {status:"unavailable",terminal:false,success:false};}
 });
