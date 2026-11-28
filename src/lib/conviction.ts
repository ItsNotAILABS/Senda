/** Research, conviction, and being early. The reward is the move after you committed. No points. */

export type VowSide = "long" | "short";

export type Vow = {
  id: string;
  symbol: string;
  mint: string;
  side: VowSide;
  size: number;
  entry: number;
  thesis: string;
  at: number;
};

const KEY = "senda.vow.v1";

export function researchOk(text: string): boolean {
  const clean = text.trim().replace(/\s+/g, " ");
  const words = clean.split(" ").filter((word) => word.length > 1);
  return clean.length >= 80 && words.length >= 12;
}

/** Percent the mark moved in the direction of the side. */
export function movePct(side: VowSide, entry: number, mark: number): number | null {
  if (!(entry > 0) || !(mark > 0)) return null;
  const raw = ((mark - entry) / entry) * 100;
  return side === "long" ? raw : -raw;
}

/** A wrong mark pays nothing. Time only multiplies a move that already went your way. */
export function reward(move: number, ageMs: number): number {
  if (!(move > 0) || !(ageMs >= 0) || !Number.isFinite(move) || !Number.isFinite(ageMs)) return 0;
  return move * (1 + Math.log1p(ageMs / 86_400_000));
}

export function listVows(): Vow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as Vow[];
    return Array.isArray(raw) ? raw.filter((row) => row && row.entry > 0 && researchOk(row.thesis)) : [];
  } catch {
    return [];
  }
}

export function saveVow(input: Omit<Vow, "id" | "at">): Vow | null {
  if (!researchOk(input.thesis) || !(input.entry > 0) || !(input.size > 0) || !input.mint || !input.symbol) return null;
  const next: Vow = { ...input, symbol: input.symbol.toUpperCase(), thesis: input.thesis.trim(), id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, at: Date.now() };
  if (typeof window === "undefined") return next;
  const rows = [next, ...listVows()].slice(0, 40);
  localStorage.setItem(KEY, JSON.stringify(rows));
  return next;
}

export function dropVow(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(listVows().filter((row) => row.id !== id)));
}
