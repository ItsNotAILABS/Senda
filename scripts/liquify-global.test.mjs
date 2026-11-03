import test from "node:test";
import assert from "node:assert/strict";
import {LIQUIFY_MARKETS,LIQUIFY_RAILS,LIQUIFY_PRODUCTS,listMarkets,railsForMarket,classifyPath} from "../src/lib/liquify-global.mjs";
test("global coverage includes all researched focus markets and has unique ids",()=>{
 assert.equal(LIQUIFY_MARKETS.length,11);
 assert.equal(new Set(LIQUIFY_MARKETS.map(x=>x.id)).size,LIQUIFY_MARKETS.length);
 for(const m of LIQUIFY_MARKETS) assert.ok(m.rails.length>0 && railsForMarket(m.id).length===m.rails.length);
});
test("four primary Senda products include Liquify",()=>assert.deepEqual(LIQUIFY_PRODUCTS.map(x=>x.id),["trade","pay","agents","liquify"]));
test("fiat candidates never treated as executable",()=>{
 assert.equal(classifyPath({marketId:"mx",railId:"bitso",asset:"USDC"}).eligible,false);
 assert.equal(classifyPath({marketId:"br",railId:"regional-fiat",asset:"USDC"}).eligible,false);
 assert.equal(classifyPath({marketId:"us",railId:"jupiter-v2",asset:"USDC"}).eligible,true);
 assert.equal(classifyPath({marketId:"kr",railId:"bitso",asset:"USDC"}).eligible,false);
});
test("search finds countries, currencies and assets",()=>{
 assert.equal(listMarkets({query:"NGN"}).length,1);
 assert.ok(listMarkets({query:"USDC"}).length>6);
});
test("all rail records have explicit status and source details",()=>{
 for(const r of LIQUIFY_RAILS)assert.ok(["code-present","candidate","not-connected"].includes(r.status)&&r.description);
});
