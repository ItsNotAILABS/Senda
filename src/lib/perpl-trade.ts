/** Open a Perpl account and send an order. Phantom signs the chain calls and the trade key. */

import { ed25519 } from "@noble/curves/ed25519";
import { sha256 } from "@noble/hashes/sha2.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { perplRelay } from "@/lib/perpl-book";

const CHAIN = 143;
const EXCHANGE = "0x34B6552d57a35a1D042CcAe1951BD1C370112a6F";
const AUSD = "0x00000000efe302beaa2b3e6e1b18d08d69a9012a";
const OPEN = 10_000_000n;

type Eth = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
type Field = { name: string; type: string };
type Types = Record<string, Field[]>;
type Typed = { types: Types; domain: Record<string, unknown>; primaryType: string; message: Record<string, unknown> };
type Saved = { priv: string; apiKey: string };

function ethereum(): Eth {
  const eth = (window as unknown as { phantom?: { ethereum?: Eth } }).phantom?.ethereum;
  if (!eth) throw new Error("Open this in Phantom. Monad uses the Ethereum account in that app.");
  return eth;
}

function hexOf(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bytesOf(hex: string): Uint8Array {
  const h = hex.replace(/^0x/, "");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function word(n: bigint): string {
  return n.toString(16).padStart(64, "0");
}

function sel(sig: string): string {
  return hexOf(keccak_256(new TextEncoder().encode(sig))).slice(0, 8);
}

function pad32(bytes: Uint8Array): Uint8Array {
  if (bytes.length === 32) return bytes;
  const out = new Uint8Array(32);
  out.set(bytes, 32 - bytes.length);
  return out;
}

function encodeType(types: Types, primary: string): string {
  const seen = new Set<string>();
  const walk = (name: string) => {
    if (seen.has(name) || !types[name]) return;
    seen.add(name);
    for (const field of types[name]) {
      const base = field.type.replace(/\[\]$/, "");
      if (types[base]) walk(base);
    }
  };
  walk(primary);
  seen.delete(primary);
  const names = [primary, ...[...seen].filter((n) => n !== "EIP712Domain").sort()];
  return names.map((name) => `${name}(${types[name].map((f) => `${f.type} ${f.name}`).join(",")})`).join("");
}

function hashStruct(types: Types, primary: string, data: Record<string, unknown>): Uint8Array {
  const chunks: Uint8Array[] = [keccak_256(new TextEncoder().encode(encodeType(types, primary)))];
  for (const field of types[primary]) chunks.push(encodeField(types, field.type, data[field.name]));
  const joined = new Uint8Array(chunks.length * 32);
  chunks.forEach((chunk, i) => joined.set(chunk, i * 32));
  return keccak_256(joined);
}

function encodeField(types: Types, type: string, value: unknown): Uint8Array {
  if (type === "string") return pad32(keccak_256(new TextEncoder().encode(String(value ?? ""))));
  if (type === "bytes") return pad32(keccak_256(bytesOf(String(value ?? "0x"))));
  if (type === "bool") return pad32(bytesOf(value ? "01" : "00"));
  if (type === "address") return pad32(bytesOf(String(value)));
  if (type.startsWith("uint") || type.startsWith("int")) {
    const n = BigInt(typeof value === "bigint" ? value : String(value ?? 0));
    const raw = n < 0n ? (1n << 256n) + n : n;
    return pad32(bytesOf(raw.toString(16)));
  }
  if (type.endsWith("]")) {
    const inner = type.slice(0, -2);
    const rows = (value as unknown[]).map((item) => encodeField(types, inner, item));
    const joined = new Uint8Array(rows.length * 32);
    rows.forEach((row, i) => joined.set(row, i * 32));
    return pad32(keccak_256(joined));
  }
  if (types[type]) return hashStruct(types, type, value as Record<string, unknown>);
  throw new Error(`Cannot sign a ${type} field.`);
}

function digestOf(typed: Typed): Uint8Array {
  const types = { ...typed.types };
  const domainFields = types.EIP712Domain;
  delete types.EIP712Domain;
  const domain = hashStruct({ EIP712Domain: domainFields }, "EIP712Domain", typed.domain);
  const message = hashStruct(types, typed.primaryType, typed.message);
  const packed = new Uint8Array(66);
  packed[0] = 0x19;
  packed[1] = 0x01;
  packed.set(domain, 2);
  packed.set(message, 34);
  return keccak_256(packed);
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function onMonad(eth: Eth): Promise<string> {
  const params = [{
    chainId: "0x8f",
    chainName: "Monad",
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    rpcUrls: ["https://rpc.monad.xyz"],
    blockExplorerUrls: ["https://monadscan.com"],
  }];
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x8f" }] });
  } catch {
    await eth.request({ method: "wallet_addEthereumChain", params });
  }
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts?.[0]) throw new Error("Phantom did not return an address.");
  return accounts[0];
}

async function send(eth: Eth, from: string, to: string, data: string): Promise<string> {
  const hash = await eth.request({ method: "eth_sendTransaction", params: [{ from, to, data, value: "0x0" }] });
  return String(hash);
}

async function signed(method: "GET" | "POST", target: string, body: string, key: Saved): Promise<{ status: number; json: unknown }> {
  const timestamp = Date.now().toString();
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const bodyHash = hexOf(sha256(new TextEncoder().encode(body)));
  const canonical = [CHAIN, method, target, timestamp, nonce, bodyHash].join("\n");
  const signature = b64url(ed25519.sign(new TextEncoder().encode(canonical), bytesOf(key.priv)));
  const sent = await perplRelay({
    data: {
      method,
      target,
      body,
      headers: {
        "X-API-Key": key.apiKey,
        "X-API-Timestamp": timestamp,
        "X-API-Nonce": nonce,
        "X-API-Signature": signature,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
    },
  });
  let json: unknown = null;
  try {
    json = JSON.parse(sent.text);
  } catch {
    json = { error: sent.text.slice(0, 240) };
  }
  return { status: sent.status, json };
}

async function enroll(eth: Eth, address: string): Promise<Saved> {
  const priv = ed25519.utils.randomPrivateKey();
  const pub = ed25519.getPublicKey(priv);
  const asked = await perplRelay({
    data: {
      method: "POST",
      target: "/v1/api-key/payload",
      body: JSON.stringify({
        chain_id: CHAIN,
        address,
        public_key: `0x${hexOf(pub)}`,
        scope_mask: 3,
        label: "Senda",
      }),
      headers: { "Content-Type": "application/json" },
    },
  });
  const payload = JSON.parse(asked.text) as { typed_data?: Typed; mac?: string; error?: string };
  if (!payload.typed_data || !payload.mac) throw new Error(payload.error || asked.text.slice(0, 240) || "Perpl did not return a signature request.");
  const signature = (await eth.request({
    method: "eth_signTypedData_v4",
    params: [address, JSON.stringify(payload.typed_data)],
  })) as string;
  const pop = ed25519.sign(digestOf(payload.typed_data), priv);
  const enrolled = await perplRelay({
    data: {
      method: "POST",
      target: "/v1/api-key/enroll",
      body: JSON.stringify({
        chain_id: CHAIN,
        address,
        typed_data: payload.typed_data,
        mac: payload.mac,
        signature,
        pop_signature: `0x${hexOf(pop)}`,
      }),
      headers: { "Content-Type": "application/json" },
    },
  });
  const body = JSON.parse(enrolled.text) as { api_key?: { api_key?: string }; error?: string };
  const apiKey = body.api_key?.api_key;
  if (!apiKey) throw new Error(body.error || enrolled.text.slice(0, 240) || "Perpl did not enroll the trade key.");
  const saved = { priv: hexOf(priv), apiKey };
  localStorage.setItem(`senda.perpl.v1.${address.toLowerCase()}`, JSON.stringify(saved));
  return saved;
}

type Account = { id?: number; fw?: boolean; lfr?: number };

async function walletOf(key: Saved): Promise<Account[]> {
  const read = await signed("GET", "/v1/trading/wallet", "", key);
  const body = read.json as { as?: Account[]; error?: string };
  if (read.status >= 400) throw new Error(body.error || "Perpl did not return the account.");
  return body.as ?? [];
}

export async function perplTrade(input: {
  side: "long" | "short";
  marketId: number;
  margin: number;
  leverage: number;
  price: number;
  sizeDecimals: number;
}): Promise<{ address: string; ref: string }> {
  if (!(input.margin >= 10)) throw new Error("Perpl opens an account with at least 10 AUSD.");
  if (!(input.price > 0)) throw new Error("This market has no mark.");
  const eth = ethereum();
  const address = await onMonad(eth);
  const stored = localStorage.getItem(`senda.perpl.v1.${address.toLowerCase()}`);
  const key = stored ? (JSON.parse(stored) as Saved) : await enroll(eth, address);
  let accounts = await walletOf(key).catch(() => [] as Account[]);
  let account = accounts[0];
  if (!account) {
    const amount = word(OPEN);
    const approve = `0x${sel("approve(address,uint256)")}${word(BigInt(EXCHANGE))}${amount}`;
    await send(eth, address, AUSD, approve);
    const open = `0x${sel("createAccount(uint256)")}${amount}`;
    const opened = await send(eth, address, EXCHANGE, open);
    accounts = await walletOf(key).catch(() => []);
    account = accounts[0];
    if (!account?.id) throw new Error(`The account transaction was sent (${opened.slice(0, 10)}). Wait for it to land, then press the button again.`);
  }
  if (!account.fw) {
    const allow = `0x${sel("allowOrderForwarding(bool)")}${word(1n)}`;
    const hash = await send(eth, address, EXCHANGE, allow);
    accounts = await walletOf(key).catch(() => accounts);
    account = accounts[0] ?? account;
    if (!account.fw) throw new Error(`Forwarding was signed (${hash.slice(0, 10)}). Wait for it to land, then press the button again.`);
  }
  const base = (input.margin * input.leverage) / input.price;
  const size = Math.round(base * 10 ** input.sizeDecimals);
  if (!(size > 0)) throw new Error("That margin is smaller than one unit of this market.");
  const order = {
    rq: Math.max(Date.now(), (account.lfr ?? 0) + 1),
    mkt: input.marketId,
    acc: account.id,
    t: input.side === "long" ? 1 : 2,
    p: 0,
    s: size,
    fl: 4,
    lv: Math.round(input.leverage * 100),
    lb: 0,
  };
  const body = JSON.stringify({ d: [order] });
  const sent = await signed("POST", "/v1/trading/orders", body, key);
  const reply = sent.json as { status?: { code?: number; error?: string }; statuses?: Array<{ code?: number; error?: string }>; error?: string };
  const row = reply.statuses?.[0];
  if (sent.status >= 400 || (row && row.code !== 0) || (reply.status?.code && !row)) {
    throw new Error(row?.error || reply.status?.error || reply.error || "Perpl did not take the order.");
  }
  return { address, ref: String(order.rq) };
}
