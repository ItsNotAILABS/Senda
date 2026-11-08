import test from "node:test";import assert from "node:assert/strict";
import {USDC,parseDflowMarket,validateDflowOrder,evaluateDflowEligibility,terminalDflowStatus} from "../src/lib/dflow-prediction-core.mjs";
const ticker="KXRAIN-26NOV03-A",yes="6".repeat(44),no="7".repeat(44),wallet="8".repeat(44);
const market={ticker,status:"active",closeTime:2000000000,accounts:{[USDC]:{yesMint:yes,noMint:no}}};
const at=1800000000000;
test("market mints always originate in matching DFlow contract",()=>{
 const m=parseDflowMarket(ticker,market,at);assert.equal(m.yesMint,yes);assert.equal(m.noMint,no);
 assert.throws(()=>parseDflowMarket(ticker,{...market,ticker:"another"},at));
 assert.throws(()=>parseDflowMarket(ticker,{...market,status:"determined"},at));
});
test("missing or matching mints fail closed",()=>{
 assert.throws(()=>parseDflowMarket(ticker,{...market,accounts:{}},at));
 assert.throws(()=>parseDflowMarket(ticker,{...market,accounts:{[USDC]:{yesMint:yes,noMint:yes}}},at));
});
const raw={inputMint:USDC,outputMint:yes,inAmount:"2500000",outAmount:"2000000",minOutAmount:"1990000",executionMode:"async",transaction:"A".repeat(200),lastValidBlockHeight:22000000,priceImpactPct:"0.01"};
const input={raw,wallet,inputMint:USDC,outputMint:yes,amountRaw:"2500000",at};
test("requires exact DFlow values and a short signed quote window",()=>{
 const p=validateDflowOrder(input);
 assert.equal(p.quoteExpiry,at+15000);assert.equal(p.executionMode,"async");
 assert.throws(()=>validateDflowOrder({...input,raw:{...raw,outputMint:no}}));
 assert.throws(()=>validateDflowOrder({...input,raw:{...raw,inAmount:"2500001"}}));
 assert.throws(()=>validateDflowOrder({...input,raw:{...raw,minOutAmount:"3000000"}}));
});
test("requires proof, approved commercial access and jurisdiction",()=>{
 const base={proof:{verified:true},enabled:true,partnerApproved:true,regionApproved:true,market:parseDflowMarket(ticker,market,at)};
 assert.equal(evaluateDflowEligibility(base).ready,true);
 assert.equal(evaluateDflowEligibility({...base,proof:{verified:false}}).ready,false);
 assert.equal(evaluateDflowEligibility({...base,partnerApproved:false}).ready,false);
 assert.equal(evaluateDflowEligibility({...base,regionApproved:false}).ready,false);
});
test("only closed asynchronous orders become fills",()=>{
 assert.equal(terminalDflowStatus("open").success,false);
 assert.equal(terminalDflowStatus("pendingClose").terminal,false);
 assert.equal(terminalDflowStatus("closed").success,true);
 assert.equal(terminalDflowStatus("failed").success,false);
});

test("only reviewed DFlow programs and standard Solana instructions are permitted",async()=>{
 const {validateDflowPrograms}=await import("../src/lib/dflow-prediction-core.mjs");
 const approved=["6".repeat(44)],compute="ComputeBudget111111111111111111111111111111";
 assert.equal(validateDflowPrograms(approved,[compute,approved[0]]),true);
 assert.throws(()=>validateDflowPrograms([], [approved[0]]));
 assert.throws(()=>validateDflowPrograms(approved,["7".repeat(44),approved[0]]));
 assert.throws(()=>validateDflowPrograms(approved,[compute]));
});

test("accepts documented DFlow accounts.usdc metadata and ISO market closes",()=>{
 const asUsdc={...market,closeTime:"2034-01-01T00:00:00.000Z",accounts:{usdc:{yesMint:yes,noMint:no}}};
 const parsed=parseDflowMarket(ticker,asUsdc,at);
 assert.equal(parsed.yesMint,yes);
 assert.equal(parsed.noMint,no);
 assert.throws(()=>parseDflowMarket(ticker,{...asUsdc,closeTime:"not-a-date"},at));
});
test("refuses provider-required submission and additional signers until implemented",()=>{
 for(const patch of [
  {transactionVersion:"legacy"},
  {submitEndpointRequired:true},
  {predictionMarketInitPayerMustSign:true},
  {destinationWalletMustSign:true},
  {addressLookupTables:[{address:wallet}]}
 ])assert.throws(()=>validateDflowOrder({...input,raw:{...raw,...patch}}));
});
