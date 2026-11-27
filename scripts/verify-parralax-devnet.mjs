/** Operator-only public-chain verifier. No private key or signing operations. */
import {verifyParralaxDevnetProof,devnetRpc} from "./parralax-devnet-proof.mjs";
const required=(key)=>{
 const value=process.env[key]?.trim();
 if(!value)throw Error("Missing required public proof configuration: "+key);
 return value;
};
try{
 const proof=await verifyParralaxDevnetProof({
  rpc:devnetRpc,
  programId:required("PARRALAX_DEVNET_PROGRAM_ID"),
  expectedAuthority:required("PARRALAX_DEVNET_UPGRADE_AUTHORITY"),
  expectedProgramDataSha256:required("PARRALAX_DEVNET_PROGRAMDATA_SHA256")
 });
 console.log(JSON.stringify({...proof,verifiedAt:new Date().toISOString()},null,2));
 if(proof.status!=="chain-present")process.exitCode=2;
}catch(error){
 console.error("PARRALAX devnet verification failed:",error instanceof Error?error.message:"Unknown verification error");
 process.exitCode=1;
}
