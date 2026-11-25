export type NonceStore = { consume(nonce: string, expiresAt: number, now?: number): Promise<boolean> };
export declare const RECEIVE_AUTH_MAX_AGE_MS: number;
export declare const RECEIVE_AUTH_MAX_SKEW_MS: number;
export declare const BRIDGE_TIMEOUT_MS: number;
export declare function receiveAuthorizationMessage(input: { owner: string; currency: string; signedAt: number; userId: string; nonce: string }): string;
export declare function verifyReceiveAuthorization(input: {
  owner: string; ownerKeyBytes: Uint8Array; currency: string; signedAt: number; nonce: string; signature: string;
  userId: string; nonceStore: NonceStore; now?: number;
}): Promise<{ ok: true } | { ok: false; error: string }>;
export declare function createMemoryNonceStore(): NonceStore;
export declare function createSqlNonceStore(query: (text: string, params: unknown[]) => Promise<unknown[]>): NonceStore;
export declare function fetchWithTimeout(url: string, init?: RequestInit, opts?: { timeoutMs?: number; fetchImpl?: typeof fetch }): Promise<Response>;
export declare function bridgeUserError(status: number | "timeout" | "network"): string;
