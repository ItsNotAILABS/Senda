import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {PublicKey} from "@solana/web3.js";
import {readAgentTreasuryAccount} from "./agent-account-read.mjs";
import {createTreasuryClient,LOCALNET_PROGRAM_ID} from "./chain-client.mjs";
const key=n=>new PublicKey(new Uint8Array(32).fill(n));
const network="localnet",programId=LOCALNET_PROGRAM_ID,verifiedProgramId=LOCALNET_PROGRAM_ID,
 expectedGenesisHash="genesis-locked-to-localnet-for-testing";
const owner=key(3),mint=key(4),agent=key(5),beneficiary=key(6);
const args={network,programId,verifiedProgramId,expectedGenesisHash,owner,mint,seedId:4n};
const client=createTreasuryClient({network,programId,verifiedProgramId});
const ids=client.derive(owner,mint,4n);
function bytes(){
 const u64=x=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(x));return b;};
 const i64=x=>{const b=Buffer.alloc(8);b.writeBigInt64LE(BigInt(x));return b;};
 return Buffer.concat([createHash("sha256").update("account:Treasury").digest().subarray(0,8),
  Buffer.from([2,ids.bump]),u64(4),owner.toBuffer(),mint.toBuffer(),
  beneficiary.toBuffer(),agent.toBuffer(),Buffer.from([0]),
  u64(100),u64(200),u64(1000),u64(50),u64(125),
  i64(2000000000),i64(4000000000),u64(3),Buffer.from([0,0])]);
}
function conn(overrides={}){
 const parsed={value:{owner:new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
  data:{program:"spl-token",parsed:{info:{owner:ids.treasury.toBase58(),
   mint:mint.toBase58(),tokenAmount:{amount:"150",decimals:6}}}}}};
 return {getGenesisHash:async()=>expectedGenesisHash,
  getAccountInfo:async()=>({owner:new PublicKey(programId),data:bytes()}),
  getParsedAccountInfo:async()=>parsed,getSlot:async()=>1234,...overrides};
}
test("read verified on-chain balance and caps without authority or floating point conversion",async()=>{
 const x=await readAgentTreasuryAccount({...args,connection:conn()});
 assert.equal(x.status,"observed");assert.equal(x.balanceMinor,"150");
 assert.equal(x.dailyCapMinor,"200");assert.equal(x.nextNonce,"3");
 assert.equal(x.canSpend,false);assert.equal(x.execution,"disabled");assert.equal(x.slot,1234);
});
test("wrong network genesis fails before reading funds",async()=>{
 await assert.rejects(()=>readAgentTreasuryAccount({...args,connection:conn({
  getGenesisHash:async()=>"other-chain-identity-is-not-allowed"})}),/genesis/);
});
test("fake treasury program owner and wrong vault token owner fail closed",async()=>{
 await assert.rejects(()=>readAgentTreasuryAccount({...args,connection:conn({
  getAccountInfo:async()=>({owner:key(9),data:bytes()})})}),/program owner/);
 await assert.rejects(()=>readAgentTreasuryAccount({...args,connection:conn({
  getParsedAccountInfo:async()=>({value:{owner:key(9),data:{}}})})}),/token owner/);
});
test("absent treasury returns uncreated, never a fabricated zero balance",async()=>{
 const x=await readAgentTreasuryAccount({...args,connection:conn({getAccountInfo:async()=>null})});
 assert.equal(x.status,"not-created");assert.equal(x.amountMinor,null);assert.equal(x.canSpend,false);
});
