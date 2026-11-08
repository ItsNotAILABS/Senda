/** Phantom wallet signing for an on-device Senda research acknowledgement.
 * Does NOT sign an exchange order, fund Kalshi or authorize Phantom Predict.
 */
import {toBase58,verifyWalletEd25519} from "@/lib/ed25519-wallet.mjs";
import {phantomProvider,waitForInjected} from "@/lib/phantom";
import {makePredictionAcknowledgement,validatePredictionAcknowledgement,type PredictionResearchRecord} from "@/lib/phantom-prediction-intent.mjs";

type PhantomMessageProvider={
 isPhantom?:boolean;
 publicKey?:{toString:()=>string};
 connect:(opts?:{onlyIfTrusted?:boolean})=>Promise<{publicKey?:{toString:()=>string}}>;
 signMessage?:(message:Uint8Array,display?:"utf8"|"hex")=>Promise<{signature:Uint8Array|number[];publicKey?:{toString:()=>string}}>;
};
export type PhantomResearchReceipt={record:PredictionResearchRecord;signature:string;wallet:string;verified:boolean;authority:"research-only";notice:string};
export async function signPhantomPredictionResearch({ticker,side,contracts,grossUsd,quotedAt}:{ticker:string;side:"yes"|"no";contracts:number;grossUsd:number;quotedAt:number}):Promise<PhantomResearchReceipt>{
 if(typeof window==="undefined"||!window.crypto?.getRandomValues)throw Error("Secure browser origin required for wallet authentication.");
 if(window.location.origin!=="https://senda.pocketnova.app")throw Error("Research signing is only enabled on the verified Senda production origin.");
 const injected=(phantomProvider()??await waitForInjected(3000)) as PhantomMessageProvider|null;
 if(!injected?.isPhantom) {
  throw Error("Open Senda inside the Phantom app or connect the Phantom extension first. A Solana wallet connection alone is not a Kalshi trading account.");
 }
 if(!injected.signMessage)throw Error("This Phantom provider does not expose a supported message-signing method.");
 const connection=await injected.connect();
 const wallet=connection.publicKey?.toString()||injected.publicKey?.toString()||"";
 if(!wallet||wallet!==injected.publicKey?.toString())throw Error("Phantom account changed during connection.");
 const nonceBytes=new Uint8Array(16);
 window.crypto.getRandomValues(nonceBytes);
 const nonce=Array.from(nonceBytes,byte=>byte.toString(16).padStart(2,"0")).join("");
 const built=makePredictionAcknowledgement({wallet,ticker,side,contracts,grossUsd,quotedAt,
  origin:window.location.origin,nonce});
 const message=new TextEncoder().encode(built.message);
 const response=await injected.signMessage(message,"utf8");
 const signature=Uint8Array.from(response?.signature||[]);
 if(signature.length!==64)throw Error("Phantom returned an invalid Ed25519 signature.");
 const returned=response.publicKey?.toString();
 if(returned&&returned!==wallet)throw Error("Phantom signed with another wallet.");
 if(!await verifyWalletEd25519(wallet,message,signature))
  throw Error("Could not verify the Phantom wallet signature.");
 if(Date.now()-quotedAt>30000)throw Error("Kalshi research quote expired while waiting for the signature. Refresh the market.");
 if(!validatePredictionAcknowledgement(built.record,Date.now()))
  throw Error("Research acknowledgement expired before verification.");
 return {record:built.record,signature:toBase58(signature),wallet,verified:true,
  authority:"research-only",notice:"Phantom verified that this wallet signed Senda research data. No Kalshi order, funds transfer or Phantom Predict session was authorized."};
}
