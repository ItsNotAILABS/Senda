import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {PublicKey,BPF_LOADER_UPGRADEABLE_PROGRAM_ID} from "@solana/web3.js";
import {verifyParralaxDevnetProof,SOLANA_DEVNET_GENESIS,PARRALAX_LOCALNET_PROGRAM_ID} from "./parralax-devnet-proof.mjs";
const key=n=>new PublicKey(new Uint8Array(32).fill(n));
const programId=key(4).toBase58(),dataAddr=key(5),authority=key(6).toBase58();
const loader=BPF_LOADER_UPGRADEABLE_PROGRAM_ID.toBase58();
const binary=Buffer.from("test SBF account data; no real on-chain deployment");
const sha=createHash("sha256").update(binary).digest("hex");
const program=Buffer.alloc(36);program.writeUInt32LE(2,0);dataAddr.toBuffer().copy(program,4);
const programData=Buffer.alloc(45+binary.length);
programData.writeUInt32LE(3,0);programData.writeBigUInt64LE(57n,4);
programData[12]=1;new PublicKey(authority).toBuffer().copy(programData,13);
binary.copy(programData,45);
const account=(data,executable=false,owner=loader)=>({owner,executable,data:[data.toString("base64"),"base64"]});
function rpc(overrides={}){
 return async(method,params)=>{
  if(method==="getGenesisHash")return overrides.genesis??SOLANA_DEVNET_GENESIS;
  if(method==="getAccountInfo")return {context:{slot:100},
   value:overrides.noProgram?null:account(program,true,overrides.programOwner??loader)};
  if(method==="getMultipleAccounts")return {context:{slot:overrides.slot??105},
   value:[account(program,true),account(overrides.programData??programData,false)]};
  throw Error("unexpected RPC");
 };
}
const input={programId,expectedAuthority:authority,expectedProgramDataSha256:sha};
test("pinned genesis, ProgramData and multisig identity give chain proof, not agent execution",async()=>{
 const x=await verifyParralaxDevnetProof({...input,rpc:rpc()});
 assert.equal(x.status,"chain-present");assert.equal(x.chainProof,true);
 assert.equal(x.programDataAddress,dataAddr.toBase58());
 assert.equal(x.rawProgramDataSha256,sha);
 assert.equal(x.upgradeAuthority,authority);
 assert.equal(x.releaseReady,false);assert.equal(x.agentExecution,"disabled");
 assert.equal(x.sourceBuildVerified,false);assert.equal(x.securityAuditVerified,false);
});
test("missing devnet program is explicit and never invented",async()=>{
 const x=await verifyParralaxDevnetProof({...input,rpc:rpc({noProgram:true})});
 assert.equal(x.status,"not-deployed");assert.equal(x.chainProof,false);
});
test("localnet program ID and non-devnet genesis are rejected",async()=>{
 await assert.rejects(()=>verifyParralaxDevnetProof({...input,programId:PARRALAX_LOCALNET_PROGRAM_ID,rpc:rpc()}),/Localnet/);
 await assert.rejects(()=>verifyParralaxDevnetProof({...input,rpc:rpc({genesis:"wrong-genesis"})}),/genesis/);
});
test("wrong program loader, upgrade authority and binary hash are rejected",async()=>{
 await assert.rejects(()=>verifyParralaxDevnetProof({...input,rpc:rpc({programOwner:key(9).toBase58()})}),/upgradeable/);
 await assert.rejects(()=>verifyParralaxDevnetProof({...input,expectedAuthority:key(7).toBase58(),rpc:rpc()}),/authority/);
 await assert.rejects(()=>verifyParralaxDevnetProof({...input,expectedProgramDataSha256:"0".repeat(64),rpc:rpc()}),/hash/);
});
test("stale ProgramData context is not accepted as a release proof",async()=>{
 await assert.rejects(()=>verifyParralaxDevnetProof({...input,rpc:rpc({slot:99})}),/context/);
});
