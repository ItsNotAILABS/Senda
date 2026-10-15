/** Server calls to Mastercard Commercial Connect. The browser never sees the signing key. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function loadVcn() {
  return import("@/lib/mastercard-vcn.mjs");
}

async function config() {
  const { connectConfig } = await loadVcn();
  return connectConfig(process.env);
}

async function callMastercard(path: string, body: unknown): Promise<{ status: number; json: unknown }> {
  const cfg = await config();
  if (!cfg.ready) throw new Error("Commercial Connect is not connected.");
  const { oauthHeader } = await loadVcn();
  const url = `${cfg.base}${path}`;
  const payload = JSON.stringify(body);
  const authorization = oauthHeader({
    method: "POST",
    url,
    body: payload,
    consumerKey: cfg.consumerKey,
    privateKeyPem: cfg.privateKeyPem.replace(/\\n/g, "\n"),
  });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization,
    },
    body: payload,
  });
  const text = await res.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { error: text.slice(0, 180) };
  }
  return { status: res.status, json };
}

function mastercardError(json: unknown, status: number): string {
  if (!json || typeof json !== "object") return `Mastercard ${status}`;
  const row = json as { error_description?: string; Errors?: { Error?: Array<{ Description?: string }> }; message?: string };
  return row.error_description || row.Errors?.Error?.[0]?.Description || row.message || `Mastercard ${status}`;
}

export const mastercardStatus = createServerFn({ method: "GET" }).handler(async () => {
  const cfg = await config();
  return { ready: cfg.ready, missing: cfg.missing, sandbox: cfg.base.includes("sandbox") };
});

export const spinOneTimeCard = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ spendUsd: z.number().positive().max(5000), hours: z.number().int().min(1).max(168) }).parse(input))
  .handler(async ({ data }) => {
    const cfg = await config();
    if (!cfg.ready) return { error: "Commercial Connect is not connected. A number minted on this desk is not a Mastercard." };
    const { oneTimeBody, readVirtualCard } = await loadVcn();
    const body = oneTimeBody({ entityId: cfg.entityId, realCardId: cfg.realCardId, spendUsd: data.spendUsd, hours: data.hours });
    const res = await callMastercard("/accounts/virtual-cards", body);
    if (res.status !== 201 && res.status !== 200) return { error: mastercardError(res.json, res.status) };
    const card = readVirtualCard(res.json);
    if (!card.accountId) return { error: "Mastercard did not return a card." };
    return { card };
  });

export const payOneTimeCard = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        accountId: z.string().min(4).max(120),
        spendUsd: z.number().positive().max(5000),
        supplierId: z.string().max(80).optional(),
        email: z.string().email().optional(),
        debtorName: z.string().min(1).max(140),
        country: z.string().min(2).max(3),
        postalCode: z.string().min(2).max(16),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const cfg = await config();
    if (!cfg.ready) return { error: "Commercial Connect is not connected." };
    const { paymentOnAccount, readPayment } = await loadVcn();
    const today = new Date().toISOString().slice(0, 10);
    let body: ReturnType<typeof paymentOnAccount>;
    try {
      body = paymentOnAccount({
        accountId: data.accountId,
        supplierId: data.supplierId,
        email: data.email,
        amount: data.spendUsd,
        debtorName: data.debtorName,
        country: data.country,
        postalCode: data.postalCode,
        requestedExecutionDate: today,
        endToEndId: `senda${Date.now().toString(36)}`.slice(0, 35),
      });
    } catch (error) {
      return { error: error instanceof Error ? error.message : "That payment is not ready." };
    }
    const res = await callMastercard("/payment-initiations", body);
    if (res.status !== 201 && res.status !== 200) return { error: mastercardError(res.json, res.status) };
    const payment = readPayment(res.json);
    if (!payment.paymentId && !payment.status) return { error: "Mastercard did not accept the payment." };
    return { payment };
  });
