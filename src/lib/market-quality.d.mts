export type MarketBar={t:number;o:number;h:number;l:number;c:number;v:number};
export type QualityStatus="no-data"|"stale"|"insufficient"|"price-only"|"volume-unverified"|"verified";
export type QualityResult={status:QualityStatus;source:string;tf:string;barCount:number;updatedAt:number|null;ageMs:number|null;lastClose:number|null;lastVolumeUsd:number|null;relativeVolume:number|null;vwap20:number|null;obv20:number|null;ema9:number|null;ema21:number|null;rsi14:number|null;atrPct:number|null;breakout:string|null;direction:string;alignment:number;checks:Array<string|{name:string;pass:boolean;detail:string}>;recommendation:string};
export declare const TIMEFRAME_MS:Readonly<Record<string,number>>;
export declare const MIN_BARS:number;
export declare function cleanMarketBars(input:unknown):MarketBar[];
export declare function inspectMarketQuality(input:{bars:MarketBar[];source:string;tf?:string;now?:number}):QualityResult;
export declare function shortlistMarkets<T extends {mint:string;symbol:string;name:string;venue:string;changePct?:number|null}>(rows:T[],query?:string,limit?:number):T[];
