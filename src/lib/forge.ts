/** A tool a person composed. Paying it is a USDC transfer the wallet signs. There is no new program. */

const KEY = "senda.forge.v1";

export type ForgeKind = "pay" | "cover" | "job";

export type ForgeTool = {
  id: string;
  kind: ForgeKind;
  name: string;
  tag: string;
  brief: string;
  usd: number;
  to: string;
  rail: "usdc-solana";
  at: number;
};

function read(): ForgeTool[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(KEY) || "[]") as ForgeTool[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function write(rows: ForgeTool[]) {
  window.localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 40)));
}

export function listForge(): ForgeTool[] {
  return read();
}

export function addForge(input: { kind: ForgeKind; name: string; brief: string; usd: number; to: string }): ForgeTool {
  const name = input.name.trim().slice(0, 48);
  const brief = input.brief.trim().slice(0, 180);
  const to = input.to.trim();
  if (!name) throw new Error("Name the tool.");
  if (!brief) throw new Error("Write what it does.");
  if (!(input.usd >= 1) || input.usd > 5000) throw new Error("The amount is between $1 and $5,000.");
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(to)) throw new Error("That is not a Solana address. USDC is paid there. The wallet signs.");
  const tag = input.kind === "pay" ? "Payment" : input.kind === "cover" ? "Cover" : "Job";
  const row: ForgeTool = {
    id: crypto.randomUUID(),
    kind: input.kind,
    name,
    tag,
    brief,
    usd: Math.round(input.usd * 100) / 100,
    to,
    rail: "usdc-solana",
    at: Date.now(),
  };
  write([row, ...read()]);
  return row;
}

export function dropForge(id: string) {
  write(read().filter((row) => row.id !== id));
}

export function shareText(row: ForgeTool): string {
  const what = row.kind === "cover" ? "Cover premium" : row.kind === "job" ? "Job" : "Payment";
  return `${row.name}\n${row.tag} · USDC on Solana · you sign\n${what}: $${row.usd.toFixed(2)}\n${row.brief}\n${row.to}`;
}
