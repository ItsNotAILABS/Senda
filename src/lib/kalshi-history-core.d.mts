export type KalshiHistoryBar={time:number;priceUsd:number|null;volumeContracts:number|null;openInterestContracts:number|null};
export declare const HISTORY_WINDOWS:readonly {id:"24h"|"7d"|"30d";name:string;days:number;interval:number}[];
export declare function normalizeKalshiCandles(rows:unknown,window?:{from?:number;to?:number}):KalshiHistoryBar[];
