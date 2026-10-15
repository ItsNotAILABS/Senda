/**
 * Mastercard Commercial Connect, one charge.
 * POST /accounts/virtual-cards. The number comes back from Mastercard or it is not shown.
 * OAuth 1.0a RSA-SHA256 with the body hash. No PAN is minted here.
 */

import { createHash, createSign, randomBytes } from "node:crypto";

export const SANDBOX = "https://sandbox.apiedge.mastercard.com/commercial";
export const PRODUCTION = "https://apiedge.mastercard.com/commercial";

export function rfc3986(value) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function baseStringUri(raw) {
  const url = new URL(raw);
  const drop = (url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80");
  const port = url.port && !drop ? `:${url.port}` : "";
  return `${url.protocol}//${url.hostname.toLowerCase()}${port}${url.pathname}`;
}

export function oauthHeader({ method, url, body = "", consumerKey, privateKeyPem, nonce, timestamp }) {
  const parsed = new URL(url);
  const bodyHash = createHash("sha256").update(body ?? "").digest("base64");
  const oauth = {
    oauth_body_hash: bodyHash,
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce || randomBytes(12).toString("hex"),
    oauth_signature_method: "RSA-SHA256",
    oauth_timestamp: String(timestamp ?? Math.floor(Date.now() / 1000)),
    oauth_version: "1.0",
  };
  const params = { ...oauth };
  for (const [key, value] of parsed.searchParams) params[key] = value;
  const paramString = Object.keys(params)
    .sort()
    .map((key) => `${rfc3986(key)}=${rfc3986(params[key])}`)
    .join("&");
  const base = [String(method || "GET").toUpperCase(), rfc3986(baseStringUri(url)), rfc3986(paramString)].join("&");
  const signature = createSign("RSA-SHA256").update(base).sign(privateKeyPem, "base64");
  const signed = { ...oauth, oauth_signature: signature };
  const header = Object.keys(signed)
    .sort()
    .map((key) => `${key}="${rfc3986(signed[key])}"`)
    .join(",");
  return `OAuth ${header}`;
}

function stamp(date) {
  return new Date(date).toISOString().replace(/\.\d{3}Z$/, ".000Z");
}

/** One authorization, one spend cap, a short validity window. Matches the Commercial Connect create body. */
export function oneTimeBody({ entityId, realCardId, spendUsd, now = Date.now(), hours = 24 }) {
  const spend = Math.round(Number(spendUsd) * 100) / 100;
  if (!(spend > 0)) throw new Error("Enter an amount.");
  if (!entityId || !realCardId) throw new Error("Commercial Connect is not connected.");
  const start = Number(now) + 60_000;
  const end = start + Math.max(1, Number(hours) || 24) * 3_600_000;
  const endDate = new Date(end);
  const cardMonth = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() + 2, 1));
  const cardExpiration = `${cardMonth.getUTCFullYear()}-${String(cardMonth.getUTCMonth() + 1).padStart(2, "0")}`;
  return {
    entityId: String(entityId),
    cardDetails: { cardExpiration, realCardId: String(realCardId) },
    cardControls: [
      {
        alias: "Senda one charge",
        transactionLimit: { spendAmount: spend },
        continuousLimit: { transactionCount: 1, spendAmount: spend },
        validityPeriod: { startDate: stamp(start), endDate: stamp(end) },
      },
    ],
  };
}

/** A full card number is digits. A masked number is not filled in. */
export function readVirtualCard(body) {
  const details = body?.cardDetails && typeof body.cardDetails === "object" ? body.cardDetails : {};
  const raw = String(details.cardNumber || "").replace(/\s/g, "");
  const expiry = String(details.cardExpiration || "");
  const cvv = String(details.cvv || details.cvc || "");
  const accountId = String(body?.accountId || "");
  const digits = raw.replace(/\D/g, "");
  if (!/^\d{13,19}$/.test(raw)) {
    return { accountId, last4: digits.slice(-4), expiry, pan: "", cvv: "", masked: true };
  }
  return { accountId, last4: raw.slice(-4), expiry, pan: raw, cvv, masked: false };
}

/**
 * Pay an existing virtual card through Commercial Connect.
 * One of supplierId or email. The debtor address is whatever the person typed.
 */
export function paymentOnAccount(input) {
  const accountId = String(input.accountId || "");
  const supplierId = String(input.supplierId || "").trim();
  const email = String(input.email || "").trim();
  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!accountId) throw new Error("Spin a card first.");
  if (supplierId && email) throw new Error("Use a supplier id or an email, not both.");
  if (!supplierId && !email) throw new Error("Name the supplier.");
  if (!(amount > 0)) throw new Error("Enter an amount.");
  const name = String(input.debtorName || "").trim();
  const country = String(input.country || "").trim();
  const postalCode = String(input.postalCode || "").trim();
  if (!name || !country || !postalCode) throw new Error("The payment needs a name, country, and postal code.");
  const creditor = supplierId ? { supplierId } : { email };
  return {
    existingCard: { accountId, cardType: "VIRTUAL" },
    ...creditor,
    debtor: { name: name.slice(0, 140), postalAddress: { country, postalCode } },
    instructedAmount: { amount, currency: "USD" },
    requestedExecutionDate: String(input.requestedExecutionDate),
    endToEndId: String(input.endToEndId || "").slice(0, 35),
  };
}

export function readPayment(body) {
  const paymentId = String(body?.paymentId || body?.id || body?.instructionIdentification || "");
  const status = String(body?.status || body?.paymentStatus?.status || "");
  return { paymentId, status };
}

export function connectConfig(env) {
  const source = env || {};
  const consumerKey = String(source.MASTERCARD_CONSUMER_KEY || "").trim();
  const privateKeyPem = String(source.MASTERCARD_SIGNING_KEY || "").trim();
  const entityId = String(source.MASTERCARD_ENTITY_ID || "").trim();
  const realCardId = String(source.MASTERCARD_REAL_CARD_ID || "").trim();
  const base = String(source.MASTERCARD_BASE_URL || "").trim() || SANDBOX;
  const missing = [];
  if (!consumerKey) missing.push("consumer key");
  if (!privateKeyPem) missing.push("signing key");
  if (!entityId) missing.push("entity id");
  if (!realCardId) missing.push("real card id");
  return {
    ready: missing.length === 0,
    missing,
    base: base.replace(/\/$/, ""),
    consumerKey,
    privateKeyPem,
    entityId,
    realCardId,
  };
}
