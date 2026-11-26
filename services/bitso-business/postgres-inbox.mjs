/**
 * PostgreSQL adapter for createBitsoWebhookInbox().
 * Requires node-postgres Pool from app server (already a Senda dependency).
 * No web routes, authentication handlers, wallet transfers, or payout writes here.
 */
export function createPostgresBitsoInboxStore(pool){
 if(!pool||typeof pool.connect!=="function")throw new Error("Private PostgreSQL pool required");
 return Object.freeze({
  async transaction(fn){
   if(typeof fn!=="function")throw new Error("Transaction callback required");
   const c=await pool.connect();
   try{
    await c.query("BEGIN");
    const tx=Object.freeze({
     async insertIfAbsent(row){
      if(!row||row.provider!=="bitso"||
        !["funding","withdrawal"].includes(row.eventType)||
        !["pending","processing","complete","failed"].includes(row.status)||
        !/^[a-f0-9]{64}$/.test(row.payloadSha256))
       throw new Error("Invalid Bitso inbox row");
      const {rowCount}=await c.query(
       "INSERT INTO bitso_business.webhook_inbox "+
       "(id,provider,account_id,event_type,provider_id,provider_status,payload_sha256) "+
       "VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING",
       [row.id,row.provider,row.accountId,row.eventType,row.providerId,row.status,row.payloadSha256]
      );
      return rowCount===1;
     },
     async enqueue(job){
      if(job?.kind!=="bitso-provider-reconcile")throw new Error("Invalid reconciliation job");
      await c.query(
       "INSERT INTO bitso_business.reconciliation_outbox "+
       "(inbox_id,account_id,provider_id,event_type,job_kind) "+
       "VALUES ($1,$2,$3,$4,$5) ON CONFLICT (inbox_id) DO NOTHING",
       [job.inboxId,job.accountId,job.providerId,job.eventType,job.kind]
      );
     }
    });
    const value=await fn(tx);
    await c.query("COMMIT");
    return value;
   }catch(e){
    try{await c.query("ROLLBACK");}catch{/* preserve original error */}
    throw e;
   }finally{c.release();}
  }
 });
}
/**
 * An outbox worker may claim up to 20 jobs using SKIP LOCKED.
 * Each claim must have an external worker/lease expiration and failure handler.
 * This function claims only; it never marks a payout settled.
 */
export async function claimBitsoReconciliationJobs(pool,{limit=10}={}){
 if(!Number.isSafeInteger(limit)||limit<1||limit>20)throw new Error("Invalid job limit");
 const c=await pool.connect();
 try{
  await c.query("BEGIN");
  const result=await c.query(
   "WITH picked AS (SELECT id FROM bitso_business.reconciliation_outbox "+
   "WHERE ((state='pending' AND available_at<=now()) OR (state='processing' AND lease_until<now())) ORDER BY id "+
   "FOR UPDATE SKIP LOCKED LIMIT $1) "+
   "UPDATE bitso_business.reconciliation_outbox AS o SET state='processing', "+
   "claimed_at=now(),lease_until=now()+interval '60 seconds',updated_at=now(),attempts=attempts+1 FROM picked WHERE o.id=picked.id "+
   "RETURNING o.id,o.inbox_id,o.account_id,o.provider_id,o.event_type,o.attempts",
   [limit]
  );
  await c.query("COMMIT");
  return result.rows;
 }catch(e){try{await c.query("ROLLBACK");}catch{}throw e;}
 finally{c.release();}
}


/**
 * Fenced resolution of a claimed outbox job. attempts is the worker fencing token.
 * Only an actual authenticated GET observation can be stored as a verified observation.
 * This does not mark user payouts settled, even if Bitso says "complete".
 */
function validJobId(value){return (Number.isSafeInteger(value)&&value>0)||(typeof value==="string"&&/^[1-9][0-9]{0,18}$/.test(value));}
export async function completeBitsoReconciliation(pool,{job,observation}={}){
 if(!validJobId(job?.id)||!Number.isSafeInteger(job?.attempts)||job.attempts<1)
  throw new Error("Invalid fenced job");
 if(observation?.source!=="authenticated-provider-query"||
    observation.providerId!==job.provider_id ||
    !["pending","processing","complete","failed","not_found"].includes(observation.status))
  throw new Error("Authenticated provider observation required");
 const c=await pool.connect();
 try{
  await c.query("BEGIN");
  const guard=await c.query(
   "SELECT id,account_id,provider_id FROM bitso_business.reconciliation_outbox "+
   "WHERE id=$1 AND attempts=$2 AND state='processing' AND lease_until>now() FOR UPDATE",
   [job.id,job.attempts]
  );
  if(guard.rows.length!==1)throw new Error("Reconciliation lease lost");
  const row=guard.rows[0];
  if(row.provider_id!==observation.providerId)
   throw new Error("Provider resource mismatch");
  await c.query(
   "INSERT INTO bitso_business.reconciliation_observations "+
   "(job_id,account_id,provider_id,source,provider_status,observed_currency,observed_amount,origin_id) "+
   "VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
   [job.id,row.account_id,row.provider_id,observation.source,
    observation.status,observation.currency??null,observation.amount??null,
    observation.originId??null]
  );
  await c.query(
   "UPDATE bitso_business.reconciliation_outbox "+
   "SET state='done',lease_until=NULL,updated_at=now(),last_error_code=NULL "+
   "WHERE id=$1 AND attempts=$2 AND state='processing'",
   [job.id,job.attempts]
  );
  await c.query("COMMIT");
  return {recorded:true,settlementVerified:false};
 }catch(e){try{await c.query("ROLLBACK");}catch{}throw e;}
 finally{c.release();}
}

/** Retry with bounded exponential backoff; dead-letter only after max attempts. */
export async function deferBitsoReconciliation(pool,{job,reason="provider_unavailable",maxAttempts=12}={}){
 if(!validJobId(job?.id)||!Number.isSafeInteger(job?.attempts)||job.attempts<1)
  throw new Error("Invalid retry job");
 if(!/^[a-z_]{1,40}$/.test(reason))throw new Error("Invalid retry reason");
 if(!Number.isSafeInteger(maxAttempts)||maxAttempts<1||maxAttempts>50)
  throw new Error("Invalid maximum attempts");
 const delaySeconds=Math.min(3600,2**Math.min(12,job.attempts)*10);
 const state=job.attempts>=maxAttempts?"dead_letter":"pending";
 const c=await pool.connect();
 try{
  const result=await c.query(
   "UPDATE bitso_business.reconciliation_outbox "+
   "SET state=$3,last_error_code=$4,lease_until=NULL,claimed_at=NULL,"+
   "available_at=now()+($5::integer*interval '1 second'),updated_at=now() "+
   "WHERE id=$1 AND attempts=$2 AND state='processing' RETURNING id",
   [job.id,job.attempts,state,reason,delaySeconds]
  );
  if(result.rowCount!==1)throw new Error("Reconciliation fencing conflict");
  return {state,delaySeconds};
 }finally{c.release();}
}
