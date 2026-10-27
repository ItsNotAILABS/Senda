/** A Solana Pay request this browser issued. Cancel is local. A paid signature cannot be undone. */

const KEY = "senda.payclaim.v1";

export type PayClaim = {
  id: string;
  to: string;
  amount: number;
  asset: string;
  memo: string;
  status: "open" | "cancelled" | "paid";
  at: number;
  paidSig?: string;
};

function read(): PayClaim[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as PayClaim[];
    return Array.isArray(raw) ? raw.filter((r) => r && typeof r.id === "string" && (r.status === "open" || r.status === "cancelled" || r.status === "paid")) : [];
  } catch {
    return [];
  }
}

function write(rows: PayClaim[]): void {
  localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 40)));
  window.dispatchEvent(new Event("senda-claim"));
}

export function listClaims(): PayClaim[] {
  return read();
}

export function claimOf(id: string): PayClaim | null {
  return read().find((r) => r.id === id) ?? null;
}

/** Opens a request. A cancelled or paid id is left alone. */
export function openClaim(row: Omit<PayClaim, "status" | "at" | "paidSig">): PayClaim {
  const rows = read();
  const hit = rows.find((r) => r.id === row.id);
  if (hit) return hit;
  const next: PayClaim = { ...row, status: "open", at: Date.now() };
  write([next, ...rows]);
  return next;
}

export function cancelClaim(id: string): { ok: true } | { ok: false; error: string } {
  const rows = read();
  const hit = rows.find((r) => r.id === id);
  if (!hit) return { ok: false, error: "That claim is not on this book." };
  if (hit.status === "paid") return { ok: false, error: "Already paid. A signature cannot be cancelled." };
  if (hit.status === "cancelled") return { ok: false, error: "Already cancelled." };
  write(rows.map((r) => (r.id === id ? { ...r, status: "cancelled" } : r)));
  return { ok: true };
}

export function markClaimPaid(id: string, paidSig: string): void {
  const rows = read();
  const hit = rows.find((r) => r.id === id);
  if (!hit || hit.status === "cancelled") return;
  write(rows.map((r) => (r.id === id ? { ...r, status: "paid", paidSig } : r)));
}
