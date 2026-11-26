export type MarketLane = "all"|"sports"|"economy"|"crypto"|"weather"|"world"|"technology"|"culture";
export type SortMode = "activity"|"closing"|"tight-spread";
export type MarketLike={ticker:string;title?:string;yes?:string;category?:string;event?:string;vol?:number;bid?:number|null;ask?:number|null;close?:string};
export declare const MARKET_LANES:readonly {id:MarketLane;name:string;description:string}[];
export declare function classifyMarket(market:MarketLike):MarketLane|"other";
export declare function marketSpread(market:MarketLike):number|null;
export declare function selectMarkets<T extends MarketLike>(rows:T[],filter?:{lane?:MarketLane;q?:string;sort?:SortMode}):T[];
