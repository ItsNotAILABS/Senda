import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const runtimeFiles=["src/lib/jup-tape.ts","src/lib/hold-marks.ts","src/lib/chain-tape.ts","src/lib/world-book.ts","src/lib/pools/read.ts","src/lib/table-pot.ts","mcp/tools.mjs"];
test("runtime market data and MCP read tools use current Jupiter host",()=>{
 for(const path of runtimeFiles){
  const body=readFileSync(new URL("../"+path,import.meta.url),"utf8");
  assert.equal(body.includes("lite-api.jup.ag"),false,path+" uses retired Lite host");
 }
});
test("wallet signing remains in its original implementation",()=>{
 const signer=readFileSync(new URL("../src/lib/jup-sign.ts",import.meta.url),"utf8");
 assert.ok(signer.includes("withWalletExecutionLock"));
 assert.ok(signer.includes("confirmTrackedSubmission"));
});
test("read-only preview cannot accidentally sign or broadcast",()=>{
 for(const path of ["src/lib/token-safety.ts","src/lib/jupiter-v2-preview.ts"]){
  const source=readFileSync(new URL("../"+path,import.meta.url),"utf8");
  for(const marker of ["sendTransaction(","signTransaction(","sendRawTransaction(","signAndSendTransaction("])
   assert.ok(!source.includes(marker),path+" contains execution primitive: "+marker);
 }
});
