/** Read-only treasury status. Never derives signing authority from an app wallet. */
import {createServerFn} from "@tanstack/react-start";
import {z} from "zod";
import type {AgentTreasuryChainView} from "../../integrations/parralax-treasury/agent-account-read.mjs";
const schema=z.object({owner:z.string().min(32).max(44),seedId:z.string().regex(/^(?:0|[1-9][0-9]{0,19})$/).default("0")});
type AccountStatus={
 status:"unconfigured"|"unavailable"|"not-created"|"observed";
 reason:string;network:string|null;observedAt:number;
 account:AgentTreasuryChainView|null;
};
const cache=new Map<string,{expires:number,value:AccountStatus}>();
export const getAgentTreasuryStatus=createServerFn({method:"POST"})
 .validator((value:unknown)=>schema.parse(value))
 .handler(async({data}):Promise<AccountStatus>=>{
  const now=Date.now(),env=process.env;
  const cfg={
   enabled:env.SENDA_AGENT_TREASURY_READ_ENABLED==="true",
   network:env.SENDA_TREASURY_NETWORK??"",
   rpcUrl:env.SENDA_TREASURY_RPC_URL??"",
   programId:env.SENDA_TREASURY_PROGRAM_ID??"",
   verifiedProgramId:env.SENDA_TREASURY_VERIFIED_PROGRAM_ID??"",
   expectedGenesisHash:env.SENDA_TREASURY_GENESIS_HASH??"",
   mint:env.SENDA_TREASURY_MINT??""
  };
  const unavailable=(status:"unconfigured"|"unavailable",reason:string):AccountStatus=>({
   status,reason,network:cfg.network||null,observedAt:now,account:null
  });
  if(!cfg.enabled||!["devnet","mainnet-beta"].includes(cfg.network)||
   !cfg.rpcUrl||!cfg.programId||!cfg.verifiedProgramId||
   !cfg.expectedGenesisHash||!cfg.mint)
   return unavailable("unconfigured","No verified PARRALAX treasury deployment is configured for this application.");
  let url:URL;
  try{
   url=new URL(cfg.rpcUrl);
   if(url.protocol!=="https:"||url.username||url.password)throw Error("Invalid RPC URL");
  }catch{return unavailable("unconfigured","Pinned treasury RPC endpoint is not configured safely.")}
  const key=cfg.network+"|"+data.owner+"|"+data.seedId;
  const cached=cache.get(key);
  if(cached&&cached.expires>now)return cached.value;
  try{
   const [{Connection,PublicKey},{readAgentTreasuryAccount}]=await Promise.all([
    import("@solana/web3.js"),
    import("../../integrations/parralax-treasury/agent-account-read.mjs")
   ]);
   const owner=new PublicKey(data.owner).toBase58();
   const connection=new Connection(cfg.rpcUrl,{commitment:"confirmed"});
   const result=await readAgentTreasuryAccount({
    connection,network:cfg.network as "devnet"|"mainnet-beta",
    programId:cfg.programId,verifiedProgramId:cfg.verifiedProgramId,
    expectedGenesisHash:cfg.expectedGenesisHash,owner,mint:cfg.mint,
    seedId:BigInt(data.seedId),commitment:"confirmed"
   });
   const state:AccountStatus={
    status:result.status,reason:result.status==="not-created"?
     "No treasury exists at this owner/mint/seed. No funds were inferred.":
     "Observed from a pinned, same-slot Solana RPC account snapshot; read only.",
    network:cfg.network,observedAt:now,account:result
   };
   if(cache.size>100)cache.clear();
   cache.set(key,{expires:now+10000,value:state});
   return state;
  }catch{return unavailable("unavailable","Treasury chain ownership, mint and account evidence could not be verified. No execution is available.")}
 });
