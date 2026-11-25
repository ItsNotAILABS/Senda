import test from "node:test";import assert from "node:assert/strict";
import {journaledSend,checkSendRecovery,classifySendError,SendOutcomeUncertain,markNotBroadcast} from "../src/lib/journaled-send.mjs";
import {listTransactions,assertNoPendingDuplicate} from "../src/lib/tx-journal.mjs";

const memStorage=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))};};
const owner="6".repeat(44),dest="7".repeat(44);
const SIG="5".repeat(88);
const draft={owner,kind:"send",asset:"USDC",destination:dest,amountRaw:"10000000",lastValidBlockHeight:1000};
const fast={attempts:1,pauseMs:0,sleep:async()=>{}};
const statusRpc=(status,height=0)=>async(method)=>{
 if(method==="getSignatureStatuses")return {value:[status]};
 if(method==="getBlockHeight")return height;
 throw new Error("unexpected "+method);
};

test("signed transaction is journaled as pending BEFORE it is broadcast",async()=>{
 const storage=memStorage();let seenAtBroadcast;
 const out=await journaledSend({storage,draft,rpc:statusRpc({err:null,confirmationStatus:"confirmed"}),confirmOptions:fast,
  sign:async()=>({mode:"signed",raw:new Uint8Array([1]),signature:SIG}),
  preflight:async()=>{},
  send:async()=>{seenAtBroadcast=listTransactions(storage,owner);return SIG;}});
 assert.equal(out.signature,SIG);
 assert.equal(seenAtBroadcast.length,1);assert.equal(seenAtBroadcast[0].status,"pending");
 assert.equal(seenAtBroadcast[0].lastValidBlockHeight,1000);
 assert.equal(listTransactions(storage,owner)[0].status,"confirmed");
});

test("broadcast network error is uncertain, carries the signature and blocks a duplicate",async()=>{
 const storage=memStorage();
 await assert.rejects(journaledSend({storage,draft,rpc:statusRpc(null),confirmOptions:fast,
  sign:async()=>({mode:"signed",raw:new Uint8Array([1]),signature:SIG}),
  send:async()=>{throw new TypeError("Failed to fetch");}}),
  e=>e instanceof SendOutcomeUncertain&&e.signature===SIG&&classifySendError(e).uncertain===true);
 assert.throws(()=>assertNoPendingDuplicate(storage,draft),/may already be on-chain/);
});

test("simulation failure is not broadcast and leaves no journal row",async()=>{
 const storage=memStorage();let sent=false;
 await assert.rejects(journaledSend({storage,draft,rpc:statusRpc(null),
  sign:async()=>({mode:"signed",raw:new Uint8Array([1]),signature:SIG}),
  preflight:async()=>{throw new Error("Program log: custom program error: 0x1");},
  send:async()=>{sent=true;return SIG;}}),
  e=>e.notBroadcast===true&&classifySendError(e).uncertain===false);
 assert.equal(sent,false);assert.equal(listTransactions(storage,owner).length,0);
});

test("unconfirmed after broadcast is uncertain; on-chain failure is final and retryable",async()=>{
 const s1=memStorage();
 await assert.rejects(journaledSend({storage:s1,draft,rpc:statusRpc(null),confirmOptions:fast,
  sign:async()=>({mode:"sent",signature:SIG}),send:async()=>SIG}),e=>e.uncertain===true&&e.signature===SIG);
 const s2=memStorage();
 await assert.rejects(journaledSend({storage:s2,draft,rpc:statusRpc({err:{InstructionError:[0,"x"]}}),confirmOptions:fast,
  sign:async()=>({mode:"sent",signature:SIG}),send:async()=>SIG}),e=>e.onChainFailure===true&&classifySendError(e).uncertain===false);
 assert.equal(listTransactions(s2,owner)[0].status,"failed");
});

test("classification fails closed for unknown and RPC errors",()=>{
 for(const m of ["RPC failed","RPC did not return a signature.","Failed to fetch","NetworkError when attempting to fetch resource.","Blockhash not found","something odd"])
  assert.equal(classifySendError(new Error(m)).uncertain,true,m);
 for(const m of ["User rejected the request.","That is not a Solana address.","This wallet has no USDC account."])
  assert.equal(classifySendError(new Error(m)).uncertain,false,m);
 assert.equal(classifySendError(markNotBroadcast(new Error("weird"))).uncertain,false);
 assert.equal(classifySendError(new SendOutcomeUncertain("x",SIG)).signature,SIG);
});

async function pendingJournal(){
 const storage=memStorage();
 await journaledSend({storage,draft,rpc:statusRpc(null),confirmOptions:fast,
  sign:async()=>({mode:"sent",signature:SIG}),send:async()=>SIG}).catch(()=>{});
 return storage;
}
test("recovery: still in blockhash window and unseen -> pending (retry stays blocked)",async()=>{
 const storage=await pendingJournal();
 const r=await checkSendRecovery({storage,owner,signature:SIG,rpc:statusRpc(null,900)});
 assert.equal(r.state,"pending");
});
test("recovery: unseen after blockhash expiry -> failed, retry allowed",async()=>{
 const storage=await pendingJournal();
 const r=await checkSendRecovery({storage,owner,signature:SIG,rpc:statusRpc(null,1001)});
 assert.equal(r.state,"clear");assert.equal(listTransactions(storage,owner)[0].status,"failed");
 assert.doesNotThrow(()=>assertNoPendingDuplicate(storage,draft));
});
test("recovery: getSignatureStatuses shows it landed -> paid, never resend",async()=>{
 const storage=await pendingJournal();
 const r=await checkSendRecovery({storage,owner,signature:SIG,rpc:statusRpc({err:null,confirmationStatus:"finalized"},5000)});
 assert.equal(r.state,"paid");
});
