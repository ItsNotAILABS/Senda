/** A link that wraps a product this desk can actually settle. It is not a balance. */

import { cleanTag, type SleeveCcy } from "@/lib/revolut-link";

export type EnvelopeRail = "revolut" | "usdc" | "pre" | "cover";

export type Envelope = {
  rail: EnvelopeRail;
  to: string;
  usd: number;
  ccy: SleeveCcy;
  what: string;
};

const RAILS: EnvelopeRail[] = ["revolut", "usdc", "pre", "cover"];
const CCYS: SleeveCcy[] = ["USD", "EUR", "GBP", "MXN"];

export function parseEnvelope(raw: {
  rail?: string;
  to?: string;
  usd?: string;
  ccy?: string;
  what?: string;
}): Envelope | null {
  const rail = RAILS.find((r) => r === raw.rail);
  if (!rail) return null;
  const ccy = CCYS.find((c) => c === raw.ccy?.toUpperCase()) ?? "USD";
  const usd = Math.round((Number(raw.usd) || 0) * 100) / 100;
  const what = (raw.what || "").trim().slice(0, 80);
  const to = (raw.to || "").trim();
  if (rail === "revolut" && !cleanTag(to)) return null;
  if (rail === "usdc" && to.length < 32) return null;
  if (rail === "pre" && !/^[A-Za-z0-9.]{1,16}$/.test(to)) return null;
  if (rail !== "cover" && !to) return null;
  if ((rail === "revolut" || rail === "usdc" || rail === "cover") && !(usd > 0)) return null;
  return { rail, to: rail === "revolut" ? cleanTag(to)! : to, usd, ccy, what: what || labelFor(rail) };
}

function labelFor(rail: EnvelopeRail): string {
  if (rail === "revolut") return "Revolut";
  if (rail === "usdc") return "USDC";
  if (rail === "pre") return "PreStock";
  return "Cover";
}

export function envelopeQuery(e: Envelope): string {
  const q = new URLSearchParams();
  q.set("act", "open");
  q.set("rail", e.rail);
  if (e.to) q.set("to", e.to);
  if (e.usd > 0) q.set("usd", String(e.usd));
  q.set("ccy", e.ccy);
  q.set("what", e.what.slice(0, 80));
  return q.toString();
}

export function envelopeUrl(e: Envelope, origin: string): string {
  return `${origin}/payments?${envelopeQuery(e)}`;
}
