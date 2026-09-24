/**
 * Senda card processor.
 * ISO 7812 PAN, Luhn check digit, Mastercard IIN 535512.
 * Auths debit Senda cash. Not a scheme-cleared bank BIN.
 */

function digits(s: string): string {
  return s.replace(/\D/g, "");
}

function luhnValid(pan: string): boolean {
  const d = digits(pan);
  if (d.length < 13) return false;
  let sum = 0;
  let alt = false;
  for (let i = d.length - 1; i >= 0; i -= 1) {
    let n = Number(d[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export const SENDA_IIN = "535512";

export type CardStatus = "active" | "frozen" | "terminated";
export type CardKind = "virtual" | "fleet" | "once";

export type IssuedCard = {
  id: string;
  label: string;
  kind: CardKind;
  network: "mastercard";
  bin: string;
  pan: string;
  last4: string;
  cvv: string;
  expiry: string;
  nameOn: string;
  frozen: boolean;
  disposable: boolean;
  status: CardStatus;
  limit: number;
  dailyLimit: number;
  dailySpent: number;
  dailyOn: string;
  spent: number;
  online: boolean;
  createdAt: string;
  sealed?: boolean;
  /** If set, a second merchant name is declined. */
  merchantLock?: string;
};

export type CardAuth = {
  id: string;
  cardId: string;
  last4: string;
  merchant: string;
  mcc: string;
  amount: number;
  status: "approved" | "declined";
  reason: string;
  at: string;
  mti?: string;
  stan?: string;
  rrn?: string;
  rc?: string;
  authCode?: string;
};

export const MCC: { id: string; label: string }[] = [
  { id: "5411", label: "Grocery" },
  { id: "5541", label: "Fuel" },
  { id: "5812", label: "Restaurant" },
  { id: "4121", label: "Transit" },
  { id: "4511", label: "Air" },
  { id: "7011", label: "Lodging" },
  { id: "5732", label: "Electronics" },
  { id: "5815", label: "Digital" },
  { id: "5999", label: "Retail" },
  { id: "0000", label: "Other" },
];

function luhnDigit(body: string): string {
  let sum = 0;
  let dbl = true;
  for (let i = body.length - 1; i >= 0; i -= 1) {
    let n = Number(body[i]);
    if (dbl) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    dbl = !dbl;
  }
  return String((10 - (sum % 10)) % 10);
}

function randDigits(n: number): string {
  const buf = new Uint8Array(n);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(buf);
  else for (let i = 0; i < n; i += 1) buf[i] = Math.floor(Math.random() * 256);
  let s = "";
  for (let i = 0; i < n; i += 1) s += String(buf[i] % 10);
  return s;
}

export function formatPanGroups(pan: string): string {
  return digits(pan).replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

export function mintPan(): { pan: string; last4: string; bin: string } {
  let body = SENDA_IIN + randDigits(9);
  let pan = body + luhnDigit(body);
  if (!luhnValid(pan)) {
    body = SENDA_IIN + randDigits(9);
    pan = body + luhnDigit(body);
  }
  return { pan: formatPanGroups(pan), last4: pan.slice(-4), bin: SENDA_IIN };
}

export function mintCvv(pan: string, expiry: string): string {
  const s = digits(pan) + digits(expiry);
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return String(100 + ((h >>> 0) % 900));
}

export function expiryFromNow(years = 3): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
}

export function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function issueInstrument(input: {
  kind: CardKind;
  nameOn: string;
  dailyLimit: number;
}): IssuedCard {
  const { pan, last4, bin } = mintPan();
  const expiry = expiryFromNow(3);
  const kind = input.kind;
  const limit = kind === "fleet" ? 8000 : kind === "once" ? 400 : 4000;
  const daily = Math.min(limit, Math.max(20, input.dailyLimit || (kind === "once" ? 400 : 1500)));
  return {
    id: `cd${Math.random().toString(36).slice(2, 10)}`,
    label: kind === "fleet" ? "Fleet debit" : kind === "once" ? "Single-use" : "Virtual debit",
    kind,
    network: "mastercard",
    bin,
    pan,
    last4,
    cvv: mintCvv(pan, expiry),
    expiry,
    nameOn: input.nameOn.trim() || "SENDA",
    frozen: false,
    disposable: kind === "once",
    status: "active",
    limit,
    dailyLimit: daily,
    dailySpent: 0,
    dailyOn: todayStamp(),
    spent: 0,
    online: true,
    createdAt: new Date().toISOString(),
  };
}

export function rotateInstrument(card: IssuedCard): IssuedCard {
  const next = issueInstrument({ kind: card.kind, nameOn: card.nameOn, dailyLimit: card.dailyLimit });
  return { ...next, id: card.id, spent: card.spent, createdAt: card.createdAt };
}

export function declineReason(card: IssuedCard, amount: number, cash: number, merchant?: string): string | null {
  if (card.status === "terminated") return "Card terminated.";
  if (card.frozen || card.status === "frozen") return "Card frozen.";
  if (!card.online) return "Online not enabled.";
  if (card.merchantLock && merchant) {
    const want = card.merchantLock.trim().toLowerCase();
    const got = merchant.trim().toLowerCase();
    if (want && got && want !== got) return `Locked to ${card.merchantLock}.`;
  }
  const [mm, yy] = card.expiry.split("/").map(Number);
  const now = new Date();
  const exp = new Date(2000 + yy, mm, 0);
  if (now > exp) return "Card expired.";
  if (amount > card.limit - card.spent) return "Over the cap on this number.";
  const day = todayStamp();
  const used = card.dailyOn === day ? card.dailySpent : 0;
  if (amount > card.dailyLimit - used) return "Over daily limit.";
  if (cash < amount) return "Insufficient Senda cash.";
  return null;
}

export function applyAuth(card: IssuedCard, amount: number): IssuedCard {
  const day = todayStamp();
  const dailySpent = card.dailyOn === day ? card.dailySpent + amount : amount;
  const next: IssuedCard = {
    ...card,
    spent: card.spent + amount,
    dailySpent,
    dailyOn: day,
  };
  if (card.disposable) {
    return {
      ...next,
      pan: "",
      cvv: "",
      sealed: true,
      status: "terminated",
      frozen: true,
    };
  }
  return next;
}
