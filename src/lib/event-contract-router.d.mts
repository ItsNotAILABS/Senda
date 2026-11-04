export type EventBook={ticker:string;asOf:number;source:string;yesBids:Array<{bid:number;size:number}>;noBids:Array<{bid:number;size:number}>;unit:string;quoteOnly:boolean};
export type EventQuote={available:boolean;reason:string;side?:string;contracts?:number;quotedAt?:number;grossCostUsd?:number;avgPriceUsd?:number;maximumPayoutUsd?:number;maximumLossBeforeFeesUsd?:number;maximumProfitBeforeFeesUsd?:number;fees?:string;notExecutable?:boolean;filled?:number;remaining?:number};
export declare const EVENT_TEMPLATES:Array<{id:string;name:string;subject:string;product:string;caution:string}>;
export declare function normalizeEventBook(ticker:string,raw:unknown,asOf?:number):EventBook;
export declare function planEventSide(book:EventBook|null,side:"yes"|"no",contracts:number,now?:number):EventQuote;
export declare function evaluateEventProduct(input:{templateId:string;book:EventBook|null;side:"yes"|"no";contracts:number;budgetUsd:number;now?:number}):{ready:boolean;reason:string;quote?:EventQuote;template?:typeof EVENT_TEMPLATES[number];budgetRemainingBeforeFees?:number;execution?:string;legalForm?:string};
export declare function eventMarketUrl(ticker:string):string|null;
