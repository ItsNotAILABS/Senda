/** Local automations and views. Execution leg is always Jupiter. */

const KEY = "senda.lab.v1";

export type Auto = {
  id: string;
  kind: "dca" | "alert";
  symbol: string;
  mint: string;
  usd: number;
  threshold: number;
  every: "day";
  lastRun: string;
};

export type View = {
  id: string;
  symbol: string;
  mint: string;
  kind: "up" | "over";
  open: number;
  mark: number;
  at: string;
};

type Store = { autos: Auto[]; views: View[]; tape: string[] };

function blank(): Store {
  return { autos: [], views: [], tape: [] };
}

export function loadLab(): Store {
  if (typeof window === "undefined") return blank();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return blank();
    const p = JSON.parse(raw) as Store;
    return { autos: p.autos ?? [], views: p.views ?? [], tape: p.tape ?? [] };
  } catch {
    return blank();
  }
}

function save(s: Store) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* quota */
  }
}

export function addAuto(row: Omit<Auto, "id" | "lastRun" | "every">): Store {
  const s = loadLab();
  s.autos = [{ ...row, id: `au${Date.now()}`, every: "day" as const, lastRun: "" }, ...s.autos].slice(0, 12);
  save(s);
  return s;
}

export function addView(row: Omit<View, "id" | "at">): Store {
  const s = loadLab();
  s.views = [{ ...row, id: `vw${Date.now()}`, at: new Date().toISOString() }, ...s.views].slice(0, 12);
  save(s);
  return s;
}

export function pushTape(line: string): Store {
  const s = loadLab();
  s.tape = [`${new Date().toISOString().slice(11, 16)} ${line}`, ...s.tape].slice(0, 20);
  save(s);
  return s;
}
