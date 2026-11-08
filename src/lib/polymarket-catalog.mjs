/** Polymarket Gamma catalog discovery: public data only, no CLOB order authentication. */
const ID=/^[0-9]{1,32}$/;
const slug=/^[a-z0-9][a-z0-9-]{1,180}$/;
const list=(v)=>{
 try{const x=typeof v==="string"?JSON.parse(v):v;return Array.isArray(x)?x:[];}catch{return [];}
};
const finite=(x)=>{const n=Number(x);return Number.isFinite(n)&&n>=0?n:null};
export function normalizePolymarketCatalog(raw,asOf=Date.now()){
 if(!Array.isArray(raw))throw Error("Polymarket Gamma catalog is not an array");
 const out=[];
 for(const row of raw.slice(0,100)){
  if(!row||typeof row!=="object"||!ID.test(String(row.id||""))||
     typeof row.question!=="string"||row.question.trim().length<8)continue;
  if(row.closed===true||row.active===false)continue;
  const outcomes=list(row.outcomes).filter(v=>typeof v==="string"&&v.trim());
  const prices=list(row.outcomePrices).map(v=>{const n=Number(v);return Number.isFinite(n)&&n>=0&&n<=1?n:null;});
  const tokens=list(row.clobTokenIds).map(v=>String(v));
  const urlslug=String(row.slug||"");
  if(!slug.test(urlslug)||outcomes.length<2||prices.length!==outcomes.length)continue;
  out.push({
   venueId:"polymarket",marketId:String(row.id),title:row.question.trim(),slug:urlslug,
   category:"Polymarket",outcomes,indicativePrices:prices,
   tokenIds:tokens.length===outcomes.length?tokens:[],
   volumeUsd:finite(row.volumeNum??row.volume),liquidityUsd:finite(row.liquidityNum??row.liquidity),
   closesAt:typeof row.endDate==="string"?row.endDate:null,
   status:"open",dataQuality:"catalog-indicative-only",readAt:asOf,
   source:"Polymarket Gamma public API",notExecutable:true
  });
 }
 return out;
}
export function polymarketMarketUrl(market){
 if(!market||typeof market.slug!=="string"||!slug.test(market.slug))return null;
 return "https://polymarket.com/event/"+market.slug;
}
