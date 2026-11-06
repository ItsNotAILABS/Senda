/**
 * Senda <-> PARRALAX on-chain treasury client.
 * Server-only transaction *construction*, NOT signing, sending or confirmation.
 * Callers must independently verify program address/upgrade authority and simulate transactions.
 */
import { createHash } from "node:crypto";
import { PublicKey, TransactionInstruction, SystemProgram } from "@solana/web3.js";

const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const SYSTEM = SystemProgram.programId;
const PLACEHOLDER = SYSTEM.toBase58();
function key(value){ return value instanceof PublicKey?value:new PublicKey(value); }
function u64(value){
 const n=BigInt(value);if(n<0n||n>18446744073709551615n)throw Error("u64 out of range");
 const out=Buffer.alloc(8);out.writeBigUInt64LE(n);return out;
}
function i64(value){
 const n=BigInt(value);if(n<(-9223372036854775808n)||n>9223372036854775807n)throw Error("i64 out of range");
 const out=Buffer.alloc(8);out.writeBigInt64LE(n);return out;
}
function discriminator(name){return createHash("sha256").update("global:"+name).digest().subarray(0,8);}
const meta=(pubkey,isSigner=false,isWritable=false)=>({pubkey,isSigner,isWritable});
export function createTreasuryClient({programId,verifiedProgramId,network}){
 if(!["devnet","localnet","mainnet-beta"].includes(network))throw Error("Explicit cluster required");
 const program=key(programId);
 if(program.toBase58()===PLACEHOLDER || program.toBase58()!==verifiedProgramId)
   throw Error("Unverified or placeholder program ID");
 function derive(owner,agent,beneficiary,mint){
  const [treasury,bump]=PublicKey.findProgramAddressSync([
   Buffer.from("treasury"),key(owner).toBuffer(),key(agent).toBuffer(),key(beneficiary).toBuffer(),key(mint).toBuffer()
  ],program);
  const [vault]=PublicKey.findProgramAddressSync([
   treasury.toBuffer(),TOKEN.toBuffer(),key(mint).toBuffer()
  ],ASSOCIATED);
  return {treasury,vault,bump};
 }
 function make(ix, accounts, bytes){
  return new TransactionInstruction({programId:program,keys:accounts,data:Buffer.concat([discriminator(ix),...bytes])});
 }
 function initialize({owner,agent,beneficiary,mint,perTxMinor,dailyMinor,lifetimeMinor,expiresAt}){
  const o=key(owner),a=key(agent),b=key(beneficiary),m=key(mint);
  const {treasury,vault}=derive(o,a,b,m);
  if(o.equals(a)||a.equals(b))throw Error("Agent authority cannot match owner or recipient");
  const per=BigInt(perTxMinor),day=BigInt(dailyMinor),life=BigInt(lifetimeMinor);
  if(per<=0n||per>day||day>life)throw Error("Invalid limits");
  return {treasury,vault,instruction:make("initialize",[
   meta(o,true,true),meta(a),meta(b),meta(m),meta(treasury,false,true),
   meta(vault,false,true),meta(TOKEN),meta(ASSOCIATED),meta(SYSTEM)
  ],[u64(per),u64(day),u64(life),i64(expiresAt)])};
 }
 function deposit({owner,agent,beneficiary,mint,ownerToken,amountMinor}){
  const o=key(owner),m=key(mint),{treasury,vault}=derive(o,agent,beneficiary,m);
  if(BigInt(amountMinor)<=0n)throw Error("Invalid amount");
  return make("deposit",[
   meta(o,true,true),meta(treasury),meta(m),meta(key(ownerToken),false,true),
   meta(vault,false,true),meta(TOKEN)
  ],[u64(amountMinor)]);
 }
 function spend({owner,agent,beneficiary,mint,beneficiaryToken,amountMinor,nonce}){
  const a=key(agent),m=key(mint),{treasury,vault}=derive(owner,a,beneficiary,m);
  if(BigInt(amountMinor)<=0n)throw Error("Invalid amount");
  return make("spend",[
   meta(a,true),meta(treasury,false,true),meta(m),meta(vault,false,true),
   meta(key(beneficiaryToken),false,true),meta(TOKEN)
  ],[u64(amountMinor),u64(nonce)]);
 }
 function revoke({owner,agent,beneficiary,mint}){
  const o=key(owner),{treasury}=derive(o,agent,beneficiary,mint);
  return make("revoke",[meta(o,true),meta(treasury,false,true)],[]);
 }
 function withdraw({owner,agent,beneficiary,mint,ownerToken,amountMinor}){
  const o=key(owner),m=key(mint),{treasury,vault}=derive(o,agent,beneficiary,m);
  if(BigInt(amountMinor)<=0n)throw Error("Invalid amount");
  return make("withdraw",[
   meta(o,true),meta(treasury),meta(m),meta(vault,false,true),
   meta(key(ownerToken),false,true),meta(TOKEN)
  ],[u64(amountMinor)]);
 }
 return Object.freeze({network,programId:program,derive,initialize,deposit,spend,revoke,withdraw,signingSupported:false});
}
