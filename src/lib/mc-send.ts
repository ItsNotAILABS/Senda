/** POST a Mastercard Send disbursement. No key, no call, no paid status. */

import { createServerFn } from "@tanstack/react-start";
import { checkDraft, minorUnits, type PayoutDraft } from "@/lib/mc-payload";

type Built = {
  url: string;
  body: string;
};

function need(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`missing:${name}`);
  return v;
}

function pem(raw: string): string {
  return raw.replace(/\\n/g, "\n");
}

function encode(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function senderAddress() {
  return {
    line1: need("MASTERCARD_SENDER_LINE1"),
    city: need("MASTERCARD_SENDER_CITY"),
    country_subdivision: need("MASTERCARD_SENDER_STATE"),
    postal_code: need("MASTERCARD_SENDER_POSTAL"),
    country: need("MASTERCARD_SENDER_COUNTRY"),
  };
}

function build(input: PayoutDraft): Built {
  const partnerId = need("MASTERCARD_PARTNER_ID");
  const base = (process.env.MASTERCARD_SEND_BASE?.trim() || "https://sandbox.api.move.mastercard.com/send/static").replace(/\/$/, "");
  const url = `${base}/v1/partners/${partnerId}/disbursements/payment?decline_details=true`;
  const pan = input.pan.replace(/\D/g, "");
  const body = JSON.stringify({
    payment_disbursement: {
      disbursement_reference: input.reference,
      payment_type: "BDB",
      amount: minorUnits(input.usd),
      currency: "USD",
      sender_account_uri: need("MASTERCARD_FUNDING_URI"),
      sender: {
        first_name: need("MASTERCARD_SENDER_FIRST"),
        last_name: need("MASTERCARD_SENDER_LAST"),
        account_type: "03",
        address: senderAddress(),
      },
      recipient_account_uri: `pan:${pan};exp=${input.exp}`,
      recipient: {
        first_name: input.first.trim(),
        last_name: input.last.trim(),
        account_type: "03",
        address: {
          line1: input.line1.trim(),
          city: input.city.trim(),
          country_subdivision: input.state.trim().toUpperCase(),
          postal_code: input.postal.trim(),
          country: input.country.trim().toUpperCase(),
        },
      },
      participant: { merchant_category_code: process.env.MASTERCARD_MCC?.trim() || "6536" },
      funding_source: process.env.MASTERCARD_FUNDING_SOURCE?.trim() || "DEBIT",
      transaction_purpose: "00",
    },
  });
  return { url, body };
}

async function oauthHeader(method: string, rawUrl: string, body: string): Promise<string> {
  const { createHash, createSign, randomBytes } = await import("node:crypto");
  const key = pem(need("MASTERCARD_SIGNING_KEY"));
  const consumer = need("MASTERCARD_CONSUMER_KEY");
  const parsed = new URL(rawUrl);
  const oauth: Record<string, string> = {
    oauth_body_hash: createHash("sha256").update(body, "utf8").digest("base64"),
    oauth_consumer_key: consumer,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "RSA-SHA256",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: "1.0",
  };
  const params: Record<string, string> = { ...oauth };
  parsed.searchParams.forEach((value, name) => {
    params[name] = value;
  });
  const paramString = Object.keys(params)
    .sort()
    .map((k) => `${encode(k)}=${encode(params[k])}`)
    .join("&");
  const baseUrl = `${parsed.origin}${parsed.pathname}`;
  const base = `${method.toUpperCase()}&${encode(baseUrl)}&${encode(paramString)}`;
  const signer = createSign("RSA-SHA256");
  signer.update(base);
  signer.end();
  oauth.oauth_signature = signer.sign(key).toString("base64");
  const header = Object.keys(oauth)
    .sort()
    .map((k) => `${encode(k)}="${encode(oauth[k])}"`)
    .join(", ");
  return `OAuth ${header}`;
}

function asDraft(input: unknown): PayoutDraft {
  const row = input as Partial<PayoutDraft>;
  const draft: PayoutDraft = {
    usd: Number(row.usd),
    reference: String(row.reference ?? ""),
    first: String(row.first ?? ""),
    last: String(row.last ?? ""),
    pan: String(row.pan ?? ""),
    exp: String(row.exp ?? ""),
    line1: String(row.line1 ?? ""),
    city: String(row.city ?? ""),
    state: String(row.state ?? ""),
    postal: String(row.postal ?? ""),
    country: String(row.country ?? "USA"),
  };
  const bad = checkDraft(draft);
  if (bad) throw new Error(bad);
  return draft;
}

function describe(json: unknown): { id: string; status: string; detail: string } {
  const row = json as {
    disbursement?: { id?: string; status?: string };
    Errors?: { Error?: Array<{ Description?: string; ReasonCode?: string }> };
  };
  const err = row.Errors?.Error?.[0];
  return {
    id: row.disbursement?.id ?? "",
    status: row.disbursement?.status ?? (err ? "DECLINED" : ""),
    detail: err?.Description || err?.ReasonCode || "",
  };
}

export const pushPayout = createServerFn({ method: "POST" })
  .validator((input: unknown) => asDraft(input))
  .handler(async ({ data }) => {
    try {
      const built = build(data);
      const auth = await oauthHeader("POST", built.url, built.body);
      const res = await fetch(built.url, {
        method: "POST",
        headers: {
          authorization: auth,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: built.body,
        signal: AbortSignal.timeout(20_000),
      });
      const text = await res.text();
      let json: unknown = null;
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        json = null;
      }
      const described = describe(json);
      if (!res.ok && !described.id) {
        throw new Error(described.detail || `Mastercard Send returned ${res.status}. Nothing was marked paid.`);
      }
      return {
        id: described.id,
        status: described.status || (res.status === 202 ? "UNKNOWN" : "APPROVED"),
        reference: data.reference,
        last4: data.pan.replace(/\D/g, "").slice(-4),
        detail: described.detail,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.startsWith("missing:")) {
        throw new Error(`Mastercard Send is not keyed (${msg.slice(8)}). Nothing was submitted and nothing was marked paid.`);
      }
      throw e instanceof Error ? e : new Error("The payout did not send.");
    }
  });

export const payoutStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const id = String((input as { id?: string }).id ?? "");
    if (!/^[A-Za-z0-9_-]{6,80}$/.test(id)) throw new Error("That disbursement id is not valid.");
    return { id };
  })
  .handler(async ({ data }) => {
    const partnerId = process.env.MASTERCARD_PARTNER_ID?.trim();
    if (!partnerId) throw new Error("Mastercard Send is not keyed. There is no status to read.");
    const base = (process.env.MASTERCARD_SEND_BASE?.trim() || "https://sandbox.api.move.mastercard.com/send/static").replace(/\/$/, "");
    const url = `${base}/v1/partners/${partnerId}/disbursements/${data.id}`;
    const auth = await oauthHeader("GET", url, "").catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : "";
      if (msg.startsWith("missing:")) throw new Error(`Mastercard Send is not keyed (${msg.slice(8)}).`);
      throw e;
    });
    const res = await fetch(url, {
      headers: { authorization: auth, accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await res.json().catch(() => null)) as unknown;
    const described = describe(json);
    if (!res.ok && !described.status) throw new Error(described.detail || `Mastercard Send returned ${res.status}.`);
    return { id: data.id, status: described.status, detail: described.detail };
  });
