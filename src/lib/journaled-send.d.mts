import type { JournalDraft, JournalEntry } from "./tx-journal.mjs";
type StorageLike = Pick<Storage, "getItem" | "setItem">;
type Rpc = (method: string, params: unknown[]) => Promise<unknown>;
export type PreparedSignature = { mode: "signed"; raw: Uint8Array; signature: string } | { mode: "sent"; signature: string };
export declare class SendOutcomeUncertain extends Error {
  uncertain: true;
  signature: string | null;
  constructor(message: string, signature?: string | null, cause?: unknown);
}
export declare function markNotBroadcast(error: unknown): Error & { notBroadcast: true };
export declare function classifySendError(error: unknown): { uncertain: boolean; signature: string | null; failedOnChain?: boolean };
export declare function journaledSend(input: {
  storage: StorageLike;
  draft: Omit<JournalDraft, "signature"> & { lastValidBlockHeight?: number };
  sign: () => Promise<PreparedSignature>;
  preflight?: (raw: Uint8Array) => Promise<void>;
  send: (raw: Uint8Array) => Promise<string>;
  rpc: Rpc;
  confirmOptions?: { attempts?: number; pauseMs?: number; sleep?: (ms: number) => Promise<unknown> };
  now?: number;
}): Promise<{ signature: string; confirmationStatus: string }>;
export declare function checkSendRecovery(input: {
  storage: StorageLike;
  owner: string;
  rpc: Rpc;
  signature?: string | null;
  now?: number;
}): Promise<{ state: "paid" | "pending" | "clear"; rows: JournalEntry[] }>;
