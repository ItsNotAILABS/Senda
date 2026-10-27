export type MatrixBar = {t:number;o:number;h:number;l:number;c:number;v:number};
export type MatrixCell = {id:string;label:string;signal:"bull"|"bear"|"neutral"|"blocked"|"caution";explain:string;weight:number};
export type MatrixState = {source:"gecko-pool"|"price-only";bars:number;volumeReliable:boolean;volumeUnit:string;close:number|null;volumeUsd:number|null;volumeRatio:number|null;obv:number|null;vwap:number|null;rsi:number|null;atrPct:number|null;emaFast:number|null;emaSlow:number|null;volumeScore:number|null;market:string;confidence:number;cells:MatrixCell[];reason:string};
export declare function normalizeBars(bars:unknown): MatrixBar[];
export declare function evaluateMatrix(input:{bars:MatrixBar[];source:string}):MatrixState;
