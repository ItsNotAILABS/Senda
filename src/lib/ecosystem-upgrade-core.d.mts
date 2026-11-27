/** Precise boundary for the read-only Jupiter sell-sizing helper. */
export declare function deriveRoundTripSellRaw(buyQuote:{
 inputMint:string;outputMint:string;inAmount:string;outAmount:string;
 otherAmountThreshold:string;
},expectedUsdcRaw:string,targetMint:string):string;
