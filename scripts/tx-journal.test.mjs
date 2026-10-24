import assert from 'node:assert/strict';
import test from 'node:test';
import { JOURNAL_KEY, listTransactions, assertNoPendingDuplicate, recordSubmission, observeTransaction, reconcileTransactions } from '../src/lib/tx-journal.mjs';
const sig1 = '3'.repeat(88), sig2 = '4'.repeat(88), who='6'.repeat(44), other='7'.repeat(44);
const mem = () => { const m=new Map(); return { getItem:k=>m.get(k)??null, setItem:(k,v)=>m.set(k,v), corrupt:(x)=>m.set(JOURNAL_KEY,x) }; };
const base = { signature:sig1, owner:who, kind:'send', asset:'USDC', destination:other, amountRaw:'25000000' };
const clock = 1800000000000;

test('persists scoped pending submissions, survives re-read, and deduplicates a signature',()=>{
 const s=mem(); const first=recordSubmission(s,base,clock); assert.equal(first.status,'pending');
 assert.equal(listTransactions(s,who).length,1);assert.equal(listTransactions(s,other).length,0);
 recordSubmission(s,base,clock+1); assert.equal(listTransactions(s,who).length,1);
 assert.throws(()=>assertNoPendingDuplicate(s,base,clock+1200),/already be on-chain/);
 assert.throws(()=>assertNoPendingDuplicate(s,base,clock+24*60*60*1000+1),/already be on-chain/);
});
test('only explicit clean confirmed/finalized observations advance state',()=>{
 const s=mem();recordSubmission(s,base,clock);
 observeTransaction(s,who,sig1,{confirmationStatus:'confirmed'},clock+10);assert.equal(listTransactions(s,who)[0].status,'pending');
 observeTransaction(s,who,sig1,{err:null,confirmationStatus:'processed'},clock+20);assert.equal(listTransactions(s,who)[0].status,'pending');
 observeTransaction(s,who,sig1,{err:null,confirmationStatus:'confirmed'},clock+30);assert.equal(listTransactions(s,who)[0].status,'confirmed');
 observeTransaction(s,who,sig1,null,clock+40);assert.equal(listTransactions(s,who)[0].status,'confirmed');
 observeTransaction(s,who,sig1,{err:null,confirmationStatus:'finalized'},clock+50);assert.equal(listTransactions(s,who)[0].status,'finalized');
 observeTransaction(s,who,sig1,{err:{InstructionError:[0,'Custom']},confirmationStatus:'confirmed'},clock+60);assert.equal(listTransactions(s,who)[0].status,'finalized');
});
test('definitive chain failure is terminal and different owners cannot alter a record',()=>{
 const s=mem();recordSubmission(s,base,clock);
 assert.equal(observeTransaction(s,other,sig1,{err:null,confirmationStatus:'finalized'}),null);
 observeTransaction(s,who,sig1,{err:{InstructionError:[1,'Custom']},confirmationStatus:'confirmed'},clock+30);
 assert.equal(listTransactions(s,who)[0].status,'failed');
 observeTransaction(s,who,sig1,{err:null,confirmationStatus:'finalized'},clock+50);
 assert.equal(listTransactions(s,who)[0].status,'failed');
 assert.doesNotThrow(()=>assertNoPendingDuplicate(s,base,clock+30));
});
test('batch-reconciles exact wallet signatures and fails closed on missing data',async()=>{
 const s=mem();recordSubmission(s,base,clock);
 recordSubmission(s,{...base,signature:sig2,amountRaw:'26000000'},clock+1);
 let calls=0;
 let rows=await reconcileTransactions(s,who,async (method,params)=>{
    calls++;assert.equal(method,'getSignatureStatuses');assert.deepEqual(params[1],{searchTransactionHistory:true});
    assert.deepEqual(params[0],[sig2,sig1]);
    return {value:[null,{err:null,confirmationStatus:'finalized'}]};
 },clock+10);
 assert.equal(calls,1);assert.equal(rows.find(r=>r.signature===sig1).status,'finalized');
 assert.equal(rows.find(r=>r.signature===sig2).status,'pending');
 rows=await reconcileTransactions(s,who,async()=>({value:[]}),clock+20);
 assert.equal(rows.find(r=>r.signature===sig2).status,'pending');
});
test('rejects malformed or corrupted records and refuses fake signatures',()=>{
 const s=mem();assert.throws(()=>recordSubmission(s,{...base,signature:'fake'},clock),/Invalid transaction metadata/);
 s.corrupt('{');assert.throws(()=>assertNoPendingDuplicate(s,base,clock),/unreadable/);
});
