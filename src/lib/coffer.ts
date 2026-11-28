/** Coffer wallets for agents. The secret stays at Coffer. This file never exports a key. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BASE = "https://coffer.pocketnova.app/v1";

export type CofferWallet = {
  id: string;
  address: string;
  network: "devnet" | "mainnet-beta";
  type: string;
  label: string;
  created: boolean;
};

const Ask = z.object({
  label: z.string().min(2).max(48),
  network: z.enum(["devnet", "mainnet-beta"]),
  type: z.enum(["agent", "operational", "burner"]),
});

type Listed = { id?: string; type?: string; network?: string; label?: string; address?: string };

export function matchWallet(wallets: Listed[], want: { type: string; network: string; label: string }): Listed | null {
  return wallets.find((row) => row.id && row.address && row.type === want.type && row.network === want.network && row.label === want.label) ?? null;
}

async function apiKey(): Promise<string> {
  const env = (process.env.COFFER_API_KEY || "").trim();
  if (env) return env;
  try {
    const { readFile } = await import("node:fs/promises");
    const text = await readFile("/workspace/artifacts/senda-treasury-keys.txt", "utf8");
    return text.match(/COFFER API KEY\n(\S+)/)?.[1] ?? "";
  } catch {
    return "";
  }
}

async function coffer(path: string, token: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!res.ok) throw new Error(body.error || body.message || "Coffer refused.");
  return body;
}

export const cofferWallet = createServerFn({ method: "POST" })
  .validator((input: unknown) => Ask.parse(input))
  .handler(async ({ data }): Promise<CofferWallet> => {
    const token = await apiKey();
    if (!token) throw new Error("COFFER_API_KEY is not set. The agent has no wallet.");
    const listed = (await coffer("/wallets", token)) as { wallets?: Listed[] };
    const found = matchWallet(listed.wallets ?? [], data);
    if (found?.id && found.address) {
      return { id: found.id, address: found.address, network: data.network, type: data.type, label: data.label, created: false };
    }
    const body = data.type === "agent"
      ? { type: "agent", label: data.label, network: data.network, agent_identity: data.label }
      : { type: data.type, label: data.label, network: data.network };
    const made = (await coffer("/wallets", token, { method: "POST", body: JSON.stringify(body) })) as Listed;
    if (!made.id || !made.address) throw new Error("Coffer did not return an address.");
    return { id: made.id, address: made.address, network: data.network, type: data.type, label: data.label, created: true };
  });
