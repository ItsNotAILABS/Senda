import test from "node:test";import assert from "node:assert/strict";
import {aggregateSolscanVolume,USDC_MINT} from "../src/lib/solscan-volume-core.mjs";
const mint="7".repeat(44),start=1_800_000_000,end=start+3600*4;
const row=(id,seconds,kind,amount,first)=>({trans_id:id.repeat(44),block_time:seconds,activity_type:kind,
 routers:first?{token1:USDC_MINT,token1_decimals:6,amount1:amount,token2:mint,token2_decimals:9,amount2:"800000000"}:
  {token1:mint,token1_decimals:9,amount1:800000000,token2:USDC_MINT,token2_decimals:6,amount2:amount}});
test("measures actual USDC raw notional and separates swap sides",()=>{
 const events=[row("a",start+30,"ACTIVITY_AGG_TOKEN_SWAP",15000000,true),
 row("b",start+3700,"ACTIVITY_TOKEN_SWAP",4250000,false)];
 const out=aggregateSolscanVolume({mint,events,start,end,complete:true});
 assert.equal(out.observedUsd,19.25);assert.equal(out.buyUsd,15);assert.equal(out.sellUsd,4.25);
 assert.equal(out.bars.length,4);assert.equal(out.bars[2].totalUsd,0);
});
test("prioritizes aggregated swap and deduplicates signature on multiple API pages",()=>{
 const x=row("a",start+30,"ACTIVITY_AGG_TOKEN_SWAP",15000000,true);
 const child=row("a",start+30,"ACTIVITY_TOKEN_SWAP",15000000,true);
 const v=aggregateSolscanVolume({mint,events:[child,x,x],start,end,complete:true});
 assert.equal(v.observedUsd,15);assert.equal(v.pricedSwaps,1);
});
test("does not dollarize SOL-paired or unsafe/unknown prices",()=>{
 const sol=row("a",start+30,"ACTIVITY_TOKEN_SWAP",1000000,true);sol.routers.token1="So11111111111111111111111111111111111111112";
 const unsafe=row("b",start+60,"ACTIVITY_TOKEN_SWAP",Number.MAX_SAFE_INTEGER+100,true);
 const res=aggregateSolscanVolume({mint,events:[sol,unsafe],start,end,complete:false});
 assert.equal(res.observedUsd,0);assert.equal(res.unpricedSwaps,2);
 assert.equal(res.bars[0].totalUsd,null);
});
test("does not mistake a capped page for zero-volume empty bars",()=>{
 const s=aggregateSolscanVolume({mint,events:[row("a",start+30,"ACTIVITY_TOKEN_SWAP",11000000,true)],start,end,complete:false});
 assert.equal(s.bars[1].totalUsd,null);assert.equal(s.coverage,"sampled-most-recent-only");
});
test("refuses malformed windows or mints",()=>{
 assert.throws(()=>aggregateSolscanVolume({mint:"bad",events:[],start,end,complete:true}));
 assert.throws(()=>aggregateSolscanVolume({mint,events:[],start,end:start+100,complete:true}));
});
