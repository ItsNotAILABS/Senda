/**
 * Senda <-> PARRALAX on-chain treasury client, program layout v2
 * (ItsNotAILABS/PARRALAX-AIHFTFUND PR #17, program source in solana/programs/agent-treasury).
 *
 * Server-only transaction *construction*, NOT signing, sending or confirmation.
 * Callers must independently verify program address/upgrade authority and simulate transactions.
 *
 * v2 vs v1 (breaking):
 *  - Treasury PDA seeds are ["treasury", owner, mint, seed_id as u64 LE]. Agent and beneficiary
 *    are no longer seeds, so the owner can rotate the agent without moving funds and run several
 *    treasuries per (owner, mint) by picking different seed_ids.
 *  - initialize(seed_id: u64, params: PolicyParams, guardian: Option<Pubkey>).
 *  - New instructions: update_policy, rotate_agent, set_guardian, pause (owner or guardian),
 *    unpause (owner), revoke (owner or guardian), close (owner; drains vault, returns rent).
 *  - Error 6010 is now Paused (was ClockRegression); 6011 Unauthorized, 6012 MintNotAllowed and
 *    6013 InvalidExpiry are new.
 *
 * The program ID is configuration, never a constant trusted by this module. The ID in the
 * program source today is a LOCALNET / TEST key; it is refused on any other cluster.
 */
import { createHash } from "node:crypto";
import { PublicKey, TransactionInstruction, SystemProgram } from "@solana/web3.js";

export const TREASURY_LAYOUT_VERSION = 2;
/** Program ID declared in the v2 program source. Localnet/test only: its keypair is not managed. */
export const LOCALNET_PROGRAM_ID = "5HJCtwtWWvDDQiMLVuvrwyqaVfXgX3hZnzMTarTKv61p";
export const NETWORKS = Object.freeze(["localnet", "devnet", "mainnet-beta"]);

const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const SYSTEM = SystemProgram.programId;
const PLACEHOLDER = SYSTEM.toBase58();
const SEED = Buffer.from("treasury");
const U64_MAX = 18446744073709551615n;

/** Anchor custom errors, code -> name (6000 + declaration index in error.rs). */
export const TREASURY_ERRORS = Object.freeze({
 6000: "InvalidAuthority",
 6001: "InvalidCaps",
 6002: "Expired",
 6003: "Revoked",
 6004: "InvalidAmount",
 6005: "PerTransactionLimit",
 6006: "DailyLimit",
 6007: "LifetimeLimit",
 6008: "InvalidNonce",
 6009: "Overflow",
 6010: "Paused",
 6011: "Unauthorized",
 6012: "MintNotAllowed",
 6013: "InvalidExpiry",
});
export function treasuryErrorName(code){ return TREASURY_ERRORS[Number(code)] ?? null; }

function key(value){ return value instanceof PublicKey?value:new PublicKey(value); }
function u64(value){
 const n=BigInt(value);if(n<0n||n>U64_MAX)throw Error("u64 out of range");
 const out=Buffer.alloc(8);out.writeBigUInt64LE(n);return out;
}
function i64(value){
 const n=BigInt(value);if(n<(-9223372036854775808n)||n>9223372036854775807n)throw Error("i64 out of range");
 const out=Buffer.alloc(8);out.writeBigInt64LE(n);return out;
}
function optionPubkey(value){
 return value==null?Buffer.from([0]):Buffer.concat([Buffer.from([1]),key(value).toBuffer()]);
}
function discriminator(name){return createHash("sha256").update("global:"+name).digest().subarray(0,8);}
const ACCOUNT_DISCRIMINATOR=createHash("sha256").update("account:Treasury").digest().subarray(0,8);
const meta=(pubkey,isSigner=false,isWritable=false)=>({pubkey,isSigner,isWritable});

/** Validate PolicyParams the same way the program does (caps; expiry checked against `nowSec`). */
export function encodePolicy({perTxMinor,dailyMinor,lifetimeMinor,expiresAt},nowSec=Math.floor(Date.now()/1000)){
 const per=BigInt(perTxMinor),day=BigInt(dailyMinor),life=BigInt(lifetimeMinor);
 if(per<=0n||per>day||day>life||life>U64_MAX)throw Error("Invalid limits: require 0 < perTx <= daily <= lifetime");
 if(!Number.isSafeInteger(expiresAt)||expiresAt<=nowSec)throw Error("Expiry must be in the future");
 return Buffer.concat([u64(per),u64(day),u64(life),i64(expiresAt)]);
}

/**
 * Resolve client config from environment-style input. Nothing is defaulted silently:
 * the network must be explicit, and the localnet test program ID is refused off localnet.
 */
export function treasuryConfigFromEnv(env=process.env){
 const network=String(env.SENDA_TREASURY_NETWORK||"").trim();
 const programId=String(env.SENDA_TREASURY_PROGRAM_ID||"").trim();
 const verifiedProgramId=String(env.SENDA_TREASURY_VERIFIED_PROGRAM_ID||"").trim();
 if(!network||!programId||!verifiedProgramId)return null;
 return {network,programId,verifiedProgramId};
}

export function createTreasuryClient({programId,verifiedProgramId,network}){
 if(!NETWORKS.includes(network))throw Error("Explicit cluster required");
 const program=key(programId);
 if(program.toBase58()===PLACEHOLDER || program.toBase58()!==verifiedProgramId)
   throw Error("Unverified or placeholder program ID");
 if(network!=="localnet"&&program.toBase58()===LOCALNET_PROGRAM_ID)
   throw Error("The v2 source program ID is localnet/test only; configure the managed program ID for "+network);

 /** Treasury PDA for (owner, mint, seedId) and its associated-token vault. */
 function derive(owner,mint,seedId=0n){
  const m=key(mint);
  const [treasury,bump]=PublicKey.findProgramAddressSync([SEED,key(owner).toBuffer(),m.toBuffer(),u64(seedId)],program);
  const [vault]=PublicKey.findProgramAddressSync([treasury.toBuffer(),TOKEN.toBuffer(),m.toBuffer()],ASSOCIATED);
  return {treasury,vault,bump};
 }
 function make(ix,accounts,bytes){
  return new TransactionInstruction({programId:program,keys:accounts,data:Buffer.concat([discriminator(ix),...bytes])});
 }
 function positive(amountMinor){ if(BigInt(amountMinor)<=0n)throw Error("Invalid amount"); return amountMinor; }

 function initialize({owner,agent,beneficiary,mint,seedId=0n,perTxMinor,dailyMinor,lifetimeMinor,expiresAt,guardian=null,nowSec}){
  const o=key(owner),a=key(agent),b=key(beneficiary),m=key(mint),g=guardian==null?null:key(guardian);
  if(o.equals(a)||a.equals(b)||(g&&g.equals(a)))throw Error("Agent authority cannot match owner, recipient or guardian");
  const policy=encodePolicy({perTxMinor,dailyMinor,lifetimeMinor,expiresAt},nowSec);
  const {treasury,vault}=derive(o,m,seedId);
  return {treasury,vault,instruction:make("initialize",[
   meta(o,true,true),meta(a),meta(b),meta(m),meta(treasury,false,true),
   meta(vault,false,true),meta(TOKEN),meta(ASSOCIATED),meta(SYSTEM)
  ],[u64(seedId),policy,optionPubkey(g)])};
 }
 function deposit({owner,mint,seedId=0n,ownerToken,amountMinor}){
  const o=key(owner),m=key(mint),{treasury,vault}=derive(o,m,seedId);
  return make("deposit",[
   meta(o,true),meta(treasury),meta(m),meta(key(ownerToken),false,true),
   meta(vault,false,true),meta(TOKEN)
  ],[u64(positive(amountMinor))]);
 }
 /** Agent-signed. `nonce` must equal the treasury's on-chain next_nonce (read it with decodeTreasury). */
 function spend({owner,agent,mint,seedId=0n,beneficiaryToken,amountMinor,nonce}){
  const m=key(mint),{treasury,vault}=derive(owner,m,seedId);
  return make("spend",[
   meta(key(agent),true),meta(treasury,false,true),meta(m),meta(vault,false,true),
   meta(key(beneficiaryToken),false,true),meta(TOKEN)
  ],[u64(positive(amountMinor)),u64(nonce)]);
 }
 function withdraw({owner,mint,seedId=0n,ownerToken,amountMinor}){
  const o=key(owner),m=key(mint),{treasury,vault}=derive(o,m,seedId);
  return make("withdraw",[
   meta(o,true),meta(treasury),meta(m),meta(vault,false,true),
   meta(key(ownerToken),false,true),meta(TOKEN)
  ],[u64(positive(amountMinor))]);
 }
 function ownerAction(name,{owner,mint,seedId=0n},bytes=[]){
  const o=key(owner),{treasury}=derive(o,mint,seedId);
  return make(name,[meta(o,true),meta(treasury,false,true)],bytes);
 }
 const updatePolicy=(input)=>ownerAction("update_policy",input,[encodePolicy(input,input.nowSec)]);
 const rotateAgent=(input)=>ownerAction("rotate_agent",input,[key(input.newAgent).toBuffer()]);
 const setGuardian=(input)=>ownerAction("set_guardian",input,[optionPubkey(input.guardian??null)]);
 const unpause=(input)=>ownerAction("unpause",input);
 /** Owner or guardian. `authority` defaults to the owner. */
 function guardianAction(name,{owner,mint,seedId=0n,authority}){
  const {treasury}=derive(owner,mint,seedId);
  return make(name,[meta(key(authority??owner),true),meta(treasury,false,true)],[]);
 }
 const pause=(input)=>guardianAction("pause",input);
 const revoke=(input)=>guardianAction("revoke",input);
 /** Owner only: drains the vault to ownerToken, closes the vault and the treasury, returns rent. */
 function close({owner,mint,seedId=0n,ownerToken}){
  const o=key(owner),m=key(mint),{treasury,vault}=derive(o,m,seedId);
  return make("close",[
   meta(o,true,true),meta(treasury,false,true),meta(m),meta(vault,false,true),
   meta(key(ownerToken),false,true),meta(TOKEN)
  ],[]);
 }
 return Object.freeze({network,programId:program,layoutVersion:TREASURY_LAYOUT_VERSION,derive,
  initialize,deposit,spend,withdraw,updatePolicy,rotateAgent,setGuardian,pause,unpause,revoke,close,
  signingSupported:false});
}

/** Decode a v2 Treasury account (Anchor/borsh). Throws on a wrong discriminator or layout version. */
export function decodeTreasury(data){
 const buf=Buffer.from(data);
 if(buf.length<8||!buf.subarray(0,8).equals(ACCOUNT_DISCRIMINATOR))throw Error("Not a Treasury account");
 let o=8;
 const need=n=>{if(o+n>buf.length)throw Error("Truncated Treasury account");};
 const u8=()=>{need(1);return buf[o++];};
 const u64r=()=>{need(8);const v=buf.readBigUInt64LE(o);o+=8;return v;};
 const i64r=()=>{need(8);const v=buf.readBigInt64LE(o);o+=8;return v;};
 const pk=()=>{need(32);const v=new PublicKey(buf.subarray(o,o+32));o+=32;return v;};
 const bool=()=>u8()!==0;
 const version=u8();
 if(version!==TREASURY_LAYOUT_VERSION)throw Error("Unsupported treasury layout version "+version);
 const bump=u8(),seedId=u64r(),owner=pk(),mint=pk(),beneficiary=pk(),agent=pk();
 const guardian=u8()===1?pk():null;
 return {version,bump,seedId,owner,mint,beneficiary,agent,guardian,
  perTxCap:u64r(),dailyCap:u64r(),lifetimeCap:u64r(),dailySpent:u64r(),lifetimeSpent:u64r(),
  lastRefillAt:i64r(),expiresAt:i64r(),nextNonce:u64r(),revoked:bool(),paused:bool()};
}
