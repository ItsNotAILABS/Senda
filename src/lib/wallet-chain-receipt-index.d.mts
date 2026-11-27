import type {WalletActivityRow} from "./wallet-activity-core.mjs";
export type IndexedReceipt={
 network:"mainnet-beta";owner:string;signature:string;status:"confirmed"|"finalized"|"failed";
 slot:string;blockTime:string|null;deltaUsdcRaw:string|null;observedAt:number;
};
export type SqlQuery=(statement:string,values?:unknown[])=>Promise<unknown[]>;
export declare function verifiedReceiptRow(row:WalletActivityRow,owner:string):IndexedReceipt|null;
export declare function collectVerifiedReceipts(rows:WalletActivityRow[],owner:string):IndexedReceipt[];
export declare function persistVerifiedReceipts(query:SqlQuery,rows:WalletActivityRow[],owner:string):
 Promise<{observed:number;stored:number;authority:"chain-rpc";execution:"disabled"}>;
export declare function readVerifiedReceipts(query:SqlQuery,input:{
 owner:string;network?:"mainnet-beta";limit?:number;olderThanSlot?:number|null;
}):Promise<Array<{signature:string;status:string;slot:string;block_time:string|null;
 delta_usdc_raw:string|null;checked_at:number}>>;
export type ReceiptCursor={slot:number;signature:string};
export type StoredChainReceipt={signature:string;status:string;slot:string;block_time:string|null;delta_usdc_raw:string|null;checked_at:number};
export declare function readVerifiedReceiptPage(query:SqlQuery,input:{
 owner:string;network?:"mainnet-beta";limit?:number;cursor?:ReceiptCursor|null;olderThanSlot?:number|null;
}):Promise<{rows:StoredChainReceipt[];nextCursor:ReceiptCursor|null;hasMore:boolean;
 source:"public-chain-receipt-index";pageScope:string}>;
