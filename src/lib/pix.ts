/** Pix payout key. A key that checks is not proof the account exists. */

export type PixPayout = {
  protocol: "cpf" | "cnpj" | "email" | "phone" | "evp";
  key: string;
  shown: string;
  concept: string;
};

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function cpfOk(value: string): boolean {
  const n = digits(value);
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(n[i]) * (10 - i);
  let check = (sum * 10) % 11;
  if (check === 10) check = 0;
  if (check !== Number(n[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(n[i]) * (11 - i);
  check = (sum * 10) % 11;
  if (check === 10) check = 0;
  return check === Number(n[10]);
}

function cnpjOk(value: string): boolean {
  const n = digits(value);
  if (n.length !== 14 || /^(\d)\1{13}$/.test(n)) return false;
  const weigh = (len: number) => {
    let sum = 0;
    let w = len - 7;
    for (let i = 0; i < len; i += 1) {
      sum += Number(n[i]) * w;
      w -= 1;
      if (w < 2) w = 9;
    }
    const check = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    return check === Number(n[len]);
  };
  return weigh(12) && weigh(13);
}

export function showPix(protocol: PixPayout["protocol"], key: string): string {
  if (protocol === "cpf" && key.length === 11) return `${key.slice(0, 3)}.${key.slice(3, 6)}.${key.slice(6, 9)}-${key.slice(9)}`;
  if (protocol === "cnpj" && key.length === 14) return `${key.slice(0, 2)}.${key.slice(2, 5)}.${key.slice(5, 8)}/${key.slice(8, 12)}-${key.slice(12)}`;
  if (protocol === "phone") {
    const n = digits(key);
    const rest = n.startsWith("55") ? n.slice(2) : n;
    if (rest.length === 11) return `+55 ${rest.slice(0, 2)} ${rest.slice(2, 7)}-${rest.slice(7)}`;
    if (rest.length === 10) return `+55 ${rest.slice(0, 2)} ${rest.slice(2, 6)}-${rest.slice(6)}`;
  }
  return key;
}

export function pixCheck(account: Record<string, string>): PixPayout | { error: string } {
  const concept = (account.concept || "").replace(/\s+/g, " ").trim();
  if (concept.length < 1 || concept.length > 40) return { error: "The concept is required, up to 40 characters." };
  const raw = (account.pix || "").trim();
  if (!raw) return { error: "The Pix key is missing." };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) && raw.length <= 77) {
    return { protocol: "email", key: raw, shown: raw, concept };
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    const key = raw.toLowerCase();
    return { protocol: "evp", key, shown: key, concept };
  }
  const n = digits(raw);
  if (n.length === 11 && cpfOk(n) && !raw.startsWith("+")) return { protocol: "cpf", key: n, shown: showPix("cpf", n), concept };
  if (n.length === 14 && cnpjOk(n) && !raw.startsWith("+")) return { protocol: "cnpj", key: n, shown: showPix("cnpj", n), concept };
  if (raw.startsWith("+") || n.length === 12 || n.length === 13) {
    const phone = n.startsWith("55") ? n : `55${n}`;
    if (phone.length < 12 || phone.length > 13) return { error: "A Pix phone is +55 and the number." };
    const key = `+${phone}`;
    return { protocol: "phone", key, shown: showPix("phone", key), concept };
  }
  if (n.length === 11 || n.length === 14) return { error: "That CPF or CNPJ does not check." };
  return { error: "A Pix key is a CPF, CNPJ, email, phone, or random key." };
}
