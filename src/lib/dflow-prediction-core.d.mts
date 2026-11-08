export type DflowMarket={ticker:string;yesMint:string;noMint:string;status:string;closeTime:number;source:string;settlementMint:string;readAt:number};
export type DflowOrder={inputMint:string;outputMint:string;inAmount:string;outAmount:string;minOutAmount:string;executionMode:"sync"|"async";transaction:string;lastValidBlockHeight:number;priceImpactPct:number|string|null;preparedAt:number;source:string;recipientWallet:string;quoteExpiry:number;allowedProgramIds?:string[]};
export declare const USDC:string;
export declare function parseDflowMarket(ticker:string,raw:unknown,now?:number):DflowMarket;
export declare function validateDflowOrder(input:{raw:unknown;wallet:string;inputMint:string;outputMint:string;amountRaw:string;at?:number}):DflowOrder;
export declare function evaluateDflowEligibility(input:{proof:{verified:boolean}|null;enabled:boolean;partnerApproved:boolean;regionApproved:boolean;market:DflowMarket|null}):{ready:boolean;reason:string};
export declare function terminalDflowStatus(value:string):{terminal:boolean;success:boolean;unknown:boolean};

export declare function validateDflowPrograms(approved:string[],observed:string[]):true;
