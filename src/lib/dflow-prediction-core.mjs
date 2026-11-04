/** DFlow proof-backed, signer-owned Solana prediction order safety contracts. */
export const USDC="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const TICKER=/^[A-Z0-9][A-Z0-9._-]{2,119}$/;
const MINT=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const RAW=/^[1-9][0-9]{0,16}$/;
export function parseDflowMarket(ticker,raw,now=Date.now()){
 if(!TICKER.test(ticker))throw Error("Invalid event ticker");
 const m=raw?.market&&typeof raw.market==="object"?raw.market:raw;
 if(!m||m.ticker!==ticker)throw Error("DFlow market ticker mismatch");
 if(m.status!=="active"&&m.status!=="open")throw Error("DFlow event is not open");
 const close=Number(m.closeTime??0);
 if(close>0 && (close<1e12?close*1000:close)<=now)throw Error("Prediction market has closed");
 const accounts=m.accounts?.[USDC];
 if(!accounts||!MINT.test(accounts.yesMint)||!MINT.test(accounts.noMint)||accounts.yesMint===accounts.noMint)
  throw Error("DFlow did not provide two verified USDC outcome mints");
 return {ticker,yesMint:accounts.yesMint,noMint:accounts.noMint,status:m.status,closeTime:close,
  source:"DFlow verified market metadata",settlementMint:USDC,readAt:now};
}
export function validateDflowOrder({raw,wallet,inputMint,outputMint,amountRaw,at=Date.now()}){
 if(!MINT.test(wallet)||inputMint!==USDC||!MINT.test(outputMint)||!RAW.test(amountRaw))
  throw Error("Invalid wallet, mint or raw amount");
 if(!raw||typeof raw!=="object")throw Error("No authoritative DFlow order response");
 if(raw.inputMint!=null && raw.inputMint!==inputMint)throw Error("DFlow input mint mismatch");
 if(raw.outputMint!=null && raw.outputMint!==outputMint)throw Error("DFlow outcome mint mismatch");
 if(String(raw.inAmount)!==amountRaw)throw Error("DFlow input amount mismatch");
 if(!RAW.test(String(raw.outAmount??""))||!RAW.test(String(raw.minOutAmount??"")))throw Error("DFlow quote has no positive minimum outcome");
 if(BigInt(raw.minOutAmount)>BigInt(raw.outAmount))throw Error("DFlow min output exceeds quote");
 if(!["async","sync"].includes(raw.executionMode))throw Error("Unknown DFlow execution mode");
 if(typeof raw.transaction!=="string"||raw.transaction.length<60||raw.transaction.length>3000||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(raw.transaction))throw Error("Missing or malformed DFlow unsigned transaction");
 if(!Number.isSafeInteger(raw.lastValidBlockHeight)||raw.lastValidBlockHeight<=0)throw Error("No transaction block expiry bound");
 const impact=Number(raw.priceImpactPct??0);
 if(!Number.isFinite(impact)||impact<0||impact>0.05)throw Error("Price impact exceeds 5% guard"); // API impact in fraction units
 return {inputMint,outputMint,inAmount:amountRaw,outAmount:String(raw.outAmount),minOutAmount:String(raw.minOutAmount),
  executionMode:raw.executionMode,transaction:raw.transaction,lastValidBlockHeight:raw.lastValidBlockHeight,
  priceImpactPct:raw.priceImpactPct??null,preparedAt:at,
  source:"DFlow Trade API",recipientWallet:wallet,quoteExpiry:at+15000};
}
export function evaluateDflowEligibility({proof,enabled,partnerApproved,regionApproved,market}){
 if(!enabled)return {ready:false,reason:"Senda's DFlow prediction execution lane is not enabled."};
 if(!partnerApproved)return {ready:false,reason:"Senda has not received DFlow's production integration approval."};
 if(!regionApproved)return {ready:false,reason:"A verified jurisdiction/age eligibility decision is required."};
 if(proof?.verified!==true)return {ready:false,reason:"This wallet is not verified by DFlow Proof."};
 if(!market?.yesMint||!market?.noMint)return {ready:false,reason:"The selected event has no confirmed outcome mints."};
 return {ready:true,reason:"Eligible for a fresh server quote; wallet signature still required."};
}
export function terminalDflowStatus(value){
 const allowed=new Set(["pending","open","pendingClose","closed","expired","failed"]);
 if(!allowed.has(value))return {terminal:false,success:false,unknown:true};
 return {terminal:["closed","expired","failed"].includes(value),success:value==="closed",unknown:false};
}

const BASIC_PROGRAMS=new Set([
 "11111111111111111111111111111111", // System
 "ComputeBudget111111111111111111111111111111", // Compute budget
 "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", // SPL token
 "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", // Token-2022
 "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL" // ATA
]);
export function validateDflowPrograms(approved,observed){
 if(!Array.isArray(approved)||!approved.length||!approved.every(x=>MINT.test(x)))
  throw Error("No independently reviewed DFlow program allowlist configured");
 if(!Array.isArray(observed)||!observed.length||!observed.every(x=>MINT.test(x)))
  throw Error("Prediction transaction contains no verifiable program IDs");
 const allowed=new Set([...BASIC_PROGRAMS,...approved]);
 if(!observed.some(x=>approved.includes(x)))throw Error("No approved DFlow program executed by transaction");
 for(const id of observed)if(!allowed.has(id))throw Error("Unreviewed program in prediction transaction: "+id);
 return true;
}
