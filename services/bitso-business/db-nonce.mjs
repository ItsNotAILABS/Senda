import {createHash} from "node:crypto";

/**
 * DB-sequenced Bitso API nonces across Vercel instances / workers.
 * Config only on trusted backend. Never log the API key.
 * Atomic upsert prevents duplicate nonces even under concurrency.
 */
export function createBitsoNonceAllocator(pool,{apiKey,clock=Date.now}={}){
 if(typeof apiKey!=="string"||!apiKey||!pool||typeof pool.query!=="function")
  throw new Error("Private API key scope and PostgreSQL pool required");
 const keyScope=createHash("sha256").update(apiKey,"utf8").digest("hex");
 return Object.freeze({
  async next(){
   const base=BigInt(clock())*1000n;
   if(base<=0n)throw new Error("Invalid nonce clock");
   const result=await pool.query(
    "INSERT INTO bitso_business.readonly_nonces (key_scope,last_nonce) VALUES ($1,$2::numeric) "+
    "ON CONFLICT (key_scope) DO UPDATE SET last_nonce = "+
    "GREATEST(bitso_business.readonly_nonces.last_nonce+1,EXCLUDED.last_nonce) "+
    "RETURNING last_nonce::text AS nonce",
    [keyScope,String(base)]
   );
   const nonce=result.rows?.[0]?.nonce;
   if(typeof nonce!=="string" || !/^[0-9]+$/.test(nonce))
    throw new Error("Nonce allocation failed");
   return nonce;
  }
 });
}
