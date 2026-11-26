/** Server-side, read-only PARRALAX treasury balance. Never create wallet keys or sign. */
import {PublicKey} from "@solana/web3.js";
import {createTreasuryClient,decodeTreasury} from "./chain-client.mjs";

const TOKEN_PROGRAM=new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const U64=18446744073709551615n;
const address=x=>new PublicKey(x).toBase58();
const same=(a,b)=>address(a)===address(b);
const rawAmount=value=>{
 if(typeof value!=="string"||!/^(?:0|[1-9][0-9]{0,19})$/.test(value))throw Error("Untrusted token amount");
 const n=BigInt(value);if(n>U64)throw Error("Amount exceeds token u64");return value;
};
/**
 * Requires a signed-and-verified program id, pinned network genesis hash, and a caller-owned RPC.
 * Does not prove a program audit, legal custodial account, or bank deposit.
 */
export async function readAgentTreasuryAccount({connection,network,programId,verifiedProgramId,
 expectedGenesisHash,owner,mint,seedId=0n,commitment="confirmed"}={}){
 if(!connection||!["confirmed","finalized"].includes(commitment)||typeof expectedGenesisHash!=="string"||
 expectedGenesisHash.length<20)throw Error("Verified RPC and expected genesis hash required");
 const observedGenesis=await connection.getGenesisHash();
 if(observedGenesis!==expectedGenesisHash)throw Error("RPC genesis does not match pinned network");
 const client=createTreasuryClient({network,programId,verifiedProgramId});
 const ownerKey=new PublicKey(owner),mintKey=new PublicKey(mint);
 const {treasury,vault}=client.derive(ownerKey,mintKey,seedId);
 const [account,tokenAccount,slot]=await Promise.all([
  connection.getAccountInfo(treasury,commitment),
  connection.getParsedAccountInfo(vault,commitment),
  connection.getSlot(commitment)
 ]);
 if(!account) return {status:"not-created",network,owner:ownerKey.toBase58(),
  mint:mintKey.toBase58(),treasury:treasury.toBase58(),vault:vault.toBase58(),slot,
  amountMinor:null,canSpend:false,source:"verified-rpc",execution:"disabled"};
 if(!same(account.owner,client.programId))throw Error("Treasury account has wrong program owner");
 const row=decodeTreasury(account.data);
 if(!same(row.owner,ownerKey)||!same(row.mint,mintKey)||row.seedId!==BigInt(seedId))
  throw Error("Treasury on-chain owner, mint or seed mismatch");
 const val=tokenAccount?.value;
 if(!val||!same(val.owner,TOKEN_PROGRAM)||val.data?.program!=="spl-token"||
 !same(val.data?.parsed?.info?.owner,treasury)||!same(val.data?.parsed?.info?.mint,mintKey))
  throw Error("Treasury vault token owner or mint mismatch");
 const info=val.data.parsed.info;
 const amountMinor=rawAmount(info.tokenAmount?.amount);
 const decimals=info.tokenAmount?.decimals;
 if(!Number.isInteger(decimals)||decimals<0||decimals>18)throw Error("Invalid token decimals");
 return {schema:"senda.agent-money.chain-account.v1",status:"observed",network,
  treasury:treasury.toBase58(),vault:vault.toBase58(),owner:ownerKey.toBase58(),
  agent:row.agent.toBase58(),beneficiary:row.beneficiary.toBase58(),mint:mintKey.toBase58(),
  balanceMinor:amountMinor,decimals,perTxCapMinor:row.perTxCap.toString(),
  dailyCapMinor:row.dailyCap.toString(),lifetimeCapMinor:row.lifetimeCap.toString(),
  dailySpentMinor:row.dailySpent.toString(),lifetimeSpentMinor:row.lifetimeSpent.toString(),
  nextNonce:row.nextNonce.toString(),expiresAt:row.expiresAt.toString(),
  revoked:row.revoked,paused:row.paused,slot,source:"verified-rpc",
  finality:commitment,canSpend:false,execution:"disabled",
  note:"This is a chain account observation. Signing, account limits, recipient, current state, and transaction success must be independently enforced by a verified on-chain program."};
}
