/**
 * Senda event-market discovery labels are NAVIGATION heuristics, not Kalshi's
 * official series taxonomy or a statement of contract equivalence.
 */
export const MARKET_LANES=Object.freeze([
 {id:"all",name:"All markets",description:"Sourced public Kalshi catalog"},
 {id:"sports",name:"Sports",description:"Matchups, totals and tournaments"},
 {id:"economy",name:"Economy",description:"Inflation, interest rates, jobs"},
 {id:"crypto",name:"Crypto",description:"BTC, ETH, digital assets"},
 {id:"weather",name:"Weather",description:"Rain, storms, temperature"},
 {id:"world",name:"World",description:"Policy and global events"},
 {id:"technology",name:"Technology",description:"AI, semiconductors and launches"},
 {id:"culture",name:"Culture",description:"Entertainment and media"}
]);
const RULES=[
 ["crypto",/\b(?:bitcoin|btc|ethereum|eth|solana|sol|crypto|cryptocurrency|blockchain|memecoin)\b/i],
 ["sports",/\b(?:nfl|nba|nhl|mlb|wnba|ufc|fifa|soccer|football|basketball|baseball|hockey|tennis|goal|playoff|super bowl|championship|matchup|touchdown|world series|grand slam)\b/i],
 ["weather",/\b(?:weather|rain|rainfall|snow|storm|hurricane|tornado|temperature|fahrenheit|flood|precipitation|wind speed|heat wave)\b/i],
 ["economy",/\b(?:fed|federal reserve|interest rate|inflation|cpi|gdp|jobs report|unemployment|recession|treasury yield|economic growth|central bank|nonfarm)\b/i],
 ["technology",/\b(?:artificial intelligence|ai model|openai|anthropic|nvidia|semiconductor|chipmaker|tech launch|spacecraft|rocket|space launch)\b/i],
 ["culture",/\b(?:oscars|grammys|emmy|movie|film|music|box office|streaming|album|celebrity|television|tv show)\b/i],
 ["world",/\b(?:election|president|congress|senate|parliament|country|tariff|policy|government|war|ceasefire|geopolitic|sanction|diplomacy)\b/i]
];
export function classifyMarket(market){
 const hay=[market?.title,market?.yes,market?.category,market?.ticker].filter(x=>typeof x==="string").join(" ").slice(0,600);
 for(const [id,re] of RULES)if(re.test(hay))return id;
 return "other";
}
export function marketSpread(market){
 const b=market?.bid,a=market?.ask;
 if(typeof b!=="number"||!Number.isFinite(b)||typeof a!=="number"||!Number.isFinite(a)||b<0||a>1||b>a)return null;
 return Math.round((a-b)*10000)/100;
}
export function selectMarkets(rows,{lane="all",q="",sort="activity"}={}){
 if(!Array.isArray(rows)||!MARKET_LANES.some(x=>x.id===lane)||!["activity","closing","tight-spread"].includes(sort))
  throw Error("Invalid Kalshi discovery filter");
 const term=String(q).trim().toLowerCase().slice(0,80);
 const candidates=rows.filter(x=>x&&typeof x.ticker==="string"&&(lane==="all"||classifyMarket(x)===lane)&&
  (!term||[x.ticker,x.title,x.yes,x.event].some(v=>String(v||"").toLowerCase().includes(term))));
 return candidates.slice().sort((a,b)=>{
  if(sort==="closing"){
   const t=x=>{const n=Date.parse(x.close||"");return Number.isFinite(n)?n:Number.MAX_SAFE_INTEGER;};
   return t(a)-t(b)||(b.vol||0)-(a.vol||0);
  }
  if(sort==="tight-spread"){
   const u=marketSpread(a),v=marketSpread(b);
   return (u??Number.MAX_SAFE_INTEGER)-(v??Number.MAX_SAFE_INTEGER)||(b.vol||0)-(a.vol||0);
  }
  return (b.vol||0)-(a.vol||0)||String(a.ticker).localeCompare(String(b.ticker));
 });
}
