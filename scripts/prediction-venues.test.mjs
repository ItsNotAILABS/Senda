import test from "node:test";import assert from "node:assert/strict";
import {PREDICTION_VENUES,normalizePredictionListing,equivalenceGate,evaluatePredictionRoute,predictionFundingPaths} from "../src/lib/prediction-venues.mjs";
const now=1800000000000;
const mk=(venueId,marketId)=>normalizePredictionListing({venueId,marketId,title:"Will Dallas receive 2 inches of rain?",marketKey:"weather:dallas:rain2in",sourceAt:now});
test("five physically separate venue identities and funding flows",()=>{
 assert.deepEqual(PREDICTION_VENUES.map(v=>v.id),["kalshi-public","phantom-us","dflow","world","polymarket"]);
 assert.equal(predictionFundingPaths().length,4);
 assert.equal(new Set(PREDICTION_VENUES.map(x=>x.id)).size,5);
});
test("same event title does not authorize cross-venue route comparison",()=>{
 const a=mk("kalshi-public","KXRAIN-ABC"),b=mk("dflow","DFLOW-ABC");
 assert.equal(equivalenceGate(a,b,null,now).comparable,false);
 assert.equal(equivalenceGate(a,b,{approved:true,marketKey:a.marketKey},now).comparable,false);
});
test("independent equivalence proof requires identical settlement, payoff and rules",()=>{
 const a=mk("kalshi-public","KXRAIN-ABC"),b=mk("dflow","DFLOW-ABC");
 const proof={approved:true,marketKey:a.marketKey,venueMarkets:[{venueId:a.venueId,marketId:a.marketId},{venueId:b.venueId,marketId:b.marketId}],
  rulesHash:"f".repeat(64),identicalPayoff:true,identicalSettlement:true,identicalCutoff:true,verifiedAt:now};
 assert.equal(equivalenceGate(a,b,proof,now).comparable,true);
 assert.equal(equivalenceGate(a,b,{...proof,identicalSettlement:false},now).comparable,false);
 assert.equal(equivalenceGate(a,b,proof,now+25*3600_000).comparable,false);
});
test("Phantom Cash Kalshi and World never impersonate DFlow execution",()=>{
 for(const venueId of ["phantom-us","world"]){
 const p=evaluatePredictionRoute({venueId,side:"yes",spendUsd:5,marketFresh:true});
 assert.equal(p.ready,false);assert.equal(p.state,"handoff");
 }
});
test("public Kalshi and Polymarket never claim executable integration",()=>{
 assert.equal(evaluatePredictionRoute({venueId:"kalshi-public",side:"yes",spendUsd:5,marketFresh:true}).ready,false);
 assert.equal(evaluatePredictionRoute({venueId:"polymarket",side:"yes",spendUsd:5,marketFresh:true}).ready,false);
});
test("DFlow requires every production execution gate",()=>{
 const base={venueId:"dflow",side:"yes",spendUsd:10,marketFresh:true,partnerReady:true,confirmedEligible:true,
 proofVerified:true,walletConnected:true,settlementSupported:true,feesUsd:0.1,bookDepth:{ok:true,observedUsd:7,quotedAt:Date.now()}};
 assert.equal(evaluatePredictionRoute(base).ready,true);
 for(const key of ["partnerReady","confirmedEligible","proofVerified","walletConnected","settlementSupported"])
  assert.equal(evaluatePredictionRoute({...base,[key]:false}).ready,false,key);
 assert.equal(evaluatePredictionRoute({...base,feesUsd:undefined}).state,"fee-unknown");
 assert.equal(evaluatePredictionRoute({...base,feesUsd:4}).state,"budget-exceeded");
});
