/** Seal a funding card in memory. PAN and CVV are not returned and must not be stored. */

function digits(s: string): string {
  return s.replace(/\D/g, "");
}

function luhn(d: string): boolean {
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

function bytesToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sealFunding(
  pan: string,
  cvv: string,
): Promise<{ last4: string; token: string } | { error: string }> {
  const d = digits(pan);
  if (!luhn(d)) return { error: "Card number doesn’t check out." };
  if (digits(cvv).length < 3) return { error: "CVV is 3 digits." };
  if (typeof crypto === "undefined" || !crypto.subtle) return { error: "This browser can’t seal a card." };
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(`${d}|${digits(cvv)}`),
  );
  const token = bytesToHex(await crypto.subtle.digest("SHA-256", cipher)).slice(0, 24);
  return { last4: d.slice(-4), token };
}
