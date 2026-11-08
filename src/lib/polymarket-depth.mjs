/** Polymarket public CLOB token-level depth. Research-only; actual orders need approved auth. */
const TOKEN=/^[0-9]{20,100}$/;
function decimal(value,maxDecimals=6){
 if(typeof value!=="string"||!/^(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,6})?$/.test(value))return null;
 const n=Number(value);
 return Number.isFinite(n)&&n>=0?n:null;
}
export function normalizePolymarketDepth(tokenId,raw,readAt=Date.now()){
 if(!TOKEN.test(tokenId)||!raw||typeof raw!=="object"||String(raw.asset_id)!==tokenId)
  throw Error("Polymarket book and chosen outcome token mismatch");
 const levels=kind=>{
  const input=raw[kind];
  if(!Array.isArray(input))return [];
  return input.slice(0,200).flatMap(x=>{
   const price=decimal(x?.price),size=decimal(x?.size);
   return price!=null&&price>0&&price<1&&size!=null&&size>0?[{price,size}]:[];
  }).sort((a,b)=>kind==="asks"?a.price-b.price:b.price-a.price);
 };
 const bids=levels("bids"),asks=levels("asks");
 const exchangeAt=Number(raw.timestamp);
 return {tokenId,source:"Polymarket public CLOB",asOf:readAt,exchangeAt:Number.isFinite(exchangeAt)?exchangeAt:null,
  bids,asks,bestBid:bids[0]?.price??null,bestAsk:asks[0]?.price??null,quoteOnly:true};
}
export function planPolymarketBuy(book,shares,at=Date.now()){
 if(!book||!TOKEN.test(book.tokenId)||!Number.isInteger(shares)||shares<=0||shares>1000)
  return {available:false,reason:"Select a sourced outcome token and 1–1000 whole shares."};
 if(!Number.isSafeInteger(book.asOf)||at<book.asOf||at-book.asOf>30000)
  return {available:false,reason:"Polymarket depth is stale. Refresh before research."};
 const venueAt=Number(book.exchangeAt);
 const venueMs=venueAt<1e12?venueAt*1000:venueAt;
 if(!Number.isSafeInteger(venueAt)||venueAt<=0||venueMs>at+5000||at-venueMs>60000)
  return {available:false,reason:"Venue timestamp is missing or stale; do not use this order book for a cost estimate."};
 if(!Array.isArray(book.asks)||!book.asks.length)
  return {available:false,reason:"No observed sell orders for this outcome token."};
 let remaining=shares,filled=0,cost=0;
 for(const level of book.asks){
  if(!Number.isFinite(level.price)||level.price<=0||level.price>=1||!Number.isFinite(level.size)||level.size<=0)continue;
  const take=Math.min(remaining,level.size);
  cost+=take*level.price;filled+=take;remaining-=take;
  if(remaining<1e-9)break;
 }
 if(remaining>1e-9)return {available:false,reason:"Insufficient CLOB asks for the requested amount.",filled,remaining};
 return {available:true,shares,grossCostUsd:Math.round(cost*1000000)/1000000,
  averagePriceUsd:Math.round(cost/shares*1000000)/1000000,quotedAt:book.asOf,
  maxBinaryPayoutUsd:shares,fees:"unknown",notExecutable:true,
  reason:"Public CLOB gross depth estimate; exchange fees and execution are not authorized."};
}
