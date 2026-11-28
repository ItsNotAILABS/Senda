import { pixCheck } from "@/lib/pix";
import { speiCheck } from "@/lib/spei";

export const HOUSE_RULES = "senda.rails.4";

export type Desk = "rosis" | "house";

export type Field = {
  id: string;
  label: string;
  hint: string;
};

export type Corridor = {
  id: string;
  country: string;
  rail: string;
  ccy: string;
  desk: Desk;
  minUsd: number;
  maxUsd: number;
  feeBps: number;
  feeUsd: number;
  fields: Field[];
};

export const CORRIDORS: Corridor[] = [
  {
    id: "mx-spei",
    country: "Mexico",
    rail: "SPEI",
    ccy: "MXN",
    desk: "rosis",
    minUsd: 10,
    maxUsd: 25_000,
    feeBps: 35,
    feeUsd: 0.25,
    fields: [
      { id: "name", label: "Name on the account", hint: "As the bank has it" },
      { id: "clabe", label: "CLABE", hint: "18 digits. Leave blank to use a card or a phone." },
      { id: "card", label: "Debit card", hint: "16 digits, only with no CLABE" },
      { id: "phone", label: "Phone", hint: "10 digits, only with no CLABE" },
      { id: "bank", label: "Bank code", hint: "3 digits. Required for a card or a phone." },
      { id: "concept", label: "Concept", hint: "Up to 40 characters" },
      { id: "reference", label: "Reference", hint: "7 digits, or leave blank" },
    ],
  },
  {
    id: "gt-bank",
    country: "Guatemala",
    rail: "Local transfer",
    ccy: "GTQ",
    desk: "rosis",
    minUsd: 10,
    maxUsd: 15_000,
    feeBps: 45,
    feeUsd: 0.4,
    fields: [
      { id: "name", label: "Name on the account", hint: "As the bank has it" },
      { id: "bank", label: "Bank", hint: "Banco Industrial, Banrural, BAC, or G&T" },
      { id: "account", label: "Account", hint: "The number the bank shows" },
    ],
  },
  {
    id: "sv-bank",
    country: "El Salvador",
    rail: "Local transfer",
    ccy: "USD",
    desk: "rosis",
    minUsd: 10,
    maxUsd: 15_000,
    feeBps: 40,
    feeUsd: 0.35,
    fields: [
      { id: "name", label: "Name on the account", hint: "As the bank has it" },
      { id: "bank", label: "Bank", hint: "The bank that holds the account" },
      { id: "account", label: "Account", hint: "The number the bank shows" },
    ],
  },
  {
    id: "us-ach",
    country: "United States",
    rail: "ACH",
    ccy: "USD",
    desk: "house",
    minUsd: 10,
    maxUsd: 25_000,
    feeBps: 25,
    feeUsd: 0.25,
    fields: [
      { id: "name", label: "Name on the account", hint: "As the bank has it" },
      { id: "routing", label: "Routing", hint: "9 digits" },
      { id: "account", label: "Account", hint: "The number the bank shows" },
    ],
  },
  {
    id: "br-pix",
    country: "Brazil",
    rail: "Pix",
    ccy: "BRL",
    desk: "rosis",
    minUsd: 10,
    maxUsd: 25_000,
    feeBps: 35,
    feeUsd: 0.3,
    fields: [
      { id: "name", label: "Name on the key", hint: "As the bank has it" },
      { id: "pix", label: "Pix key", hint: "CPF, CNPJ, email, phone, or random key" },
      { id: "concept", label: "Concept", hint: "Up to 40 characters" },
    ],
  },
  {
    id: "co-ach",
    country: "Colombia",
    rail: "ACH",
    ccy: "COP",
    desk: "rosis",
    minUsd: 10,
    maxUsd: 15_000,
    feeBps: 50,
    feeUsd: 0.4,
    fields: [
      { id: "name", label: "Name on the account", hint: "As the bank has it" },
      { id: "account", label: "Account", hint: "The number the bank shows" },
    ],
  },
  {
    id: "ar-cvu",
    country: "Argentina",
    rail: "Transfers 3.0",
    ccy: "ARS",
    desk: "rosis",
    minUsd: 10,
    maxUsd: 10_000,
    feeBps: 60,
    feeUsd: 0.5,
    fields: [
      { id: "name", label: "Name on the account", hint: "As the bank has it" },
      { id: "cvu", label: "CBU or CVU", hint: "22 digits" },
    ],
  },
  {
    id: "pe-cci",
    country: "Peru",
    rail: "CCI",
    ccy: "PEN",
    desk: "rosis",
    minUsd: 10,
    maxUsd: 15_000,
    feeBps: 50,
    feeUsd: 0.4,
    fields: [
      { id: "name", label: "Name on the account", hint: "As the bank has it" },
      { id: "cci", label: "CCI", hint: "20 digits" },
    ],
  },
];

const GT_BANKS = ["banco industrial", "banrural", "bac", "g&t", "gt"];

export function corridorById(id: string): Corridor | undefined {
  return CORRIDORS.find((row) => row.id === id);
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function routingOk(value: string): boolean {
  const n = digits(value);
  if (n.length !== 9) return false;
  const weights = [3, 7, 1];
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(n[i]) * weights[i % 3];
  return sum % 10 === 0 && sum > 0;
}

export function checkAccount(corridor: Corridor, account: Record<string, string>): string | null {
  const name = (account.name || "").trim();
  if (name.length < 2 || name.length > 80) return "The name on the account is missing.";
  if (corridor.id === "mx-spei") {
    const spei = speiCheck(account);
    if ("error" in spei) return spei.error;
    return null;
  }
  if (corridor.id === "gt-bank") {
    const bank = (account.bank || "").trim().toLowerCase();
    if (!GT_BANKS.some((row) => bank.includes(row))) return "Name Banco Industrial, Banrural, BAC, or G&T.";
    const n = digits(account.account || "");
    if (n.length < 6 || n.length > 20) return "The Guatemala account number is missing.";
  }
  if (corridor.id === "sv-bank") {
    if ((account.bank || "").trim().length < 2) return "Name the bank in El Salvador.";
    const n = digits(account.account || "");
    if (n.length < 6 || n.length > 20) return "The El Salvador account number is missing.";
  }
  if (corridor.id === "us-ach") {
    if (!routingOk(account.routing || "")) return "That routing number does not check.";
    const n = digits(account.account || "");
    if (n.length < 4 || n.length > 17) return "The US account number is missing.";
  }
  if (corridor.id === "br-pix") {
    const pix = pixCheck(account);
    if ("error" in pix) return pix.error;
    return null;
  }
  if (corridor.id === "co-ach") {
    const n = digits(account.account || "");
    if (n.length < 6 || n.length > 20) return "The Colombia account number is missing.";
  }
  if (corridor.id === "ar-cvu" && digits(account.cvu || "").length !== 22) return "A CBU or CVU is 22 digits.";
  if (corridor.id === "pe-cci" && digits(account.cci || "").length !== 20) return "A CCI is 20 digits.";
  return null;
}

export function price(usd: number, rate: number, corridor: Corridor): { feeUsd: number; local: number; netUsd: number } | { error: string } {
  if (!(usd >= corridor.minUsd) || usd > corridor.maxUsd) {
    return { error: `This corridor takes ${corridor.minUsd} to ${corridor.maxUsd} dollars.` };
  }
  if (!(rate > 0)) return { error: "No rate." };
  const feeUsd = Math.round(((usd * corridor.feeBps) / 10_000 + corridor.feeUsd) * 100) / 100;
  const netUsd = Math.round((usd - feeUsd) * 100) / 100;
  if (!(netUsd > 0)) return { error: "The fee is larger than the send." };
  const local = Math.round(netUsd * rate * 100) / 100;
  return { feeUsd, local, netUsd };
}
