import type { JournalDraft, JournalEntry } from './tx-journal.mjs';
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
export declare function confirmTrackedSubmission(
  storage: StorageLike,
  draft: JournalDraft,
  rpc: (method: string, params: unknown[]) => Promise<unknown>,
  options?: { attempts?: number; pauseMs?: number; sleep?: (ms: number) => Promise<unknown> },
): Promise<{ signature: string; confirmationStatus: string }>;
