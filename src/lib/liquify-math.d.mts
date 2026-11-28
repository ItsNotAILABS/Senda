export declare function rawToUi(raw:unknown,decimals:number):string|null;
export type CurveRow={usd:number;status:string;tokens:string|null;usdPerToken:number|null;router:string|null;feeBps:number|null;impactPct:number|null;reason:string|null;executionPremiumPct:number|null};
export declare function describeCurve(sizes:unknown[],decimals:number):CurveRow[];
export declare function curveCoverage(rows:unknown[]):{available:number;total:number;maxQuotedUsd:number;hasRoutableSize:boolean};
export type JupiterQuote={inAmount:string;outAmount:string;router:string;mode:string;feeBps:number|null;impactPct:number|null;observedAt:string};
export declare function quoteFromJupiter(raw:unknown,amount:string):JupiterQuote|null;
