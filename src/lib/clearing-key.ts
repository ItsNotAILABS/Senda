/**
 * A clearing address that lives on this device.
 * The secret is not sent to a server. Import it into Phantom to move the funds.
 * This is not a bank account and not a balance Senda holds.
 */

import { Keypair } from "@solana/web3.js";

const KEY = "senda.clearing.v1";
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function encodeBase58(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  const digits = [0];
  for (let i = zeros; i < bytes.length; i += 1) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j += 1) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "1".repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i -= 1) out += ALPHABET[digits[i]];
  return out;
}

export type ClearingAccount = { address: string; secret: string };

export function loadClearing(): ClearingAccount {
  if (typeof window === "undefined") return { address: "", secret: "" };
  const raw = window.localStorage.getItem(KEY);
  if (raw) {
    const secret = JSON.parse(raw) as number[];
    const kp = Keypair.fromSecretKey(Uint8Array.from(secret));
    return { address: kp.publicKey.toBase58(), secret: encodeBase58(kp.secretKey) };
  }
  const kp = Keypair.generate();
  window.localStorage.setItem(KEY, JSON.stringify(Array.from(kp.secretKey)));
  return { address: kp.publicKey.toBase58(), secret: encodeBase58(kp.secretKey) };
}
