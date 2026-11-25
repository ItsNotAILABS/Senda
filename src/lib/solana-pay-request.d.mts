export declare function buildUsdcPayLink(input: { to: string; cents: number; memo?: string; reference?: string | null; mint: string }): string;
export declare function verifyReferencedUsdcPayment(tx: unknown, expected: { recipient: string; mint: string; cents: number }): { paid: boolean; reason: string };
