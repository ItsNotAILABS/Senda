/** Wallet Activity: chain-derived, account-scoped receipts. No signing or balance authority. */
const SIG=/^[1-9A-HJ-NP-Za-km-z]{80,90}$/;
const ADDR=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const USDC="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const minor=x=>typeof x==="string"&&/^(?:0|[1-9][0-9]*)$/.test(x)?BigInt(x):null;
const known=new Set(["processed","confirmed","finalized"]);
function parsedDelta(tx,owner){
 if(!tx||typeof tx!=="object"||!tx.meta||tx.meta.err!=null)return null;
 const balances=(rows)=>{
  if(!Array.isArray(rows))return null;
  let sum=0n,found=false;
  for(const item of rows){
   if(item?.mint!==USDC||item?.owner!==owner)continue;
   if(item?.uiTokenAmount?.decimals!==6)return null;
   const n=minor(item.uiTokenAmount.amount);
   if(n===null)return null;
   sum+=n;found=true;
  }
  return found?sum:0n;
 };
 const pre=balances(tx.meta.preTokenBalances),post=balances(tx.meta.postTokenBalances);
 if(pre===null||post===null)return null;
 const delta=post-pre;
 return delta===0n?null:delta.toString();
}
function rank(status){return {failed:5,finalized:4,confirmed:3,processing:2,pending:1,unverified:0}[status]??0;}
function chainStatus(status){
 if(!status||typeof status!=="object")return "unverified";
 if(status.err!=null)return "failed";
 if(status.err!==null||!known.has(status.confirmationStatus))return "unverified";
 return status.confirmationStatus==="finalized"?"finalized":
  status.confirmationStatus==="confirmed"?"confirmed":"processing";
}
export function normalizeWalletActivity({owner,entries,statuses,transactions={},local=[],now=Date.now()}={}){
 if(!ADDR.test(owner||"")||!Array.isArray(entries)||!Array.isArray(statuses)||
 statuses.length!==entries.length||!integer(now)||now<=0)
  throw Error("Unverified wallet activity response");
 const out=new Map();
 for(let i=0;i<entries.length;i++){
  const item=entries[i],sig=item?.signature;
  if(!SIG.test(sig||"")||!integer(item?.slot))throw Error("Malformed chain signature observation");
  const status=chainStatus(statuses[i]);
  const row={signature:sig,network:"mainnet-beta",owner,
   status,source:"solana-rpc",slot:item.slot,
   blockTime:integer(item.blockTime)?item.blockTime:null,
   kind:"transaction",deltaUsdcRaw:parsedDelta(transactions[sig],owner),
   observedAt:now,localKind:null,localAmountRaw:null,localDestination:null};
  const prior=out.get(sig);
  if(!prior||rank(row.status)>rank(prior.status))out.set(sig,row);
 }
 for(const record of local){
  if(record?.owner!==owner||!SIG.test(record.signature||""))continue;
  const prior=out.get(record.signature);
  if(prior){
   out.set(record.signature,{...prior,
    localKind:record.kind==="send"||record.kind==="swap"?record.kind:null,
    localAmountRaw:typeof record.amountRaw==="string"&&/^[0-9]+$/.test(record.amountRaw)?record.amountRaw:null,
    localDestination:typeof record.destination==="string"&&ADDR.test(record.destination)?record.destination:null});
  }else if(["pending","confirmed","finalized","failed"].includes(record.status)&&integer(record.submittedAt)){
   out.set(record.signature,{signature:record.signature,network:"mainnet-beta",owner,
    status:record.status==="pending"?"pending":"unverified",source:"local-recovery-journal",
    slot:null,blockTime:null,kind:"transaction",deltaUsdcRaw:null,
    observedAt:integer(record.checkedAt)?record.checkedAt:record.submittedAt,
    localKind:record.kind==="send"||record.kind==="swap"?record.kind:null,
    localAmountRaw:typeof record.amountRaw==="string"&&/^[0-9]+$/.test(record.amountRaw)?record.amountRaw:null,
    localDestination:typeof record.destination==="string"&&ADDR.test(record.destination)?record.destination:null});
  }
 }
 return [...out.values()].sort((a,b)=>(b.blockTime??Math.floor(b.observedAt/1000))-
  (a.blockTime??Math.floor(a.observedAt/1000))||
  (b.slot??0)-(a.slot??0)||a.signature.localeCompare(b.signature));
}
/** Merge at most N entries from wallet and token-account streams without dropping unconsumed signatures. */
export function selectActivityPage({wallet=[],usdc=[],limit=20,before={}}={}){
 if(!Number.isInteger(limit)||limit<1||limit>40)throw Error("Invalid history page size");
 const sources={wallet,usdc},seen=new Set(),combined=[];
 for(const [source,items] of Object.entries(sources)){
  if(!Array.isArray(items)||items.length>limit)throw Error("Malformed wallet history page");
  for(const entry of items){
   if(!SIG.test(entry?.signature||"")||!integer(entry.slot))
    throw Error("Malformed wallet history source");
   combined.push({source,entry});
  }
 }
 combined.sort((a,b)=>(b.entry.slot-a.entry.slot)||a.entry.signature.localeCompare(b.entry.signature));
 const selected=[],cursor={wallet:before?.wallet??null,usdc:before?.usdc??null};
 for(const item of combined){
  if(seen.has(item.entry.signature)){
   if(selected.some(x=>x.signature===item.entry.signature))cursor[item.source]=item.entry.signature;
   continue;
  }
  if(selected.length>=limit)break;
  seen.add(item.entry.signature);selected.push(item.entry);
  cursor[item.source]=item.entry.signature;
 }
 const consumed=new Set(selected.map(x=>x.signature));
 const moreInPage=combined.some(x=>!consumed.has(x.entry.signature));
 const mayHaveMore=moreInPage||wallet.length===limit||usdc.length===limit;
 return {entries:selected,nextCursor:mayHaveMore?cursor:null,pageScope:"wallet and canonical USDC ATA; other token accounts not indexed"};
}
