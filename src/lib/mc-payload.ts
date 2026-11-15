/** Mastercard Send Disbursements body. Amount is minor units, the way their POST expects it. */

export type PayoutDraft = {
  usd: number;
  reference: string;
  first: string;
  last: string;
  pan: string;
  exp: string;
  line1: string;
  city: string;
  state: string;
  postal: string;
  country: string;
};

export function luhn(pan: string): boolean {
  const d = pan.replace(/\D/g, "");
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

export function minorUnits(usd: number): string {
  return String(Math.round(usd * 100));
}

export function checkDraft(input: PayoutDraft): string | null {
  if (!(input.usd >= 0.01) || input.usd > 2500) return "Amount has to be between $0.01 and $2,500.";
  if (!/^[A-Z0-9]{6,40}$/.test(input.reference)) return "The reference is not valid.";
  if (input.first.trim().length < 1 || input.last.trim().length < 1) return "The card needs a first and last name.";
  if (!luhn(input.pan)) return "That card number does not check.";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.exp)) return "Expiry has to be YYYY-MM.";
  const [year, month] = input.exp.split("-").map(Number);
  const end = new Date(Date.UTC(year, month, 1));
  if (end.getTime() <= Date.now()) return "That card is expired.";
  if (input.line1.trim().length < 2 || input.city.trim().length < 2) return "The card needs a street and a city.";
  if (!/^[A-Za-z]{2}$/.test(input.state.trim())) return "State is two letters.";
  if (input.postal.trim().length < 3) return "Postal code is missing.";
  if (!/^[A-Za-z]{3}$/.test(input.country.trim())) return "Country is a 3-letter code, such as USA.";
  return null;
}

/** What the user can see hashed. The PAN is not in it. */
export function payoutSeal(input: PayoutDraft): string {
  const last4 = input.pan.replace(/\D/g, "").slice(-4);
  return [input.reference, input.usd.toFixed(2), last4, input.exp, input.country.trim().toUpperCase()].join("|");
}
