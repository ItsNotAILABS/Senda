import test from "node:test";
import assert from "node:assert/strict";
import {PublicKey} from "@solana/web3.js";
import {createTreasuryClient} from "./chain-client.mjs";
const PROGRAM="BPFLoaderUpgradeab1e11111111111111111111111";
const owner="So11111111111111111111111111111111111111112";
const agent="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const beneficiary="3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh";
const mint="7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs";
const client=()=>createTreasuryClient({programId:PROGRAM,verifiedProgramId:PROGRAM,network:"localnet"});
test("rejects system program placeholder or mismatch",()=>{
 assert.throws(()=>createTreasuryClient({programId:"11111111111111111111111111111111",verifiedProgramId:"11111111111111111111111111111111",network:"devnet"}));
 assert.throws(()=>createTreasuryClient({programId:PROGRAM,verifiedProgramId:owner,network:"devnet"}));
});
test("PDA includes fixed beneficiary and mint",()=>{
 const c=client();
 const x=c.derive(owner,agent,beneficiary,mint);
 const y=c.derive(owner,agent,owner,mint);
 assert.equal(x.treasury.equals(y.treasury),false);
 assert.ok(x.treasury instanceof PublicKey);
});
test("correct Anchor discriminators, accounts and little endian fields",()=>{
 const c=client(),x=c.initialize({owner,agent,beneficiary,mint,perTxMinor:"100",dailyMinor:"200",
  lifetimeMinor:"300",expiresAt:1900000000});
 assert.equal(x.instruction.keys.length,9);
 assert.equal(x.instruction.keys[0].isSigner,true);
 assert.equal(x.instruction.data.readBigUInt64LE(8),100n);
 assert.equal(x.instruction.data.readBigInt64LE(32),1900000000n);
 assert.equal(c.signingSupported,false);
});
test("spends never supply arbitrary destination account as signer",()=>{
 const c=client(),i=c.spend({owner,agent,beneficiary,mint,beneficiaryToken:owner,amountMinor:"1",nonce:"0"});
 assert.equal(i.keys[0].isSigner,true);assert.equal(i.keys[4].isSigner,false);
});
test("rejects invalid amount and caps",()=>{
 const c=client();
 assert.throws(()=>c.deposit({owner,agent,beneficiary,mint,ownerToken:owner,amountMinor:0}));
 assert.throws(()=>c.initialize({owner,agent,beneficiary,mint,perTxMinor:5,dailyMinor:4,lifetimeMinor:10,expiresAt:1900000000}));
});
