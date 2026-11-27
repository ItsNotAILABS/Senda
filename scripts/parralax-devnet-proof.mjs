/**
 * PARRALAX Solana Devnet program proof: chain presence and upgrade authority only.
 * Does NOT deploy, sign, audit, certify byte-for-byte source reproducibility or enable agents.
 */
import {createHash} from "node:crypto";
import {PublicKey,BPF_LOADER_UPGRADEABLE_PROGRAM_ID} from "@solana/web3.js";
export const PARRALAX_LOCALNET_PROGRAM_ID="5HJCtwtWWvDDQiMLVuvrwyqaVfXgX3hZnzMTarTKv61p";
export const SOLANA_DEVNET_GENESIS="EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const HASH=/^[a-f0-9]{64}$/;
const B58=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
function key(s,label){
 if(typeof s!=="string"||!B58.test(s))throw Error("Invalid "+label+" public key");
 try{return new PublicKey(s).toBase58()}catch{throw Error("Invalid "+label+" public key")}
}
function account(result){
 const value=result?.value;
 if(value==null)return null;
 if(typeof value!=="object"||typeof value.owner!=="string"||
 !Array.isArray(value.data)||value.data[1]!=="base64"||
 typeof value.data[0]!=="string"||typeof value.executable!=="boolean")
  throw Error("Untrusted Solana account response");
 const bytes=Buffer.from(value.data[0],"base64");
 if(!bytes.length||bytes.length>20_000_000)throw Error("Invalid Solana program account data");
 return {owner:value.owner,executable:value.executable,bytes};
}
function programPointer(program){
 if(!program||!program.executable||
 program.owner!==BPF_LOADER_UPGRADEABLE_PROGRAM_ID.toBase58()||
 program.bytes.length!==36||program.bytes.readUInt32LE(0)!==2)
  throw Error("Program is not a valid executable upgradeable BPF program");
 return new PublicKey(program.bytes.subarray(4,36)).toBase58();
}
function programData(programDataAccount){
 if(!programDataAccount||programDataAccount.executable||
 programDataAccount.owner!==BPF_LOADER_UPGRADEABLE_PROGRAM_ID.toBase58()||
 programDataAccount.bytes.length<45||programDataAccount.bytes.readUInt32LE(0)!==3)
  throw Error("ProgramData account is missing or owned by the wrong loader");
 const bytes=programDataAccount.bytes;
 if(bytes[12]!==1)throw Error("Program has no controlled upgrade authority");
 const authority=new PublicKey(bytes.subarray(13,45)).toBase58();
 const deployedAtSlot=bytes.readBigUInt64LE(4).toString();
 const rawProgramDataSha256=createHash("sha256").update(bytes.subarray(45)).digest("hex");
 return {authority,deployedAtSlot,rawProgramDataSha256};
}
/** rpc is an injected JSON-RPC caller (method,params)->result; no signing methods are called. */
export async function verifyParralaxDevnetProof({rpc,programId,expectedAuthority,expectedProgramDataSha256}={}){
 if(typeof rpc!=="function")throw Error("Trusted Solana RPC client required");
 const p=key(programId,"program"),authority=key(expectedAuthority,"upgrade authority");
 if(p===PARRALAX_LOCALNET_PROGRAM_ID)throw Error("Localnet test program ID cannot be used for devnet deployment");
 if(!HASH.test(expectedProgramDataSha256||""))throw Error("Pinned ProgramData SHA-256 is required");
 const genesis=await rpc("getGenesisHash",[]);
 if(genesis!==SOLANA_DEVNET_GENESIS)throw Error("RPC genesis is not Solana Devnet");
 const first=await rpc("getAccountInfo",[p,{encoding:"base64",commitment:"finalized"}]);
 const initialSlot=first?.context?.slot;
 if(!Number.isSafeInteger(initialSlot)||initialSlot<1)throw Error("RPC has no finalized context slot");
 if(first.value===null)return {schema:"parralax.devnet.proof.v1",status:"not-deployed",
  programId:p,network:"devnet",genesisHash:genesis,slot:initialSlot,chainProof:false,
  releaseReady:false,agentExecution:"disabled",
  reason:"No executable program is deployed at this managed program ID on Solana Devnet."};
 const pointer=programPointer(account(first));
 const second=await rpc("getMultipleAccounts",[
  [p,pointer],{encoding:"base64",commitment:"finalized",minContextSlot:initialSlot}
 ]);
 const slot=second?.context?.slot;
 if(!Number.isSafeInteger(slot)||slot<initialSlot||
 !Array.isArray(second?.value)||second.value.length!==2)
  throw Error("Solana program and ProgramData were not observed at one valid finalized context");
 const [observedProgram,observedProgramData]=second.value.map(value=>account({value}));
 if(programPointer(observedProgram)!==pointer)throw Error("ProgramData pointer changed during verification");
 const decoded=programData(observedProgramData);
 if(decoded.authority!==authority)throw Error("On-chain upgrade authority does not match the pinned multisig");
 if(decoded.rawProgramDataSha256!==expectedProgramDataSha256)
  throw Error("On-chain ProgramData hash does not match the pinned release hash");
 return {schema:"parralax.devnet.proof.v1",status:"chain-present",
  network:"devnet",genesisHash:genesis,slot,programId:p,
  programDataAddress:pointer,upgradeAuthority:authority,
  deployedAtSlot:decoded.deployedAtSlot,rawProgramDataSha256:decoded.rawProgramDataSha256,
  chainProof:true,sourceBuildVerified:false,securityAuditVerified:false,
  releaseReady:false,agentExecution:"disabled",
  reason:"Chain identity and binary account hash match. Independent source-build verification, audit, policy drills, deployment transaction receipts and funding controls remain mandatory."};
}
/** Read-only Solana RPC, with timeout and a fixed devnet origin. No private keys. */
export async function devnetRpc(method,params){
 if(!["getGenesisHash","getAccountInfo","getMultipleAccounts"].includes(method))
  throw Error("RPC method forbidden in devnet proof verifier");
 const r=await fetch("https://api.devnet.solana.com",{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({jsonrpc:"2.0",id:1,method,params}),
  signal:AbortSignal.timeout(15000),redirect:"error"
 });
 if(!r.ok)throw Error("Devnet RPC returned HTTP "+r.status);
 const body=await r.json();
 if(body?.error||!("result" in body))throw Error("Solana Devnet RPC verification request failed");
 return body.result;
}
