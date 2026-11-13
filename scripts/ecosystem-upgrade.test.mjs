import test from "node:test";
import assert from "node:assert/strict";
import {
  MAINNET_USDC, SOLANA_MAINNET_CAIP2, SOLANA_DEVNET_CAIP2,
  TOKEN_PROGRAM, TOKEN_2022_PROGRAM, validateSwapV2Preview,
  evaluateAgentPaymentRequirement, classifySolanaMintAccount, validRawAmount, deriveRoundTripSellRaw
} from "../src/lib/ecosystem-upgrade-core.mjs";
const sol="So11111111111111111111111111111111111111112";
const recipient="7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs";
const req={inputMint:sol,outputMint:MAINNET_USDC,amount:"100000000"};
const quote={transaction:null,inAmount:req.amount,outAmount:"19000000",router:"metis",mode:"ultra",feeBps:3};
test("V2 preview rejects signed transactions and mismatches",()=>{
 const r=validateSwapV2Preview(req,quote,1700000000000);
 assert.equal(r.transaction,null);assert.equal(r.canSign,false);
 assert.equal(r.router,"metis");assert.equal(r.requiresFreshOrder,true);
 for(const patch of [{transaction:"AA=="},{inAmount:"1"},{outAmount:"0"},{router:"unknown-router"},{errorCode:1},{feeBps:10001}])
  assert.throws(()=>validateSwapV2Preview(req,{...quote,...patch},1700000000000));
});
test("raw amount validation is exact integer and u64-safe",()=>{
 for(const x of ["0","-1","1e6","1.0","0001","18446744073709551616","a"])assert.equal(validRawAmount(x),false,x);
 for(const x of ["1","1000000"])assert.equal(validRawAmount(x),true,x);
});
const policy={network:SOLANA_MAINNET_CAIP2,allowedAssets:[MAINNET_USDC],allowedRecipients:[recipient],maxPerCallMinor:"100000"};
const offer={protocol:"x402-v2",scheme:"exact",network:SOLANA_MAINNET_CAIP2,asset:MAINNET_USDC,payTo:recipient,
 amount:"10000",expiresAtMs:Date.now()+30000,challengeId:"charge-12345",verifiedByProtocolSdk:true,verifiedByPolicyStore:true};
test("x402 V2 policy requires trusted SDK and still does not authorize signing",()=>{
 const r=evaluateAgentPaymentRequirement(policy,offer);
 assert.equal(r.decision,"REVIEW_REQUIRED");assert.equal(r.executionAuthorized,false);
 for(const patch of [{scheme:"upto"},{network:SOLANA_DEVNET_CAIP2},{asset:sol},{payTo:sol},{amount:"100001"},
 {verifiedByProtocolSdk:false},{verifiedByPolicyStore:false},{challengeId:"x"},{expiresAtMs:Date.now()-1000}])
   assert.equal(evaluateAgentPaymentRequirement(policy,{...offer,...patch}).decision,"DENY");
});
test("MPP charge may pass but session is not silently enabled",()=>{
 assert.equal(evaluateAgentPaymentRequirement(policy,{...offer,protocol:"mpp",intent:"charge"}).decision,"REVIEW_REQUIRED");
 assert.equal(evaluateAgentPaymentRequirement(policy,{...offer,protocol:"mpp",intent:"session"}).decision,"DENY");
});
test("Token2022 unknown extensions fail closed and hooks are exposed",()=>{
 assert.equal(classifySolanaMintAccount({owner:TOKEN_2022_PROGRAM,data:{parsed:{type:"mint",info:{decimals:6}}}}).decision,"DENY");
 const r=classifySolanaMintAccount({owner:TOKEN_2022_PROGRAM,data:{parsed:{type:"mint",info:{decimals:6,extensions:[{extension:"transferHook"}]}}}});
 assert.equal(r.requiresExtensionAwareExecution,true);assert.equal(r.transferRisks[0],"transferHook");
 const legacy=classifySolanaMintAccount({owner:TOKEN_PROGRAM,data:{parsed:{type:"mint",info:{decimals:6}}}});
 assert.equal(legacy.decision,"READ_ONLY_INSPECTED");
});

test("round-trip sell preview uses token raw units rather than USDC raw units",()=>{
 const quote={inputMint:MAINNET_USDC,outputMint:sol,inAmount:"25000000",
   outAmount:"100000000",otherAmountThreshold:"99000000"};
 assert.equal(deriveRoundTripSellRaw(quote,"25000000",sol),"100000000");
 for(const patch of [{inAmount:"100"},{outputMint:recipient},{outAmount:"0"},{otherAmountThreshold:"100000001"}])
  assert.throws(()=>deriveRoundTripSellRaw({...quote,...patch},"25000000",sol));
});
