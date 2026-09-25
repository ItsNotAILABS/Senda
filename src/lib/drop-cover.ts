/** A cover on one PreStock print. Premium is taken in cash. It pays if last falls 10%. */

const KEY = "senda.dropcover.v1";

export type DropCover = { symbol: string; strike: number; cover: number; paid: boolean };

function load(): DropCover[] {
  if (typeof window === "undefined") return [];
  try {
    const p = JSON.parse(window.localStorage.getItem(KEY) || "[]") as DropCover[];
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function save(rows: DropCover[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 20)));
  } catch {
    /* quota */
  }
}

export function listDrops(): DropCover[] {
  return load();
}

export function lockDrop(row: DropCover) {
  save([row, ...load().filter((d) => d.symbol !== row.symbol)]);
}

export function markDropPaid(symbol: string) {
  save(load().map((d) => (d.symbol === symbol ? { ...d, paid: true } : d)));
}
