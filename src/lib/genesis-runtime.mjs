import { findCharacter, findAsset } from "./genesis-catalog.mjs";

/**
 * Deterministic, read-only character runtime. No keys, swaps, fees, PnL or trade authority.
 * Bonus lenses are displayed only for independently verified owned assets.
 */
function avg(xs){return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;}
function pct(a,b){return a>0&&Number.isFinite(a)&&Number.isFinite(b)?((b-a)/a)*100:null;}
export function validateCandles(input) {
  if(!Array.isArray(input))return [];
  return input.filter(b=>b&&[b.t,b.o,b.h,b.l,b.c,b.v].every(n=>typeof n==="number"&&Number.isFinite(n)) &&
    b.t>0&&b.o>0&&b.h>=Math.max(b.o,b.c)&&b.l>0&&b.l<=Math.min(b.o,b.c)&&b.v>=0)
   .sort((a,b)=>a.t-b.t).filter((b,i,all)=>i===all.length-1||b.t!==all[i+1].t);
}
export function analyzeMarket({bars,source}) {
 const ordered=validateCandles(bars);
 const closes=ordered.map(b=>b.c);
 const last=ordered.at(-1),prev=ordered.at(-2);
 const historyEnough=ordered.length>=22;
 const realVolume=source==="gecko-pool"&&historyEnough&&ordered.slice(-21).every(b=>b.v>0);
 const baseVolume=realVolume?avg(ordered.slice(-21,-1).map(b=>b.v)):null;
 const relativeVolume=baseVolume?last.v/baseVolume:null;
 const maFast=closes.length>=9?avg(closes.slice(-9)):null;
 const maSlow=closes.length>=21?avg(closes.slice(-21)):null;
 let range=null;
 if(ordered.length>=15){
  let tr=0;
  for(let i=ordered.length-14;i<ordered.length;i++){
   const b=ordered[i],p=ordered[i-1];
   tr+=Math.max(b.h-b.l,Math.abs(b.h-p.c),Math.abs(b.l-p.c));
  }
  range=last.c>0?(tr/14/last.c)*100:null;
 }
 return {
  source,sourceVerified:realVolume,barCount:ordered.length,close:last?.c??null,
  changePct:prev?pct(prev.c,last.c):null,relativeVolume,volumeUsd:realVolume?last.v:null,
  maFast,maSlow,rangePct:range,trend:maFast==null||maSlow==null?"unknown":maFast>maSlow?"up":maFast<maSlow?"down":"flat",
  sourceNote:realVolume?"USD pool candle volume; not exchange order flow":source==="gecko-pool"?
    "Insufficient real pool volume for strength assessment":"Price-only history; no reliable traded volume",
 };
}
export function resolveEntitlements(ownedIds,characterId) {
 if(!Array.isArray(ownedIds))return [];
 const matched=new Set();
 for(const id of ownedIds){
  const asset=typeof id==="string"?findAsset(id):null;
  if(asset&&asset.character===characterId)matched.add(id);
 }
 return [...matched];
}
export function runGenesisResearch(input){
 const character=findCharacter(input.characterId);
 if(!character)throw Error("Unknown character runtime.");
 const owned=resolveEntitlements(input.verifiedAssetIds,character.id);
 const configuredGear=owned.includes(character.gear);
 const configuredCode=owned.includes(character.pack);
 const m=analyzeMarket({bars:input.bars,source:input.source});
 const symbol=String(input.symbol||"MARKET").replace(/[^A-Z0-9_.-]/gi,"").slice(0,22)||"MARKET";
 const lines=[];
 const checks=[];
 if(m.barCount<22) checks.push("Less than 22 valid bars: trend evidence is limited.");
 if(!m.sourceVerified)checks.push("Volume-based strategy strength is unavailable; no order should be inferred.");
 switch(character.runtime){
  case "signals":
   lines.push(m.trend==="unknown"?"Trend is not ready.":`Fast/slow structure: ${m.trend}. ${symbol} last ${m.close?.toFixed(4)??"unknown"}.`);
   lines.push(m.relativeVolume==null?"Volume confirmation unavailable.":`Pool relative volume: ${m.relativeVolume.toFixed(2)}x the prior 20 candles.`);
   if(configuredGear)lines.push("Raven Wing lens: "+(m.relativeVolume==null?"data held":m.relativeVolume>=1.5?"unusual pool-volume acceleration":"no unusual pool-volume acceleration"));
   if(configuredCode)lines.push("Signal Matrix pack: indicators are descriptive; no forecast or order has been generated.");
   break;
  case "strategies":
   lines.push(m.trend==="unknown"?"No rule comparison without enough bars.":`Research hypotheses: trend-following ${m.trend==="up"?"aligned":"not aligned"} and mean-reversion ${m.changePct!=null&&m.changePct<0?"candidate":"not triggered"}.`);
   lines.push("A backtest with costs, held-out samples and execution quotes is required before deploying a strategy.");
   if(configuredGear)lines.push("Fox Mask: second rule comparison lens active.");
   if(configuredCode)lines.push("Strategy Lab: review checklist includes look-ahead bias, fees, spread and drawdown.");
   break;
  case "risk":
   lines.push(m.rangePct==null?"ATR volatility is unavailable.":`ATR as fraction of last price: ${m.rangePct.toFixed(2)}%.`);
   lines.push(m.rangePct!=null&&m.rangePct>8?"Elevated observed candle range; reduce proposed size before user approval.":"No risk approval can be inferred from volatility alone.");
   if(configuredGear)lines.push("Owl Eye: volume reliability and volatility warnings active.");
   if(configuredCode)lines.push("Risk Sentinel: check spending caps and wallet authorization before every submission.");
   break;
  case "macro":
   lines.push(`Single-asset candle trend: ${m.trend}.`);
   lines.push("Macro correlation and cross-market analysis require independently sourced comparative instruments; none were fabricated.");
   if(configuredGear)lines.push("Dragon Core: regime lens active, restricted to observed price history.");
   if(configuredCode)lines.push("Macro Atlas: evidence checklist for broader market regime comparisons.");
   break;
  case "orchestrator":
   lines.push("Mission: read data → validate provenance → compare hypotheses → record evidence → request human review.");
   lines.push("No delegated signing, shell access or network side effects were granted by this collectible.");
   if(configuredGear)lines.push("Orbi Core: plan includes an additional stop-on-error checkpoint.");
   if(configuredCode)lines.push("Agent Workflows: append review receipt before proposing action.");
   break;
  case "creator":
   lines.push(`Editorial brief: explain ${symbol} with data source, observed trend and uncertainty.`);
   lines.push("Generated content must distinguish observable facts from speculation.");
   if(configuredGear)lines.push("Lyra Crystal: community narrative layout unlocked.");
   if(configuredCode)lines.push("Creator Studio: evidence and disclosure checklist unlocked.");
   break;
 }
 return {
  schema:"senda.genesis.runtime.v1",characterId:character.id,runtime:character.runtime,symbol,
  mode:"read-only",data:m,lines,checks,
  entitlements:owned,enabled:{gear:configuredGear,code:configuredCode},
  receipt:{source:m.source,barCount:m.barCount,confirmedVolume:m.sourceVerified,
    walletSignatureRequiredForTrade:true,orderSubmitted:false,noSimulatedFill:true}
 };
}
