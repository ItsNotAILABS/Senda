/** Gift link math. The secret stays in the URL hash. It is not a query parameter. */

export const GIFT_WINDOWS = [
  { id: "1h", hours: 1, label: "1 hour" },
  { id: "1d", hours: 24, label: "1 day" },
  { id: "7d", hours: 168, label: "7 days" },
];

export function giftOpen(now, expiresAt) {
  return Number.isFinite(now) && Number.isFinite(expiresAt) && now < expiresAt;
}

export function giftHash(input) {
  const q = new URLSearchParams();
  q.set("s", String(input.secret || ""));
  q.set("e", String(input.expiresAt));
  q.set("u", String(input.usd));
  return q.toString();
}

export function readGiftHash(hash) {
  const raw = String(hash || "").replace(/^#/, "");
  if (!raw) return null;
  const q = new URLSearchParams(raw);
  const secret = q.get("s") || "";
  const expiresAt = Number(q.get("e"));
  const usd = Number(q.get("u"));
  if (!secret || !Number.isFinite(expiresAt)) return null;
  return { secret, expiresAt, usd: Number.isFinite(usd) ? usd : 0 };
}
