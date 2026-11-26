import test from "node:test";
import assert from "node:assert/strict";
import {Readable} from "node:stream";
import {nodeHandler} from "../src/node-adapter.mjs";

function request({url,method="GET",headers={},body}={}){
 const req=Readable.from(body===undefined?[]:[Buffer.from(typeof body==="string"?body:JSON.stringify(body))]);
 req.url=url;req.method=method;req.headers=headers;return req;
}
function response(){
 const headers={};
 return {statusCode:200,headers,body:null,
  setHeader(key,value){headers[key.toLowerCase()]=value;},
  end(body){this.body=body;},
  json(){try{return JSON.parse(this.body)}catch{return null}}
 };
}
async function probe(input){
 const res=response();
 await nodeHandler(request(input),res);
 return res;
}
test("Vercel rewrite maps exact health route without a bearer secret",async()=>{
 const res=await probe({url:"/api/index?__senda_path=health"});
 assert.equal(res.statusCode,200);
 assert.equal(res.json().schema,"senda.events.health.v1");
 assert.equal(res.json().role,"research-only");
});
test("unknown encoded routes fail closed before source calls",async()=>{
 const res=await probe({url:"/api/index?__senda_path=../markets"});
 assert.equal(res.statusCode,400);
 assert.equal(res.json().error.code,"INVALID_PATH");
});
test("unconfigured financial endpoint does not allow public market discovery",async()=>{
 const res=await probe({url:"/api/index?__senda_path=markets"});
 assert.equal(res.statusCode,503);
 assert.equal(res.json().error.code,"NOT_CONFIGURED");
});
test("transport limits oversized JSON before executing route or checking funds",async()=>{
 const res=await probe({url:"/v1/contingency/reserve",method:"POST",body:"x".repeat(16001)});
 assert.equal(res.statusCode,413);
 assert.equal(res.json().error.code,"PAYLOAD_TOO_LARGE");
});
test("POST with small body stays deny-by-default without credentials",async()=>{
 const res=await probe({url:"/api/index?__senda_path=contingency/reserve",
  method:"POST",headers:{"content-type":"application/json"},body:{
   potentialExpenseUsd:1000,availableCashUsd:500,targetCoveragePct:75}});
 assert.equal(res.statusCode,503);
 assert.equal(res.json().error.code,"NOT_CONFIGURED");
});
