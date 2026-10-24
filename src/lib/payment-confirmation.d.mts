export declare function confirmSolanaPayment(
  signature: string,
  rpc: (method: string, params: unknown[]) => Promise<unknown>,
  options?: { attempts?: number; pauseMs?: number; sleep?: (ms: number) => Promise<unknown> },
): Promise<{ signature: string; confirmationStatus: string }>;
