/** Read-only Kalshi quote-depth planner. Public venue book != a Phantom/Senda executable order. */
const tickerPattern=/^[A-Z0-9][A-Z0-9._-]{2,119}$/;
const fixed4=(value)=>{
 if(typeof value!=="string"||!/^0(?:\.\d{1,4})?$|^1(?:\.0{1,4})?$/.test(value))return null;
 const [whole,fraction=""]=value.split(".");
 const n=Number(whole)*10000+Number(fraction.padEnd(4,"0"));
 return n>=0&&n<=10000?n:null;
};
function qty(v){
 if(typeof v!=="string"||!/^\d{1,8}(?:\.\d{1,2})?$/.test(v))return null;
 const n=Number(v);return n>0&&Number.isFinite(n)?Math.round(n*100)/100:null;
}
export function normalizeEventBook(ticker,raw,asOf=Date.now()){
 if(!tickerPattern.test(ticker))throw Error("Invalid market ticker");
 const input=raw?.orderbook_fp;
 const levels=(key)=>{
  const rows=input?.[key];if(!Array.isArray(rows))return [];
  return rows.slice(0,250).flatMap(row=>{
   if(!Array.isArray(row)||row.length<2)return [];
   const bid=fixed4(row[0]),size=qty(row[1]);
   return bid!=null&&bid>0&&bid<10000&&size!=null?[{bid,size}]:[];
  }).sort((a,b)=>b.bid-a.bid);
 };
 return {ticker,asOf,source:"Kalshi public orderbook",yesBids:levels("yes_dollars"),noBids:levels("no_dollars"),unit:"USD per event contract",quoteOnly:true};
}
export function planEventSide(book,side,contracts,now=Date.now()){
 if(!book||!tickerPattern.test(book.ticker)||!["yes","no"].includes(side)||!Number.isInteger(contracts)||contracts<1||contracts>1000)
  return {available:false,reason:"Valid ticker, outcome and 1–1000 whole contracts required."};
 if(!Number.isFinite(book.asOf)||now<book.asOf||now-book.asOf>30000)
  return {available:false,reason:"Market depth is stale. Refresh before planning."};
 // Binary complement: NO bid at p is YES ask at (1-p), and vice versa.
 const source=side==="yes"?book.noBids:book.yesBids;
 if(!Array.isArray(source)||!source.length)
  return {available:false,reason:"No opposing-side bids for this outcome."};
 let remaining=contracts,costUnits=0,matched=0;
 for(const level of source){
  const priceUnits=10000-level.bid;
  if(!Number.isSafeInteger(priceUnits)||priceUnits<=0||priceUnits>=10000||!(level.size>0))continue;
  const take=Math.min(remaining,Math.floor(level.size));
  if(!take)continue;
  costUnits+=take*priceUnits;remaining-=take;matched+=take;
  if(!remaining)break;
 }
 if(remaining)return {available:false,reason:`Insufficient opposing bids: ${matched} of ${contracts} contracts visible.`,filled:matched,remaining};
 const gross=costUnits/10000;
 return {available:true,side,contracts,source:book.source,quotedAt:book.asOf,grossCostUsd:gross,
  avgPriceUsd:gross/contracts,maximumPayoutUsd:contracts,maximumLossBeforeFeesUsd:gross,
  maximumProfitBeforeFeesUsd:contracts-gross,
  fees:"unknown",notExecutable:true,
  reason:"Public orderbook gross-only estimate. Venue fees, timing, identity and trading permissions must be checked at order entry."};
}
export const EVENT_TEMPLATES=[
 {id:"weather",name:"Weather disruption",subject:"Rainfall, temperature, storms",product:"Trip/rain-out budget planning",caution:"Not insurance. Event payout cannot guarantee reimbursement for an individual loss."},
 {id:"shipping",name:"Supply-chain contingency",subject:"Port closure, hurricanes, weather",product:"Budget contingency research for freight or projects",caution:"Contract event may not correlate with a real delivery delay."},
 {id:"energy",name:"Energy cost stress",subject:"Power/gas price or supply events",product:"Scenario research for energy-sensitive spending",caution:"Settlement event may differ from your actual electricity or fuel bill."},
 {id:"macro",name:"Macro purchasing power",subject:"Inflation, interest rate and FX events",product:"Business budget planning and portfolio research",caution:"Not a direct FX hedge, deposit, or investment advice."},
 {id:"tech",name:"Technology milestones",subject:"AI releases, product launches and availability",product:"Procurement and demand forecast scenario planning",caution:"Event definitions and sources must be reviewed before relying on them."}
];
const EVENT_KEYWORDS={
 weather:["rain","weather","storm","temperature","snow","hurricane","tornado","flood"],
 shipping:["shipping","port","hurricane","supply","cargo","freight","canal"],
 energy:["energy","power","oil","natural gas","gasoline","electricity"],
 macro:["inflation","cpi","interest","fed","rate","gdp","currency","forex"],
 tech:["ai","artificial intelligence","technology","launch","software","chip","device"]
};
export function eventTemplateFit(templateId,title="",category=""){
 const words=EVENT_KEYWORDS[templateId];
 if(!words)return {matched:false,reason:"Unknown product template."};
 const text=(String(title)+" "+String(category)).toLowerCase();
 const matched=words.some(word=>text.includes(word));
 return {matched,reason:matched?"Theme match only; inspect exact market contract and settlement rules.":"No apparent theme match. Select a relevant event rather than inferring protection."};
}
export function evaluateEventProduct({templateId,book,side,contracts,budgetUsd,marketTitle="",marketCategory="",now=Date.now()}){
 const template=EVENT_TEMPLATES.find(x=>x.id===templateId);
 if(!template)return {ready:false,reason:"Unsupported event-product research template."};
 if(typeof budgetUsd!=="number"||!Number.isFinite(budgetUsd)||budgetUsd<=0||budgetUsd>100000)
  return {ready:false,reason:"A finite positive research budget is required."};
 const fit=eventTemplateFit(templateId,marketTitle,marketCategory);
 if(!fit.matched)return {ready:false,template,fit,reason:fit.reason};
 const quote=planEventSide(book,side,contracts,now);
 if(!quote.available)return {ready:false,template,quote,reason:quote.reason};
 if(quote.grossCostUsd>budgetUsd)return {ready:false,template,quote,reason:"Gross quote exceeds research budget before exchange/platform fees."};
 return {ready:true,template,quote,budgetRemainingBeforeFees:budgetUsd-quote.grossCostUsd,
  execution:"disabled",legalForm:"event-contract research only",
  reason:"Scenario can be studied. Senda has no authorized Phantom/Kalshi order execution interface."};
}
export function eventMarketUrl(ticker){
 return tickerPattern.test(ticker)?`https://kalshi.com/markets/${ticker.toLowerCase()}`:null;
}
