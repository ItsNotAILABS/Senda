const KEY = "senda.esim.v1";

export type HeldEsim = {
  orderNo: string;
  code: string;
  name: string;
  usd: number;
  iccid: string;
  qr: string;
  ac: string;
  status: string;
  at: number;
};

function isHeld(row: unknown): row is HeldEsim {
  if (!row || typeof row !== "object") return false;
  const rec = row as HeldEsim;
  return typeof rec.orderNo === "string" && typeof rec.name === "string";
}

export function readEsims(): HeldEsim[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as unknown;
    return Array.isArray(raw) ? raw.filter(isHeld) : [];
  } catch {
    return [];
  }
}

export function saveEsim(row: HeldEsim) {
  const next = [row, ...readEsims().filter((item) => item.orderNo !== row.orderNo)].slice(0, 12);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
