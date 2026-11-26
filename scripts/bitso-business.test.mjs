import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {signBalance,createBitsoBalanceReader,BITSO_CAPABILITIES} from "../services/bitso-business/bitso-balance.mjs";
import {STATES,validMexicoConsent,mexicoProductionGate,advanceMexicoPayout} from "../services/bitso-business/mexico-state.mjs";

const consent={quoteId:"q",quoteExpiresAt:"2026-12-01T00:00:00Z",sourceWallet:"wallet",
 sourceMint:"mint",sourceNetwork:"solana",sourceAmount:"12.35",destinationCurrency:"MXN",
 recipientFingerprint:"hashed-recipient",minimumDestinationAmount:"200",
 feeDisclosure:"fees",providerDisclosure:"Bitso",refundDisclosure:"refund terms",
 explicitUserConsent:true};
const now=Date.parse("2026-11-25T00:00:00Z");

test("Bitso HMAC matches public documented signature (read-only)",()=>{
 const nonce="1700000000000",secret="test-secret",key="test-key";
 const expected=createHmac("sha256",secret).update(nonce+"GET"+"/api/v3/balance/").digest("hex");
 assert.equal(signBalance({nonce,key,secret}),"Bitso "+key+":"+nonce+":"+expected);
 assert.throws(()=>signBalance({nonce:"oops",key,secret}),/nonce/);
});
test("only GET balance, stage host, successful envelope accepted",async()=>{
 let called=0;
 const client=createBitsoBalanceReader({key:"key",secret:"secret",nonceFactory:()=>1700000000000,
  fetchImpl:async(url,opts)=>{
   called++;
   assert.equal(url,"https://stage.bitso.com/api/v3/balance/");
   assert.equal(opts.method,"GET");
   assert.match(opts.headers.Authorization,/^Bitso key:/);
   assert.equal(opts.redirect,"error");
   return {ok:true,json:async()=>({success:true,payload:{balances:[{currency:"mxn",available:"0"}]}})};
  }
 });
 assert.equal((await client.getBalance())[0].currency,"mxn");
 assert.equal(called,1);
 assert.equal(client.sendMoney,undefined);
 assert.equal(BITSO_CAPABILITIES.speiPayout,"not-connected");
});
test("unsafe environment, transport response and missing nonce source fail closed",async()=>{
 assert.throws(()=>createBitsoBalanceReader({environment:"https://evil.com"}));
 assert.throws(()=>createBitsoBalanceReader({key:"k",secret:"s"}),/nonce/);
 const client=createBitsoBalanceReader({key:"k",secret:"s",nonceFactory:()=>1,
  fetchImpl:async()=>({ok:false,status:403})});
 await assert.rejects(client.getBalance(),/403/);
});
test("consent must include accurate recipient and unexpired quote",()=>{
 assert.equal(validMexicoConsent(consent,now),true);
 assert.equal(validMexicoConsent({...consent,explicitUserConsent:false},now),false);
 assert.equal(validMexicoConsent({...consent,quoteExpiresAt:"2026-11-01T00:00:00Z"},now),false);
 assert.equal(validMexicoConsent({...consent,sourceNetwork:"ethereum"},now),false);
 assert.equal(validMexicoConsent({...consent,recipientFingerprint:""},now),false);
});
test("no payout enablement or settlement without verified evidence",()=>{
 assert.equal(mexicoProductionGate().enabled,false);
 assert.ok(mexicoProductionGate().missing.includes("livePayoutSettled"));
 assert.ok(STATES.includes("payout_processing"));
 assert.throws(()=>advanceMexicoPayout("quote_requested","payout_settled"),/Invalid/);
 assert.throws(()=>advanceMexicoPayout("quote_received","user_approved",{now}),/consent/);
 assert.equal(advanceMexicoPayout("quote_received","user_approved",{consent,now}).status,"user_approved");
 const evidence={providerId:"payout-1",verifiedBy:"authenticated-provider-query",
  settlementId:"spei-receipt",beneficiaryMatches:true};
 assert.throws(()=>advanceMexicoPayout("payout_processing","payout_settled",{evidence}),/activated/);
 assert.throws(()=>advanceMexicoPayout("payout_processing","payout_settled",{
  providerEnabled:true,evidence:{...evidence,beneficiaryMatches:false}
 }),/beneficiary/);
 assert.equal(advanceMexicoPayout("payout_processing","payout_settled",{providerEnabled:true,evidence}).status,"payout_settled");
});