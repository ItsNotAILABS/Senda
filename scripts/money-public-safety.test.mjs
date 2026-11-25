// Behavioral checks: load the real wallet ledger module (as a public/production build sees it:
// no import.meta.env.MODE=development) and prove every paper money mutation refuses to run.
import test from "node:test";
import assert from "node:assert/strict";
import {createJiti} from "jiti";
import {fileURLToPath} from "node:url";
import {UNSETTLED_PAYMENT_MESSAGE} from "../src/lib/paper-money-policy.mjs";

const src=fileURLToPath(new URL("../src",import.meta.url));
const jiti=createJiti(import.meta.url,{alias:{"@":src},interopDefault:true});
const ledger=await jiti.import("../src/lib/wallet.ts");

const rich={tag:"@you",balances:{USD:1e6,EUR:1e6,GBP:1e6,MXN:1e6,USDC:1e6,SOL:1e6},contacts:[],activity:[],cards:[],links:[],notes:[],
 policies:[{id:"p1",cover:500,until:"2999-01-01T00:00:00Z"}],vaults:[{id:"v1",ccy:"USD",balance:1e5}],banks:[],payMethods:[]};
const calls={
 addMoney:w=>ledger.addMoney(w,100,"USD"),
 withdraw:w=>ledger.withdraw(w,100,"USD"),
 sendTo:w=>ledger.sendTo(w,"@friend",100,"USD","hi"),
 convert:w=>ledger.convert(w,"USD","EUR",100),
 spendCard:w=>ledger.spendCard(w,"c1",10,"Shop"),
 replaceCard:w=>ledger.replaceCard(w,"c1"),
 setCardLimit:w=>ledger.setCardLimit(w,"c1",100),
 issueCheckout:w=>ledger.issueCheckout(w,10,"Shop"),
 issueCard:w=>ledger.issueCard(w,"virtual"),
 payCover:w=>ledger.payCover(w,10,"Cover"),
 playRound:w=>ledger.playRound(w,10,20,"x"),
 playStake:w=>ledger.playStake(w,10,"x"),
 claimCover:w=>ledger.claimCover(w,"p1"),
 vaultIn:w=>ledger.vaultIn(w,"v1",10),
 vaultOut:w=>ledger.vaultOut(w,"v1",10),
 investFromVault:w=>ledger.investFromVault(w,"v1",10,"X"),
 issueNearby:w=>ledger.issueNearby(w,10,"USD"),
 claimNearby:w=>ledger.claimNearby(w,{id:"n1",from:"@other",amount:10,ccy:"USD"}),
 addPayBank:w=>ledger.addPayBank(w,"Bank","026073150","12345678"),
 addPayCard:w=>ledger.addPayCard(w,"4242424242424242","12/30","123","A Person"),
 addMaskedCard:w=>ledger.addMaskedCard(w,"4242","12/30","A Person","tok_123"),
};
test("public build: every paper money mutation returns the unsettled-payment error and changes nothing",()=>{
 for(const [name,call] of Object.entries(calls)){
  const before=structuredClone(rich);
  const out=call(rich);
  assert.deepEqual(out,{error:UNSETTLED_PAYMENT_MESSAGE},name);
  assert.deepEqual(rich,before,name+" mutated the wallet");
 }
});
test("public build: no synthetic bank receiving details are generated",()=>{
 assert.deepEqual(ledger.sendaDeposit("@alice"),{bank:"Not connected",routing:"",account:""});
});
