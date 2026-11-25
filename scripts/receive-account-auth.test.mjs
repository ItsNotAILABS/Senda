import test from "node:test";import assert from "node:assert/strict";
import {verifyReceiveAuthorization,receiveAuthorizationMessage,createMemoryNonceStore,createSqlNonceStore,
 fetchWithTimeout,bridgeUserError,RECEIVE_AUTH_MAX_AGE_MS} from "../src/lib/receive-account-auth.mjs";

const pair=await crypto.subtle.generateKey({name:"Ed25519"},true,["sign","verify"]);
const ownerKeyBytes=new Uint8Array(await crypto.subtle.exportKey("raw",pair.publicKey));
const owner="Owner1111111111111111111111111111111111111";
const userId="user_123";
async function proof({nonce="a".repeat(32),signedAt=Date.now(),currency="usd",signFor=userId}={}){
 const msg=new TextEncoder().encode(receiveAuthorizationMessage({owner,currency,signedAt,userId:signFor,nonce}));
 const sig=Buffer.from(await crypto.subtle.sign("Ed25519",pair.privateKey,msg)).toString("base64");
 return {owner,ownerKeyBytes,currency,signedAt,nonce,signature:sig,userId};
}

test("valid fresh proof passes once; the same signed proof cannot be replayed",async()=>{
 const nonceStore=createMemoryNonceStore();
 const p=await proof();
 assert.deepEqual(await verifyReceiveAuthorization({...p,nonceStore}),{ok:true});
 const again=await verifyReceiveAuthorization({...p,nonceStore});
 assert.equal(again.ok,false);assert.match(again.error,/already used/);
});
test("nonces expire from the store after the signature window",async()=>{
 const nonceStore=createMemoryNonceStore();const t=Date.now();
 assert.equal(await nonceStore.consume("b".repeat(32),t+1000,t),true);
 assert.equal(await nonceStore.consume("b".repeat(32),t+1000,t+500),false);
 assert.equal(await nonceStore.consume("b".repeat(32),t+5000,t+2000),true);
});
test("expired, future, wrong-user, wrong-currency and forged proofs fail without burning the nonce",async()=>{
 const nonceStore=createMemoryNonceStore();
 assert.match((await verifyReceiveAuthorization({...await proof({signedAt:Date.now()-RECEIVE_AUTH_MAX_AGE_MS-1}),nonceStore})).error,/expired/);
 assert.match((await verifyReceiveAuthorization({...await proof({signedAt:Date.now()+60_000}),nonceStore})).error,/expired/);
 assert.equal((await verifyReceiveAuthorization({...await proof({signFor:"someone_else"}),nonceStore})).ok,false);
 assert.equal((await verifyReceiveAuthorization({...await proof(),currency:"eur",nonceStore})).ok,false);
 const forged=await proof();forged.signature=Buffer.alloc(64,7).toString("base64");
 assert.equal((await verifyReceiveAuthorization({...forged,nonceStore})).ok,false);
 // None of the failures consumed the nonce, so the genuine proof still works.
 assert.deepEqual(await verifyReceiveAuthorization({...await proof(),nonceStore}),{ok:true});
});
test("a missing or failing nonce store fails closed",async()=>{
 assert.equal((await verifyReceiveAuthorization({...await proof()})).ok,false);
 const broken={consume:async()=>{throw new Error("db down")}};
 assert.equal((await verifyReceiveAuthorization({...await proof(),nonceStore:broken})).ok,false);
});
test("SQL nonce store uses insert..on conflict do nothing returning and prunes expired rows",async()=>{
 const rows=new Map();const seen=[];
 const query=async(text,params)=>{seen.push(text);
  if(text.startsWith("delete")){for(const [k,v] of rows)if(v<params[0])rows.delete(k);return [];}
  if(rows.has(params[0]))return [];rows.set(params[0],params[1]);return [{nonce:params[0]}];};
 const store=createSqlNonceStore(query);
 assert.equal(await store.consume("c".repeat(32),Date.now()+1000),true);
 assert.equal(await store.consume("c".repeat(32),Date.now()+1000),false);
 assert.ok(seen.some(t=>/on conflict \(nonce\) do nothing returning nonce/.test(t)));
});
test("Bridge calls time out and errors are sanitized",async()=>{
 const hang=(url,init)=>new Promise((_,reject)=>init.signal.addEventListener("abort",()=>reject(new Error("aborted"))));
 await assert.rejects(fetchWithTimeout("https://example.test",{}, {timeoutMs:20,fetchImpl:hang}),e=>e.name==="TimeoutError");
 for(const s of [400,401,403,404,409,422,429,500,"timeout","network"]){
  const m=bridgeUserError(s);
  assert.ok(m.length>10);assert.doesNotMatch(m,/api[-_ ]?key|customer_|bridge\.xyz/i);
 }
});
