/**
 * Bitso Trading API READ ONLY (server-side). Not FXaaS or SPEI entitlement.
 * See https://docs.bitso.com/bitso-api/docs/create-signed-requests
 * Never load from a browser bundle or accept client-chosen URLs/paths.
 */
import {createHmac} from "node:crypto";
const HOSTS=Object.freeze({stage:"https://stage.bitso.com",production:"https://bitso.com"});
const PATH="/api/v3/balance/";
export function signBalance({key,secret,nonce}){
  if(!key || !secret || !/^[0-9]+$/.test(String(nonce)))throw new Error("Missing credentials or invalid nonce");
  const signature=createHmac("sha256",secret).update(String(nonce)+"GET"+PATH).digest("hex");
  return "Bitso "+key+":"+nonce+":"+signature;
}
export function createBitsoBalanceReader({environment="stage",key,secret,nonceFactory,fetchImpl=globalThis.fetch}={}){
  if(!Object.hasOwn(HOSTS,environment))throw new Error("Unsupported Bitso environment");
  // A shared key needs a durable, strictly increasing nonce allocator across all instances.
  if(typeof nonceFactory!=="function")throw new Error("Monotonic nonce allocator required");
  if(typeof fetchImpl!=="function")throw new Error("HTTP transport required");
  return Object.freeze({
    async getBalance(){
      const nonce=await nonceFactory();
      const auth=signBalance({key,secret,nonce});
      const response=await fetchImpl(HOSTS[environment]+PATH,{
        method:"GET",headers:{Authorization:auth,Accept:"application/json"},
        redirect:"error",cache:"no-store",signal:AbortSignal.timeout(8000)
      });
      if(!response.ok)throw new Error("Bitso balance request failed: "+response.status);
      const json=await response.json();
      if(json?.success!==true || !Array.isArray(json?.payload?.balances))
        throw new Error("Invalid Bitso balance response");
      return json.payload.balances;
    }
  });
}
export const BITSO_CAPABILITIES=Object.freeze({
  tradingBalance:"read-only-adapter",businessFx:"not-connected",
  speiPayout:"not-connected",liveSettlement:"unverified"
});