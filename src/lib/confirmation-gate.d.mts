export declare function waitForChainConfirmation(
  signature: string,
  getStatus: (signature: string) => Promise<{ err?: unknown; confirmationStatus?: string | null } | null>,
  options?: {
    attempts?: number;
    pauseMs?: number;
    sleep?: (ms: number) => Promise<unknown>;
  },
): Promise<{ signature: string; confirmationStatus: string }>;
