export type VolumeBar={t:number;buyUsd:number|null;sellUsd:number|null;totalUsd:number|null;netUsd:number|null;trades:number|null;observed:boolean};
export type NativeVolume={schema:string;mint:string;source:string;unit:string;basis:string;direction:string;interval:string;from:number;to:number;observedAt:string;complete:boolean;coverage:string;pricedSwaps:number;unpricedSwaps:number;totalSwapsObserved:number;buyUsd:number;sellUsd:number;observedUsd:number;bars:VolumeBar[];note:string};
export declare const USDC_MINT:string;
export declare function aggregateSolscanVolume(input:{mint:string;events:unknown[];start:number;end:number;tf?:"15m"|"1H"|"4H"|"1D";complete?:boolean;observedAt?:string;observedThrough?:number}):NativeVolume;
