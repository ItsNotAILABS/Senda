/** Fixed Solana CLI calls. No free-form shell. Devnet only. The house key never leaves the server. */

import { execFile } from "node:child_process";
import { PublicKey } from "@solana/web3.js";
import { coverCheck, explainPayment } from "./payment-error.ts";

const URL = "https://api.devnet.solana.com";
const PROGRAM = "DeJVhSszpHrwHonu78hnYxrQxcr6ZEuYgwZmzYQYXpwy";
const TREASURY = "D7ZbAbJUkDEU4tfqcWQNGSHBXXrdfZKmrvgovvSQEvJb";
const HOUSE = "FMn74h5jZMPXoKYYWSTxHiD5j6PeAVsAc6ftkxg6apvA";

export function sendAllowed(sol: number): boolean {
  return Number.isFinite(sol) && sol >= 0.01 && sol <= 0.25;
}

function pubkey(value: string): string {
  return new PublicKey(value).toBase58();
}

async function cliBin(): Promise<string> {
  const { access } = await import("node:fs/promises");
  const candidates = [
    process.env.SOLANA_CLI,
    "/root/.local/share/solana/install/active_release/bin/solana",
  ].filter((item): item is string => Boolean(item));
  for (const path of candidates) {
    try {
      await access(path);
      return path;
    } catch {
      /* next */
    }
  }
  throw new Error("The Solana CLI is not installed on this server. Nothing was sent.");
}

async function houseKey(): Promise<string> {
  const path = "/tmp/senda-keys/coffer-devnet.json";
  const { access, mkdir, readFile, writeFile } = await import("node:fs/promises");
  try {
    await access(path);
    return path;
  } catch {
    /* write it from the key file */
  }
  const text = await readFile("/workspace/artifacts/senda-treasury-keys.txt", "utf8");
  const row = text.match(/COFFER WALLET KEYPAIR\n(\[[0-9,]+\])/);
  if (!row) throw new Error("The house key is not on this machine. Nothing was sent.");
  await mkdir("/tmp/senda-keys", { recursive: true });
  await writeFile(path, row[1], { mode: 0o600 });
  return path;
}

function run(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: 60_000 }, (error, stdout, stderr) => {
      if (error) reject(new Error((stderr || error.message).trim().slice(0, 360)));
      else resolve(stdout);
    });
  });
}

export async function cliBalance(address: string): Promise<number> {
  const bin = await cliBin();
  const out = await run(bin, ["balance", pubkey(address), "--url", URL, "--output", "json"]);
  const row = JSON.parse(out) as { lamports?: number };
  return (row.lamports ?? 0) / 1_000_000_000;
}

export type CliDesk = {
  house: string;
  houseSol: number;
  programId: string;
  authority: string;
  treasury: string;
  spendOpen: boolean;
  magic: string;
};

export async function cliDesk(): Promise<CliDesk> {
  const bin = await cliBin();
  const key = await houseKey();
  const [balanceOut, programOut, accountOut] = await Promise.all([
    run(bin, ["balance", HOUSE, "--url", URL, "--output", "json"]),
    run(bin, ["program", "show", PROGRAM, "--url", URL, "--keypair", key, "--output", "json"]),
    run(bin, ["account", TREASURY, "--url", URL, "--output", "json"]),
  ]);
  const balance = JSON.parse(balanceOut) as { lamports?: number };
  const program = JSON.parse(programOut) as { programId?: string; authority?: string };
  const account = JSON.parse(accountOut) as { account?: { data?: [string, string] } };
  const raw = Buffer.from(account.account?.data?.[0] || "", "base64");
  return {
    house: HOUSE,
    houseSol: (balance.lamports ?? 0) / 1_000_000_000,
    programId: program.programId || PROGRAM,
    authority: program.authority || "",
    treasury: TREASURY,
    spendOpen: raw[10] === 1,
    magic: raw.subarray(0, 8).toString() || "",
  };
}

/** The house wallet pays an agent address. Phantom is not asked. Mainnet is not asked. */
export async function cliSend(to: string, sol: number): Promise<{ signature: string; houseSol: number; toSol: number }> {
  const key = await houseKey();
  const row = await cliSendFrom(key, to, sol);
  return { signature: row.signature, houseSol: row.fromSol, toSol: row.toSol };
}

/** An agent wallet pays another address. The key file is the agent's, not Phantom. */
export async function cliSendFrom(keyFile: string, to: string, sol: number): Promise<{ signature: string; from: string; fromSol: number; toSol: number }> {
  if (!sendAllowed(sol)) throw new Error("A send is 0.01 to 0.25 SOL on devnet. Nothing was sent.");
  let dest: string;
  try {
    dest = pubkey(to);
  } catch {
    throw new Error("That is not a Solana address. Nothing was sent.");
  }
  const bin = await cliBin();
  const from = pubkey((await run(bin, ["address", "--keypair", keyFile])).trim());
  if (from === dest) throw new Error("The sender and the receiver are the same account. Nothing was sent.");
  const have = await cliBalance(from);
  const covered = coverCheck(Math.round(have * 1_000_000_000), sol);
  if (!covered.ok) throw new Error(covered.why);
  let signature = "";
  try {
    const out = await run(bin, [
      "transfer",
      dest,
      sol.toFixed(9).replace(/0+$/, "").replace(/\.$/, ""),
      "--from",
      keyFile,
      "--keypair",
      keyFile,
      "--url",
      URL,
      "--allow-unfunded-recipient",
      "--output",
      "json",
    ]);
    const row = JSON.parse(out) as { signature?: string };
    if (!row.signature) throw new Error("The CLI did not return a signature. Nothing was confirmed.");
    signature = row.signature;
    await run(bin, ["confirm", row.signature, "--url", URL]);
  } catch (error) {
    if (signature) throw new Error(`Submitted ${signature}. It was not confirmed. Do not send it again.`);
    throw new Error(explainPayment(error));
  }
  const [fromSol, toSol] = await Promise.all([cliBalance(from), cliBalance(dest)]);
  return { signature, from, fromSol, toSol };
}

export async function cliRent(bytes: number): Promise<{ lamports: number; sol: number }> {
  if (!Number.isInteger(bytes) || bytes < 0 || bytes > 10_000_000) throw new Error("Rent needs a byte length. Nothing was asked.");
  const bin = await cliBin();
  const out = await run(bin, ["rent", String(bytes), "--url", URL, "--output", "json"]);
  const row = JSON.parse(out) as { rentExemptMinimumLamports?: number };
  const lamports = row.rentExemptMinimumLamports ?? 0;
  return { lamports, sol: lamports / 1_000_000_000 };
}

export async function cliProgramAddress(): Promise<{ programId: string; keyFile: string }> {
  const bin = await cliBin();
  const keygen = bin.replace(/solana$/, "solana-keygen");
  const keyFile = `/tmp/senda-keys/launch-${Date.now()}.json`;
  await run(keygen, ["new", "--no-bip39-passphrase", "--force", "-s", "-o", keyFile]);
  const programId = pubkey((await run(bin, ["address", "--keypair", keyFile])).trim());
  return { programId, keyFile };
}

export async function cliDeploy(keyFile: string): Promise<{ programId: string }> {
  if (!/^\/tmp\/senda-keys\/launch-\d+\.json$/.test(keyFile)) throw new Error("That is not a launch program key. Nothing was deployed.");
  const bin = await cliBin();
  const payer = await houseKey();
  const out = await run(bin, [
    "program",
    "deploy",
    "/workspace/chain/treasury/target/deploy/senda_treasury.so",
    "--url",
    URL,
    "--program-id",
    keyFile,
    "--keypair",
    payer,
    "--upgrade-authority",
    payer,
    "--output",
    "json",
  ]);
  const row = JSON.parse(out) as { programId?: string };
  if (!row.programId) throw new Error("The CLI did not deploy a program.");
  return { programId: row.programId };
}
