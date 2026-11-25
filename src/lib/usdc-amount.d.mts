export declare const USDC_DECIMALS: number;
export declare const MAX_TRANSFER_CENTS: number;
export declare function assertCents(cents: number): number;
export declare function usdNumberToCents(usd: number): number;
export declare function centsToUsdcRaw(cents: number): bigint;
export declare function centsToDecimalString(cents: number): string;
