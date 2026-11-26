import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {PublicKey} from "@solana/web3.js";
import {TOKEN_PROGRAM_ID} from "@solana/spl-token";
import {readAgentTreasuryAccount} from "./agent-account-read.mjs";
import {createTreasuryClient,LOCALNET_PROGRAM_ID} from "./chain-client.mjs";

const key=n=>new PublicKey(new Uint8Array(32).fill(n));
const network="localnet",programId=LOCALNET_PROGRAM_ID,verifiedProgramId=LOCALNET_PROGRAM_ID;
const expectedGenesisHash="genesis-locked-to-localnet-for-testing";
const owner=key(3),mint=key(4),agent=key(5),beneficiary=key(6);
const args={network,programId,verifiedProgramId,expectedGenesisHash,owner,mint,seedId:4n};
const client=createTreasuryClient({network,programId,verifiedProgramId});
const ids=client.derive(owner,mint,4n);
const u64=x=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(x));return b;};
const i64=x=>{const b=Buffer.alloc(8);b.writeBigInt64LE(BigInt(x));return b;};
function treasuryData(){
 return Buffer.concat([createHash("sha256").update("account:Treasury").digest().subarray(0,8),
  Buffer.from([2,ids.bump]),u64(4),owner.toBuffer(),mint.toBuffer(),
  beneficiary.toBuffer(),agent.toBuffer(),Buffer.from([0]),
  u64(100),u64(200),u64(1000),u64(50),u64(125),
  i64(2000000000),i64(4000000000),u64(3),Buffer.from([0,0])]);
}
function vaultData(){
 const b=Buffer.alloc(165);mint.toBuffer().copy(b,0);ids.treasury.toBuffer().copy(b,32);
 u64(150).copy(b,64);b[108]=1;return b;
}
function mintData(){const b=Buffer.alloc(82);b[44]=6;b[45]=1;return b;}
const info=(owner,data)=>({owner,data,lamports:1,executable:false,rentEpoch:0});
function conn(overrides={}){
 return {getGenesisHash:async()=>expectedGenesisHash,
  getMultipleAccountsInfoAndContext:async()=>({context:{slot:1234},value:[
   info(new PublicKey(programId),treasuryData()),
   info(TOKEN_PROGRAM_ID,vaultData()),
   info(TOKEN_PROGRAM_ID,mintData())]}),...overrides};
}
test("same-slot chain observations show exact raw treasury balance and caps, never execution",async()=>{
 const x=await readAgentTreasuryAccount({...args,connection:conn()});
 assert.equal(x.status,"observed");assert.equal(x.balanceMinor,"150");
 assert.equal(x.dailyCapMinor,"200");assert.equal(x.nextNonce,"3");
 assert.equal(x.canSpend,false);assert.equal(x.execution,"disabled");assert.equal(x.slot,1234);
 assert.equal(x.source,"same-slot-verified-rpc");
});
test("wrong genesis or missing atomic context fails closed",async()=>{
 await assert.rejects(()=>readAgentTreasuryAccount({...args,connection:conn({
  getGenesisHash:async()=>"other-chain-identity-is-not-allowed"})}),/genesis/);
 await assert.rejects(()=>readAgentTreasuryAccount({...args,connection:conn({
  getMultipleAccountsInfoAndContext:async()=>({context:{slot:0},value:[]})})}),/atomic/);
});
test("fake program owner and wrong vault token owner fail closed",async()=>{
 await assert.rejects(()=>readAgentTreasuryAccount({...args,connection:conn({
  getMultipleAccountsInfoAndContext:async()=>({context:{slot:1234},value:[
   info(key(9),treasuryData()),info(TOKEN_PROGRAM_ID,vaultData()),
   info(TOKEN_PROGRAM_ID,mintData())]})})}),/program owner/);
 const wrong=vaultData();key(9).toBuffer().copy(wrong,32);
 await assert.rejects(()=>readAgentTreasuryAccount({...args,connection:conn({
  getMultipleAccountsInfoAndContext:async()=>({context:{slot:1234},value:[
   info(new PublicKey(programId),treasuryData()),
   info(TOKEN_PROGRAM_ID,wrong),info(TOKEN_PROGRAM_ID,mintData())]})})}),/token owner/);
});
test("absent treasury account reports uncreated, not an invented balance",async()=>{
 const x=await readAgentTreasuryAccount({...args,connection:conn({
  getMultipleAccountsInfoAndContext:async()=>({context:{slot:1234},value:[null,null,null]})
 })});assert.equal(x.status,"not-created");assert.equal(x.balanceMinor,null);assert.equal(x.canSpend,false);
});
