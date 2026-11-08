import test from "node:test";import assert from "node:assert/strict";
import {fromBase58,toBase58,verifyWalletEd25519,decodeBase64} from "../src/lib/ed25519-wallet.mjs";
test("base58 preserves zeros and canonical Solana address encoding",()=>{
 const bytes=Uint8Array.from([0,0,1,5,8,255,17,0,32]);
 assert.deepEqual(fromBase58(toBase58(bytes)),bytes);
 assert.deepEqual(fromBase58("11111111111111111111111111111111"),new Uint8Array(32));
});
test("rejects invalid alphabet and malformed transaction",()=>{
 assert.throws(()=>fromBase58("0OIl"));
 assert.throws(()=>decodeBase64("not a base64 packet!"));
});
test("WebCrypto verifies genuine Ed25519 signatures, fails tampering",async()=>{
 const keypair=await globalThis.crypto.subtle.generateKey({name:"Ed25519"},true,["sign","verify"]);
 const raw=new Uint8Array(await globalThis.crypto.subtle.exportKey("raw",keypair.publicKey));
 const wallet=toBase58(raw);
 const message=new TextEncoder().encode("Senda prediction research only");
 const sig=new Uint8Array(await globalThis.crypto.subtle.sign("Ed25519",keypair.privateKey,message));
 assert.equal(await verifyWalletEd25519(wallet,message,sig),true);
 assert.equal(await verifyWalletEd25519(wallet,new TextEncoder().encode("ORDER"),sig),false);
});
