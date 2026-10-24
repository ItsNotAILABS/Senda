export type JournalEntry = {
 signature: string; owner: string; kind: 'swap' | 'send'; asset: string; destination: string;
 amountRaw: string; submittedAt: number; checkedAt: number; status: 'pending' | 'confirmed' | 'finalized' | 'failed';
};
export type JournalDraft = Omit<JournalEntry, 'submittedAt' | 'checkedAt' | 'status'> & { amountRaw: string | number | bigint };
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
export declare const JOURNAL_KEY: string;
export declare function listTransactions(storage: StorageLike, owner?: string): JournalEntry[];
export declare function assertNoPendingDuplicate(storage: StorageLike, candidate: Pick<JournalDraft, 'owner' | 'kind' | 'asset' | 'destination' | 'amountRaw'>, now?: number): void;
export declare function recordSubmission(storage: StorageLike, candidate: JournalDraft, now?: number): JournalEntry;
export declare function observeTransaction(storage: StorageLike, owner: string, signature: string, chainStatus: { err?: unknown; confirmationStatus?: string | null } | null, now?: number): JournalEntry | null;
export declare function reconcileTransactions(storage: StorageLike, owner: string, rpc: (method: string, params: unknown[]) => Promise<unknown>, now?: number): Promise<JournalEntry[]>;
