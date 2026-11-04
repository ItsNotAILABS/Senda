/**
 * SENDA Prediction Router v2 — venues remain distinct while the desk is unified.
 *
 * Discovery and executable eligibility are different capabilities. Phantom's U.S. Cash
 * -> Kalshi account pathway is not a DFlow Solana order; World is another venue.
 * NEVER invent a cross-venue fill, shared account, or equivalent market.
 */
export const PREDICTION_VENUES=Object.freeze([
 {id:"kalshi-public",name:"Kalshi",family:"regulated-exchange",region:"US-eligible",
  funding:"Kalshi account",settlement:"Exchange account",discovery:"public-live",
  order:"requires-separate-venue-auth",status:"research",color:"cyan",
  description:"Public market data, rules and depth. Authenticated execution is a separate integration."},
 {id:"phantom-us",name:"Phantom Predict · US",family:"kalshi-via-phantom",region:"US-eligible",
  funding:"Phantom Cash (CASH) or supported Solana tokens",settlement:"Kalshi then Phantom Cash",
  discovery:"official-mobile-app",order:"phantom-app-only",status:"handoff",color:"violet",
  description:"Phantom-native Kalshi onboarding, quotes, fees, signing and position management. Not available through a public Phantom prediction SDK."},
 {id:"dflow",name:"DFlow Outcome Tokens",family:"solana-tokenized-event",region:"approved-jurisdictions",
  funding:"Native Solana USDC",settlement:"Async CLP outcome tokens",
  discovery:"partner-gated",order:"wallet-transaction-when-approved",status:"approval-gated",color:"lime",
  description:"Venue-authenticated outcome mints and signed Solana transactions, with Proof KYC and asynchronous settlement."},
 {id:"world",name:"World Prediction Markets",family:"solana-prediction",region:"eligible-non-US",
  funding:"Supported Solana assets",settlement:"World protocol and Phantom Cash where supported",
  discovery:"official-mobile-app",order:"phantom-app-only",status:"handoff",color:"orange",
  description:"Separate non-US Phantom prediction execution; no third-party Phantom Predictions API is published."},
 {id:"polymarket",name:"Polymarket",family:"polygon-event",region:"jurisdiction-dependent",
  funding:"Supported venue collateral",settlement:"Polygon / venue-specific",
  discovery:"candidate",order:"not-configured",status:"research",color:"gray",
  description:"Independent market and collateral system. No common Kalshi order book or equivalent outcome assumed."}
]);
const VENUE_MAP=new Map(PREDICTION_VENUES.map(v=>[v.id,v]));
const MARKET=/^[A-Z0-9][A-Z0-9._-]{2,119}$/;
const ADDRESS=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const CANONICAL=/^[a-z0-9][a-z0-9:-]{2,180}$/;
export function venueById(id){return VENUE_MAP.get(id)||null;}
export function normalizePredictionListing({venueId,marketId,title,eventId="",category="",outcomes=["YES","NO"],
  sourceAt=Date.now(),status="unknown",marketKey=null}){
 const venue=venueById(venueId);
 if(!venue||typeof title!=="string"||title.trim().length<4||title.length>500 ||
  typeof marketId!=="string"||!marketId||marketId.length>200)
  throw Error("Cannot create an unsourced prediction listing.");
 if(!Number.isSafeInteger(sourceAt)||sourceAt<=0)throw Error("Market timestamp invalid.");
 if(!Array.isArray(outcomes)||outcomes.length<2||outcomes.some(x=>typeof x!=="string"||!x.trim()))throw Error("Invalid outcomes");
 if(marketKey!==null && (typeof marketKey!=="string"||!CANONICAL.test(marketKey)))throw Error("Invalid canonical market mapping");
 return Object.freeze({venueId,marketId,title:title.trim(),eventId,category,outcomes:[...outcomes],
  sourceAt,status,marketKey,source:venue.discovery,execution:venue.order,
  verifiedEquivalent:false});
}
/**
 * A collision-resistant comparison requires an explicit, externally reviewed mapping
 * of contract rule identifiers, payoff units, trigger/resolution, settlement and timing.
 * Similar titles are not sufficient.
 */
export function equivalenceGate(a,b,proof,now=Date.now()){
 if(!a||!b||a.venueId===b.venueId)return {comparable:false,reason:"Different venues are required."};
 if(!proof||proof.approved!==true||proof.marketKey!==a.marketKey||proof.marketKey!==b.marketKey||
   typeof proof.marketKey!=="string"||!CANONICAL.test(proof.marketKey))
  return {comparable:false,reason:"No human-approved, identical contract mapping."};
 if(!Array.isArray(proof.venueMarkets)||!proof.venueMarkets.some(x=>x.venueId===a.venueId&&x.marketId===a.marketId)||
    !proof.venueMarkets.some(x=>x.venueId===b.venueId&&x.marketId===b.marketId))
  return {comparable:false,reason:"Venue market identifiers were not reviewed together."};
 if(!proof.rulesHash||!/^[a-f0-9]{64}$/.test(proof.rulesHash)||proof.identicalPayoff!==true||
    proof.identicalSettlement!==true||proof.identicalCutoff!==true)
  return {comparable:false,reason:"Contracts differ or settlement proof is incomplete."};
 if(!Number.isSafeInteger(proof.verifiedAt)||proof.verifiedAt>now||now-proof.verifiedAt>24*3600_000)
  return {comparable:false,reason:"Equivalence proof is stale."};
 return {comparable:true,reason:"Explicit contract rules, payoff and settlement equivalence reviewed."};
}
export function evaluatePredictionRoute(input){
 const {venueId,side,spendUsd,marketFresh,bookDepth,feesUsd,confirmedEligible=false,
 partnerReady=false,walletConnected=false,proofVerified=false,settlementSupported=false}=input||{};
 const venue=venueById(venueId);
 if(!venue)return {ready:false,state:"unavailable",reason:"Unknown venue.",phase:"none"};
 if(!["yes","no"].includes(side)||typeof spendUsd!=="number"||!Number.isFinite(spendUsd)||spendUsd<=0)
  return {ready:false,state:"invalid-input",reason:"Select an outcome and positive spend.",phase:"quote"};
 if(!marketFresh)return {ready:false,state:"stale",reason:"Fresh market contract rules and availability must be verified.",phase:"quote"};
 if(venueId==="phantom-us"||venueId==="world")
  return {ready:false,state:"handoff",reason:"Use Phantom's supported mobile Predict flow. Senda cannot submit through its private Predictions session.",phase:"external"};
 if(venueId==="kalshi-public")return {ready:false,state:"account-required",reason:"Public Kalshi book is research-only; authenticated orders need separately authorized venue credentials.",phase:"external"};
 if(venueId==="polymarket")return {ready:false,state:"not-connected",reason:"Research candidate; authenticated CLOB API, jurisdiction and settlement not configured.",phase:"none"};
 if(!partnerReady||!confirmedEligible||!proofVerified)
  return {ready:false,state:"verification-required",reason:"DFlow production partner approval, Proof identity and jurisdiction eligibility must all pass.",phase:"identity"};
 if(!walletConnected)return {ready:false,state:"wallet-required",reason:"Connect Phantom for on-chain signature.",phase:"wallet"};
 if(!settlementSupported)return {ready:false,state:"settlement-unverified",reason:"Outcome-token and settlement/redemption support is not confirmed.",phase:"settlement"};
 if(!bookDepth||bookDepth.ok!==true||!(bookDepth.observedUsd>0)||
  !Number.isSafeInteger(bookDepth.quotedAt)||bookDepth.quotedAt>Date.now()||Date.now()-bookDepth.quotedAt>15000)
  return {ready:false,state:"no-route",reason:"No fresh executable venue quote.",phase:"quote"};
 if(typeof feesUsd!=="number"||!Number.isFinite(feesUsd)||feesUsd<0)
  return {ready:false,state:"fee-unknown",reason:"Total costs/fees must be disclosed before signing.",phase:"fee"};
 if(bookDepth.observedUsd+feesUsd>spendUsd)
  return {ready:false,state:"budget-exceeded",reason:"Quote and fees exceed approved spend.",phase:"fee"};
 return {ready:true,state:"order-review",reason:"Review the exact venue-bound order and sign with Phantom.",phase:"signature"};
}
export function predictionFundingPaths(){
 return [
  {source:"Phantom Cash",target:"Phantom US / Kalshi",mode:"account-transfer",available:"within Phantom only",
   note:"Funded Cash trades may be gasless; Kalshi account and Stripe settlement are managed in Phantom."},
  {source:"Solana USDC",target:"DFlow",mode:"wallet-transaction",available:"partner-gated",
   note:"Direct USDC-to-outcome swap requires Proof KYC, eligibility, partner credentials, verified mint and wallet signature."},
  {source:"Solana token",target:"Phantom World",mode:"mobile-only",available:"eligible regions only",
   note:"Separate protocol with its own rules and availability; not interchangeable with U.S. Kalshi."},
  {source:"Venue collateral",target:"Polymarket",mode:"separate-account",available:"research-only",
   note:"Distinct Polygon account/collateral, API and local eligibility."}
 ];
}

/** Strict future-adapter quote comparator. Never ranks indicative market probabilities. */
export function rankEquivalentPredictionQuotes({listings,quotes,proof,budgetUsd,now=Date.now()}){
 if(!Array.isArray(listings)||!Array.isArray(quotes)||!Number.isFinite(budgetUsd)||budgetUsd<=0)
  return {ready:false,reason:"No valid funded quote comparison.",ranked:[]};
 if(listings.length<2 || listings.length!==quotes.length)
  return {ready:false,reason:"At least two distinct venue contracts and their actual quotes are required.",ranked:[]};
 const anchor=listings[0];
 for(let i=1;i<listings.length;i++){
  const eq=equivalenceGate(anchor,listings[i],proof,now);
  if(!eq.comparable)return {ready:false,reason:eq.reason,ranked:[]};
 }
 const ranked=[];
 const seen=new Set();
 for(let i=0;i<listings.length;i++){
  const l=listings[i],q=quotes[i],venue=venueById(l.venueId);
  if(seen.has(l.venueId)||!venue||venue.order==="phantom-app-only"||
    venue.order==="requires-separate-venue-auth"||venue.order==="not-configured")
   return {ready:false,reason:"The selected venue does not have an authorized Senda execution adapter.",ranked:[]};
  seen.add(l.venueId);
  if(!q||q.venueId!==l.venueId||q.marketId!==l.marketId||
    !q.authorized||!q.takerBound||q.source!=="provider-executable"||
    !Number.isSafeInteger(q.quotedAt)||q.quotedAt>now||now-q.quotedAt>15000||
    !Number.isFinite(q.baseCostUsd)||q.baseCostUsd<=0||
    !Number.isFinite(q.totalFeesUsd)||q.totalFeesUsd<0||
    !Number.isFinite(q.slippageBufferUsd)||q.slippageBufferUsd<0||
    !Number.isInteger(q.contracts)||q.contracts<=0)
   return {ready:false,reason:"An execution quote is stale, unauthenticated or missing fees.",ranked:[]};
  const worstCost=q.baseCostUsd+q.totalFeesUsd+q.slippageBufferUsd;
  if(worstCost>budgetUsd)
   return {ready:false,reason:"At least one offer exceeds the authorized budget.",ranked:[]};
  ranked.push({venueId:l.venueId,marketId:l.marketId,contracts:q.contracts,
    totalWorstCaseUsd:Math.round(worstCost*10000)/10000,quotedAt:q.quotedAt});
 }
 if(new Set(ranked.map(q=>q.contracts)).size!==1)
  return {ready:false,reason:"Quote amounts are not contract-equivalent.",ranked:[]};
 ranked.sort((a,b)=>a.totalWorstCaseUsd-b.totalWorstCaseUsd);
 return {ready:true,reason:"Reviewed equivalent venue contracts, authorized quote sizes and known worst-case fees only.",ranked};
}
