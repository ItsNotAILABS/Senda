/** Jupiter is the pool router. This refuses a clip the book cannot hold, and says when two smaller clips are cleaner. */

import { previewFill, type FillPreview } from "@/lib/fill-quote";

const HARD = 5;
const WARN = 1.5;

export async function guardRoute(input: {
  mint: string;
  side: "buy" | "sell";
  usd: number;
  price?: number;
  symbol?: string;
  maxImpact?: number;
}): Promise<FillPreview> {
  const preview = await previewFill(input);
  const hard = input.maxImpact && input.maxImpact > 0 ? input.maxImpact : HARD;
  if (preview.impact > hard) {
    let softer = "";
    const half = Math.round((input.usd / 2) * 100) / 100;
    if (half >= 1) {
      try {
        const small = await previewFill({ ...input, usd: half });
        if (small.impact + 0.05 < preview.impact) {
          softer = ` Two $${half.toFixed(2)} clips quote ${small.impact.toFixed(2)}% instead.`;
        }
      } catch {
        /* the smaller clip can fail and the refusal still stands */
      }
    }
    throw new Error(`Price impact is ${preview.impact.toFixed(1)}%. The book is too thin. Nothing was sent.${softer}`);
  }
  if (hard === HARD && preview.impact > WARN) {
    return { ...preview, line: `${preview.line} · thin` };
  }
  return preview;
}
