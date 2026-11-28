/** The plan the desk agents read. A send or a share buy that breaks it is refused before a wallet is asked. */

const KEY = "senda.money-plan.v1";

export type MoneyPlan = {
  cashFloor: number;
  monthSend: number;
  sent: number;
  month: string;
  /** Empty means any listed share. Set means the sleeve only buys this symbol. */
  sleeveSymbol: string;
  sleeveMonth: number;
  sleeveSpent: number;
  note: string;
};

export const OPEN_PLAN: MoneyPlan = {
  cashFloor: 0,
  monthSend: 500,
  sent: 0,
  month: "",
  sleeveSymbol: "",
  sleeveMonth: 100,
  sleeveSpent: 0,
  note: "",
};

const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function monthKey(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

export function livePlan(plan: MoneyPlan, now = new Date()): MoneyPlan {
  const month = monthKey(now);
  if (plan.month === month) return plan;
  return { ...plan, month, sent: 0, sleeveSpent: 0 };
}

function dollars(n: number, max: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(Math.min(max, n) * 100) / 100;
}

function clean(row: Partial<MoneyPlan> | null): MoneyPlan {
  const base = row ?? {};
  return {
    cashFloor: dollars(Number(base.cashFloor), 1_000_000),
    monthSend: dollars(Number(base.monthSend) || OPEN_PLAN.monthSend, 1_000_000),
    sent: dollars(Number(base.sent), 1_000_000),
    month: typeof base.month === "string" ? base.month.slice(0, 7) : "",
    sleeveSymbol: typeof base.sleeveSymbol === "string" ? base.sleeveSymbol.trim().toUpperCase().slice(0, 12) : "",
    sleeveMonth: dollars(Number(base.sleeveMonth) || OPEN_PLAN.sleeveMonth, 1_000_000),
    sleeveSpent: dollars(Number(base.sleeveSpent), 1_000_000),
    note: typeof base.note === "string" ? base.note.trim().slice(0, 240) : "",
  };
}

export function readPlan(): MoneyPlan {
  if (typeof localStorage === "undefined") return { ...OPEN_PLAN };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...OPEN_PLAN };
    return clean(JSON.parse(raw) as Partial<MoneyPlan>);
  } catch {
    return { ...OPEN_PLAN };
  }
}

export function writePlan(plan: MoneyPlan): MoneyPlan {
  const next = clean(plan);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
  return next;
}

export type Proposal =
  | { ok: true; usd: number; room: number }
  | { ok: false; error: string };

export function sendRoom(plan: MoneyPlan, cap: number, now = new Date()): number {
  const live = livePlan(plan, now);
  const left = Math.max(0, live.monthSend - live.sent);
  return Math.round(Math.min(Math.max(0, cap), left) * 100) / 100;
}

export function sleeveRoom(plan: MoneyPlan, cap: number, now = new Date()): number {
  const live = livePlan(plan, now);
  const left = Math.max(0, live.sleeveMonth - live.sleeveSpent);
  return Math.round(Math.min(Math.max(0, cap), left) * 100) / 100;
}

export function proposeSend(input: {
  plan: MoneyPlan;
  cap: number;
  pocket: number;
  usd: number;
  to: string;
  memo: string;
  now?: Date;
}): Proposal {
  const now = input.now ?? new Date();
  const usd = Math.round(input.usd * 100) / 100;
  const memo = input.memo.trim();
  const to = input.to.trim();
  if (!(usd >= 1)) return { ok: false, error: "The smallest send is $1." };
  if (usd > input.cap) return { ok: false, error: `That is over the $${input.cap} spend cap. Raise it on the wallet, or send less.` };
  const room = sendRoom(input.plan, input.cap, now);
  if (usd > room) return { ok: false, error: `The send plan has $${room.toFixed(2)} left this month.` };
  const pocket = Number.isFinite(input.pocket) ? input.pocket : 0;
  const floor = livePlan(input.plan, now).cashFloor;
  if (floor > 0 && pocket - usd < floor) {
    return { ok: false, error: `That would leave the pocket under the $${floor.toFixed(2)} cash floor.` };
  }
  if (!B58.test(to)) return { ok: false, error: "That is not a Solana address." };
  if (memo.length < 2) return { ok: false, error: "Write a memo. The courier does not send a blank payment." };
  return { ok: true, usd, room };
}

export function proposeSleeve(input: {
  plan: MoneyPlan;
  cap: number;
  symbol: string;
  usd: number;
  halted?: boolean;
  now?: Date;
}): Proposal {
  const now = input.now ?? new Date();
  const usd = Math.round(input.usd * 100) / 100;
  const symbol = input.symbol.trim().toUpperCase();
  if (!symbol) return { ok: false, error: "Pick a share." };
  if (input.halted) return { ok: false, error: `${symbol} is halted. The sleeve will not queue it.` };
  if (!(usd >= 1)) return { ok: false, error: "The smallest buy is $1." };
  if (usd > input.cap) return { ok: false, error: `That is over the $${input.cap} spend cap.` };
  const live = livePlan(input.plan, now);
  if (live.sleeveSymbol && live.sleeveSymbol !== symbol) {
    return { ok: false, error: `This month the sleeve only buys ${live.sleeveSymbol}.` };
  }
  const room = sleeveRoom(input.plan, input.cap, now);
  if (usd > room) return { ok: false, error: `The stock sleeve has $${room.toFixed(2)} left this month.` };
  return { ok: true, usd, room };
}

export function noteSend(plan: MoneyPlan, usd: number, now = new Date()): MoneyPlan {
  const live = livePlan(plan, now);
  return { ...live, sent: Math.round((live.sent + usd) * 100) / 100 };
}

export function noteSleeve(plan: MoneyPlan, usd: number, now = new Date()): MoneyPlan {
  const live = livePlan(plan, now);
  return { ...live, sleeveSpent: Math.round((live.sleeveSpent + usd) * 100) / 100 };
}
