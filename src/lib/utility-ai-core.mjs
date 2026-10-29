/** Senda Utility AI evidence engine.
 * Pure: public-source facts and deterministic guards, no wallet, transaction or model authority.
 */
export const UTILITY_TASKS=Object.freeze(["market","liquidity","transfer"]);
export const SOL_USDC="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const MINT=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const finite=(x)=>typeof x==="number"&&Number.isFinite(x)?x:null;
const positive=(x)=>{const n=typeof x==="string"&&x.trim()?Number(x):finite(x);return Number.isFinite(n)&&n>0?n:null};
const bounded=(x)=>typeof x==="string"?x.replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,90):"";
export function validMint(x){return typeof x==="string"&&MINT.test(x);}
export function normalizePrestock(raw,mint) {
 if(!validMint(mint)||!Array.isArray(raw))return null;
 const hit=raw.find(x=>x&&typeof x==="object"&&x.contract_address===mint);
 if(!hit)return null;
 return {mint,symbol:bounded(hit.symbol)||"UNNAMED",name:bounded(hit.name)||"Unnamed PreStock",
  tokenPrice:positive(hit.tokenPrice),markPrice:positive(hit.markPrice),
  impliedValuation:positive(hit.impliedValuation),markValuation:positive(hit.markValuation),
  holders:finite(hit.holders)!=null&&hit.holders>=0?Math.floor(hit.holders):null,
  source:"PreStocks public API"};
}
export function normalizePools(raw,mint){
 if(!validMint(mint)||!raw||typeof raw!=="object"||!Array.isArray(raw.data))return [];
 const seen=new Set(),out=[];
 for(const record of raw.data.slice(0,30)){
  const a=record?.attributes??{},addr=a.address;
  if(!validMint(addr)||seen.has(addr))continue;
  seen.add(addr);
  const liquid=positive(a.reserve_in_usd);
  const volume=positive(a.volume_usd?.h24);
  const buy=finite(a.transactions?.h24?.buys),sell=finite(a.transactions?.h24?.sells);
  out.push({address:addr,name:bounded(a.name)||"Solana liquidity pool",
   reserveUsd:liquid,volume24Usd:volume,
   buys24h:buy!=null&&buy>=0?Math.floor(buy):null,
   sells24h:sell!=null&&sell>=0?Math.floor(sell):null,
   basePriceUsd:positive(a.base_token_price_usd),quotePriceUsd:positive(a.quote_token_price_usd),
   poolCreatedAt:typeof a.pool_created_at==="string"?a.pool_created_at.slice(0,40):null
  });
 }
 return out.sort((a,b)=>(b.reserveUsd??-1)-(a.reserveUsd??-1)).slice(0,6);
}
function fact(id,label,value,source,url,observedAt,unit=""){return {id,label,value,unit,source,url,observedAt};}
const money=n=>"$"+n.toLocaleString("en-US",{maximumFractionDigits:n<1?6:2});
const entry=(id,label,value,source,url,at,unit)=>fact(id,label,value,source,url,at,unit);
export function buildUtilityReport({task,mint="",prestock=null,pools=[],currency="USDC",amount=null,prestockAt=null,poolsAt=null,now=new Date().toISOString()}){
 if(!UTILITY_TASKS.includes(task))throw Error("Unknown Senda utility.");
 if(task!=="transfer"&&!validMint(mint))throw Error("Valid Solana token mint required.");
 const facts=[],risks=[],actions=[];
 const snapshot={schema:"senda.utility-ai.report.v1",task,mint:task==="transfer"?null:mint,
  observedAt:now,scope:"public-data-only",authority:"read-only",verdict:"research-only",
  facts,risks,actions,symbol:prestock?.symbol??null,headline:"",dataStatus:"partial"};
 if(task==="transfer"){
  if(!["USDC","USDT"].includes(currency))throw Error("Unsupported stablecoin.");
  const numeric=finite(amount);
  if(amount!==null&&(numeric===null||numeric<=0||numeric>100000))throw Error("Invalid transfer amount.");
  snapshot.headline=currency+" on Solana · signing and settlement checklist";
  facts.push(entry("network","Intended network","Solana mainnet","Senda transfer policy","https://solana.com/docs/payments/how-payments-work",now));
  facts.push(entry("currency","Chosen currency",currency,"User selection","https://solana.com/docs/payments/how-payments-work",now));
  if(numeric!=null)facts.push(entry("amount","Proposed transfer amount",numeric,"User input","https://solana.com/docs/payments/how-payments-work",now,currency));
  if(currency==="USDC")facts.push(entry("mint","Canonical Solana USDC mint",SOL_USDC,"Senda verified transfer constant","https://solscan.io/token/"+SOL_USDC,now));
  risks.push("No recipient or wallet signature was supplied. No transaction was built, signed or broadcast.");
  risks.push("The destination must support the exact chain and token mint; transferring to the wrong network can permanently lose funds.");
  if(currency==="USDT")risks.push("USDT mint and token program must be independently verified by the transfer flow; this assistant does not assert one.");
  actions.push("Verify recipient address, network and canonical mint in the actual transfer interface.");
  actions.push("Check wallet balance, recipient associated token account, SOL network fees and any token-account creation fee.");
  actions.push("Preview exact transaction details, sign in your connected wallet, then independently verify finality.");
  snapshot.dataStatus="policy";
  return snapshot;
 }
 if(prestock){
  snapshot.headline=prestock.name+" · market evidence";
  facts.push(entry("asset","PreStocks instrument",prestock.symbol+" · "+prestock.name,"PreStocks API","https://prestocks.com/api/prestocks",prestockAt??now));
  if(prestock.tokenPrice!=null)facts.push(entry("token_price","Provider token price",prestock.tokenPrice,"PreStocks API","https://prestocks.com/api/prestocks",prestockAt??now,"USD/token"));
  if(prestock.markPrice!=null)facts.push(entry("mark_price","Provider mark (not a share quote)",prestock.markPrice,"PreStocks API","https://prestocks.com/api/prestocks",prestockAt??now,"USD/token"));
  if(prestock.tokenPrice!=null&&prestock.markPrice!=null)facts.push(entry("premium","Token price vs provider mark",+(100*(prestock.tokenPrice/prestock.markPrice-1)).toFixed(2),"Derived from PreStocks fields","https://prestocks.com/api/prestocks",prestockAt??now,"%"));
  if(prestock.holders!=null)facts.push(entry("holders","Provider reported holders",prestock.holders,"PreStocks API","https://prestocks.com/api/prestocks",prestockAt??now,"addresses"));
  risks.push("A PreStock is tokenized economic exposure, not ownership of an underlying company share.");
  risks.push("Provider marks and indicative token prices are not executable swap quotes.");
 } else {
  snapshot.headline="Solana liquidity and market evidence";
  if(task==="market")risks.push("The PreStocks feed did not verify this mint. No synthetic or seeded token price was substituted.");
 }
 if(pools.length){
  const p=pools[0];
  facts.push(entry("pool","Top observed pool",p.address,"GeckoTerminal Solana pool index","https://www.geckoterminal.com/solana/pools/"+p.address,poolsAt??now));
  if(p.reserveUsd!=null)facts.push(entry("pool_reserve","Top pool reported reserve",p.reserveUsd,"GeckoTerminal pool index","https://www.geckoterminal.com/solana/pools/"+p.address,poolsAt??now,"USD"));
  if(p.volume24Usd!=null)facts.push(entry("pool_volume","Top pool reported 24h volume",p.volume24Usd,"GeckoTerminal pool index","https://www.geckoterminal.com/solana/pools/"+p.address,poolsAt??now,"USD"));
  if(p.buys24h!=null&&p.sells24h!=null)facts.push(entry("pool_swaps","Top pool 24h indexed swaps",p.buys24h+p.sells24h,"GeckoTerminal pool index","https://www.geckoterminal.com/solana/pools/"+p.address,poolsAt??now,"swaps"));
  if(p.reserveUsd==null)risks.push("Pool reserve liquidity was not reported; execution capacity cannot be estimated.");
  else if(p.reserveUsd<50000)risks.push("Observed top pool reserves are thin (below $50,000). Actual order impact may be material.");
  if(p.volume24Usd==null)risks.push("Recent pool volume was not reported; missing is not zero.");
  snapshot.headline=prestock?prestock.name+" · pool and valuation intelligence":"Solana token · liquidity evidence";
 }else risks.push("No verified pool data available; missing liquidity is not zero liquidity.");
 risks.push("Pool reserve and 24h activity are research metrics, not firm bids, asks or a fillable Jupiter quote.");
 actions.push("Check the mint address and token program before any trade.");
 actions.push("Request a fresh taker-bound swap quote for the actual order amount; compare output, fees, route expiry and slippage.");
 actions.push("Review the wallet-signing prompt and confirm final settlement. This copilot cannot trade.");
 if(!facts.length)snapshot.verdict="insufficient-data";
 snapshot.dataStatus=(prestock||pools.length)?"sourced":"unavailable";
 return snapshot;
}
export function validateModelCommentary(raw,allowedIds){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("Invalid model reply.");
 const plain=(x,max)=>typeof x==="string"?x.trim().slice(0,max):"";
 if(!Array.isArray(raw.observations)||!Array.isArray(raw.next_steps)||!Array.isArray(raw.uncertainties))throw Error("Model omitted required lists.");
 const ids=new Set(allowedIds);
 const observations=raw.observations.slice(0,5).map(x=>{
  if(!x||typeof x!=="object"||!Array.isArray(x.evidence_ids))throw Error("Missing evidence reference.");
  if(!x.evidence_ids.length||x.evidence_ids.length>5||x.evidence_ids.some(id=>typeof id!=="string"||!ids.has(id)))
   throw Error("Model used an unverified evidence ID.");
  const evidence_ids=[...new Set(x.evidence_ids)];
  const text=plain(x.text,300);
  if(!text)throw Error("Model observation is empty.");
  return {text,evidence_ids};
 });
 return {summary:plain(raw.summary,550),observations,
  uncertainties:raw.uncertainties.slice(0,5).map(x=>plain(x,220)).filter(Boolean),
  next_steps:raw.next_steps.slice(0,5).map(x=>plain(x,220)).filter(Boolean)};
}
