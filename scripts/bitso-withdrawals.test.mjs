import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {createBitsoWithdrawalReader,signWithdrawalQuery,withdrawalQueryPath} from "../services/bitso-business/withdrawal-readonly.mjs";

test("origin_id lookup uses documented exact endpoint and HMAC path including query",async()=>{
 const path="/v3/withdrawals?origin_ids=senda_x-123",nonce=1700000000000;
 const signature=createHmac("sha256","secret").update(nonce+"GET"+path).digest("hex");
 assert.equal(withdrawalQueryPath("senda_x-123"),path);
 assert.equal(signWithdrawalQuery({key:"key",secret:"secret",nonce,path}),"Bitso key:"+nonce+":"+signature);
 const reader=createBitsoWithdrawalReader({environment:"stage",key:"key",secret:"secret",nonceFactory:()=>nonce,
 fetchImpl:async(url,options)=>{
  assert.equal(url,"https://api-stage.bitso.com"+path);
  assert.equal(options.method,"GET");
  assert.equal(options.headers.Authorization,"Bitso key:"+nonce+":"+signature);
  return {ok:true,json:async()=>({success:true,payload:[
   {wid:"bitso-wid",status:"processing",currency:"mxn",amount:"100.00",
    details:{origin_id:"senda_x-123",clabe:"DO_NOT_RETURN"},created_at:"2026-11-25T00:00:00Z"}
  ]})};
 }});
 assert.deepEqual(await reader.byOriginId("senda_x-123"),[{
  wid:"bitso-wid",status:"processing",currency:"mxn",amount:"100.00",
  originId:"senda_x-123",createdAt:"2026-11-25T00:00:00Z",
  settlementEvidenceComplete:false
 }]);
 assert.equal(reader.withdraw,undefined);
});
test("untrusted identifiers and arbitrary paths rejected",()=>{
 for(const id of ["bad&currency=mxn","../withdrawals","","contains space","x".repeat(41)]){
  assert.throws(()=>withdrawalQueryPath(id));
 }
 assert.throws(()=>signWithdrawalQuery({key:"k",secret:"s",nonce:1,path:"/v3/withdrawals"}),/allowed/);
});
test("HTTP failure and malformed envelope fail closed",async()=>{
 const base={key:"k",secret:"s",nonceFactory:()=>1};
 await assert.rejects(
  createBitsoWithdrawalReader({...base,fetchImpl:async()=>({ok:false,status:429})}).byOriginId("abc"),/429/);
 await assert.rejects(
  createBitsoWithdrawalReader({...base,fetchImpl:async()=>({ok:true,json:async()=>({success:true,payload:{}})})}).byOriginId("abc"),/schema/);
});
