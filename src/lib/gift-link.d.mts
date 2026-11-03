export const GIFT_WINDOWS: Array<{ id: string; hours: number; label: string }>;
export function giftOpen(now: number, expiresAt: number): boolean;
export function giftHash(input: { secret: string; expiresAt: number; usd: number }): string;
export function readGiftHash(hash: string): { secret: string; expiresAt: number; usd: number } | null;
