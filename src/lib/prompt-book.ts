/** Questions that stay on this phone. Written only while the desk key is open, so the seal stores ciphertext. */

import { sealOpen } from "@/lib/seal";

const KEY = "senda.prompt-book.v1";
const MAX = 12;

export type KeptPrompt = { at: number; q: string; a: string };

function read(): KeptPrompt[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw || raw.startsWith("sen1.")) return [];
    const rows = JSON.parse(raw) as KeptPrompt[];
    if (!Array.isArray(rows)) return [];
    return rows
      .filter((row) => Boolean(row) && typeof row.q === "string" && typeof row.a === "string" && typeof row.at === "number")
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function listPrompts(): KeptPrompt[] {
  if (!sealOpen()) return [];
  return read();
}

/** Returns false when the desk is locked. The question is not written in the clear. */
export function keepPrompt(q: string, a: string): boolean {
  if (!sealOpen()) return false;
  const question = q.trim().slice(0, 400);
  const answer = a.trim().slice(0, 1200);
  if (!question || !answer) return false;
  const rows = [{ at: Date.now(), q: question, a: answer }, ...read().filter((row) => row.q !== question || row.a !== answer)];
  localStorage.setItem(KEY, JSON.stringify(rows.slice(0, MAX)));
  return true;
}
