export type DflowReceipt={wallet:string;ticker:string;side:"yes"|"no";amountRaw:string;signature:string;lastValidBlockHeight:number;submittedAt:number;status:string;source:string;checkedAt?:number};
export declare const DFLOW_RECEIPT_KEY:string;
export declare function readDflowReceipts(storage:Storage):DflowReceipt[];
export declare function ensureNoDuplicatePrediction(storage:Storage,input:{wallet:string;ticker:string;side:"yes"|"no";amountRaw:string}):void;
export declare function recordDflowSubmitted(storage:Storage,input:{wallet:string;ticker:string;side:"yes"|"no";amountRaw:string;signature:string;lastValidBlockHeight:number},now?:number):DflowReceipt;
export declare function observeDflowReceipt(storage:Storage,signature:string,status:string):DflowReceipt;
