export type WalletActivityRow={
 signature:string;network:"mainnet-beta";owner:string;
 status:"pending"|"processing"|"confirmed"|"finalized"|"failed"|"unverified";
 source:"solana-rpc"|"local-recovery-journal";slot:number|null;blockTime:number|null;
 kind:"transaction";deltaUsdcRaw:string|null;observedAt:number;
 localKind:"send"|"swap"|null;localAmountRaw:string|null;localDestination:string|null;
};
export type ActivityCursor={wallet:string|null;usdc:string|null};
export declare function normalizeWalletActivity(input:{
 owner:string;entries:Array<{signature:string;slot:number;blockTime?:number|null}>;
 statuses:Array<{err?:unknown;confirmationStatus?:string|null}|null>;
 transactions?:Record<string,unknown>;
 local?:Array<{owner:string;signature:string;kind:string;status:string;
  amountRaw:string;destination:string;submittedAt:number;checkedAt?:number}>;
 now?:number;
}):WalletActivityRow[];
export declare function selectActivityPage(input:{
 wallet?:Array<{signature:string;slot:number;blockTime?:number|null}>;
 usdc?:Array<{signature:string;slot:number;blockTime?:number|null}>;
 limit?:number;before?:ActivityCursor;
}):{entries:Array<{signature:string;slot:number;blockTime?:number|null}>;
 nextCursor:ActivityCursor|null;pageScope:string};
export declare function mergeActivityWithRecovery(input:{owner:string;chain?:WalletActivityRow[];
 local?:Array<{owner:string;signature:string;kind:string;status:string;amountRaw:string;
 destination:string;submittedAt:number;checkedAt?:number}>;now?:number}):WalletActivityRow[];
