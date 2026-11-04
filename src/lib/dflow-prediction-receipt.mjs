/** Durable local DFlow prediction submission receipts. Chain confirmation != CLP fill. */
export const DFLOW_RECEIPT_KEY="senda.prediction.dflow.v1";
const ADDRESS=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const TICKER=/^[A-Z0-9][A-Z0-9._-]{2,119}$/;
const SIG=/^[1-9A-HJ-NP-Za-km-z]{80,100}$/;
const ACTIVE=new Set(["pending","open","pendingClose","unverified"]);
const STATUSES=new Set([...ACTIVE,"closed","failed","expired"]);
export function readDflowReceipts(storage){
 if(!storage||typeof storage.getItem!=="function")throw Error("Prediction recovery storage unavailable");
 let rows;
 try{rows=JSON.parse(storage.getItem(DFLOW_RECEIPT_KEY)||"[]");}
 catch{throw Error("Prediction receipt ledger is corrupted. Check venue before trading again.");}
 if(!Array.isArray(rows)||!rows.every(r=>r&&ADDRESS.test(r.wallet)&&TICKER.test(r.ticker)&&SIG.test(r.signature)&&
  ["yes","no"].includes(r.side)&&/^[1-9][0-9]*$/.test(r.amountRaw)&&STATUSES.has(r.status)&&Number.isSafeInteger(r.submittedAt)))
  throw Error("Prediction receipt ledger contains invalid entries. Reconcile before trading again.");
 return rows;
}
function write(storage,rows){storage.setItem(DFLOW_RECEIPT_KEY,JSON.stringify(rows.slice(0,100)));}
export function ensureNoDuplicatePrediction(storage,{wallet,ticker,side,amountRaw}){
 const rows=readDflowReceipts(storage);
 if(rows.some(r=>r.wallet===wallet&&r.ticker===ticker&&r.side===side&&r.amountRaw===amountRaw&&ACTIVE.has(r.status)))
  throw Error("An identical prediction order may still be pending. Reconcile it first.");
}
export function recordDflowSubmitted(storage,{wallet,ticker,side,amountRaw,signature,lastValidBlockHeight},now=Date.now()){
 if(!ADDRESS.test(wallet)||!TICKER.test(ticker)||!["yes","no"].includes(side)||!/^[1-9][0-9]*$/.test(amountRaw)||
  !SIG.test(signature)||!Number.isSafeInteger(lastValidBlockHeight)||lastValidBlockHeight<=0||!Number.isSafeInteger(now))
  throw Error("Cannot record invalid prediction submission metadata.");
 const rows=readDflowReceipts(storage);
 const existing=rows.find(r=>r.signature===signature);
 if(existing)return existing;
 const entry={wallet,ticker,side,amountRaw,signature,lastValidBlockHeight,submittedAt:now,status:"pending",source:"DFlow CLP"};
 write(storage,[entry,...rows]);
 return entry;
}
export function observeDflowReceipt(storage,signature,status){
 if(!STATUSES.has(status))throw Error("Unexpected DFlow status");
 const rows=readDflowReceipts(storage);
 const row=rows.find(r=>r.signature===signature);
 if(!row)throw Error("Unknown prediction transaction");
 if(["closed","expired","failed"].includes(row.status))return row;
 row.status=status;
 row.checkedAt=Date.now();
 write(storage,rows);
 return row;
}
