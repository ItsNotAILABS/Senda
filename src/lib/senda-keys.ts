/** Browser-issued Solana-style key. Paper key stays on this device. */

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function toB58(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  const digits = [0];
  for (const b of bytes) {
    let carry = b;
    for (let i = 0; i < digits.length; i += 1) {
      const x = digits[i] * 256 + carry;
      digits[i] = x % 58;
      carry = Math.floor(x / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  return "1".repeat(zeros) + digits.reverse().map((d) => B58[d]).join("");
}

export function shortPk(pk: string): string {
  if (pk.length < 12) return pk;
  return `${pk.slice(0, 4)}…${pk.slice(-4)}`;
}

export function issueSendaKey(): { pubkey: string; secret: string } {
  const secret = crypto.getRandomValues(new Uint8Array(32));
  const pub = crypto.getRandomValues(new Uint8Array(32));
  return { pubkey: toB58(pub), secret: [...secret].map((b) => b.toString(16).padStart(2, "0")).join("") };
}
