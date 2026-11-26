import test from "node:test";
import assert from "node:assert/strict";
import {createEventService} from "../src/service.mjs";
import {createSendaEventClient} from "../sdk/client.mjs";

const key="test-only-server-credential-0123456789ABCDEFG";
const clock=Date.parse("2026-11-20T15:00:00.000Z");
const ticker="KXRAIN-26NOV20-A",series="KXRAIN";
const facts={
 events:{events:[{event_ticker:"KXRAIN-26NOV20",series_ticker:series,title:"Will it rain?",
  category:"Weather",markets:[{ticker,yes_sub_title:"In Dallas",yes_bid_dollars:"0.39",
   yes_ask_dollars:"0.45",volume_24h_fp:"123.00",close_time:"2026-12-01T00:00:00Z"}]}],cursor:""},
 market:{market:{ticker,title:"Rainfall contract",status:"active",event_ticker:"KXRAIN-26NOV20",
  rules_primary:"Settlement according to official source",volume_24h_fp:"123.00"}},
 event:{event:{event_ticker:"KXRAIN-26NOV20",series_ticker:series,markets:[{ticker}]}},
 book:{orderbook_fp:{yes_dollars:[["0.5500","5.00"]],no_dollars:[["0.6000","3.00"],["0.5000","10.00"]]}},
 candles:{ticker,candlesticks:[
  {end_period_ts:Math.floor(clock/1000)-3600,price:{close_dollars:"0.5600"},volume_fp:"8.00",open_interest_fp:"14"},
  {end_period_ts:Math.floor(clock/1000),price:{close_dollars:null},volume_fp:null}
 ]}
};
function fakeFetch(address){
 const u=new URL(address);
 const data=u.pathname==="/trade-api/v2/events"?facts.events:
  u.pathname.endsWith("/orderbook")?facts.book:
  u.pathname.endsWith("/candlesticks")?facts.candles:
  u.pathname==="/trade-api/v2/events/KXRAIN-26NOV20"?facts.event:
  u.pathname==="/trade-api/v2/markets/"+ticker?facts.market:null;
 if(!data)return Promise.resolve(new Response(JSON.stringify({message:"missing"}),{status:404}));
 return Promise.resolve(new Response(JSON.stringify(data),{status:200,headers:{"content-type":"application/json"}}));
}
const create=()=>createEventService({env:{SENDA_EVENT_API_KEYS:key},fetchImpl:fakeFetch,now:()=>clock});
const headers={authorization:"Bearer "+key,"content-type":"application/json"};
const req=(path,options={})=>new Request("https://example.test"+path,{method:options.method||"GET",
 headers:options.auth===false?{}:headers,body:options.body?JSON.stringify(options.body):undefined});
async function call(api,path,options={}){const result=await api.handleRequest(req(path,options));return {status:result.status,body:await result.json()};}

test("health is safe without credentials, funds and provider claims",async()=>{
 const api=create();
 const result=await call(api,"/v1/health",{auth:false});
 assert.equal(result.status,200);assert.equal(result.body.role,"research-only");
 assert.equal(result.body.integrations,"configuration-dependent");
});
test("financial data rejects missing and wrong credentials",async()=>{
 const api=create();
 assert.equal((await call(api,"/v1/markets",{auth:false})).status,401);
 assert.equal((await api.handleRequest(new Request("https://example.test/v1/markets",{
  headers:{authorization:"Bearer "+"x".repeat(45)}
 }))).status,401);
 const closed=createEventService({env:{},fetchImpl:fakeFetch,now:()=>clock});
 assert.equal((await call(closed,"/v1/markets")).status,503);
});
test("market catalog comes from provider facts, not placeholders",async()=>{
 const api=create();
 const r=await call(api,"/v1/markets?lane=weather&limit=10");
 assert.equal(r.status,200);assert.equal(r.body.data.markets.length,1);
 assert.equal(r.body.data.markets[0].ticker,ticker);
 assert.equal(r.body.data.markets[0].volume24hContracts,123);
 assert.equal(r.body.data.pageScope,"single Kalshi events page");
 assert.equal(r.body.execution,"disabled");assert.equal(r.body.insurance,false);
 assert.equal(r.body.receipt.onchainAnchored,false);
});
test("market contract rules source and history use exact provider series",async()=>{
 const api=create();
 const d=await call(api,"/v1/markets/"+ticker);
 assert.equal(d.body.data.rulesPrimary,"Settlement according to official source");
 const c=await call(api,"/v1/markets/"+ticker+"/history?window=24h");
 assert.equal(c.status,200);assert.equal(c.body.data.bars[0].priceUsd,.56);
 assert.equal(c.body.data.bars[0].volumeContracts,8);
 assert.equal(c.body.data.bars[1].volumeContracts,null);
});
test("fresh public book only: scenario has independent outcomes, no insurance",async()=>{
 const api=create();
 const result=await call(api,"/v1/contingency/scenario",{method:"POST",body:{
  ticker,side:"yes",contracts:5,possibleLossUsd:1000,budgetUsd:50
 }});
 assert.equal(result.status,200);assert.equal(result.body.data.quote.grossCostUsd,2.2);
 assert.equal(result.body.data.scenario.ready,true);
 assert.equal(result.body.data.scenario.events.length,4);
 assert.equal(result.body.data.scenario.events[0].overallNetBeforeFees,-997.2);
 assert.equal(result.body.insurance,false);assert.equal(result.body.data.scenario.execution,"disabled");
});
test("cash reserve is not an event guarantee or insurance",async()=>{
 const api=create();
 const result=await call(api,"/v1/contingency/reserve",{method:"POST",body:{
  potentialExpenseUsd:1000,availableCashUsd:150,targetCoveragePct:60
 }});
 assert.equal(result.body.data.additionalCashRequiredUsd,450);
 assert.equal(result.body.data.insurance,false);
});
test("malformed transfer-like path, unsafe input and oversized amounts fail",async()=>{
 const api=create();
 assert.equal((await call(api,"/v1/transfer")).status,404);
 assert.equal((await call(api,"/v1/markets/BO")).status,400);
 const bad=await call(api,"/v1/contingency/scenario",{method:"POST",body:{ticker,side:"yes",
  contracts:3,possibleLossUsd:-1,budgetUsd:50}});
 assert.equal(bad.status,400);
});
test("provider failure fails closed without invented market data",async()=>{
 const api=createEventService({env:{SENDA_EVENT_API_KEYS:key},fetchImpl:async()=>new Response("rate-limited",{status:429}),now:()=>clock});
 const r=await call(api,"/v1/markets");
 assert.equal(r.status,503);assert.equal(r.body.error.code,"PROVIDER_RATE_LIMITED");
});
test("server SDK rejects unsafe base URLs and validates response authority",async()=>{
 assert.throws(()=>createSendaEventClient({baseUrl:"http://external.example/",apiKey:key}));
 assert.throws(()=>createSendaEventClient({baseUrl:"https://alice:pw@example.test/",apiKey:key}));
 let requested="";
 const client=createSendaEventClient({baseUrl:"https://events.example/",apiKey:key,
  fetchImpl:async(url)=>{requested=url;return new Response(JSON.stringify({
   schema:"senda.events.response.v1",execution:"disabled",insurance:false,data:{ready:true}
  }),{status:200});}});
 const out=await client.reserve({potentialExpenseUsd:100,availableCashUsd:10,targetCoveragePct:50});
 assert.equal(out.data.ready,true);
 assert.equal(requested,"https://events.example/v1/contingency/reserve");
});
test("capability and failure responses have no payment authority",async()=>{
 const api=create();
 const c=await call(api,"/v1/capabilities");
 assert.equal(c.body.data.capabilities.sendapayMoneyMovement,false);
 assert.equal(c.body.data.capabilities.insuranceIssuance,false);
 assert.equal(c.body.data.capabilities.kalshiAccountOrders,false);
 assert.equal((await call(api,"/v1/markets?limit=99999")).status,400);
});

test("history refuses unverified market-to-event or fake series mapping",async()=>{
 const fakeMismatched=async address=>{
  const u=new URL(address);
  if(u.pathname==="/trade-api/v2/events/KXRAIN-26NOV20")
   return new Response(JSON.stringify({event:{event_ticker:"KXRAIN-26NOV20",
    series_ticker:"FORGED",markets:[{ticker:"SOME-OTHER-MARKET"}]}}));
  return fakeFetch(address);
 };
 const api=createEventService({env:{SENDA_EVENT_API_KEYS:key},fetchImpl:fakeMismatched,now:()=>clock});
 const response=await call(api,"/v1/markets/"+ticker+"/history?window=7d");
 assert.equal(response.status,503);
 assert.equal(response.body.error.code,"MARKET_EVENT_MISMATCH");
});
test("market detail no longer requires nonexistent series field",async()=>{
 const api=create();
 const detail=await call(api,"/v1/markets/"+ticker);
 assert.equal(detail.status,200);
 assert.equal(detail.body.data.eventTicker,"KXRAIN-26NOV20");
 const h=await call(api,"/v1/markets/"+ticker+"/history?window=7d");
 assert.equal(h.status,200);
 assert.equal(h.body.data.seriesTicker,series);
});

test("readiness verifies the upstream provider, not merely process liveness",async()=>{
 const api=create();
 const result=await call(api,"/v1/ready");
 assert.equal(result.status,200);
 assert.equal(result.body.data.provider.reachable,true);
 assert.equal(result.body.data.provider.synthetic,false);
 assert.equal(result.body.data.serviceConnectedToSendapay,false);
 assert.equal(result.body.execution,"disabled");
 assert.equal((await call(api,"/v1/ready",{auth:false})).status,401);
});
test("readiness fails closed when Kalshi public API is unavailable",async()=>{
 const api=createEventService({env:{SENDA_EVENT_API_KEYS:key},fetchImpl:async()=>new Response("unavailable",{status:503}),now:()=>clock});
 const result=await call(api,"/v1/ready");
 assert.equal(result.status,503);
 assert.equal(result.body.error.code,"PROVIDER_UNAVAILABLE");
});
