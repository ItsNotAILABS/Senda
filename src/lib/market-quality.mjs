/** Deterministic market-quality evaluator. Read-only and evidence-gated; never an order. */
const finite=n=>typeof n==="number"&&Number.isFinite(n);
export const TIMEFRAME_MS=Object.freeze({"15m":900000,"1H":3600000,"4H":14400000,"1D":86400000});
export const MIN_BARS=30;
export function cleanMarketBars(value){
 if(!Array.isArray(value))return [];
 const seen=new Map();
 for(const b of value){
  if(!b||![b.t,b.o,b.h,b.l,b.c,b.v].every(finite)||b.t<=0||b.o<=0||b.c<=0||
     b.h<Math.max(b.o,b.c)||b.l>Math.min(b.o,b.c)||b.l<=0||b.v<0)continue;
  seen.set(b.t,{t:b.t,o:b.o,h:b.h,l:b.l,c:b.c,v:b.v});
 }
 return [...seen.values()].sort((a,b)=>a.t-b.t).slice(-500);
}
function mean(xs){return xs.reduce((a,b)=>a+b,0)/xs.length;}
function exponential(values,n){
 if(values.length<n)return null;
 let v=mean(values.slice(0,n)),k=2/(n+1);
 for(let i=n;i<values.length;i++)v=values[i]*k+v*(1-k);
 return v;
}
function calcRsi(values,n=14){
 if(values.length<=n)return null;
 let g=0,l=0;
 for(let i=1;i<=n;i++){const d=values[i]-values[i-1];g+=Math.max(d,0);l+=Math.max(-d,0);}
 g/=n;l/=n;
 for(let i=n+1;i<values.length;i++){const d=values[i]-values[i-1];g=(g*(n-1)+Math.max(0,d))/n;l=(l*(n-1)+Math.max(0,-d))/n;}
 return l===0?(g===0?50:100):100-100/(1+g/l);
}
function calcAtr(bars,n=14){
 if(bars.length<=n)return null;
 const ranges=[];
 for(let i=1;i<bars.length;i++){const b=bars[i],prev=bars[i-1];ranges.push(Math.max(b.h-b.l,Math.abs(b.h-prev.c),Math.abs(b.l-prev.c)));}
 return mean(ranges.slice(-n));
}
export function inspectMarketQuality({bars,source,tf="1H",now=Date.now()}){
 const data=cleanMarketBars(bars);
 const last=data.at(-1);
 const interval=TIMEFRAME_MS[tf]??TIMEFRAME_MS["1H"];
 const ageMs=last?Math.max(0,now-last.t):null;
 const status= !last?"no-data":ageMs>interval*3?"stale":data.length<MIN_BARS?"insufficient":
   source!=="gecko-pool"?"price-only":
   data.slice(-21).some(b=>b.v<=0)?"volume-unverified":"verified";
 const base={status,source,tf,barCount:data.length,updatedAt:last?.t??null,ageMs,
  lastClose:last?.c??null,lastVolumeUsd:null,relativeVolume:null,vwap20:null,obv20:null,
  ema9:null,ema21:null,rsi14:null,atrPct:null,breakout:null,direction:"unknown",alignment:0,
  checks:[],recommendation:"No trade recommendation; inspect wallet quote independently."};
 if(!last||data.length<MIN_BARS)return {...base,checks:[status==="no-data"?"No historical market bars.":"Not enough valid bars for indicators."]};
 const closes=data.map(b=>b.c);
 const fast=exponential(closes,9),slow=exponential(closes,21),rsi=calcRsi(closes),atr=calcAtr(data);
 const direction=fast>slow?"bull":fast<slow?"bear":"range";
 const low=Math.min(...data.slice(-21,-1).map(x=>x.l));
 const high=Math.max(...data.slice(-21,-1).map(x=>x.h));
 const breakout=last.c>high?"up":last.c<low?"down":"none";
 const atrPct=atr/last.c*100;
 const calculated={...base,ema9:fast,ema21:slow,rsi14:rsi,atrPct,breakout,direction};
 if(status!=="verified"){
  const message=status==="stale"?"Historical feed is stale; indicators are descriptive only.":
    status==="price-only"?"This source has no verified traded volume.":status==="volume-unverified"?
      "The pool returned missing or zero bar volume.":"Only historical price indicators available.";
  return {...calculated,checks:[message],alignment:0};
 }
 const last21=data.slice(-21),prior20=last21.slice(0,20);
 const priorMean=mean(prior20.map(x=>x.v));
 if(!(priorMean>0))return {...calculated,status:"volume-unverified",checks:["No positive historical volume baseline."]};
 const rv=last.v/priorMean;
 const last20=data.slice(-20),denom=last20.reduce((s,b)=>s+b.v,0);
 const vwap=denom>0?last20.reduce((s,b)=>s+((b.h+b.l+b.c)/3)*b.v,0)/denom:null;
 const obv=last20.reduce((s,b,i)=>i? s+(b.c>last20[i-1].c?b.v:b.c<last20[i-1].c?-b.v:0):0,0);
 const evidence=[
  {name:"Trend",pass:direction!=="range",detail:direction==="bull"?"EMA 9 above EMA 21":direction==="bear"?"EMA 9 below EMA 21":"No directional EMA separation"},
  {name:"Relative volume",pass:rv>=1.2,detail:rv.toFixed(2)+"x vs prior 20 bars"},
  {name:"Breakout",pass:breakout==="up"||breakout==="down",detail:breakout==="none"?"Inside prior 20-bar range":"Beyond previous 20-bar extreme"},
  {name:"Risk",pass:atrPct<=8,detail:"ATR "+atrPct.toFixed(2)+"% of last close"},
 ];
 const confluence=(direction==="bull"&&breakout==="up")||(direction==="bear"&&breakout==="down");
 const score=evidence.filter(x=>x.pass).length*20+(confluence?20:0);
 return {...calculated,lastVolumeUsd:last.v,relativeVolume:rv,vwap20:vwap,obv20:obv,alignment:score,
  checks:evidence, recommendation:"Research-only conditions; Jupiter quote, fees, eligibility and wallet approval are separate."};
}
export function shortlistMarkets(rows,query="",limit=60){
 const q=query.trim().toLowerCase();
 const seen=new Set();
 return (Array.isArray(rows)?rows:[])
 .filter(x=>x&&typeof x.mint==="string"&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(x.mint)&&typeof x.symbol==="string"&&x.symbol.length>0)
 .filter(x=>!q||[x.symbol,x.name,x.venue].join(" ").toLowerCase().includes(q))
 .filter(x=>{if(seen.has(x.mint))return false;seen.add(x.mint);return true;})
 .sort((a,b)=>{
  const av=finite(a.changePct)?Math.abs(a.changePct): -1;
  const bv=finite(b.changePct)?Math.abs(b.changePct): -1;
  return bv-av||a.symbol.localeCompare(b.symbol);
 }).slice(0,Math.max(1,Math.min(limit,250)));
}
