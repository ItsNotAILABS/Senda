/** Pure Solscan activity -> conservative native USDC-notional volume bars.
 * Never multiply a historical swap by today's price or count transfers as trading volume.
 */
export const USDC_MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SWAP_TYPES=new Set(["ACTIVITY_TOKEN_SWAP","ACTIVITY_AGG_TOKEN_SWAP"]);
const RAW=/^[0-9]{1,30}$/;
const MAX_SAFE=BigInt(Number.MAX_SAFE_INTEGER);
const STEPS={"15m":900,"1H":3600,"4H":14400,"1D":86400};
function stableAmount(router,side) {
 if(!router||typeof router!=="object")return null;
 const key=side===1?"amount1":"amount2",decimals=side===1?"token1_decimals":"token2_decimals";
 if(router[decimals]!==6)return null;
 const raw=router[key];
 let units;
 if(typeof raw==="number") {
  if(!Number.isSafeInteger(raw)||raw<0)return null;
  units=BigInt(raw);
 }else if(typeof raw==="string"&&RAW.test(raw)) {
  try{units=BigInt(raw);}catch{return null;}
 }else return null;
 if(units<=0n||units>MAX_SAFE)return null;
 return Number(units)/1e6;
}
function parseActivity(row,mint,start,end) {
 if(!row||typeof row!=="object"||!SWAP_TYPES.has(row.activity_type))return null;
 if(typeof row.trans_id!=="string"||row.trans_id.length<32)return null;
 const t=row.block_time;
 if(!Number.isInteger(t)||t<start||t>=end)return null;
 const route=row.routers;
 if(!route||typeof route!=="object")return {t,sig:row.trans_id,priced:false,why:"unknown-router"};
 if(route.token1===USDC_MINT&&route.token2===mint) {
  const nominal=stableAmount(route,1);
  return {t,sig:row.trans_id,priced:nominal!=null,side:"buy",nominal,kind:row.activity_type};
 }
 if(route.token2===USDC_MINT&&route.token1===mint){
  const nominal=stableAmount(route,2);
  return {t,sig:row.trans_id,priced:nominal!=null,side:"sell",nominal,kind:row.activity_type};
 }
 return {t,sig:row.trans_id,priced:false,why:"non-USDC-pair",kind:row.activity_type};
}
export function aggregateSolscanVolume({mint,events,start,end,tf="1H",complete=false,observedAt,observedThrough=end}){
 if(typeof mint!=="string"||!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)||mint===USDC_MINT)throw Error("Invalid volume mint.");
 const step=STEPS[tf];if(!step)throw Error("Invalid volume interval.");
 if(!Number.isInteger(start)||!Number.isInteger(end)||end<=start||end-start>86400||end-start<step)throw Error("Invalid volume time range.");
 const ordered=Array.isArray(events)?events:[];
 // Prefer aggregate top-level swaps over child legs if Solscan returns both.
 const grouped=new Map();
 for(const event of ordered) {
  const parsed=parseActivity(event,mint,start,end);
  if(!parsed)continue;
  const existing=grouped.get(parsed.sig);
  if(!existing||parsed.kind==="ACTIVITY_AGG_TOKEN_SWAP"&&existing.kind!=="ACTIVITY_AGG_TOKEN_SWAP" ||
    (parsed.priced&&!existing.priced&&parsed.kind===existing.kind))grouped.set(parsed.sig,parsed);
 }
 const buckets=new Map();
 let priced=0,unpriced=0;
 for(const event of grouped.values()){
  if(!event.priced||!(event.nominal>0)){unpriced++;continue;}
  priced++;
  const t=Math.floor(event.t/step)*step;
  const cell=buckets.get(t)||{buy:0,sell:0,buyTrades:0,sellTrades:0};
  cell[event.side]+=event.nominal;
  cell[event.side==="buy"?"buyTrades":"sellTrades"]+=1;
  buckets.set(t,cell);
 }
 const bars=[];
 for(let t=Math.floor(start/step)*step;t<end;t+=step){
  const x=buckets.get(t);
  if(!x) {
   // Even a fully paginated index cannot certify the still-open interval is empty.
   const knownEmpty=complete && t+step<=observedThrough;
   bars.push({t:t*1000,buyUsd:knownEmpty?0:null,sellUsd:knownEmpty?0:null,totalUsd:knownEmpty?0:null,
    netUsd:knownEmpty?0:null,trades:knownEmpty?0:null,observed:false});
   continue;
  }
  const buy=+x.buy.toFixed(6),sell=+x.sell.toFixed(6);
  bars.push({t:t*1000,buyUsd:buy,sellUsd:sell,totalUsd:+(buy+sell).toFixed(6),
    netUsd:+(buy-sell).toFixed(6),trades:x.buyTrades+x.sellTrades,observed:true});
 }
 const buyUsd=bars.reduce((a,x)=>a+(x.buyUsd||0),0);
 const sellUsd=bars.reduce((a,x)=>a+(x.sellUsd||0),0);
 return {schema:"senda.volume.solscan.v1",mint,source:"Solscan Pro token DeFi swaps",
  unit:"USDC notional (~USD)",basis:"direct/aggregate token↔USDC router only",
  direction:"inferred from Solscan router token1→token2",
  interval:tf,from:start,to:end,observedAt:observedAt||new Date().toISOString(),
  complete,coverage:complete?"full-pages-in-window":"sampled-most-recent-only",
  pricedSwaps:priced,unpricedSwaps:unpriced,totalSwapsObserved:grouped.size,
  buyUsd:+buyUsd.toFixed(6),sellUsd:+sellUsd.toFixed(6),
  observedUsd:+(buyUsd+sellUsd).toFixed(6),bars,
  note:complete?"Indexed swaps in the requested time range; ingestion lag is possible. Direct USDC pairs only.":
   "Partial indexed swap sample (pagination cap). Totals are lower-bound observations, and absent bars are unknown."};
}
