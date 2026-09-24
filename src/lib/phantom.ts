/** Phantom in this browser. The address is public. Keys never leave the extension. */

type Pub = { toString: () => string };

export type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: Pub;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey?: Pub }>;
  signAndSendTransaction?: (
    tx: unknown,
    opts?: { skipPreflight?: boolean },
  ) => Promise<{ signature: string | Uint8Array }>;
  signTransaction?: (tx: unknown) => Promise<{ serialize: () => Uint8Array }>;
};

export function phantomProvider(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { phantom?: { solana?: PhantomProvider }; solana?: PhantomProvider };
  const p = w.phantom?.solana ?? w.solana;
  if (!p?.connect) return null;
  return p;
}

export async function connectPhantom(): Promise<string> {
  const p = phantomProvider();
  if (!p) throw new Error("No Phantom in this browser. Install it, then open Senda in that window.");
  const res = await p.connect();
  const addr = res?.publicKey?.toString() || p.publicKey?.toString();
  if (!addr) throw new Error("Phantom returned no account.");
  return addr;
}

export async function sendVersioned(tx: { serialize: () => Uint8Array }): Promise<string> {
  const p = phantomProvider();
  if (!p) throw new Error("Phantom is not connected.");
  if (p.signAndSendTransaction) {
    const out = await p.signAndSendTransaction(tx);
    const sig = out.signature;
    if (typeof sig === "string") return sig;
    return bytesToBase58(sig);
  }
  if (!p.signTransaction) throw new Error("This Phantom cannot send a transaction.");
  const signed = await p.signTransaction(tx);
  const raw = signed.serialize();
  const body = await rpc("sendTransaction", [bytesToBase64(raw), { encoding: "base64", skipPreflight: false }]);
  if (typeof body !== "string") throw new Error("RPC did not return a signature.");
  return body;
}

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function bytesToBase58(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  const digits = [0];
  for (let i = zeros; i < bytes.length; i += 1) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j += 1) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "1".repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i -= 1) out += ALPHABET[digits[i]];
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

const RPCS = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  let last = "RPC failed";
  for (const url of RPCS) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const j = (await r.json()) as { result?: unknown; error?: { message?: string } };
      if (j.error) {
        last = j.error.message || last;
        continue;
      }
      return j.result;
    } catch (e) {
      last = e instanceof Error ? e.message : last;
    }
  }
  throw new Error(last);
}

export async function mintDecimals(mint: string): Promise<number> {
  const result = (await rpc("getAccountInfo", [mint, { encoding: "jsonParsed" }])) as {
    value?: { data?: { parsed?: { info?: { decimals?: number } } } };
  };
  const d = result?.value?.data?.parsed?.info?.decimals;
  return typeof d === "number" ? d : 9;
}

export async function splHolding(owner: string, mint: string): Promise<{ ui: number; raw: string; decimals: number }> {
  const result = (await rpc("getTokenAccountsByOwner", [
    owner,
    { mint },
    { encoding: "jsonParsed" },
  ])) as {
    value?: Array<{
      account?: { data?: { parsed?: { info?: { tokenAmount?: { uiAmount?: number | null; amount?: string; decimals?: number } } } } };
    }>;
  };
  const rows = result?.value ?? [];
  let ui = 0;
  let raw = 0n;
  let decimals = 9;
  for (const row of rows) {
    const t = row.account?.data?.parsed?.info?.tokenAmount;
    ui += t?.uiAmount || 0;
    if (t?.amount) raw += BigInt(t.amount);
    if (typeof t?.decimals === "number") decimals = t.decimals;
  }
  return { ui, raw: raw.toString(), decimals };
}
