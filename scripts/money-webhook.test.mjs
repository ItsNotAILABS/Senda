import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {PGlite} from "@electric-sql/pglite";
import {createMoneyIntent,createSqlIntentStore} from "../src/lib/money-settlement-core.mjs";
import {handleMoneyWebhook} from "../src/lib/money-webhook.mjs";

const SECRET="w".repeat(40);
const env={SENDA_SETTLEMENT_PROVIDER:"acquirer:test",SENDA_SETTLEMENT_WEBHOOK_SECRET:SECRET};
const pg=new PGlite();
await pg.exec(readFileSync(new URL("../migrations/0010_money_intent.sql",import.meta.url),"utf8"));
const query=async(text,params)=>(await pg.query(text,params)).rows;
const getQuery=async()=>query;
const store=createSqlIntentStore(query);
const quiet={error(){},warn(){}};
const T0=Date.now()-60_000;

async function hmac(msg){
 const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return Buffer.from(await crypto.subtle.sign("HMAC",k,new TextEncoder().encode(msg))).toString("hex");
}
async function post(body,{sign=true,tamper=false,raw}={}){
 const text=raw??JSON.stringify(body),ts=Date.now();
 const headers={"content-type":"application/json","x-senda-timestamp":String(ts)};
 if(sign)headers["x-senda-signature"]=await hmac(`${ts}.${text}`);
 return new Request("http://senda.test/api/money/webhook",{method:"POST",headers,body:tamper?text.replace("2500","9999"):text});
}
let n=0;
const ev=(transferId,next,extra={})=>({id:`evt:${String(++n).padStart(6,"0")}`,transferId,next,occurredAt:T0+n,reference:`ref:${String(n).padStart(6,"0")}`,amountCents:2500,...extra});

test("SQL intent store: create, get, compare-and-set with version check",async()=>{
 const i=createMoneyIntent({id:"transfer:store001",source:"card-token:abc12345",recipient:"wallet:abcdef12",amountCents:2500,createdAt:T0});
 await store.create(i);
 await assert.rejects(store.create(i),/exists/);
 assert.deepEqual(await store.get(i.id),i);
 assert.equal(await store.get("transfer:missing0"),null);
 const next={...i,status:"funding-pending",version:1};
 assert.equal(await store.compareAndSet(i.id,0,next),true);
 assert.equal(await store.compareAndSet(i.id,0,{...next,version:1}),false,"stale writer loses");
 assert.equal(await store.compareAndSet(i.id,1,{...next,version:3}),false,"version must advance by one");
 assert.equal((await store.get(i.id)).status,"funding-pending");
});

test("webhook route is fail-closed when not configured",async()=>{
 const res=await handleMoneyWebhook(await post(ev("transfer:x0000001","funding-pending")),{env:{},getQuery,log:quiet});
 assert.equal(res.status,503);
 const weak=await handleMoneyWebhook(await post(ev("transfer:x0000001","funding-pending")),{env:{...env,SENDA_SETTLEMENT_WEBHOOK_SECRET:"short"},getQuery,log:quiet});
 assert.equal(weak.status,503);
 const get=await handleMoneyWebhook(new Request("http://senda.test/api/money/webhook"),{env,getQuery,log:quiet});
 assert.equal(get.status,405);
});

test("webhook verifies the raw body, then advances the stored intent once",async()=>{
 const id="transfer:hook0001";
 await store.create(createMoneyIntent({id,source:"card-token:abc12345",recipient:"wallet:abcdef12",amountCents:2500,createdAt:T0}));
 const unsigned=await handleMoneyWebhook(await post(ev(id,"funding-pending"),{sign:false}),{env,getQuery,log:quiet});
 assert.equal(unsigned.status,401);
 const tampered=await handleMoneyWebhook(await post(ev(id,"funding-pending"),{tamper:true}),{env,getQuery,log:quiet});
 assert.equal(tampered.status,401);
 assert.equal((await store.get(id)).status,"created");

 const event=ev(id,"funding-pending");
 const ok=await handleMoneyWebhook(await post(event),{env,getQuery,log:quiet});
 assert.equal(ok.status,200);
 const body=await ok.json();
 assert.equal(body.outcome,"applied");assert.equal(body.state,"funding-pending");assert.equal(body.delivered,false);
 const replay=await handleMoneyWebhook(await post(event),{env,getQuery,log:quiet});
 assert.equal((await replay.json()).outcome,"duplicate");
 assert.equal((await store.get(id)).version,1);

 const wrongAmount=await handleMoneyWebhook(await post(ev(id,"authorized",{amountCents:1})),{env,getQuery,log:quiet});
 assert.equal(wrongAmount.status,422);
 const unknown=await handleMoneyWebhook(await post(ev("transfer:nope0001","funding-pending")),{env,getQuery,log:quiet});
 assert.equal(unknown.status,404);
 const notJson=await handleMoneyWebhook(await post(null,{raw:"not json"}),{env,getQuery,log:quiet});
 assert.equal(notJson.status,422);
});

test("database outage is a retryable 503, not a 200",async()=>{
 const res=await handleMoneyWebhook(await post(ev("transfer:hook0001","authorized")),{env,getQuery:async()=>{throw Error("down");},log:quiet});
 assert.equal(res.status,503);
});
