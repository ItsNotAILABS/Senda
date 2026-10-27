/** A price watch. It notices a move. It does not sign. */

const KEY = "senda.watch.v1";

export type Watch = {
  symbol: string;
  price: number;
  pct: number;
  at: number;
};

export function readWatch(): Watch | null {
  if (typeof window === "undefined") return null;
  try {
    const row = JSON.parse(window.localStorage.getItem(KEY) || "") as Watch;
    return row?.symbol && row.price > 0 ? row : null;
  } catch {
    return null;
  }
}

export function armWatch(symbol: string, price: number, pct: number): Watch {
  const row = { symbol, price, pct: Math.min(50, Math.max(0.1, pct)), at: Date.now() };
  window.localStorage.setItem(KEY, JSON.stringify(row));
  return row;
}

export function clearWatch() {
  window.localStorage.removeItem(KEY);
}

export function watchMove(watch: Watch, price: number): { moved: number; hit: boolean } {
  if (!(watch.price > 0) || !(price > 0)) return { moved: 0, hit: false };
  const moved = ((price - watch.price) / watch.price) * 100;
  return { moved, hit: Math.abs(moved) >= watch.pct };
}
