/** Exact raw-unit analysis for quote-size curves. Never infer liquidity from market cap or fake books. */
const validRaw=(x)=>typeof x==="string"&&/^[1-9][0-9]*$/.test(x)&&x.length<80;
export function rawToUi(raw,decimals){
 if(!validRaw(raw)||!Number.isInteger(decimals)||decimals<0||decimals>18)return null;
 const n=BigInt(raw),scale=10n**BigInt(decimals);
 const integer=n/scale,frac=n%scale;
 const digits=decimals>0?String(frac).padStart(decimals,"0").replace(/0+$/,""):"";
 return String(integer)+(digits?"."+digits:"");
}
export function describeCurve(sizes,decimals){
 if(!Array.isArray(sizes))return [];
 const mapped=sizes.map(row=>{
  const raw=row?.quote?.outAmount;
  const output=rawToUi(raw,decimals);
  const num=output==null?null:Number(output);
  const usd=row?.usd;
  const usdPerToken=num!=null&&Number.isFinite(num)&&num>0&&Number.isFinite(usd)&&usd>0?usd/num:null;
  return {usd,status:row?.status==="available"&&usdPerToken!=null?"available":"unavailable",
   tokens:output,usdPerToken,router:row?.quote?.router??null,feeBps:row?.quote?.feeBps??null,
   reason:row?.reason??null};
 });
 const first=mapped.find(x=>x.status==="available");
 return mapped.map(row=>({...row,executionPremiumPct:row.usdPerToken!=null&&first?.usdPerToken!=null?
  (row.usdPerToken/first.usdPerToken-1)*100:null}));
}
export function curveCoverage(rows){
 const n=Array.isArray(rows)?rows:[];
 const actual=n.filter(x=>x.status==="available"&&x.quote&&validRaw(x.quote.outAmount));
 return {available:actual.length,total:n.length,maxQuotedUsd:actual.reduce((a,b)=>Math.max(a,b.usd),0),
  hasRoutableSize:actual.length>0};
}
