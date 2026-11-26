/** Public-market evidence quality, never a trading signal or insurance recommendation. */
const dollars = units => units == null ? null : Math.round(units) / 10000;
const finite = value => typeof value === "number" && Number.isFinite(value);
const tickerPattern = /^[A-Z0-9][A-Z0-9._-]{2,119}$/;
function levels(raw) {
 if (!Array.isArray(raw)) return [];
 return raw.filter(row => row && Number.isInteger(row.bid) && row.bid > 0 &&
  row.bid < 10000 && finite(row.size) && row.size > 0)
  .sort((a,b) => b.bid - a.bid).slice(0,20);
}
const two = n => Math.round(n * 100) / 100;
export function analyzeEventEvidence({detail,book,history,now=Date.now()}={}) {
 const ticker=detail?.ticker;
 if (!tickerPattern.test(ticker||"") || book?.ticker!==ticker ||
  history?.ticker!==ticker || !Number.isSafeInteger(now) || now<=0)
  throw Object.assign(new Error("Market evidence identifiers do not match"),{status:503,code:"SOURCE_INCONSISTENT"});
 const yes=levels(book.yesBids),no=levels(book.noBids);
 const bid=yes[0]?.bid??null,ask=no[0]?10000-no[0].bid:null;
 const bestNo=no[0]?.bid??null;
 const spread=bid!=null && ask!=null ? (ask-bid)/10000:null;
 const bookAgeMs=finite(book.asOf)?now-book.asOf:null;
 const flags=[];
 if (detail.status!=="active" && detail.status!=="open")flags.push("MARKET_NOT_ACTIVE");
 const closeAt=detail.closeTime?Date.parse(detail.closeTime):null;
 if (!finite(closeAt))flags.push("UNVERIFIED_CLOSE_TIME");
 if (finite(closeAt) && closeAt<=now)flags.push("MARKET_CLOSE_PASSED");
 if (bookAgeMs===null || bookAgeMs<0 || bookAgeMs>30000)flags.push("BOOK_NOT_FRESH");
 if (bid==null || ask==null)flags.push("INCOMPLETE_TWO_SIDED_BOOK");
 if (spread!==null && spread<0)flags.push("CROSSED_OR_INCONSISTENT_BOOK");
 if (!detail.rulesPrimary)flags.push("RULES_UNAVAILABLE");
 if (!Array.isArray(history?.bars))flags.push("HISTORY_UNAVAILABLE");
 const bars=Array.isArray(history?.bars)?
  history.bars.filter(x=>Number.isSafeInteger(x.time) && x.time>0 && x.time<=Math.floor(now/1000)+60).slice(-190):[];
 const priced=bars.filter(x=>finite(x.priceUsd) && x.priceUsd>=0 && x.priceUsd<=1);
 const newest=priced.at(-1),prior=priced.length>=2?priced.at(-2):null;
 const historyAgeMs=newest?now-newest.time*1000:null;
 if (historyAgeMs===null || historyAgeMs<0 || historyAgeMs>86400000)flags.push("RECENT_PRICE_MISSING");
 const blockers=new Set(["MARKET_NOT_ACTIVE","MARKET_CLOSE_PASSED","BOOK_NOT_FRESH",
  "INCOMPLETE_TWO_SIDED_BOOK","CROSSED_OR_INCONSISTENT_BOOK","RULES_UNAVAILABLE",
  "UNVERIFIED_CLOSE_TIME","HISTORY_UNAVAILABLE","RECENT_PRICE_MISSING"]);
 const researchReady=flags.every(x=>!blockers.has(x));
 return {
  schema:"senda.events.intelligence.v1",ticker,source:"Kalshi public market/detail/book/history",
  marketStatus:detail.status,closeTime:detail.closeTime??null,
  researchReady,quality:flags.length===0?"complete":researchReady?"limited":"blocked",
  flags,observedAt:new Date(now).toISOString(),
  evidence:{
   bookObservedAt:finite(book?.asOf)?new Date(book.asOf).toISOString():null,
   bookAgeMs,historyWindow:history?.window??null,reportedVolume24hContracts:detail.volume24hContracts??null,
   rulesPresent:Boolean(detail.rulesPrimary),historyBars:bars.length
  },
  market:{
   yesBestBidUsd:dollars(bid),yesImpliedAskUsd:dollars(ask),
   noBestBidUsd:dollars(bestNo),spreadUsd:spread==null?null:Math.round(spread*10000)/10000,
   yesBidDepthContracts:two(yes.reduce((n,x)=>n+x.size,0)),
   noBidDepthContracts:two(no.reduce((n,x)=>n+x.size,0)),
   lastReportedPriceUsd:newest?.priceUsd??null,
   previousReportedPriceUsd:prior?.priceUsd??null,
   lastReportedPriceAt:newest?new Date(newest.time*1000).toISOString():null
  },
  execution:"disabled",insurance:false,probabilityForecast:null,tradeRecommendation:null,
  warning:"Research-quality status only. Public depth is not an executable quote, a bank reserve, insurance, or permission to trade."
 };
}
