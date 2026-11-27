/** Persist only directly observed public Solana chain receipts. Not a custodial ledger.
 * Local journal entries, client labels, account balances and user claims are excluded.
 */
const SIG=/^[1-9A-HJ-NP-Za-km-z]{80,90}$/;
const ADDRESS=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const RAW=/^-?(?:0|[1-9][0-9]*)$/;
const STATES=new Set(["confirmed","finalized","failed"]);
const integer=x=>Number.isSafeInteger(x)&&x>0;
export function verifiedReceiptRow(row,owner){
 if(!ADDRESS.test(owner||"")||!row||row.owner!==owner||row.source!=="solana-rpc"||
 row.network!=="mainnet-beta"||!SIG.test(row.signature||"")||
 !STATES.has(row.status)||!integer(row.slot)||!integer(row.observedAt))return null;
 if(row.blockTime!==null&&row.blockTime!==undefined&&!integer(row.blockTime))return null;
 if(row.deltaUsdcRaw!==null&&row.deltaUsdcRaw!==undefined&&
  (typeof row.deltaUsdcRaw!=="string"||!RAW.test(row.deltaUsdcRaw)))return null;
 // A transaction with an execution error never carried a verified token transfer.
 if(row.status==="failed"&&row.deltaUsdcRaw!=null)return null;
 return {network:"mainnet-beta",owner,signature:row.signature,status:row.status,
  slot:String(row.slot),blockTime:row.blockTime==null?null:String(row.blockTime),
  deltaUsdcRaw:row.deltaUsdcRaw??null,observedAt:row.observedAt};
}
export function collectVerifiedReceipts(rows,owner){
 if(!Array.isArray(rows)||rows.length>40||!ADDRESS.test(owner||""))throw Error("Invalid receipt batch");
 const known=new Map();
 for(const row of rows){
  const value=verifiedReceiptRow(row,owner);
  if(!value)continue;
  const old=known.get(value.signature);
  if(old&&old.status!==value.status&&
    !((old.status==="confirmed"&&value.status==="finalized")||
      (old.status==="finalized"&&value.status==="confirmed")))
   throw Error("Conflicting chain evidence in receipt batch");
  if(!old||value.status==="finalized")known.set(value.signature,value);
 }
 return [...known.values()];
}
/** Postgres adapter takes a trusted getSql() query method from the server, never browser SQL. */
export async function persistVerifiedReceipts(query,rows,owner){
 if(typeof query!=="function")throw Error("Receipt store requires a trusted query function");
 const receipts=collectVerifiedReceipts(rows,owner);
 let saved=0;
 for(const row of receipts){
  const res=await query(
   `INSERT INTO wallet_chain_receipt
    (network,owner,signature,status,slot,block_time,delta_usdc_raw,observed_at,checked_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,to_timestamp($8::double precision/1000.0),now())
    ON CONFLICT (network,owner,signature) DO UPDATE SET
      status=CASE WHEN wallet_chain_receipt.status='confirmed' AND EXCLUDED.status='finalized'
          THEN 'finalized' ELSE wallet_chain_receipt.status END,
      delta_usdc_raw=COALESCE(wallet_chain_receipt.delta_usdc_raw,EXCLUDED.delta_usdc_raw),
      checked_at=now()
    WHERE wallet_chain_receipt.status=EXCLUDED.status
       OR (wallet_chain_receipt.status='confirmed' AND EXCLUDED.status='finalized')
    RETURNING signature`,
   [row.network,row.owner,row.signature,row.status,row.slot,row.blockTime,row.deltaUsdcRaw,row.observedAt]
  );
  saved+=Array.isArray(res)?res.length:0;
 }
 return {observed:receipts.length,stored:saved,authority:"chain-rpc",execution:"disabled"};
}
/** Public blockchain history only; scope to one owner and bounded page size. */
export async function readVerifiedReceipts(query,{owner,network="mainnet-beta",limit=30,olderThanSlot=null}={}){
 if(typeof query!=="function"||!ADDRESS.test(owner||"")||network!=="mainnet-beta"||
 !Number.isInteger(limit)||limit<1||limit>50||
 (olderThanSlot!==null&&!integer(olderThanSlot)))
  throw Error("Invalid receipt history query");
 const rows=await query(
  `SELECT signature,status,slot::text AS slot,block_time::text AS block_time,
    delta_usdc_raw,extract(epoch from checked_at)*1000 AS checked_at
    FROM wallet_chain_receipt WHERE network=$1 AND owner=$2
    AND ($3::bigint IS NULL OR slot<$3::bigint)
    ORDER BY slot DESC,signature LIMIT $4`,
  [network,owner,olderThanSlot==null?null:String(olderThanSlot),limit]
 );
 return Array.isArray(rows)?rows:[];
}
