/** Reauthorize an agent's exact queued intent immediately before wallet interaction. */
export function authorizeWorkerTrade(worker, cap, symbol) {
  const deny=(m)=>{throw new Error(m+" No transaction was signed.");};
  if(!worker||worker.status!=="active"||worker.autonomy!=="queue"||
     !Array.isArray(worker.tools)||!worker.tools.includes("trade")||!worker.queue)
    deny("Worker is paused, unapproved or has no trade authority.");
  const q=worker.queue;
  if(q.side!=="buy"&&q.side!=="sell")deny("Unsupported side.");
  if(q.side!==worker.side)deny("Queued side differs from worker mandate.");
  if(typeof q.symbol!=="string"||q.symbol!==symbol)deny("Queued symbol changed.");
  if(Array.isArray(worker.symbols)&&worker.symbols.length&&
    !worker.symbols.some(s=>s.toUpperCase()===q.symbol.toUpperCase()))
      deny("Asset is outside the worker allowlist.");
  if(!Number.isFinite(worker.maxUsd)||!Number.isFinite(cap)||!Number.isFinite(q.usd)||
     q.usd<=0||q.usd>worker.maxUsd||q.usd>cap||cap<=0)deny("Trade exceeds authorized budget.");
  return {side:q.side,symbol:q.symbol,usd:q.usd};
}
