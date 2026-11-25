import test from "node:test";import assert from "node:assert/strict";
import {buildUsdcPayLink,verifyReferencedUsdcPayment} from "../src/lib/solana-pay-request.mjs";
const to="7".repeat(44),mint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",reference="8".repeat(44);
test("payment request carries exact amount, mint, reference and a sanitized memo",()=>{
 const url=new URL(buildUsdcPayLink({to,cents:2501,memo:"Dinner\nnight",reference,mint}));
 assert.equal(url.protocol,"solana:");assert.equal(url.pathname,to);
 assert.equal(url.searchParams.get("amount"),"25.01");
 assert.equal(url.searchParams.get("spl-token"),mint);
 assert.equal(url.searchParams.get("reference"),reference);
 assert.equal(url.searchParams.get("memo"),"Dinner night");
 assert.throws(()=>buildUsdcPayLink({to:"@bob",cents:100,reference,mint}));
 assert.throws(()=>buildUsdcPayLink({to,cents:0,reference,mint}));
});
const bal=(owner,amount)=>({owner,mint,uiTokenAmount:{amount:String(amount)}});
test("a referenced transaction only counts when it paid the exact USDC to the requester",()=>{
 const paid={meta:{err:null,preTokenBalances:[bal(to,1_000_000)],postTokenBalances:[bal(to,26_010_000)]}};
 assert.equal(verifyReferencedUsdcPayment(paid,{recipient:to,mint,cents:2501}).paid,true);
 assert.equal(verifyReferencedUsdcPayment(paid,{recipient:to,mint,cents:2500}).paid,false);
 const newAccount={meta:{err:null,preTokenBalances:[],postTokenBalances:[bal(to,25_010_000)]}};
 assert.equal(verifyReferencedUsdcPayment(newAccount,{recipient:to,mint,cents:2501}).paid,true);
 const failed={meta:{err:{x:1},preTokenBalances:[],postTokenBalances:[bal(to,25_010_000)]}};
 assert.equal(verifyReferencedUsdcPayment(failed,{recipient:to,mint,cents:2501}).paid,false);
 const other={meta:{err:null,preTokenBalances:[],postTokenBalances:[bal("9".repeat(44),25_010_000)]}};
 assert.equal(verifyReferencedUsdcPayment(other,{recipient:to,mint,cents:2501}).paid,false);
 assert.equal(verifyReferencedUsdcPayment(null,{recipient:to,mint,cents:2501}).paid,false);
});
