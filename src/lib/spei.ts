/** SPEI payout instruction. A checked CLABE is not proof the account exists. */

const BANKS: Record<string, string> = {
  "002": "Banamex",
  "012": "BBVA México",
  "014": "Santander",
  "021": "HSBC",
  "030": "Bajío",
  "036": "Inbursa",
  "042": "Mifel",
  "044": "Scotiabank",
  "058": "Banregio",
  "059": "Invex",
  "062": "Afirme",
  "072": "Banorte",
  "127": "Banco Azteca",
  "130": "Compartamos",
  "136": "Intercam",
  "137": "BanCoppel",
  "143": "CIBanco",
  "646": "STP",
};

export type SpeiPayout = {
  protocol: "clabe" | "card" | "phone";
  account: string;
  bankCode: string;
  plaza: string;
  bankName: string;
  concept: string;
  reference: string;
};

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

export function clabeOk(value: string): boolean {
  const n = digits(value);
  if (n.length !== 18) return false;
  const weights = [3, 7, 1];
  let sum = 0;
  for (let i = 0; i < 17; i += 1) sum += Number(n[i]) * weights[i % 3];
  return (10 - (sum % 10)) % 10 === Number(n[17]);
}

function luhnOk(value: string): boolean {
  const n = digits(value);
  if (n.length !== 16) return false;
  let sum = 0;
  for (let i = 0; i < 16; i += 1) {
    let d = Number(n[15 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export function bankName(code: string): string {
  return BANKS[code] || "";
}

export function speiCheck(account: Record<string, string>): SpeiPayout | { error: string } {
  const concept = (account.concept || "").replace(/\s+/g, " ").trim();
  if (concept.length < 1 || concept.length > 40) return { error: "The concept is required, up to 40 characters." };
  const reference = digits(account.reference || "");
  if (reference && reference.length !== 7) return { error: "The reference is 7 digits, or leave it blank." };
  const clabe = digits(account.clabe || "");
  const card = digits(account.card || "");
  const phone = digits(account.phone || "");
  const bank = digits(account.bank || "");
  if (clabe) {
    if (!clabeOk(clabe)) return { error: "That CLABE does not check." };
    const bankCode = clabe.slice(0, 3);
    return {
      protocol: "clabe",
      account: clabe,
      bankCode,
      plaza: clabe.slice(3, 6),
      bankName: bankName(bankCode),
      concept,
      reference,
    };
  }
  if (card) {
    if (!luhnOk(card)) return { error: "That debit card number does not check." };
    if (bank.length !== 3) return { error: "A card payout needs the 3-digit bank code." };
    return { protocol: "card", account: card, bankCode: bank, plaza: "", bankName: bankName(bank), concept, reference };
  }
  if (phone) {
    if (phone.length !== 10) return { error: "The phone is 10 digits." };
    if (bank.length !== 3) return { error: "A phone payout needs the 3-digit bank code." };
    return { protocol: "phone", account: phone, bankCode: bank, plaza: "", bankName: bankName(bank), concept, reference };
  }
  return { error: "A SPEI payout needs a CLABE, a debit card, or a 10-digit phone." };
}

export function fillReference(payout: SpeiPayout): SpeiPayout {
  if (payout.reference) return payout;
  const n = String(Math.floor(1000000 + Math.random() * 9000000));
  return { ...payout, reference: n };
}
