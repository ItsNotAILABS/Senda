/** Kalshi public candle normalization, with null rather than fabricated market activity. */
const decimal=(x,max=Infinity)=>{
 if(typeof x!=="string"&&typeof x!=="number")return null;
 if(x===null||x===undefined||x==="")return null;
 const n=Number(x);return Number.isFinite(n)&&n>=0&&n<=max?n:null;
};
export function normalizeKalshiCandles(rows,{from=0,to=Date.now()/1000}={}){
 if(!Array.isArray(rows))throw Error("Kalshi candle response must be an array");
 const seen=new Set(),out=[];
 for(const raw of rows.slice(0,220)){
  if(!raw||typeof raw!=="object")continue;
  const t=raw.end_period_ts;
  if(!Number.isSafeInteger(t)||t<=0||t<from||t>to+86400||seen.has(t))continue;
  seen.add(t);
  const price=decimal(raw.price?.close_dollars,1);
  const volume=decimal(raw.volume_fp,1e12);
  const interest=decimal(raw.open_interest_fp,1e12);
  out.push({time:t,priceUsd:price,volumeContracts:volume,openInterestContracts:interest});
 }
 return out.sort((a,b)=>a.time-b.time).slice(-190);
}
export const HISTORY_WINDOWS=Object.freeze([
 {id:"24h",name:"24H",days:1,interval:60},
 {id:"7d",name:"7D",days:7,interval:60},
 {id:"30d",name:"30D",days:30,interval:1440}
]);
