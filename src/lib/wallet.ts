/**
 * Senda wallet — cash, FX, P2P, virtual cards, cover, PreStocks.
 * Paper balances. Instant P2P. Mid-market FX, no weekend markup.
 */

import { encodeNote, makeCode, type NearbyPayload } from "@/lib/nearby";
import { issueSendaKey } from "@/lib/senda-keys";
import { endToEndOf, pain001, uetrOf } from "@/lib/iso20022";
import { authRequest, authResponse, reasonToRc } from "@/lib/iso8583";
import {
  applyAuth,
  declineReason,
  issueInstrument,
  rotateInstrument,
  type CardAuth,
  type CardKind as IssueKind,
  type IssuedCard,
} from "@/lib/card-issuing";

export const FIAT_CCYS = ["USD", "EUR", "GBP", "MXN"] as const;
export const CRYPTO_CCYS = ["USDC", "SOL"] as const;
export const CCYS = ["USD", "EUR", "GBP", "MXN", "USDC", "SOL"] as const;
export type Ccy = (typeof CCYS)[number];
export type FiatCcy = (typeof FIAT_CCYS)[number];

export const CCY_META: Record<
  Ccy,
  { name: string; symbol: string; flag: string; decimals: number; kind: "fiat" | "crypto" }
> = {
  USD: { name: "US dollar", symbol: "$", flag: "US", decimals: 2, kind: "fiat" },
  EUR: { name: "Euro", symbol: "€", flag: "EU", decimals: 2, kind: "fiat" },
  GBP: { name: "Pound", symbol: "£", flag: "GB", decimals: 2, kind: "fiat" },
  MXN: { name: "Mexican peso", symbol: "MX$", flag: "MX", decimals: 2, kind: "fiat" },
  USDC: { name: "USD Coin", symbol: "USDC", flag: "SOL", decimals: 2, kind: "crypto" },
  SOL: { name: "Solana", symbol: "◎", flag: "SOL", decimals: 4, kind: "crypto" },
};

export type TxKind =
  | "add"
  | "withdraw"
  | "send"
  | "receive"
  | "request"
  | "fx"
  | "card"
  | "split"
  | "invest"
  | "cover"
  | "move"
  | "vault"
  | "nearby";

export type TxStatus = "pending" | "sent" | "failed";

export type Tx = {
  id: string;
  kind: TxKind;
  amount: number;
  ccy: Ccy;
  counterparty: string;
  note: string;
  status: TxStatus;
  auroFee: number;
  revolutFee: number;
  createdAt: string;
  uetr?: string;
  endToEnd?: string;
  iso?: string;
};

export type Contact = {
  id: string;
  name: string;
  tag: string;
  subtitle: string;
  country: string;
  kind: "person" | "business" | "bank";
};

export type Pocket = {
  id: string;
  name: string;
  ccy: Ccy;
  balance: number;
};

export type CardKind = IssueKind | "metal";
export type Card = IssuedCard;
export type { CardAuth };

export type Policy = {
  id: string;
  coverId: string;
  title: string;
  premium: number;
  cover: number;
  until: string;
};

export type FundSource =
  | "card"
  | "masked"
  | "apple"
  | "cash"
  | "ach"
  | "direct"
  | "plaid"
  | "usdc"
  | "sol"
  | "bank"
  | "cashapp"
  | "chime"
  | "venmo";

export type PayMethod = {
  id: string;
  kind: "card" | "bank" | "apple" | "usdc" | "masked" | "cashapp" | "chime" | "venmo";
  label: string;
  last4?: string;
  expiry?: string;
  nameOn?: string;
  handle?: string;
  token?: string;
};

export type Vault = {
  id: string;
  name: string;
  ccy: Ccy;
  balance: number;
  lockUntil?: string;
};

export type SendaKey = {
  pubkey: string;
  secret: string;
  createdAt: string;
};

export type ChainLink = {
  id: string;
  label: string;
  address: string;
  kind: "phantom" | "solana" | "evm";
};

export type NearbyNote = {
  id: string;
  code: string;
  amount: number;
  ccy: Ccy;
  fromTag: string;
  payload: string;
  status: "open" | "claimed";
  createdAt: string;
};

export type Wallet = {
  tag: string;
  balances: Record<Ccy, number>;
  opened: Ccy[];
  pockets: Pocket[];
  vaults: Vault[];
  senda: SendaKey | null;
  links: ChainLink[];
  notes: NearbyNote[];
  cards: Card[];
  methods: PayMethod[];
  contacts: Contact[];
  txs: Tx[];
  policies: Policy[];
  cardAuths: CardAuth[];
};

const KEY = "senda.wallet.v2";

export const DIRECTORY: Contact[] = [
  { id: "c1", name: "Rosa M.", tag: "@rosa", subtitle: "Family · instant", country: "US", kind: "person" },
  { id: "c2", name: "Luis H.", tag: "@luis", subtitle: "Family · instant", country: "MX", kind: "person" },
  { id: "c3", name: "Montesas", tag: "@montesas", subtitle: "Fleet ops · instant", country: "US", kind: "business" },
  { id: "c4", name: "Warehouse 12", tag: "@wh12", subtitle: "3PL · bank same day", country: "US", kind: "business" },
  { id: "c5", name: "Sofia R.", tag: "@sofia", subtitle: "Rent · instant", country: "US", kind: "person" },
  { id: "c6", name: "Own checking", tag: "ACH · 021000021", subtitle: "Chase · 1 business day", country: "US", kind: "bank" },
];

function mintCard(kind: IssueKind, nameOn: string, dailyLimit: number): Card {
  return issueInstrument({ kind, nameOn, dailyLimit });
}

function hydrateCard(c: Partial<Card> & { last4?: string }): Card {
  const kind: IssueKind = c.kind === "fleet" || c.kind === "once" ? c.kind : "virtual";
  const base = issueInstrument({ kind, nameOn: c.nameOn ?? "SENDA", dailyLimit: c.dailyLimit ?? c.limit ?? 1500 });
  return {
    ...base,
    ...c,
    id: c.id ?? base.id,
    kind,
    network: "mastercard",
    bin: c.bin ?? "535512",
    pan: c.pan ?? base.pan,
    last4: c.last4 ?? base.last4,
    cvv: c.cvv ?? base.cvv,
    expiry: c.expiry ?? base.expiry,
    nameOn: c.nameOn ?? "SENDA",
    frozen: Boolean(c.frozen),
    disposable: c.disposable ?? kind === "once",
    status: c.status ?? (c.frozen ? "frozen" : "active"),
    limit: c.limit ?? base.limit,
    dailyLimit: c.dailyLimit ?? c.limit ?? 1500,
    dailySpent: c.dailySpent ?? 0,
    dailyOn: c.dailyOn ?? "",
    spent: c.spent ?? 0,
    online: c.online ?? true,
    sealed: Boolean(c.sealed),
    merchantLock: c.merchantLock,
    createdAt: c.createdAt ?? base.createdAt,
    label: c.label ?? base.label,
  };
}

function empty(): Wallet {
  return {
    tag: "@you",
    balances: { USD: 0, EUR: 0, GBP: 0, MXN: 0, USDC: 0, SOL: 0 },
    opened: ["USD"],
    pockets: [],
    vaults: [],
    senda: null,
    links: [],
    notes: [],
    cards: [],
    methods: [],
    contacts: [],
    txs: [],
    policies: [],
    cardAuths: [],
  };
}

export function loadWallet(): Wallet {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty();
    const p = JSON.parse(raw) as Partial<Wallet>;
    const base = empty();
    const hadSecret = Boolean((p as Wallet).senda?.secret);
    const next: Wallet = {
      tag: typeof p.tag === "string" && p.tag.startsWith("@") ? p.tag : base.tag,
      balances: { ...base.balances, ...(p.balances ?? {}) },
      opened: Array.isArray((p as Wallet).opened) && (p as Wallet).opened.length ? (p as Wallet).opened : ["USD"],
      pockets: Array.isArray(p.pockets) ? p.pockets : [],
      vaults: Array.isArray((p as Wallet).vaults) ? (p as Wallet).vaults : [],
      senda: (p as Wallet).senda ? { ...(p as Wallet).senda!, secret: "" } : null,
      links: Array.isArray((p as Wallet).links) ? (p as Wallet).links : [],
      notes: Array.isArray((p as Wallet).notes) ? (p as Wallet).notes : [],
      cards: Array.isArray(p.cards) ? p.cards.map((c) => hydrateCard(c)) : [],
      methods: Array.isArray(p.methods) ? p.methods : [],
      contacts: Array.isArray(p.contacts) ? p.contacts : [],
      txs: Array.isArray(p.txs) ? p.txs.slice(0, 80) : [],
      policies: Array.isArray(p.policies) ? p.policies : [],
      cardAuths: Array.isArray((p as Wallet).cardAuths) ? (p as Wallet).cardAuths.slice(0, 80) : [],
    };
    if (hadSecret) saveWallet(next);
    return next;
  } catch {
    return empty();
  }
}

export function saveWallet(w: Wallet): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(w));
  } catch {
    /* quota */
  }
}

export function roundCcy(n: number, ccy: Ccy): number {
  const d = CCY_META[ccy].decimals;
  const m = 10 ** d;
  return Math.round((n + Number.EPSILON) * m) / m;
}

export function formatMoney(n: number, ccy: Ccy = "USD"): string {
  const dec = CCY_META[ccy].decimals;
  if (ccy === "SOL") return `${n.toFixed(dec)} SOL`;
  if (ccy === "USDC") return `${n.toFixed(dec)} USDC`;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: ccy === "MXN" ? "MXN" : ccy,
      maximumFractionDigits: dec,
    }).format(n);
  } catch {
    return `${CCY_META[ccy].symbol}${n.toFixed(dec)}`;
  }
}

export function totalUsd(w: Wallet, usdPer: Record<Ccy, number>): number {
  const cash = CCYS.reduce((s, c) => s + w.balances[c] * (usdPer[c] || 0), 0);
  const vault = (w.vaults ?? []).reduce((s, v) => s + v.balance * (usdPer[v.ccy] || 0), 0);
  return cash + vault;
}

function nid(prefix: string): string {
  return `${prefix}${Math.random().toString(36).slice(2, 9)}`;
}

export function isWeekend(d = new Date()): boolean {
  const day = d.getUTCDay();
  const h = d.getUTCHours();
  if (day === 0 || day === 6) return true;
  if (day === 5 && h >= 21) return true;
  if (day === 1 && h < 0) return true;
  return false;
}

/** Revolut Standard: 1% weekend FX, 0.3% min $0.40 on SWIFT, $0 P2P. */
export function revolutFee(kind: TxKind, amountUsd: number, weekend: boolean): number {
  if (kind === "fx") {
    const weekendMarkup = weekend ? amountUsd * 0.01 : 0;
    const overAllowance = Math.max(0, amountUsd - 1000) * 0.01;
    return roundCcy(weekendMarkup + overAllowance, "USD");
  }
  if (kind === "send") {
    return roundCcy(Math.min(5, Math.max(0.4, amountUsd * 0.003)), "USD");
  }
  return 0;
}

export function auroFee(_kind: TxKind, _amountUsd: number): number {
  return 0;
}

function pushTx(w: Wallet, tx: Omit<Tx, "id" | "createdAt" | "status"> & { status?: TxStatus }): Wallet {
  const row: Tx = {
    ...tx,
    id: nid("tx"),
    status: tx.status ?? "sent",
    createdAt: new Date().toISOString(),
  };
  return { ...w, txs: [row, ...w.txs].slice(0, 80) };
}

export function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

export function luhnOk(pan: string): boolean {
  const d = digitsOnly(pan);
  if (d.length < 13 || d.length > 19) return false;
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

export function formatPan(raw: string): string {
  return digitsOnly(raw).slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

export function sendaDeposit(tag: string): { bank: string; routing: string; account: string } {
  let h = 2166136261;
  for (let i = 0; i < tag.length; i += 1) h = Math.imul(h ^ tag.charCodeAt(i), 16777619);
  const acc = String(10000000 + ((h >>> 0) % 90000000));
  return { bank: "Senda", routing: "026073150", account: acc };
}

export function addPayCard(
  w: Wallet,
  pan: string,
  expiry: string,
  cvv: string,
  nameOn: string,
): Wallet | { error: string } {
  const d = digitsOnly(pan);
  if (!luhnOk(d)) return { error: "Card number doesn’t check out." };
  const exp = expiry.replace(/\s/g, "");
  if (!/^\d{2}\/\d{2}$/.test(exp)) return { error: "Expiry is MM/YY." };
  const [mm, yy] = exp.split("/").map(Number);
  if (mm < 1 || mm > 12) return { error: "Expiry month." };
  if (digitsOnly(cvv).length < 3) return { error: "CVV is 3 digits." };
  const who = nameOn.trim();
  if (who.length < 2) return { error: "Name on card." };
  const last4 = d.slice(-4);
  const method: PayMethod = {
    id: nid("pm"),
    kind: "card",
    label: `Debit ··${last4}`,
    last4,
    expiry: exp,
    nameOn: who,
  };
  return { ...w, methods: [method, ...w.methods.filter((m) => !(m.kind === "card" && m.last4 === last4))] };
}

/** One-time funding method. Caller must already have discarded PAN and CVV. */
export function addMaskedCard(
  w: Wallet,
  last4: string,
  expiry: string,
  nameOn: string,
  token: string,
): Wallet | { error: string } {
  if (!/^\d{4}$/.test(last4)) return { error: "Could not mask that card." };
  const exp = expiry.replace(/\s/g, "");
  if (!/^\d{2}\/\d{2}$/.test(exp)) return { error: "Expiry is MM/YY." };
  const who = nameOn.trim();
  if (who.length < 2) return { error: "Name on card." };
  const method: PayMethod = {
    id: nid("pm"),
    kind: "masked",
    label: `One-time ··${last4}`,
    last4,
    expiry: exp,
    nameOn: who,
    token,
  };
  return { ...w, methods: [method, ...w.methods] };
}

export function burnMasked(w: Wallet, token: string): Wallet {
  return { ...w, methods: w.methods.filter((m) => m.token !== token) };
}

export function fundMasked(w: Wallet, amount: number, token: string): Wallet | { error: string } {
  if (!w.methods.some((m) => m.kind === "masked" && m.token === token)) {
    return { error: "That one-time card is already used." };
  }
  const added = addMoney(w, amount, "USD", "masked");
  if ("error" in added) return added;
  return burnMasked(added, token);
}

export function addPayApp(
  w: Wallet,
  kind: "cashapp" | "chime" | "venmo",
  handle: string,
): Wallet | { error: string } {
  const raw = handle.trim();
  if (kind === "cashapp") {
    const tag = raw.replace(/^\$/, "");
    if (!/^[A-Za-z][A-Za-z0-9]{1,19}$/.test(tag)) return { error: "Cash App tag is $Name, letters and numbers." };
    const label = `Cash App $${tag}`;
    return {
      ...w,
      methods: [{ id: nid("pm"), kind, label, handle: `$${tag}` }, ...w.methods.filter((m) => m.handle !== `$${tag}`)],
    };
  }
  if (kind === "venmo") {
    const tag = raw.replace(/^@/, "");
    if (!/^[A-Za-z0-9_-]{2,30}$/.test(tag)) return { error: "Venmo is @handle." };
    return {
      ...w,
      methods: [{ id: nid("pm"), kind, label: `Venmo @${tag}`, handle: `@${tag}` }, ...w.methods.filter((m) => m.handle !== `@${tag}`)],
    };
  }
  if (!/^[^\s@]+@[^\s@]+$/.test(raw) && !/^\$[A-Za-z][A-Za-z0-9]{1,19}$/.test(raw)) {
    return { error: "Chime email or $Cashtag." };
  }
  return {
    ...w,
    methods: [{ id: nid("pm"), kind, label: `Chime ${raw}`, handle: raw }, ...w.methods.filter((m) => m.handle !== raw)],
  };
}

export function sealIssued(w: Wallet, cardId: string): Wallet {
  return {
    ...w,
    cards: w.cards.map((c) => (c.id === cardId ? { ...c, pan: "", cvv: "", sealed: true } : c)),
  };
}

export function addPayBank(
  w: Wallet,
  bank: string,
  routing: string,
  account: string,
): Wallet | { error: string } {
  const name = bank.trim();
  const rt = digitsOnly(routing);
  const ac = digitsOnly(account);
  if (name.length < 2) return { error: "Bank name." };
  if (rt.length !== 9) return { error: "Routing is 9 digits." };
  if (ac.length < 4) return { error: "Account number." };
  const last4 = ac.slice(-4);
  const method: PayMethod = {
    id: nid("pm"),
    kind: "bank",
    label: `${name} ··${last4}`,
    last4,
    nameOn: name,
  };
  return { ...w, methods: [method, ...w.methods.filter((m) => !(m.kind === "bank" && m.last4 === last4))] };
}

export function addPayApple(w: Wallet): Wallet {
  if (w.methods.some((m) => m.kind === "apple")) return w;
  return {
    ...w,
    methods: [{ id: nid("pm"), kind: "apple", label: "Apple Pay" }, ...w.methods],
  };
}

export function addPayUsdc(w: Wallet): Wallet {
  if (w.methods.some((m) => m.kind === "usdc")) return w;
  return {
    ...w,
    methods: [{ id: nid("pm"), kind: "usdc", label: "Phantom USDC" }, ...w.methods],
  };
}

export function upsertContact(w: Wallet, name: string, tag: string): { wallet: Wallet; contact: Contact } {
  const t = tag.startsWith("@") ? tag : `@${tag}`;
  const n = name.trim() || t;
  const existing = w.contacts.find((c) => c.tag.toLowerCase() === t.toLowerCase());
  if (existing) return { wallet: w, contact: existing };
  const contact: Contact = {
    id: nid("ct"),
    name: n,
    tag: t,
    subtitle: "Instant",
    country: "US",
    kind: "person",
  };
  return { wallet: { ...w, contacts: [contact, ...w.contacts] }, contact };
}

export function setTag(w: Wallet, raw: string): Wallet | { error: string } {
  const t = raw.trim().replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (t.length < 2) return { error: "Tag is at least 2 characters." };
  if (t.length > 20) return { error: "Tag is too long." };
  return { ...w, tag: `@${t}` };
}

export function addMoney(
  w: Wallet,
  amount: number,
  ccy: Ccy = "USD",
  source: FundSource = "bank",
): Wallet | { error: string } {
  const amt = roundCcy(amount, ccy);
  if (!(amt > 0)) return { error: "Enter an amount." };
  const next = {
    ...ensureOpened(w, ccy),
    balances: { ...w.balances, [ccy]: roundCcy(w.balances[ccy] + amt, ccy) },
  };
  const note =
    source === "apple"
      ? "Apple Pay · instant"
      : source === "card"
        ? "Debit card · instant"
        : source === "cash"
          ? "Cash deposit"
          : source === "ach"
            ? "Bank transfer in"
            : source === "direct"
              ? "Direct deposit"
              : source === "plaid"
                ? "Linked bank"
                : source === "usdc"
                  ? "Phantom USDC"
                  : source === "sol"
                    ? "Phantom SOL"
                    : source === "masked"
                      ? "One-time card · number discarded"
                      : source === "cashapp"
                        ? "Cash App"
                        : source === "chime"
                          ? "Chime"
                          : source === "venmo"
                            ? "Venmo"
                            : "Bank transfer in";
  const who =
    source === "apple"
      ? "Apple Pay"
      : source === "card"
        ? "Debit card"
        : source === "masked"
          ? "Masked card"
          : source === "cash"
            ? "Cash deposit"
            : source === "ach" || source === "bank"
              ? "Senda"
              : source === "direct"
                ? "Payroll"
                : source === "plaid"
                  ? "Linked bank"
                  : source === "cashapp"
                    ? "Cash App"
                    : source === "chime"
                      ? "Chime"
                      : source === "venmo"
                        ? "Venmo"
                        : "Phantom";
  return pushTx(next, {
    kind: "add",
    amount: amt,
    ccy,
    counterparty: who,
    note,
    auroFee: 0,
    revolutFee: 0,
  });
}

export function withdraw(w: Wallet, amount: number, ccy: Ccy = "USD"): Wallet | { error: string } {
  const amt = roundCcy(amount, ccy);
  if (!(amt > 0)) return { error: "Enter an amount." };
  if (w.balances[ccy] < amt) return { error: `Not enough ${ccy}.` };
  const next = {
    ...w,
    balances: { ...w.balances, [ccy]: roundCcy(w.balances[ccy] - amt, ccy) },
  };
  return pushTx(next, {
    kind: "withdraw",
    amount: amt,
    ccy,
    counterparty: "Own checking",
    note: "To linked bank",
    auroFee: 0,
    revolutFee: 0,
  });
}

export function sendTo(
  w: Wallet,
  amount: number,
  ccy: Ccy,
  contact: Contact,
  note: string,
  amountUsd: number,
  weekend: boolean,
): Wallet | { error: string } {
  const amt = roundCcy(amount, ccy);
  if (!(amt > 0)) return { error: "Enter an amount." };
  if (w.balances[ccy] < amt) return { error: `Not enough ${ccy}.` };
  const next = {
    ...w,
    balances: { ...w.balances, [ccy]: roundCcy(w.balances[ccy] - amt, ccy) },
  };
  const instant = contact.kind !== "bank";
  const pain = pain001({
    fromTag: w.tag,
    toTag: contact.tag,
    toName: contact.name,
    amount: amt,
    ccy,
    note,
    pubkey: w.senda?.pubkey,
    purpose: instant ? "INST" : "ACH",
  });
  return pushTx(next, {
    kind: "send",
    amount: amt,
    ccy,
    counterparty: contact.name,
    note: note.trim() || (instant ? "pain.001 credit transfer" : "pain.001 · bank"),
    auroFee: 0,
    revolutFee: revolutFee("send", amountUsd, weekend),
    status: "sent",
    uetr: uetrOf(pain),
    endToEnd: endToEndOf(pain),
    iso: "pain.001.001.09",
  });
}

export function receiveFrom(w: Wallet, amount: number, ccy: Ccy, from: string, note: string): Wallet {
  const amt = roundCcy(amount, ccy);
  const next = {
    ...ensureOpened(w, ccy),
    balances: { ...w.balances, [ccy]: roundCcy(w.balances[ccy] + amt, ccy) },
  };
  return pushTx(next, {
    kind: "receive",
    amount: amt,
    ccy,
    counterparty: from,
    note,
    auroFee: 0,
    revolutFee: 0,
  });
}

export function convert(
  w: Wallet,
  from: Ccy,
  to: Ccy,
  amount: number,
  rate: number,
  amountUsd: number,
  weekend: boolean,
): Wallet | { error: string } {
  if (from === to) return { error: "Pick two currencies." };
  const amt = roundCcy(amount, from);
  if (!(amt > 0)) return { error: "Enter an amount." };
  if (w.balances[from] < amt) return { error: `Not enough ${from}.` };
  if (!(rate > 0)) return { error: "Rate unavailable." };
  const got = roundCcy(amt * rate, to);
  const next = {
    ...ensureOpened(w, to),
    balances: {
      ...w.balances,
      [from]: roundCcy(w.balances[from] - amt, from),
      [to]: roundCcy(w.balances[to] + got, to),
    },
  };
  return pushTx(next, {
    kind: "fx",
    amount: amt,
    ccy: from,
    counterparty: `${from} → ${to} ${got.toFixed(CCY_META[to].decimals)}`,
    note: weekend ? "Mid-market · weekend" : "Mid-market",
    auroFee: 0,
    revolutFee: revolutFee("fx", amountUsd, weekend),
  });
}

export function spendCard(
  w: Wallet,
  amount: number,
  merchant: string,
  cardId?: string,
  mcc = "5999",
): Wallet | { error: string } {
  const card =
    (cardId ? w.cards.find((c) => c.id === cardId) : w.cards.find((c) => !c.frozen && c.status !== "terminated")) ??
    w.cards[0];
  if (!card) return { error: "No card." };
  const amt = roundCcy(amount, "USD");
  if (!(amt > 0)) return { error: "Enter an amount." };
  const usd = w.balances.USD || 0;
  const usdc = w.balances.USDC || 0;
  const why = declineReason(card, amt, usd + usdc, merchant);
  const req = authRequest({
    pan: card.pan.replace(/\D/g, "").length >= 12 ? card.pan : `535512000000${card.last4}`,
    amount: amt,
    mcc,
    merchant,
  });
  const rc = reasonToRc(why);
  const res = authResponse(req, rc);
  const auth: CardAuth = {
    id: nid("au"),
    cardId: card.id,
    last4: card.last4,
    merchant,
    mcc,
    amount: amt,
    status: why ? "declined" : "approved",
    reason: why ?? "approved",
    at: new Date().toISOString(),
    mti: res.mti,
    stan: res.f11_stan,
    rrn: res.f37_rrn,
    rc: res.f39_rc,
    authCode: res.f38_auth,
  };
  if (why) {
    return { error: `${why} · ISO 8583 ${res.mti} RC ${rc} STAN ${res.f11_stan}` };
  }
  const rail: Ccy = usd >= amt ? "USD" : "USDC";
  const nextCard = applyAuth(card, amt);
  const next = {
    ...w,
    cardAuths: [auth, ...(w.cardAuths ?? [])].slice(0, 80),
    cards: w.cards.map((c) => (c.id === card.id ? nextCard : c)),
    balances: { ...w.balances, [rail]: roundCcy(w.balances[rail] - amt, rail) },
  };
  return pushTx(next, {
    kind: "card",
    amount: amt,
    ccy: rail,
    counterparty: merchant,
    note: `ISO 8583 ${res.mti} · STAN ${res.f11_stan} · RC ${rc} · •••• ${card.last4}`,
    auroFee: 0,
    revolutFee: 0,
  });
}

export function toggleFreeze(w: Wallet, cardId: string): Wallet {
  return {
    ...w,
    cards: w.cards.map((c) =>
      c.id === cardId
        ? {
            ...c,
            frozen: !c.frozen,
            status: c.status === "terminated" ? "terminated" : c.frozen ? "active" : "frozen",
          }
        : c,
    ),
  };
}

export function terminateCard(w: Wallet, cardId: string): Wallet {
  return {
    ...w,
    cards: w.cards.map((c) => (c.id === cardId ? { ...c, frozen: true, status: "terminated" as const } : c)),
  };
}

export function replaceCard(w: Wallet, cardId: string): Wallet | { error: string } {
  const card = w.cards.find((c) => c.id === cardId);
  if (!card) return { error: "No card." };
  if (card.status === "terminated") return { error: "Terminated. Issue a new one." };
  const rotated = rotateInstrument(card);
  return { ...w, cards: w.cards.map((c) => (c.id === cardId ? rotated : c)) };
}

export function setCardLimit(w: Wallet, cardId: string, dailyLimit: number): Wallet | { error: string } {
  const n = roundCcy(dailyLimit, "USD");
  if (!(n > 0)) return { error: "Enter a limit." };
  return {
    ...w,
    cards: w.cards.map((c) => (c.id === cardId ? { ...c, dailyLimit: n } : c)),
  };
}

export function moveToPocket(w: Wallet, pocketId: string, amount: number): Wallet | { error: string } {
  const amt = roundCcy(amount, "USD");
  if (!(amt > 0)) return { error: "Enter an amount." };
  if (w.balances.USD < amt) return { error: "Not enough USD." };
  return {
    ...w,
    balances: { ...w.balances, USD: roundCcy(w.balances.USD - amt, "USD") },
    pockets: w.pockets.map((p) => (p.id === pocketId ? { ...p, balance: roundCcy(p.balance + amt, p.ccy) } : p)),
  };
}

export function investDebit(w: Wallet, amount: number, name: string): Wallet | { error: string } {
  const amt = roundCcy(amount, "USD");
  if (!(amt > 0)) return { error: "Enter an amount." };
  const rail: Ccy = w.balances.USD >= amt ? "USD" : w.balances.USDC >= amt ? "USDC" : "USD";
  if (w.balances[rail] < amt) return { error: "Not enough USD or USDC." };
  const next = {
    ...w,
    balances: { ...w.balances, [rail]: roundCcy(w.balances[rail] - amt, rail) },
  };
  return pushTx(next, {
    kind: "invest",
    amount: amt,
    ccy: rail,
    counterparty: name,
    note: rail === "USDC" ? "PreStocks · USDC" : "PreStocks",
    auroFee: 0,
    revolutFee: 0,
  });
}

export function investCredit(w: Wallet, amount: number, name: string): Wallet {
  const amt = roundCcy(amount, "USD");
  const next = {
    ...w,
    balances: { ...w.balances, USD: roundCcy(w.balances.USD + amt, "USD") },
  };
  return pushTx(next, {
    kind: "invest",
    amount: amt,
    ccy: "USD",
    counterparty: name,
    note: "PreStocks sale",
    auroFee: 0,
    revolutFee: 0,
  });
}

export type CheckoutReveal = {
  id: string;
  pan: string;
  cvv: string;
  expiry: string;
  last4: string;
};

/** One number for one purchase. PAN is returned to the screen only — the saved card is already blank. */
export function issueCheckout(
  w: Wallet,
  cap: number,
  merchant: string,
  nameOn = "SENDA",
): { wallet: Wallet; reveal: CheckoutReveal } | { error: string } {
  if (!(cap > 0)) return { error: "Set a cap for this purchase." };
  if (w.cards.filter((c) => c.status !== "terminated").length >= 6) return { error: "Six live cards max." };
  const minted = mintCard("once", nameOn || "SENDA", cap);
  const reveal: CheckoutReveal = {
    id: minted.id,
    pan: minted.pan,
    cvv: minted.cvv,
    expiry: minted.expiry,
    last4: minted.last4,
  };
  const stored: Card = {
    ...minted,
    pan: "",
    cvv: "",
    sealed: true,
    label: merchant.trim() ? `For ${merchant.trim()}` : "One-time checkout",
    limit: cap,
    dailyLimit: cap,
    merchantLock: merchant.trim() || undefined,
    disposable: true,
  };
  return { wallet: { ...w, cards: [stored, ...w.cards] }, reveal };
}

export function issueCard(
  w: Wallet,
  kind: CardKind,
  nameOn = "SENDA",
  dailyLimit = 1500,
): Wallet | { error: string } {
  if (w.cards.filter((c) => c.status !== "terminated").length >= 6) return { error: "Six live cards max." };
  const k: IssueKind = kind === "fleet" || kind === "once" ? kind : "virtual";
  return { ...w, cards: [...w.cards, mintCard(k, nameOn, dailyLimit)] };
}

export function buyCover(
  w: Wallet,
  plan: { id: string; title: string; premium: number; cover: number; term: string },
): Wallet | { error: string } {
  const amt = roundCcy(plan.premium, "USD");
  if (w.balances.USD < amt) return { error: "Not enough USD." };
  const until = new Date(Date.now() + 30 * 86_400_000).toISOString();
  const next: Wallet = {
    ...w,
    balances: { ...w.balances, USD: roundCcy(w.balances.USD - amt, "USD") },
    policies: [
      { id: nid("pol"), coverId: plan.id, title: plan.title, premium: amt, cover: plan.cover, until },
      ...w.policies,
    ],
  };
  return pushTx(next, {
    kind: "cover",
    amount: amt,
    ccy: "USD",
    counterparty: plan.title,
    note: `Cover ${plan.term}`,
    auroFee: 0,
    revolutFee: 0,
  });
}

export function openCurrency(w: Wallet, ccy: Ccy): Wallet | { error: string } {
  if (w.opened.includes(ccy)) return { error: `${ccy} is already open.` };
  return { ...w, opened: [...w.opened, ccy] };
}

export function ensureOpened(w: Wallet, ccy: Ccy): Wallet {
  if (w.opened.includes(ccy)) return w;
  return { ...w, opened: [...w.opened, ccy] };
}

export function createSenda(w: Wallet): Wallet | { error: string } {
  if (w.senda) return { error: "You already have a Senda wallet." };
  const k = issueSendaKey();
  const next: Wallet = {
    ...ensureOpened(w, "SOL"),
    senda: { pubkey: k.pubkey, secret: "", createdAt: new Date().toISOString() },
  };
  return pushTx(next, {
    kind: "move",
    amount: 0,
    ccy: "SOL",
    counterparty: k.pubkey,
    note: "Issued Senda Solana wallet",
    auroFee: 0,
    revolutFee: 0,
  });
}

export function unlinkChain(w: Wallet, address: string): Wallet {
  return { ...w, links: w.links.filter((l) => l.address !== address) };
}

export function linkChain(
  w: Wallet,
  address: string,
  label: string,
  kind: "phantom" | "solana" | "evm",
): Wallet | { error: string } {
  const addr = address.trim();
  if (kind === "evm") {
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return { error: "That doesn’t look like an Ethereum address." };
  } else if (addr.length < 32 || addr.length > 48) {
    return { error: "That doesn’t look like a Solana address." };
  }
  if (w.links.some((l) => l.address.toLowerCase() === addr.toLowerCase())) return { error: "Already linked." };
  return {
    ...w,
    links: [{ id: nid("ln"), label: label.trim() || kind, address: addr, kind }, ...w.links],
  };
}

export function openVault(w: Wallet, name: string, ccy: Ccy = "USD"): Wallet | { error: string } {
  const n = name.trim();
  if (n.length < 2) return { error: "Name the vault." };
  if (w.vaults.some((v) => v.name.toLowerCase() === n.toLowerCase())) return { error: "Vault already exists." };
  const vault: Vault = { id: nid("vt"), name: n, ccy, balance: 0 };
  return {
    ...w,
    vaults: [vault, ...w.vaults],
  };
}

export function vaultIn(w: Wallet, vaultId: string, amount: number): Wallet | { error: string } {
  const v = w.vaults.find((x) => x.id === vaultId);
  if (!v) return { error: "Vault not found." };
  if (v.lockUntil && Date.parse(v.lockUntil) > Date.now()) return { error: "Vault is locked." };
  const amt = roundCcy(amount, v.ccy);
  if (!(amt > 0)) return { error: "Enter an amount." };
  if (w.balances[v.ccy] < amt) return { error: `Not enough ${v.ccy}.` };
  const next: Wallet = {
    ...w,
    balances: { ...w.balances, [v.ccy]: roundCcy(w.balances[v.ccy] - amt, v.ccy) },
    vaults: w.vaults.map((x) => (x.id === vaultId ? { ...x, balance: roundCcy(x.balance + amt, x.ccy) } : x)),
  };
  return pushTx(next, {
    kind: "vault",
    amount: amt,
    ccy: v.ccy,
    counterparty: v.name,
    note: "Into vault",
    auroFee: 0,
    revolutFee: 0,
  });
}

export function vaultOut(w: Wallet, vaultId: string, amount: number): Wallet | { error: string } {
  const v = w.vaults.find((x) => x.id === vaultId);
  if (!v) return { error: "Vault not found." };
  if (v.lockUntil && Date.parse(v.lockUntil) > Date.now()) return { error: "Vault is locked." };
  const amt = roundCcy(amount, v.ccy);
  if (!(amt > 0)) return { error: "Enter an amount." };
  if (v.balance < amt) return { error: "Not enough in the vault." };
  const next: Wallet = {
    ...w,
    balances: { ...w.balances, [v.ccy]: roundCcy(w.balances[v.ccy] + amt, v.ccy) },
    vaults: w.vaults.map((x) => (x.id === vaultId ? { ...x, balance: roundCcy(x.balance - amt, x.ccy) } : x)),
  };
  return pushTx(next, {
    kind: "vault",
    amount: amt,
    ccy: v.ccy,
    counterparty: v.name,
    note: "Out of vault",
    auroFee: 0,
    revolutFee: 0,
  });
}

export function investFromVault(w: Wallet, vaultId: string, amount: number, name: string): Wallet | { error: string } {
  const v = w.vaults.find((x) => x.id === vaultId);
  if (!v) return { error: "Vault not found." };
  if (v.ccy !== "USD") return { error: "PreStocks settle in USD. Move to cash or a USD vault." };
  const amt = roundCcy(amount, "USD");
  if (v.balance < amt) return { error: "Not enough in the vault." };
  const next: Wallet = {
    ...w,
    vaults: w.vaults.map((x) => (x.id === vaultId ? { ...x, balance: roundCcy(x.balance - amt, x.ccy) } : x)),
  };
  return pushTx(next, {
    kind: "invest",
    amount: amt,
    ccy: "USD",
    counterparty: name,
    note: `PreStocks from ${v.name}`,
    auroFee: 0,
    revolutFee: 0,
  });
}

export function issueNearby(
  w: Wallet,
  amount: number,
  ccy: Ccy,
): { wallet: Wallet; note: NearbyNote } | { error: string } {
  const amt = roundCcy(amount, ccy);
  if (!(amt > 0)) return { error: "Enter an amount." };
  if (w.balances[ccy] < amt) return { error: `Not enough ${ccy}.` };
  const id = nid("nb");
  const code = makeCode();
  const payloadObj: NearbyPayload = { v: 1, id, code, from: w.tag, amount: amt, ccy, ts: Date.now() };
  const payload = encodeNote(payloadObj);
  const note: NearbyNote = {
    id,
    code,
    amount: amt,
    ccy,
    fromTag: w.tag,
    payload,
    status: "open",
    createdAt: new Date().toISOString(),
  };
  const next: Wallet = {
    ...w,
    balances: { ...w.balances, [ccy]: roundCcy(w.balances[ccy] - amt, ccy) },
    notes: [note, ...w.notes],
  };
  return {
    wallet: pushTx(next, {
      kind: "nearby",
      amount: amt,
      ccy,
      counterparty: code,
      note: "Nearby send · waiting",
      auroFee: 0,
      revolutFee: 0,
      status: "pending",
    }),
    note,
  };
}

export function claimNearby(w: Wallet, p: NearbyPayload): Wallet | { error: string } {
  if (w.notes.some((n) => n.id === p.id && n.status === "claimed")) return { error: "Already claimed here." };
  if (p.from === w.tag) return { error: "That’s your own note." };
  const ccy = CCYS.includes(p.ccy as Ccy) ? (p.ccy as Ccy) : "USD";
  const amt = roundCcy(p.amount, ccy);
  const next: Wallet = {
    ...w,
    balances: { ...w.balances, [ccy]: roundCcy(w.balances[ccy] + amt, ccy) },
    notes: [
      {
        id: p.id,
        code: p.code,
        amount: amt,
        ccy,
        fromTag: p.from,
        payload: "",
        status: "claimed",
        createdAt: new Date().toISOString(),
      },
      ...w.notes,
    ],
  };
  return pushTx(next, {
    kind: "nearby",
    amount: amt,
    ccy,
    counterparty: p.from,
    note: `Nearby from ${p.from} · ${p.code}`,
    auroFee: 0,
    revolutFee: 0,
  });
}

export const FALLBACK_USD: Record<Ccy, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  MXN: 0.056,
  USDC: 1,
  SOL: 148,
};
