/** Samples this browser actually read. Nothing is invented between reads. */

const KEY = "senda.marks.v1";

type Point = { t: number; v: number };
type Book = Record<string, Point[]>;

export const WINDOWS = [
  ["15m", 15 * 60 * 1000],
  ["1H", 60 * 60 * 1000],
  ["4H", 4 * 60 * 60 * 1000],
  ["1D", 24 * 60 * 60 * 1000],
] as const;

export type WindowId = (typeof WINDOWS)[number][0];

function read(): Book {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) || "{}") as Book;
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export function noteMark(key: string, value: number) {
  if (typeof window === "undefined" || !Number.isFinite(value)) return;
  const book = read();
  const rows = Array.isArray(book[key]) ? book[key] : [];
  const last = rows[rows.length - 1];
  const now = Date.now();
  if (last && now - last.t < 20_000 && last.v === value) return;
  rows.push({ t: now, v: value });
  const cut = now - 86_400_000;
  book[key] = rows.filter((p) => p.t >= cut).slice(-480);
  window.localStorage.setItem(KEY, JSON.stringify(book));
}

export function marksIn(key: string, windowMs: number): Point[] {
  const now = Date.now();
  const rows = read()[key];
  if (!Array.isArray(rows)) return [];
  return rows.filter((p) => p && p.t >= now - windowMs && Number.isFinite(p.v));
}
