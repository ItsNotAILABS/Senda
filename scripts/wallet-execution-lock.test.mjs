import assert from 'node:assert/strict';
import test from 'node:test';
import { withWalletExecutionLock } from '../src/lib/wallet-execution-lock.mjs';
const owner='6'.repeat(44), other='7'.repeat(44);
const deferred=()=>{let done;const promise=new Promise((resolve)=>{done=resolve});return {promise,done};};
test('a second same-tab signing request cannot start while one awaits a wallet',async()=>{
 const d=deferred();const first=withWalletExecutionLock(owner,()=>d.promise,null);
 await assert.rejects(()=>withWalletExecutionLock(owner,()=>Promise.resolve('duplicate'),null),/already in progress/);
 d.done('signed');assert.equal(await first,'signed');
 assert.equal(await withWalletExecutionLock(owner,async()=> 'ready',null),'ready');
});
test('errors release the lock; different wallets are isolated',async()=>{
 await assert.rejects(()=>withWalletExecutionLock(owner,async()=>{throw Error('wallet rejected')},null),/wallet rejected/);
 const d=deferred();const active=withWalletExecutionLock(owner,()=>d.promise,null);
 assert.equal(await withWalletExecutionLock(other,async()=> 'different wallet',null),'different wallet');
 d.done('done');await active;
});
test('an unavailable cross-tab Web Lock never calls the signer',async()=>{
 let called=false;
 const unavailable={request:async(name,options,callback)=>{assert.ok(options.ifAvailable);return callback(null)}};
 await assert.rejects(()=>withWalletExecutionLock(owner,async()=>{called=true},unavailable),/busy in another tab/);
 assert.equal(called,false);
});
test('a granted browser lock runs once and the same-tab key is released',async()=>{
 let calls=0;
 const granted={request:async(_name,_opts,callback)=>callback({name:'granted'})};
 assert.equal(await withWalletExecutionLock(owner,async()=>{calls++;return 'ok'},granted),'ok');
 assert.equal(calls,1);
 await withWalletExecutionLock(owner,async()=>{calls++},granted);
 assert.equal(calls,2);
});
