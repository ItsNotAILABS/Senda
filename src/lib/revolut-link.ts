/** Revolut on this wallet. The Revtag is theirs. Senda does not read the balance. */

const KEY = "senda.revolut.v1";

export type RevolutLink = { tag: string; at: number; wallet: string };

export type SleeveCcy = "USD" | "EUR" | "GBP" | "MXN";

export function readRevolut(): RevolutLink | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as RevolutLink;
    if (!p || typeof p.tag !== "string") return null;
    const tag = cleanTag(p.tag);
    return tag ? { tag, at: Number(p.at) || 0, wallet: typeof p.wallet === "string" ? p.wallet : "" } : null;
  } catch {
    return null;
  }
}

/** Bind a Revtag to the Solana address that is this account. */
export function saveRevolut(tag: string, wallet = ""): RevolutLink | null {
  const clean = cleanTag(tag);
  if (!clean) return null;
  const row = { tag: clean, at: Date.now(), wallet: wallet.trim() };
  localStorage.setItem(KEY, JSON.stringify(row));
  return row;
}

export function clearRevolut(): void {
  localStorage.removeItem(KEY);
}

/** Revtag, without the @. Revolut.me uses this as the path. */
export function cleanTag(raw: string): string | null {
  const tag = raw.trim().replace(/^@+/, "").toLowerCase();
  if (!/^[a-z][a-z0-9_]{2,19}$/.test(tag)) return null;
  return tag;
}

export function revolutMe(tag: string): string {
  return `https://revolut.me/${tag}`;
}

function pathAmount(n: number): string {
  const r = Math.round(n * 100) / 100;
  if (!(r > 0)) return "0";
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
}

export function payNote(raw: string): string {
  const note = raw.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32);
  return note || "senda";
}

/**
 * Personal Revolut.me payment with the amount filled in.
 * https://revolut.me/<revtag>/<currency><amount>/<note>
 * Card top-ups through this link are capped by Revolut. A Revolut-to-Revolut transfer is their own limit.
 */
export function revolutPayUrl(tag: string, ccy: SleeveCcy, amount: number, note: string): string {
  return `https://revolut.me/${tag}/${ccy.toLowerCase()}${pathAmount(amount)}/${payNote(note)}`;
}

export function openRevolutPay(url: string): void {
  const phone = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (phone) {
    window.location.assign(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function openRevolutApp(): void {
  const web = "https://www.revolut.com/";
  const phone = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (!phone) {
    window.open(web, "_blank", "noopener,noreferrer");
    return;
  }
  const started = Date.now();
  window.location.href = "revolut://";
  window.setTimeout(() => {
    if (document.hidden || Date.now() - started > 1600) return;
    window.location.href = web;
  }, 800);
}
