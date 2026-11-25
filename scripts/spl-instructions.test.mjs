import test from "node:test";import assert from "node:assert/strict";
import {Keypair,PublicKey,Transaction,TransactionInstruction} from "@solana/web3.js";
import {transferCheckedData,ataCreateIdempotentData,firstSignatureFromWire,base58Encode} from "../src/lib/spl-instructions.mjs";
test("TransferChecked encodes discriminator 12, u64 LE amount and decimals",()=>{
 const d=transferCheckedData(290_000n,6);
 assert.equal(d.length,10);assert.equal(d[0],12);assert.equal(d[9],6);
 assert.equal(new DataView(d.buffer).getBigUint64(1,true),290_000n);
 assert.throws(()=>transferCheckedData(0n,6));
 assert.throws(()=>transferCheckedData(1n<<64n,6));
 assert.throws(()=>transferCheckedData(5,6));
});
test("ATA create is the idempotent variant",()=>{
 assert.deepEqual([...ataCreateIdempotentData()],[1]);
});
test("signature read from signed wire bytes equals the transaction id",()=>{
 const payer=Keypair.generate();
 const tx=new Transaction({feePayer:payer.publicKey,recentBlockhash:Keypair.generate().publicKey.toBase58()});
 tx.add(new TransactionInstruction({programId:new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),keys:[],data:Buffer.from("hi")}));
 tx.sign(payer);
 const wire=new Uint8Array(tx.serialize());
 assert.equal(firstSignatureFromWire(wire),base58Encode(new Uint8Array(tx.signature)));
});
test("unsigned or malformed bytes are rejected",()=>{
 const unsigned=new Uint8Array(200);unsigned[0]=1;
 assert.throws(()=>firstSignatureFromWire(unsigned),/unsigned/);
 assert.throws(()=>firstSignatureFromWire(new Uint8Array(10)));
});
