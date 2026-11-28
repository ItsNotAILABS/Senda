/** A camera code turned into a Solana recipient. Not a payment until the wallet signs. */

import { PublicKey } from "@solana/web3.js";

export type ScannedPay = {
  ok: true;
  to: string;
  amount?: number;
  label?: string;
  message?: string;
  memo?: string;
  kind: "address" | "solana-pay";
};

const BASE58 = /[1-9A-HJ-NP-Za-km-z]{32,44}/;

function pubkey(text: string): string | null {
  try {
    return new PublicKey(text).toBase58();
  } catch {
    return null;
  }
}

function fromSolana(text: string): ScannedPay | { ok: false; error: string } | null {
  const at = text.toLowerCase().indexOf("solana:");
  if (at < 0) return null;
  const body = text.slice(at + "solana:".length);
  const cut = body.indexOf("?");
  const to = pubkey(cut < 0 ? body : body.slice(0, cut));
  if (!to) return { ok: false, error: "Could not read that link." };
  const q = new URLSearchParams(cut < 0 ? "" : body.slice(cut + 1));
  const amount = Number(q.get("amount") || "");
  return {
    ok: true,
    to,
    amount: amount > 0 ? amount : undefined,
    label: q.get("label") || undefined,
    message: q.get("message") || undefined,
    memo: q.get("memo") || undefined,
    kind: "solana-pay",
  };
}

function fromJson(text: string): string | null {
  if (!text.startsWith("{")) return null;
  try {
    const row = JSON.parse(text) as Record<string, unknown>;
    for (const key of ["recipient", "address", "account", "pubkey", "owner"]) {
      const value = row[key];
      if (typeof value === "string" && pubkey(value)) return value.trim();
    }
  } catch {
    return null;
  }
  return null;
}

/** Phantom, Solflare, a bare address, a solana: bill, or a link that carries one. */
export function readPayCode(raw: string): ScannedPay | { ok: false; error: string } {
  const text = raw.trim().replace(/^\uFEFF/, "");
  if (!text) return { ok: false, error: "That code was empty." };
  if (/^0x[a-fA-F0-9]{40}$/.test(text)) return { ok: false, error: "That is an Ethereum address. This send is Solana USDC." };
  if (/^(bc1|tb1)[a-z0-9]{20,}/i.test(text)) return { ok: false, error: "That is a Bitcoin address. This send is Solana USDC." };

  const linked = fromSolana(text);
  if (linked) return linked;

  const jsonAddress = fromJson(text);
  if (jsonAddress) {
    const to = pubkey(jsonAddress);
    if (to) return { ok: true, to, kind: "address" };
  }

  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      for (const key of ["recipient", "address", "to", "account", "pubkey"]) {
        const value = url.searchParams.get(key);
        const to = value ? pubkey(value) : null;
        if (to) {
          const amount = Number(url.searchParams.get("amount") || "");
          return { ok: true, to, amount: amount > 0 ? amount : undefined, kind: "solana-pay", label: url.searchParams.get("label") || undefined };
        }
      }
      const last = url.pathname.split("/").filter(Boolean).pop() || "";
      const to = pubkey(last);
      if (to) return { ok: true, to, kind: "address" };
    } catch {
      /* not a url */
    }
  }

  const bare = pubkey(text);
  if (bare) return { ok: true, to: bare, kind: "address" };

  const buried = text.match(BASE58);
  if (buried) {
    const to = pubkey(buried[0]);
    if (to) return { ok: true, to, kind: "address" };
  }
  return { ok: false, error: "That code is not a Solana address or a solana: bill." };
}
