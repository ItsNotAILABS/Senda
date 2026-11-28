/** Senda's own signed inference. Not Nito, and not a hardware enclave. */

import { createServerFn } from "@tanstack/react-start";
import nacl from "tweetnacl";
import { z } from "zod";

const MODEL = "grok-4.5";
const REFUSAL = "Senda did not infer an answer. No model output is attached.";
const HARDWARE_NOTE =
  "This host is not an Intel TDX or AMD SEV-SNP enclave. No hardware quote was produced, and no Solana attestation account was written for this key.";

export type SealHardware = {
  attested: false;
  chip: null;
  record: null;
  note: string;
};

export type Seal = {
  text: string;
  inferred: boolean;
  model: "grok-4.5" | "none";
  issuedAt: string;
  nonce: string;
  pubkey: string;
  signature: string;
  hardware: SealHardware;
  fault?: string;
};

const Ask = z.object({
  prompt: z.string().trim().min(1).max(400),
});

let pair: nacl.SignKeyPair | null = null;
const hits: number[] = [];

function signingKey(): nacl.SignKeyPair {
  if (!pair) pair = nacl.sign.keyPair();
  return pair;
}

function b64(bytes: Uint8Array): string {
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw);
}

export function unb64(value: string): Uint8Array {
  const raw = atob(value);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Exact bytes the signature covers. Change the prefix and every old seal fails closed. */
export function sealBytes(seal: Pick<Seal, "model" | "issuedAt" | "nonce" | "text">): Uint8Array {
  return new TextEncoder().encode(["SENDA-SEAL-v1", seal.model, seal.issuedAt, seal.nonce, seal.text].join("\n"));
}

export function verifySeal(seal: Pick<Seal, "model" | "issuedAt" | "nonce" | "text" | "pubkey" | "signature">): boolean {
  try {
    const sig = unb64(seal.signature);
    const pub = unb64(seal.pubkey);
    if (sig.length !== nacl.sign.signatureLength || pub.length !== nacl.sign.publicKeyLength) return false;
    return nacl.sign.detached.verify(sealBytes(seal), sig, pub);
  } catch {
    return false;
  }
}

function hardware(): SealHardware {
  return { attested: false, chip: null, record: null, note: HARDWARE_NOTE };
}

function allow(): boolean {
  const now = Date.now();
  while (hits.length && now - hits[0]! > 60_000) hits.shift();
  if (hits.length >= 8) return false;
  hits.push(now);
  return true;
}

function issue(text: string, inferred: boolean, model: Seal["model"], fault?: string): Seal {
  const key = signingKey();
  const seal: Omit<Seal, "signature"> = {
    text,
    inferred,
    model,
    issuedAt: new Date().toISOString(),
    nonce: b64(nacl.randomBytes(16)),
    pubkey: b64(key.publicKey),
    hardware: hardware(),
    ...(fault ? { fault } : {}),
  };
  const signature = b64(nacl.sign.detached(sealBytes(seal), key.secretKey));
  return { ...seal, signature };
}

export const sealCard = createServerFn({ method: "GET" }).handler(async () => {
  const key = signingKey();
  return { pubkey: b64(key.publicKey), hardware: hardware() };
});

export const askSeal = createServerFn({ method: "POST" })
  .validator((input: unknown) => Ask.parse(input))
  .handler(async ({ data }): Promise<Seal> => {
    if (!allow()) return issue(REFUSAL, false, "none", "Too many asks this minute.");
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return issue(REFUSAL, false, "none", "The model key is not on this host.");

    let res: Response;
    try {
      res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(20_000),
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 220,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "You are Senda's private desk. Answer in plain sentences, under 90 words. You do not place trades, move funds, or claim a hardware attestation. If asked what the signature proves, say it proves these exact words were signed by Senda's process key, and that this host is not a TEE so the operator and the model provider can still read the prompt. Desk encryption is Senda's own passport on the phone, not Solana Confidential Compute and not Nito. Never invent a Solana program id, a fill, or a quote.",
            },
            { role: "user", content: data.prompt },
          ],
        }),
      });
    } catch {
      return issue(REFUSAL, false, "none", "The model did not answer in time.");
    }
    if (!res.ok) return issue(REFUSAL, false, "none", `The model returned ${res.status}.`);
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = (body.choices?.[0]?.message?.content ?? "").trim().slice(0, 1200);
    if (!text) return issue(REFUSAL, false, "none", "The model returned an empty answer.");
    return issue(text, true, MODEL);
  });
