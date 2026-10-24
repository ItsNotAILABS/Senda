import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmTrackedSubmission } from '../src/lib/tracked-confirmation.mjs';
import { listTransactions } from '../src/lib/tx-journal.mjs';
const SIG='3'.repeat(88),OWNER='6'.repeat(44),DEST='7'.repeat(44);
const draft={ signature:SIG,owner:OWNER,kind:'send',asset:'USDC',destination:DEST,amountRaw:'25000000' };
const mem=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}};
const options={attempts:2,pauseMs:1,sleep:async()=>{}};
test('confirmed submission survives in the journal',async()=>{
 const storage=mem(); const x=await confirmTrackedSubmission(storage,draft,async()=>({value:[{err:null,confirmationStatus:'confirmed'}]}),options);
 assert.equal(x.confirmationStatus,'confirmed');assert.equal(listTransactions(storage,OWNER)[0].status,'confirmed');
});
test('RPC timeout is left pending and retains the exact recoverable signature',async()=>{
 const storage=mem();await assert.rejects(()=>confirmTrackedSubmission(storage,draft,async()=>{throw Error('429')},options),/not yet confirmed/);
 const row=listTransactions(storage,OWNER)[0];assert.equal(row.signature,SIG);assert.equal(row.status,'pending');
});
test('real on-chain failure becomes failed rather than a success receipt',async()=>{
 const storage=mem();await assert.rejects(()=>confirmTrackedSubmission(storage,draft,async()=>({value:[{err:{InstructionError:[0,'Custom']},confirmationStatus:'confirmed'}]}),options),/failed on-chain/);
 assert.equal(listTransactions(storage,OWNER)[0].status,'failed');
});
test('failed storage never silently reports confirmed payment',async()=>{
 const storage={getItem:()=>null,setItem:()=>{throw Error('quota')}};
 await assert.rejects(()=>confirmTrackedSubmission(storage,draft,async()=>({value:[{err:null,confirmationStatus:'confirmed'}]}),options),/submitted but could not be saved/);
});
