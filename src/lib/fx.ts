/** A dollar size, also in pesos and rupees. The payment is still USDC. */

let cache: { mxn: number; inr: number; at: number } | null = null;

export async function usdRates(): Promise<{ mxn: number; inr: number } | null> {
  if (cache && Date.now() - cache.at < 6 * 60 * 60 * 1000) return cache;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const body = (await res.json()) as { rates?: { MXN?: number; INR?: number } };
    const mxn = Number(body.rates?.MXN);
    const inr = Number(body.rates?.INR);
    if (!(mxn > 0) || !(inr > 0)) return cache;
    cache = { mxn, inr, at: Date.now() };
    return cache;
  } catch {
    return cache;
  }
}

export function localLine(usd: number, rates: { mxn: number; inr: number } | null): string {
  if (!rates || !(usd > 0)) return "";
  const mxn = usd * rates.mxn;
  const inr = usd * rates.inr;
  return `About ${mxn.toFixed(mxn >= 100 ? 0 : 2)} MXN · ${inr.toFixed(inr >= 100 ? 0 : 0)} INR. You still pay in USDC.`;
}
