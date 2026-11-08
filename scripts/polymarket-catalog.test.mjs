import test from "node:test";import assert from "node:assert/strict";
import {normalizePolymarketCatalog,polymarketMarketUrl} from "../src/lib/polymarket-catalog.mjs";
const market={id:"123",question:"Will the Fed cut rates this year?",slug:"fed-cut-rates-this-year",closed:false,active:true,outcomes:'["Yes","No"]',outcomePrices:'["0.62","0.38"]',clobTokenIds:'["111","222"]',volumeNum:"100000",liquidityNum:"25000"};
test("Gamma discovery remains source-indicative, not a trade quote",()=>{
 const row=normalizePolymarketCatalog([market])[0];assert.equal(row.venueId,"polymarket");
 assert.deepEqual(row.outcomes,["Yes","No"]);assert.deepEqual(row.indicativePrices,[0.62,0.38]);
 assert.equal(row.notExecutable,true);assert.equal(row.dataQuality,"catalog-indicative-only");
});
test("catalog rejects malicious slug, closed markets and unparseable prices",()=>{
 const bad={...market,slug:"../orders"};assert.equal(normalizePolymarketCatalog([bad]).length,0);
 assert.equal(normalizePolymarketCatalog([{...market,closed:true}]).length,0);
 assert.equal(normalizePolymarketCatalog([{...market,outcomePrices:'["bad","0.25"]'}])[0].indicativePrices[0],null);
});
test("venue links cannot use arbitrary hosts",()=>{
 assert.equal(polymarketMarketUrl(normalizePolymarketCatalog([market])[0]),"https://polymarket.com/event/fed-cut-rates-this-year");
 assert.equal(polymarketMarketUrl({slug:"https://evil.example"}),null);
});
