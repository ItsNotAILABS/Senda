import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
import {collectVerifiedReceipts,persistVerifiedReceipts,readVerifiedReceipts,readVerifiedReceiptPage} from "../src/lib/wallet-chain-receipt-index.mjs";

const owner="B".repeat(44),other="C".repeat(44),sig="A".repeat(88),sig2="D".repeat(88);
const base=(override={})=>({owner,signature:sig,source:"solana-rpc",network:"mainnet-beta",
 status:"confirmed",slot:200,blockTime:1795770000,deltaUsdcRaw:"-1000000",
 observedAt:1795770021000,...override});
async function makeDb(){
 const db=new PGlite();
 await db.exec(await readFile(new URL("../migrations/0011_wallet_chain_receipt.sql",import.meta.url),"utf8"));
 return {db,query:async(sql,args)=> (await db.query(sql,args)).rows};
}
test("only chain-derived confirmed/finalized evidence is durable",()=>{
 const rows=collectVerifiedReceipts([base(),base({signature:sig2,status:"finalized"}),
  base({signature:"E".repeat(88),status:"pending"}),
  base({signature:"F".repeat(88),source:"local-recovery-journal"}),
  base({owner:other,signature:"G".repeat(88)}),base({signature:"H".repeat(88),status:"failed",deltaUsdcRaw:"900"})],owner);
 assert.equal(rows.length,2);
 assert.deepEqual(rows.map(x=>x.signature),[sig,sig2]);
});
test("persist and page exact public receipts; no spoofed local claims",async()=>{
 const {db,query}=await makeDb();
 try{
  const first=await persistVerifiedReceipts(query,[base(),base({signature:sig2,slot:180,status:"finalized",deltaUsdcRaw:"300000"})],owner);
  assert.equal(first.stored,2);
  assert.equal(first.execution,"disabled");
  const page=await readVerifiedReceipts(query,{owner,limit:1});
  assert.equal(page.length,1);assert.equal(page[0].signature,sig);
  const older=await readVerifiedReceipts(query,{owner,limit:2,olderThanSlot:200});
  assert.equal(older[0].signature,sig2);
  assert.equal(older[0].delta_usdc_raw,"300000");
  assert.deepEqual(await readVerifiedReceipts(query,{owner:other}),[]);
 }finally{await db.close()}
});
test("later finality upgrades confirmed; stale confirmed cannot downgrade finalized",async()=>{
 const {db,query}=await makeDb();
 try{
  await persistVerifiedReceipts(query,[base()],owner);
  await persistVerifiedReceipts(query,[base({status:"finalized"})],owner);
  await persistVerifiedReceipts(query,[base({status:"confirmed"})],owner);
  const p=await readVerifiedReceipts(query,{owner});
  assert.equal(p[0].status,"finalized");
  assert.equal(p[0].delta_usdc_raw,"-1000000");
 }finally{await db.close()}
});
test("failed receipts remain terminal and wallet-scoped",async()=>{
 const {db,query}=await makeDb();
 try{
  await persistVerifiedReceipts(query,[base({status:"failed",deltaUsdcRaw:null})],owner);
  const upgrade=await persistVerifiedReceipts(query,[base({status:"confirmed"})],owner);
  assert.equal(upgrade.stored,0);
  const p=await readVerifiedReceipts(query,{owner});
  assert.equal(p[0].status,"failed");
  assert.equal(p[0].delta_usdc_raw,null);
 }finally{await db.close()}
});
test("malformed evidence and conflicting signatures cannot enter the store",()=>{
 assert.throws(()=>collectVerifiedReceipts([base(),base({status:"failed",deltaUsdcRaw:null})],owner),/Conflicting/);
 assert.equal(collectVerifiedReceipts([base({deltaUsdcRaw:"0.02"}),base({status:"processing"})],owner).length,0);
 assert.throws(()=>collectVerifiedReceipts(new Array(41).fill(base()),owner),/Invalid/);
});

test("compound receipt cursor does not skip same-slot signatures or duplicate across pages",async()=>{
 const {db,query}=await makeDb();
 try{
  await persistVerifiedReceipts(query,[base({signature:sig,slot:200}),
   base({signature:sig2,slot:200,status:"finalized"}),
   base({signature:"E".repeat(88),slot:200}),
   base({signature:"F".repeat(88),slot:199})],owner);
  const seen=new Set();let cursor=null,rounds=0;
  do {
   const page=await readVerifiedReceiptPage(query,{owner,limit:1,cursor});
   assert.equal(page.rows.length,1);
   assert.ok(!seen.has(page.rows[0].signature),"cursor yielded a duplicate");
   seen.add(page.rows[0].signature);
   cursor=page.nextCursor;
   rounds++;
   assert.ok(rounds<=5,"cursor did not terminate");
  }while(cursor);
  assert.deepEqual([...seen],[sig,sig2,"E".repeat(88),"F".repeat(88)]);
 }finally{await db.close()}
});
test("empty and terminal receipt pages expose no next cursor",async()=>{
 const {db,query}=await makeDb();
 try{
  const empty=await readVerifiedReceiptPage(query,{owner,limit:2});
  assert.equal(empty.hasMore,false);assert.equal(empty.nextCursor,null);
  await persistVerifiedReceipts(query,[base()],owner);
  const only=await readVerifiedReceiptPage(query,{owner,limit:2});
  assert.equal(only.hasMore,false);assert.equal(only.nextCursor,null);
 }finally{await db.close()}
});
test("cursor validation rejects malformed, mixed and ambiguous pagination",async()=>{
 const {db,query}=await makeDb();
 try{
  await assert.rejects(readVerifiedReceiptPage(query,{owner,cursor:{slot:3,signature:"bad"}}),/Invalid/);
  await assert.rejects(readVerifiedReceiptPage(query,{owner,cursor:{slot:3,signature:sig},olderThanSlot:2}),/Invalid/);
  await assert.rejects(readVerifiedReceiptPage(query,{owner,cursor:{slot:-1,signature:sig}}),/Invalid/);
  await assert.rejects(readVerifiedReceiptPage(query,{owner,limit:51}),/Invalid/);
 }finally{await db.close()}
});
