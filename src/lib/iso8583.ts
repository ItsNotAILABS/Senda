/** ISO 8583 financial messages. Card auth on Senda cash. */

export type Mti = "0100" | "0110" | "0200" | "0210" | "0420" | "0430";

export type Iso8583 = {
  mti: Mti;
  f2_pan: string;
  f3_proc: string;
  f4_amount: string;
  f7_xmit: string;
  f11_stan: string;
  f18_mcc: string;
  f22_pos: string;
  f37_rrn: string;
  f38_auth?: string;
  f39_rc?: string;
  f41_tid: string;
  f42_mid: string;
  f43_merchant: string;
  f49_ccy: "840";
};

const RC: Record<string, string> = {
  "00": "Approved",
  "05": "Do not honour",
  "12": "Invalid transaction",
  "14": "Invalid PAN",
  "51": "Insufficient funds",
  "54": "Expired",
  "57": "Not permitted",
  "62": "Restricted (frozen)",
  "63": "Security",
};

export function rcText(code: string): string {
  return RC[code] ?? code;
}

function stan(): string {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

function rrn(): string {
  const t = Date.now().toString().slice(-12);
  return t.padStart(12, "0");
}

function xmit(): string {
  const d = new Date();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${mm}${dd}${hh}${mi}${ss}`;
}

function amount12(n: number): string {
  return String(Math.round(n * 100)).padStart(12, "0");
}

export function authRequest(input: {
  pan: string;
  amount: number;
  mcc: string;
  merchant: string;
}): Iso8583 {
  const last4 = input.pan.replace(/\D/g, "").slice(-4);
  return {
    mti: "0100",
    f2_pan: `************${last4}`,
    f3_proc: "000000",
    f4_amount: amount12(input.amount),
    f7_xmit: xmit(),
    f11_stan: stan(),
    f18_mcc: input.mcc.padStart(4, "0"),
    f22_pos: "810",
    f37_rrn: rrn(),
    f41_tid: "SENDA001",
    f42_mid: "SENDAUS4F00001",
    f43_merchant: input.merchant.slice(0, 40),
    f49_ccy: "840",
  };
}

export function authResponse(req: Iso8583, rc: string): Iso8583 {
  return {
    ...req,
    mti: "0110",
    f38_auth: rc === "00" ? String(100000 + Math.floor(Math.random() * 899999)) : undefined,
    f39_rc: rc,
  };
}

export function reasonToRc(reason: string | null): string {
  if (!reason) return "00";
  const r = reason.toLowerCase();
  if (r.includes("insufficient") || r.includes("cash") || r.includes("enough")) return "51";
  if (r.includes("expir")) return "54";
  if (r.includes("frozen") || r.includes("termin")) return "62";
  if (r.includes("limit") || r.includes("cap")) return "57";
  if (r.includes("no card")) return "14";
  return "05";
}
