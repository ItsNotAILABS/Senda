import test from "node:test";
import assert from "node:assert/strict";
import {normalizeWalletActivity,selectActivityPage,mergeActivityWithRecovery} from "../src/lib/wallet-activity-core.mjs";
const sig=x=>x.repeat(88);
const owner="B".repeat(44),other="C".repeat(44),A=sig("A"),D=sig("D"),E=sig("E"),F=sig("F");
const now=1795730400000;
const entries=[{signature:A,slot:200,blockTime:1795730000},{signature:D,slot:190,blockTime:1795729900}];
const statuses=[{err:null,confirmationStatus:"finalized"},{err:null,confirmationStatus:"confirmed"}];
const token=raw=>({mint:"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",owner,
 uiTokenAmount:{decimals:6,amount:raw}});
test("confirmation states depend on exact RPC evidence, never local success labels",()=>{
 const rows=normalizeWalletActivity({owner,entries,statuses,now});
 assert.equal(rows[0].status,"finalized");
 assert.equal(rows[1].status,"confirmed");
 const unknown=normalizeWalletActivity({owner,entries,statuses:[null,{err:null,confirmationStatus:"processed"}],now});
 assert.equal(unknown.find(x=>x.signature===A).status,"unverified");
 assert.equal(unknown.find(x=>x.signature===D).status,"processing");
 const failed=normalizeWalletActivity({owner,entries,statuses:[{err:{InstructionError:[0,1]},confirmationStatus:"finalized"},null],now});
 assert.equal(failed.find(x=>x.signature===A).status,"failed");
});
test("exact USDC raw balance deltas are derived only from confirmed matching owner transactions",()=>{
 const transactions={[A]:{meta:{err:null,preTokenBalances:[token("10000000")],
  postTokenBalances:[token("8500000")]}},[D]:{meta:{err:null,
  preTokenBalances:[token("100000")],postTokenBalances:[token("300000")]}}};
 const rows=normalizeWalletActivity({owner,entries,statuses,transactions,now});
 assert.equal(rows.find(x=>x.signature===A).deltaUsdcRaw,"-1500000");
 assert.equal(rows.find(x=>x.signature===D).deltaUsdcRaw,"200000");
 const bad=normalizeWalletActivity({owner,entries,statuses,
  transactions:{[A]:{meta:{err:{a:1},preTokenBalances:[token("100")],postTokenBalances:[token("0")]}}},now});
 assert.equal(bad.find(x=>x.signature===A).deltaUsdcRaw,null);
});
test("wallet-only and ATA streams deduplicate and retain precise pagination cursors",()=>{
 const wallet=[{signature:A,slot:120},{signature:D,slot:90},{signature:E,slot:70}];
 const usdc=[{signature:A,slot:120},{signature:F,slot:110},{signature:D,slot:90}];
 const p=selectActivityPage({wallet,usdc,limit:3,before:{wallet:null,usdc:null}});
 assert.deepEqual(p.entries.map(x=>x.signature),[A,F,D]);
 assert.equal(p.nextCursor.wallet,D);
 assert.equal(p.nextCursor.usdc,D);
 const second=selectActivityPage({wallet:[{signature:E,slot:70}],
  usdc:[],limit:3,before:p.nextCursor});
 assert.deepEqual(second.entries.map(x=>x.signature),[E]);
 assert.equal(second.nextCursor,null);
});
test("unconfirmed local submissions remain visible without pretending they are chain-confirmed",()=>{
 const chain=normalizeWalletActivity({owner,entries:[entries[0]],statuses:[statuses[0]],now});
 const local=[{signature:A,owner,kind:"send",status:"finalized",amountRaw:"1000000",
  destination:other,submittedAt:now-2000},
  {signature:E,owner,kind:"send",status:"pending",amountRaw:"2500000",
   destination:other,submittedAt:now-1000,checkedAt:now-1000}];
 const rows=mergeActivityWithRecovery({owner,chain,local,now});
 assert.equal(rows.find(x=>x.signature===A).status,"finalized");
 assert.equal(rows.find(x=>x.signature===A).localAmountRaw,"1000000");
 assert.equal(rows.find(x=>x.signature===E).status,"pending");
 assert.equal(rows.find(x=>x.signature===E).source,"local-recovery-journal");
 const stale=[{...local[1],status:"finalized"}];
 const r=mergeActivityWithRecovery({owner,chain:[],local:stale,now});
 assert.equal(r[0].status,"unverified");
});
test("mixed-wallet, malformed and inconsistent status payloads fail closed",()=>{
 assert.throws(()=>normalizeWalletActivity({owner,entries,statuses:[],now}),/Unverified/);
 assert.throws(()=>mergeActivityWithRecovery({owner,chain:[{...normalizeWalletActivity({
  owner,entries:[entries[0]],statuses:[statuses[0]],now})[0],owner:other}],local:[],now}),/Mixed-wallet/);
 assert.throws(()=>selectActivityPage({wallet:[{signature:"not-a-signature",slot:1}],limit:10}),/Malformed/);
});
