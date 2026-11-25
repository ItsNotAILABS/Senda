import test from "node:test";import assert from "node:assert/strict";
import {createMoneyIntent,recordProviderTransition,verifyProviderWebhook,createHmacWebhookVerifier,applyProviderWebhook,
 createMemoryIntentStore,canDisplayDelivered,publicMoneyState} from "../src/lib/money-settlement-core.mjs";

const SECRET="s".repeat(40);
const T0=Date.now()-60_000;
const verifier=createHmacWebhookVerifier({provider:"acquirer:test",secret:SECRET});
const hmac=async(msg)=>{const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return Buffer.from(await crypto.subtle.sign("HMAC",k,new TextEncoder().encode(msg))).toString("hex");};
async function signed(body,{secret}={}){
 const raw=JSON.stringify(body),ts=Date.now();
 let sig=await hmac(`${ts}.${raw}`);
 if(secret==="wrong")sig=sig.replace(/^./,c=>c==="0"?"1":"0");
 return {rawBody:raw,headers:{"x-senda-timestamp":String(ts),"x-senda-signature":sig}};
}
const intentInput={id:"transfer:000001",source:"card-token:abc12345",recipient:"wallet:abcdef12",amountCents:2500,createdAt:T0};
let n=0;
const ev=(next,extra={})=>({id:`evt:${String(++n).padStart(6,"0")}`,transferId:"transfer:000001",next,occurredAt:T0+n,reference:`ref:${String(n).padStart(6,"0")}`,...extra});
async function verified(body){const s=await signed(body);return verifyProviderWebhook(s.rawBody,s.headers,verifier);}
async function run(intent,next,extra){return recordProviderTransition(intent,await verified(ev(next,extra))).intent;}

test("unverified objects and a caller-asserted flag can no longer move money",async()=>{
 const i=createMoneyIntent(intentInput);
 assert.throws(()=>recordProviderTransition(i,ev("funding-pending")),/verified provider webhooks/);
 const copied={...(await verified(ev("funding-pending")))};
 assert.throws(()=>recordProviderTransition(i,copied),/verified provider webhooks/);
 const bad=await signed(ev("funding-pending"),{secret:"wrong"});
 await assert.rejects(verifyProviderWebhook(bad.rawBody,bad.headers,verifier),/did not verify/);
 const good=await signed(ev("funding-pending"));
 await assert.rejects(verifyProviderWebhook(good.rawBody.replace("2500","9999")+" ",good.headers,verifier),/did not verify/);
 const stale={...good.headers,"x-senda-timestamp":String(Date.now()-10*60_000)};
 await assert.rejects(verifyProviderWebhook(good.rawBody,stale,verifier),/did not verify/);
});

test("provider identity comes from the verifier, not the payload",async()=>{
 const e=await verified(ev("funding-pending",{provider:"attacker:spoofed"}));
 assert.equal(e.provider,"acquirer:test");
});

test("same-currency: card -> settled -> payout -> delivered; conversion step rejected",async()=>{
 let i=createMoneyIntent(intentInput);
 for(const s of ["funding-pending","authorized","settled"])i=await run(i,s);
 assert.throws(()=>recordProviderTransition(i,null));
 await assert.rejects(async()=>recordProviderTransition(i,await verified(ev("conversion-pending"))),/Illegal/);
 i=await run(i,"payout-pending");i=await run(i,"delivered");
 assert.equal(canDisplayDelivered(i),true);
 assert.equal(i.terminal,false);assert.equal(i.reversible,true);
 i=await run(i,"reversed");
 assert.equal(i.terminal,true);assert.equal(publicMoneyState(i).delivered,false);
});

test("cross-currency must convert before payout",async()=>{
 let i=createMoneyIntent({...intentInput,destinationCurrency:"USDC"});
 for(const s of ["funding-pending","authorized","settled"])i=await run(i,s);
 const early=recordProviderTransition(i,await verified(ev("payout-pending")));
 assert.equal(early.outcome,"held"); // payout-pending is reachable only via conversion
 i=early.intent;
 i=await run(i,"conversion-pending");
 assert.equal(i.status,"conversion-pending");
 i=await run(i,"converted");
 assert.equal(i.status,"payout-pending","held payout drained once conversion completed");
 assert.equal(i.held.length,0);
});

test("exact replay is idempotent; conflicting replay of the same id is rejected",async()=>{
 let i=createMoneyIntent(intentInput);
 const body=ev("funding-pending");
 const first=await verified(body);
 i=recordProviderTransition(i,first).intent;
 const again=recordProviderTransition(i,await verified(body));
 assert.equal(again.outcome,"duplicate");assert.equal(again.intent,i);
 await assert.rejects(async()=>recordProviderTransition(i,await verified({...body,next:"cancelled"})),/Conflicting replay/);
 await assert.rejects(async()=>recordProviderTransition(i,await verified({...body,reference:"ref:forged001"})),/Conflicting replay/);
});

test("out-of-order events are held then applied; late events are stale, not errors",async()=>{
 let i=createMoneyIntent(intentInput);
 i=await run(i,"funding-pending");
 const settledEarly=recordProviderTransition(i,await verified(ev("settled")));
 assert.equal(settledEarly.outcome,"held");assert.equal(settledEarly.intent.status,"funding-pending");
 i=await run(settledEarly.intent,"authorized");
 assert.equal(i.status,"settled");
 const late=recordProviderTransition(i,await verified(ev("funding-pending")));
 assert.equal(late.outcome,"stale");assert.equal(late.intent,i);
 await assert.rejects(async()=>recordProviderTransition(i,await verified(ev("cancelled"))),/Illegal/);
});

test("wrong transfer, wrong amount and missing settlement reference are denied",async()=>{
 const i=createMoneyIntent(intentInput);
 await assert.rejects(async()=>recordProviderTransition(i,await verified(ev("funding-pending",{transferId:"transfer:wrong001"}))),/mismatch/);
 await assert.rejects(async()=>recordProviderTransition(i,await verified(ev("funding-pending",{amountCents:2600}))),/amount/);
 let j=await run(i,"funding-pending");j=await run(j,"authorized");
 await assert.rejects(async()=>recordProviderTransition(j,await verified(ev("settled",{reference:""}))),/reference/);
});

test("store applies with optimistic version checks and retries a lost race",async()=>{
 const store=createMemoryIntentStore();
 await store.create(createMoneyIntent(intentInput));
 const s=await signed(ev("funding-pending"));
 // Simulate a concurrent writer: the first compareAndSet loses.
 let raced=false;const cas=store.compareAndSet.bind(store);
 store.compareAndSet=async(id,v,next)=>{if(!raced){raced=true;return false;}return cas(id,v,next);};
 const out=await applyProviderWebhook({store,...s,verifier});
 assert.equal(out.outcome,"applied");assert.equal((await store.get("transfer:000001")).version,1);
 assert.equal(await cas("transfer:000001",0,{...out.intent,version:1}),false,"stale version is refused");
 const dup=await applyProviderWebhook({store,...s,verifier});
 assert.equal(dup.outcome,"duplicate");assert.equal((await store.get("transfer:000001")).version,1);
});

test("invalid amount and verifier setup fail closed",()=>{
 assert.throws(()=>createMoneyIntent({...intentInput,amountCents:1.5}));
 assert.throws(()=>createHmacWebhookVerifier({provider:"acquirer:test",secret:"short"}));
});
