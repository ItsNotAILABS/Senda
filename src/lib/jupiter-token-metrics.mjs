/** Jupiter Tokens V2 explicitly reports priceChange as percent points (1.5 = 1.5%). */
const finite=n=>typeof n==="number"&&Number.isFinite(n);
const nonnegative=n=>finite(n)&&n>=0?n:null;
export function readJupiterTokenMetrics(raw){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
 const x=raw,stats=x.stats24h&&typeof x.stats24h==="object"?x.stats24h:{};
 const price=finite(x.usdPrice)&&x.usdPrice>0?x.usdPrice:null;
 const liquidityUsd=nonnegative(x.liquidity);
 const buys=nonnegative(stats.buyVolume),sells=nonnegative(stats.sellVolume);
 const totalVolume=buys!=null&&sells!=null?buys+sells:null;
 const volume24hUsd=totalVolume!=null&&Number.isFinite(totalVolume)?totalVolume:null;
 const score=finite(x.organicScore)&&x.organicScore>=0&&x.organicScore<=100?x.organicScore:null;
 const change=finite(stats.priceChange)?stats.priceChange:null;
 const updatedAt=typeof x.updatedAt==="string"&&Number.isFinite(Date.parse(x.updatedAt))?x.updatedAt:null;
 return {priceUsd:price,liquidityUsd,volume24hUsd,organicScore:score,priceChangePct:change,
  verified:x.isVerified===true,updatedAt};
}
