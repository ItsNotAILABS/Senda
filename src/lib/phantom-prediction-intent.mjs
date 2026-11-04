/** Signed Senda research acknowledgement, never a Kalshi/Phantom order or deposit. */
const TICKER=/^[A-Z0-9][A-Z0-9._-]{2,119}$/;
const SOL_ADDRESS=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const PREDICTION_ACK_DOMAIN="senda.pocketnova.app";
export function makePredictionAcknowledgement({wallet,ticker,side,contracts,grossUsd,quotedAt,origin,nonce,createdAt=Date.now()}){
 if(!SOL_ADDRESS.test(wallet))throw Error("Invalid Solana wallet address");
 if(!TICKER.test(ticker)||!["yes","no"].includes(side))throw Error("Invalid market intent");
 if(!Number.isInteger(contracts)||contracts<1||contracts>1000)throw Error("Invalid contract count");
 if(!Number.isFinite(grossUsd)||grossUsd<=0||grossUsd>100000)throw Error("Invalid gross research estimate");
 if(!Number.isSafeInteger(quotedAt)||quotedAt>createdAt||createdAt-quotedAt>30000)throw Error("Research quote expired");
 if(!/^https:\/\/[a-z0-9.-]+(?::\d{1,5})?$/.test(origin)||new URL(origin).hostname!==PREDICTION_ACK_DOMAIN)throw Error("Only the Senda production origin may create an acknowledgement");
 if(typeof nonce!=="string"||!/^[0-9a-f]{32}$/.test(nonce))throw Error("A new 128-bit random challenge is required");
 if(!Number.isSafeInteger(createdAt)||createdAt<=0)throw Error("Invalid timestamp");
 const record={
  kind:"senda.prediction.research-ack.v1",domain:PREDICTION_ACK_DOMAIN,origin,nonce,
  issuedAt:new Date(createdAt).toISOString(),expiresAt:new Date(createdAt+2*60_000).toISOString(),
  wallet,market:ticker,outcome:side,contracts,
  grossResearchUsd:Math.round(grossUsd*100)/100,
  approvedAction:"READ_ONLY_RESEARCH_ACKNOWLEDGEMENT",
  tradingAuthority:"NONE",venue:"Kalshi (public market research)",
  execution:"NOT_SUBMITTED",fundsMoved:false
 };
 return {record,message:[
  "SENDA | Event Market Research Only",
  "This signature acknowledges a public market research preview. It is NOT an order, deposit, insurance purchase, or permission to trade.",
  "No account authentication or trading authority for Kalshi or Phantom is granted.",
  ...Object.entries(record).map(([key,value])=>key+": "+String(value))
 ].join("\n")};
}
export function validatePredictionAcknowledgement(record,now=Date.now()){
 if(!record||record.kind!=="senda.prediction.research-ack.v1"||
 record.domain!==PREDICTION_ACK_DOMAIN||record.approvedAction!=="READ_ONLY_RESEARCH_ACKNOWLEDGEMENT"||
 record.tradingAuthority!=="NONE"||record.execution!=="NOT_SUBMITTED"||record.fundsMoved!==false)return false;
 const t=Date.parse(record.issuedAt),end=Date.parse(record.expiresAt);
 return Number.isFinite(t)&&Number.isFinite(end)&&now>=t&&now<=end&&end-t===120000;
}
