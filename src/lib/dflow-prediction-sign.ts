/** Real Phantom-signed DFlow Solana onchain outcome intent.
 * This is NOT the U.S. Phantom/Kalshi mobile account order flow.
 * Requires approved DFlow API, Proof KYC, independent jurisdiction verdict, user review.
 */
import {toBase58,verifyWalletEd25519,decodeBase64} from "@/lib/ed25519-wallet.mjs";
import {Buffer} from "buffer";
import {phantomProvider,waitForInjected,sendVersioned} from "@/lib/phantom";
import {sealOpen,unlockSeal} from "@/lib/seal";
import {withWalletExecutionLock} from "@/lib/wallet-execution-lock.mjs";
import {prepareDflowPredictionOrder,getDflowPredictionStatus} from "@/lib/dflow-predictions";
import {ensureNoDuplicatePrediction,recordDflowSubmitted,observeDflowReceipt} from "@/lib/dflow-prediction-receipt.mjs";
import {validateDflowPrograms,type DflowOrder} from "@/lib/dflow-prediction-core.mjs";
const MINT=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
type SolanaSignMessageProvider={
 isPhantom?:boolean;
 publicKey?:{toString:()=>string};
 connect:()=>Promise<{publicKey?:{toString:()=>string}}>;
 signMessage?:(message:Uint8Array,display?:"utf8"|"hex")=>Promise<{signature:Uint8Array;publicKey?:{toString:()=>string}}>;
};
export async function connectPhantomForDflow():Promise<string>{
 const p=(phantomProvider()??await waitForInjected(3000)) as SolanaSignMessageProvider|null;
 if(!p?.isPhantom)throw Error("Open Senda in Phantom mobile or connect the Phantom extension.");
 const c=await p.connect();
 const wallet=c.publicKey?.toString()||p.publicKey?.toString()||"";
 if(!MINT.test(wallet)||wallet!==p.publicKey?.toString())throw Error("Phantom wallet identity mismatch.");
 await unlockSeal(wallet); // canonical wallet-bound encrypted recovery state
 return wallet;
}
export async function startDflowProofVerification(wallet:string):Promise<void>{
 if(typeof window==="undefined"||window.location.origin!=="https://senda.pocketnova.app")
  throw Error("Proof identity verification requires Senda's production domain.");
 const p=(phantomProvider()??await waitForInjected(3000)) as SolanaSignMessageProvider|null;
 if(!p?.isPhantom||!p.signMessage)throw Error("Use Phantom to sign the Proof KYC wallet-ownership message.");
 if(!MINT.test(wallet)||p.publicKey?.toString()!==wallet)throw Error("Connect the wallet requiring verification.");
 const timestamp=Date.now().toString();
 const signed=await p.signMessage(new TextEncoder().encode("Proof KYC verification: "+timestamp),"utf8");
 const signature=Uint8Array.from(signed.signature);
 if(!await verifyWalletEd25519(wallet,new TextEncoder().encode("Proof KYC verification: "+timestamp),signature))
  throw Error("Phantom Proof KYC signature did not verify.");
 const url=new URL("https://dflow.net/proof");
 url.searchParams.set("wallet",wallet);
 url.searchParams.set("signature",toBase58(signature));
 url.searchParams.set("timestamp",timestamp);
 url.searchParams.set("redirect_uri","https://senda.pocketnova.app/social/events");
 window.location.assign(url.toString());
}
export async function signDflowPrediction({wallet,ticker,side,amountUsd,order}:{
 wallet:string;ticker:string;side:"yes"|"no";amountUsd:number;order:DflowOrder;
}):Promise<{signature:string;status:string;filled:boolean;amountUsd:number}>{
 if(typeof window==="undefined"||!MINT.test(wallet)||!(amountUsd>=1&&amountUsd<=250))throw Error("Invalid execution request");
 if(!sealOpen())throw Error("Unlock Senda with Phantom first so your signed transaction can be kept in the recovery journal.");
 const owner=await connectPhantomForDflow();
 if(owner!==wallet)throw Error("Wallet switched since the DFlow quote was prepared.");
 const amountRaw=String(Math.round(amountUsd*1e6));
 if(order.recipientWallet!==wallet||order.inAmount!==amountRaw||Date.now()>order.quoteExpiry||
  order.inputMint!=="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
  throw Error("DFlow quote expired or does not match this wallet/amount. Request a fresh order.");
 return withWalletExecutionLock(wallet,async()=>{
  ensureNoDuplicatePrediction(window.localStorage,{wallet,ticker,side,amountRaw});
  const raw=decodeBase64(order.transaction);
  if(raw.length>1232||raw.length<64)throw Error("DFlow transaction is outside Solana packet-size limits.");
  if(!globalThis.Buffer)globalThis.Buffer=Buffer;
  const {PublicKey,VersionedTransaction}=await import("@solana/web3.js");
  const tx=VersionedTransaction.deserialize(raw);
  if(tx.version!==0||!("addressTableLookups" in tx.message)||
     tx.message.addressTableLookups.length>0)
    throw Error("DFlow returned an unverified legacy or address-lookup transaction. Program review required.");
  if(tx.message.header.numRequiredSignatures!==1||
     !tx.message.staticAccountKeys[0]?.equals(new PublicKey(wallet)))
    throw Error("DFlow returned a transaction with an unexpected fee payer or additional signers.");
  const programIds=tx.message.compiledInstructions.map(instruction=>{
    const key=tx.message.staticAccountKeys[instruction.programIdIndex];
    if(!key)throw Error("DFlow transaction references an unresolved program ID.");
    return key.toBase58();
  });
  validateDflowPrograms(order.allowedProgramIds||[],programIds);
  // Phantom presents this real transaction for explicit approval.
  const signature=await sendVersioned(tx);
  try{recordDflowSubmitted(window.localStorage,{
   wallet,ticker,side,amountRaw,signature,lastValidBlockHeight:order.lastValidBlockHeight
  });}catch(e){throw Error("Transaction "+signature+" was submitted, but could not be saved locally. Check it before retrying: "+String(e));}
  let status="pending",filled=false;
  for(let i=0;i<12;i++){
   await new Promise<void>(resolve=>setTimeout(resolve,2000));
   const progress=await getDflowPredictionStatus({data:{signature,wallet,lastValidBlockHeight:order.lastValidBlockHeight}});
   if(progress.status==="unavailable")continue;
   status=progress.status;
   try{observeDflowReceipt(window.localStorage,signature,status)}catch{ /* retain signature for manual recovery */ }
   if(progress.terminal){filled=progress.success;break;}
  }
  return {signature,status,filled,amountUsd};
 });
}
