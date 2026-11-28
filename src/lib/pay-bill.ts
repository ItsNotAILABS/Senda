/** A shop bill is a solana: request. The clock and the tip are numbers. Nothing here signs. */

export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export const CLOCKS = [
  { id: "15m", label: "15 min", ms: 15 * 60 * 1000 },
  { id: "1h", label: "1 hour", ms: 60 * 60 * 1000 },
  { id: "1d", label: "1 day", ms: 24 * 60 * 60 * 1000 },
  { id: "open", label: "No clock", ms: 0 },
] as const;

export const TIPS = [0, 10, 15, 20] as const;

export type ClockId = (typeof CLOCKS)[number]["id"];

export function billClock(memo?: string): number | null {
  const hit = memo?.match(/(?:^|\s)exp=(\d{10,16})(?=\s|$)/);
  if (!hit) return null;
  const n = Number(hit[1]);
  return Number.isFinite(n) ? n : null;
}

export function chargeMemo(note: string, dies: number | null): string {
  const clean = note.replace(/exp=\d+/g, "").trim().slice(0, 48);
  if (dies) return `exp=${dies}${clean ? ` ${clean}` : ""}`;
  return clean;
}

export function withTip(usd: number, pct: number): { bill: number; tip: number; total: number } {
  const bill = Math.round(usd * 100) / 100;
  if (!(bill > 0) || !(pct > 0)) return { bill, tip: 0, total: bill };
  const tip = Math.round(bill * pct) / 100;
  return { bill, tip, total: Math.round((bill + tip) * 100) / 100 };
}

export type Slip = {
  ok: true;
  to: string;
  bill: number | null;
  label: string;
  message: string;
  memo: string;
  expiresAt: number | null;
  expired: boolean;
};

export type BillInput = {
  recipient: string;
  amount?: number;
  splToken?: string;
  label?: string;
  message?: string;
  memo?: string;
};

export function readSlip(parsed: BillInput | { error: string }, now = Date.now()): Slip | { ok: false; error: string } {
  if ("error" in parsed) return { ok: false, error: parsed.error };
  if (parsed.splToken && parsed.splToken !== USDC_MINT) return { ok: false, error: "That bill is not USDC." };
  const expiresAt = billClock(parsed.memo);
  const amount = parsed.amount && parsed.amount > 0 ? Math.round(parsed.amount * 100) / 100 : null;
  return {
    ok: true,
    to: parsed.recipient,
    bill: amount,
    label: parsed.label || "",
    message: parsed.message || "",
    memo: parsed.memo || "",
    expiresAt,
    expired: expiresAt != null && now > expiresAt,
  };
}
