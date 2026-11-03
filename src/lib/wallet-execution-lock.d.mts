/** Advisory wallet-transaction lock. Server-side idempotency is still required. */
export declare function withWalletExecutionLock<T>(
  owner: string,
  execute: () => Promise<T>,
  locks?: LockManager | null,
): Promise<T>;
