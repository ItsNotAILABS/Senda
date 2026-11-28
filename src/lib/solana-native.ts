import { createServerFn } from "@tanstack/react-start";
import { Keypair } from "@solana/web3.js";
import { z } from "zod";
import { cliBalance, cliDeploy, cliDesk, cliProgramAddress, cliRent, cliSend, cliSendFrom } from "@/lib/solana-cli";
import { explainPayment } from "@/lib/payment-error";

export const nativeDesk = createServerFn({ method: "GET" }).handler(async () => cliDesk());

export const nativeBalance = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ address: z.string().min(32).max(48) }).parse(input))
  .handler(async ({ data }) => ({ sol: await cliBalance(data.address) }));

export const houseSend = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ to: z.string().min(32).max(48), sol: z.number() }).parse(input))
  .handler(async ({ data }) => {
    try {
      return await cliSend(data.to, data.sol);
    } catch (error) {
      throw new Error(explainPayment(error));
    }
  });

async function cofferKey(): Promise<string> {
  const env = (process.env.COFFER_API_KEY || "").trim();
  if (env) return env;
  const { readFile } = await import("node:fs/promises");
  const text = await readFile("/workspace/artifacts/senda-treasury-keys.txt", "utf8");
  return text.match(/COFFER API KEY\n(\S+)/)?.[1] ?? "";
}

/** The agent wallet spends its own SOL. The secret is not returned. */
export const agentTransfer = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({
    fromId: z.string().regex(/^wal_[a-z0-9]+$/),
    to: z.string().min(32).max(48),
    sol: z.number(),
  }).parse(input))
  .handler(async ({ data }) => {
    const token = await cofferKey();
    if (!token) throw new Error("COFFER_API_KEY is not set. The agent did not spend.");
    const res = await fetch(`https://coffer.pocketnova.app/v1/wallets/${data.fromId}/export`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ confirm: "EXPORT" }),
    });
    const body = (await res.json()) as { secret_key?: { keypair_json?: number[] }; address?: string; error?: string };
    if (!res.ok || !body.secret_key?.keypair_json || !body.address) throw new Error(body.error || "Coffer did not open the agent key. Nothing was sent.");
    const secret = Uint8Array.from(body.secret_key.keypair_json);
    const owner = Keypair.fromSecretKey(secret).publicKey.toBase58();
    if (owner !== body.address) throw new Error("The exported key did not match the wallet. Nothing was sent.");
    const { writeFile, unlink, mkdir } = await import("node:fs/promises");
    const file = `/tmp/senda-keys/spend-${data.fromId}.json`;
    await mkdir("/tmp/senda-keys", { recursive: true });
    await writeFile(file, JSON.stringify(body.secret_key.keypair_json), { mode: 0o600 });
    try {
      const sent = await cliSendFrom(file, data.to, data.sol);
      return { signature: sent.signature, from: sent.from, fromSol: sent.fromSol, toSol: sent.toSol };
    } catch (error) {
      throw new Error(explainPayment(error));
    } finally {
      await unlink(file).catch(() => undefined);
    }
  });

export const launchRent = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ bytes: z.number().int().min(0).max(10_000_000) }).parse(input))
  .handler(async ({ data }) => cliRent(data.bytes));

export const launchProgram = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ deploy: z.boolean().optional(), keyFile: z.string().optional() }).parse(input))
  .handler(async ({ data }) => {
    if (data.deploy && data.keyFile) return cliDeploy(data.keyFile);
    return cliProgramAddress();
  });
