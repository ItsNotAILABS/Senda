/** One search string handed from Kalshi to Polymarket, or back. It is not a position. */

const KEY = "senda.predict.q";

export function stashPredictQuery(q: string) {
  if (typeof sessionStorage === "undefined") return;
  const next = q.trim().slice(0, 80);
  try {
    if (next.length < 2) sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, next);
  } catch {
    /* private mode */
  }
}

export function takePredictQuery(): string {
  if (typeof sessionStorage === "undefined") return "";
  try {
    const q = sessionStorage.getItem(KEY) ?? "";
    sessionStorage.removeItem(KEY);
    return q.trim().slice(0, 80);
  } catch {
    return "";
  }
}
