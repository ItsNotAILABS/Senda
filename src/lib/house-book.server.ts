import { getSql } from "@/lib/db";
import { HOUSE_RULES, checkAccount, corridorById, price, type Corridor } from "@/lib/house-rails";
import { fillReference, speiCheck, type SpeiPayout } from "@/lib/spei";
import { pixCheck, type PixPayout } from "@/lib/pix";

const FX = ["MXN", "GTQ", "BRL", "COP", "ARS", "PEN"] as const;

export type HouseOrder = {
  id: string;
  rules: string;
  direction: "out" | "in";
  corridor: string;
  country: string;
  rail: string;
  desk: "rosis" | "house";
  ccy: string;
  usd: number;
  rate: number;
  feeUsd: number;
  netUsd: number;
  local: number;
  account: Record<string, string>;
  status: "open" | "signed" | "credited";
  signature: string;
  tracking: string;
  note: string;
  createdAt: string;
};

function receive(): string {
  return process.env.HOUSE_USDC_ADDRESS?.trim() || "";
}

export function collectAccount(corridorId: string): Record<string, string> | null {
  const env = process.env;
  if (corridorId === "mx-spei" && env.HOUSE_MX_CLABE?.trim()) return { clabe: env.HOUSE_MX_CLABE.trim() };
  if (corridorId === "gt-bank" && env.HOUSE_GT_ACCOUNT?.trim()) return { account: env.HOUSE_GT_ACCOUNT.trim(), bank: env.HOUSE_GT_BANK?.trim() || "" };
  if (corridorId === "sv-bank" && env.HOUSE_SV_ACCOUNT?.trim()) return { account: env.HOUSE_SV_ACCOUNT.trim(), bank: env.HOUSE_SV_BANK?.trim() || "" };
  if (corridorId === "us-ach" && env.HOUSE_US_ACCOUNT?.trim() && env.HOUSE_US_ROUTING?.trim()) {
    return { account: env.HOUSE_US_ACCOUNT.trim(), routing: env.HOUSE_US_ROUTING.trim() };
  }
  return null;
}

async function rateFor(corridor: Corridor): Promise<number> {
  if (corridor.ccy === "USD") return 1;
  const res = await fetch(`https://api.frankfurter.app/latest?from=USD&to=${FX.join(",")}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Rates ${res.status}`);
  const body = (await res.json()) as { rates?: Record<string, number> };
  const rate = Number(body.rates?.[corridor.ccy]) || 0;
  if (!(rate > 0)) throw new Error(`No ${corridor.ccy} rate.`);
  return rate;
}

export async function quoteHouse(input: { corridor: string; usd: number; account: Record<string, string>; direction: "out" | "in" }) {
  const corridor = corridorById(input.corridor);
  if (!corridor) return { error: "That corridor is not on the house book." as const };
  if (input.direction === "out") {
    const fieldError = checkAccount(corridor, input.account);
    if (fieldError) return { error: fieldError };
  }
  let rate = 0;
  try {
    rate = await rateFor(corridor);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Rates did not answer." };
  }
  const priced = price(input.usd, rate, corridor);
  if ("error" in priced) return priced;
  let spei: SpeiPayout | null = null;
  if (corridor.id === "mx-spei" && input.direction === "out") {
    const checked = speiCheck(input.account);
    if ("error" in checked) return checked;
    spei = checked;
  }
  let pix: PixPayout | null = null;
  if (corridor.id === "br-pix" && input.direction === "out") {
    const checked = pixCheck(input.account);
    if ("error" in checked) return checked;
    pix = checked;
  }
  const collect = input.direction === "in" ? collectAccount(corridor.id) : null;
  return {
    rules: HOUSE_RULES,
    direction: input.direction,
    corridor: corridor.id,
    country: corridor.country,
    rail: corridor.rail,
    desk: corridor.desk,
    ccy: corridor.ccy,
    usd: input.usd,
    rate,
    feeUsd: priced.feeUsd,
    netUsd: priced.netUsd,
    local: priced.local,
    expires: Date.now() + 90_000,
    receive: receive(),
    collect,
    spei,
    pix,
    note:
      input.direction === "in"
        ? collect
          ? "Pay this local account. USDC is released only after the house marks it."
          : "The house has not issued a collect account on this corridor yet."
        : corridor.desk === "rosis"
          ? "Rosis posts the local credit. The house keeps this row."
          : "The house posts the US credit. The house keeps this row.",
  };
}

function rowOf(raw: Record<string, unknown>): HouseOrder {
  let account: Record<string, string> = {};
  try {
    account = JSON.parse(String(raw.account_json || "{}")) as Record<string, string>;
  } catch {
    account = {};
  }
  return {
    id: String(raw.id),
    rules: String(raw.rules),
    direction: raw.direction === "in" ? "in" : "out",
    corridor: String(raw.corridor),
    country: String(raw.country),
    rail: String(raw.rail),
    desk: raw.desk === "house" ? "house" : "rosis",
    ccy: String(raw.ccy),
    usd: Number(raw.usd),
    rate: Number(raw.rate),
    feeUsd: Number(raw.fee_usd),
    netUsd: Number(raw.net_usd),
    local: Number(raw.local_amount),
    account,
    status: raw.status === "signed" || raw.status === "credited" ? raw.status : "open",
    signature: String(raw.signature || ""),
    tracking: String(raw.tracking || ""),
    note: String(raw.note || ""),
    createdAt: raw.created_at instanceof Date ? raw.created_at.toISOString() : String(raw.created_at || ""),
  };
}

export async function listHouseOrders(): Promise<HouseOrder[]> {
  const sql = await getSql();
  const rows = await sql`select * from house_order order by created_at desc limit 40`;
  return rows.map((row) => rowOf(row));
}

export async function openHouseOrder(input: { corridor: string; usd: number; account: Record<string, string>; direction: "out" | "in" }) {
  const quote = await quoteHouse(input);
  if ("error" in quote) return quote;
  const spei = quote.spei ? fillReference(quote.spei) : null;
  let account = spei
    ? { ...input.account, reference: spei.reference, protocol: spei.protocol, bankCode: spei.bankCode, bankName: spei.bankName, plaza: spei.plaza }
    : input.account;
  if (quote.corridor === "br-pix" && input.direction === "out" && quote.pix) {
    account = { ...account, protocol: quote.pix.protocol, pix: quote.pix.key, concept: quote.pix.concept };
  }
  const id = crypto.randomUUID();
  const sql = await getSql();
  await sql`
    insert into house_order (
      id, rules, direction, corridor, country, rail, desk, ccy, usd, rate, fee_usd, net_usd, local_amount, account_json, status, note
    ) values (
      ${id}, ${quote.rules}, ${quote.direction}, ${quote.corridor}, ${quote.country}, ${quote.rail}, ${quote.desk}, ${quote.ccy},
      ${quote.usd}, ${quote.rate}, ${quote.feeUsd}, ${quote.netUsd}, ${quote.local}, ${JSON.stringify(account)}, 'open', ${quote.note}
    )
  `;
  const rows = await sql`select * from house_order where id = ${id}`;
  return { order: rowOf(rows[0]), quote };
}

export async function signHouseOrder(id: string, signature: string) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(signature)) return { error: "That is not a signature." as const };
  const sql = await getSql();
  const rows = await sql`update house_order set status = 'signed', signature = ${signature} where id = ${id} and status = 'open' returning *`;
  if (!rows[0]) return { error: "That instruction is not open." as const };
  return { order: rowOf(rows[0]) };
}

function trackingOk(clave: string, corridor: string): string | null {
  if (!clave) return null;
  if (corridor === "br-pix") {
    if (/^E\d{20}[A-Za-z0-9]{11}$/.test(clave)) return null;
    return "A Pix end-to-end id is 32 characters and starts with E. Leave it blank if Rosis has not posted one. This row is not a Bacen receipt.";
  }
  if (/^[A-Za-z0-9]{1,30}$/.test(clave)) return null;
  return corridor === "mx-spei"
    ? "A clave de rastreo is up to 30 letters and digits. This row is not a Banxico CEP."
    : "That tracking key is up to 30 letters and digits.";
}

export async function creditHouseOrder(id: string, tracking = "") {
  const clave = tracking.trim();
  const sql = await getSql();
  const existing = await sql`select corridor from house_order where id = ${id} and status <> 'credited'`;
  if (!existing[0]) return { error: "That row is already closed." as const };
  const bad = trackingOk(clave, String(existing[0].corridor));
  if (bad) return { error: bad };
  const rows = clave
    ? await sql`update house_order set status = 'credited', tracking = ${clave} where id = ${id} and status <> 'credited' returning *`
    : await sql`update house_order set status = 'credited' where id = ${id} and status <> 'credited' returning *`;
  if (!rows[0]) return { error: "That row is already closed." as const };
  return { order: rowOf(rows[0]) };
}
