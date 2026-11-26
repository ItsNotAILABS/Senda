/** Read-only PARRALAX treasury. One RPC context slot for treasury, vault and mint. */
import {PublicKey} from "@solana/web3.js";
import {unpackAccount,unpackMint,TOKEN_PROGRAM_ID} from "@solana/spl-token";
import {createTreasuryClient,decodeTreasury} from "./chain-client.mjs";

const U64=18446744073709551615n;
const address=x=>new PublicKey(x).toBase58();
const same=(a,b)=>address(a)===address(b);
const rawAmount=value=>{
 const n=BigInt(value);if(n<0n||n>U64)throw Error("Untrusted SPL u64 amount");return n.toString();
};
/**
 * Requires a pinned chain genesis, verified program ID, and an authenticated RPC supplied
 * by the caller. This is observational: no wallet signing, spending, or bank deposit.
 */
export async function readAgentTreasuryAccount({connection,network,programId,verifiedProgramId,
 expectedGenesisHash,owner,mint,seedId=0n,commitment="confirmed"}={}){
 if(!connection||!["confirmed","finalized"].includes(commitment)||
 typeof expectedGenesisHash!=="string"||expectedGenesisHash.length<20)
  throw Error("Verified RPC and expected genesis hash required");
 const observedGenesis=await connection.getGenesisHash();
 if(observedGenesis!==expectedGenesisHash)throw Error("RPC genesis does not match pinned network");
 const client=createTreasuryClient({network,programId,verifiedProgramId});
 const ownerKey=new PublicKey(owner),mintKey=new PublicKey(mint);
 const {treasury,vault}=client.derive(ownerKey,mintKey,seedId);
 const snapshot=await connection.getMultipleAccountsInfoAndContext([treasury,vault,mintKey],commitment);
 const slot=snapshot?.context?.slot,accounts=snapshot?.value;
 if(!Number.isSafeInteger(slot)||slot<1||!Array.isArray(accounts)||accounts.length!==3)
  throw Error("Unverified atomic RPC account snapshot");
 const [treasuryInfo,vaultInfo,mintInfo]=accounts;
 if(!treasuryInfo)return {schema:"senda.agent-money.chain-account.v1",
  status:"not-created",network,owner:ownerKey.toBase58(),mint:mintKey.toBase58(),
  treasury:treasury.toBase58(),vault:vault.toBase58(),slot,
  balanceMinor:null,canSpend:false,source:"same-slot-verified-rpc",execution:"disabled"};
 if(!same(treasuryInfo.owner,client.programId))throw Error("Treasury account has wrong program owner");
 const row=decodeTreasury(treasuryInfo.data);
 if(!same(row.owner,ownerKey)||!same(row.mint,mintKey)||row.seedId!==BigInt(seedId))
  throw Error("Treasury on-chain owner, mint or seed mismatch");
 if(!vaultInfo||!mintInfo)throw Error("Treasury vault or mint account missing");
 const token=unpackAccount(vault,vaultInfo,TOKEN_PROGRAM_ID);
 const mintAccount=unpackMint(mintKey,mintInfo,TOKEN_PROGRAM_ID);
 if(!same(token.owner,treasury)||!same(token.mint,mintKey))throw Error("Treasury vault token owner or mint mismatch");
 const amount=rawAmount(token.amount);
 if(!Number.isInteger(mintAccount.decimals)||mintAccount.decimals<0||mintAccount.decimals>18)
  throw Error("Invalid token mint decimals");
 return {schema:"senda.agent-money.chain-account.v1",status:"observed",network,
  treasury:treasury.toBase58(),vault:vault.toBase58(),owner:ownerKey.toBase58(),
  agent:row.agent.toBase58(),beneficiary:row.beneficiary.toBase58(),mint:mintKey.toBase58(),
  balanceMinor:amount,decimals:mintAccount.decimals,perTxCapMinor:row.perTxCap.toString(),
  dailyCapMinor:row.dailyCap.toString(),lifetimeCapMinor:row.lifetimeCap.toString(),
  dailySpentMinor:row.dailySpent.toString(),lifetimeSpentMinor:row.lifetimeSpent.toString(),
  nextNonce:row.nextNonce.toString(),expiresAt:row.expiresAt.toString(),
  revoked:row.revoked,paused:row.paused,slot,source:"same-slot-verified-rpc",
  finality:commitment,canSpend:false,execution:"disabled",
  note:"Single RPC-context observation, not a signing grant or bank deposit. Independently verify program security and current chain state again at transaction submission."};
}
