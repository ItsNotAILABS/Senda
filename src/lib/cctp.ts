/** Circle CCTP v2. Phantom's Ethereum provider mints on Ethereum and Base. Arbitrum is an export. */

const MESSENGER = "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d";
const TRANSMITTER = "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64";
const RECEIVE = "0x57ecfd28";
const BURN = "0x8e0250ee";
const APPROVE = "0x095ea7b3";
const IRIS = "https://iris-api.circle.com/v2/messages";

export type CctpId = "ethereum" | "base" | "arbitrum" | "solana";

export type CctpDomain = {
  id: CctpId;
  name: string;
  domain: number;
  chainId: string;
  usdc: string;
  /** Phantom will switch to this chain and send receiveMessage. */
  mintInApp: boolean;
  why: string;
};

export const CCTP_DOMAINS: CctpDomain[] = [
  {
    id: "ethereum",
    name: "Ethereum",
    domain: 0,
    chainId: "0x1",
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    mintInApp: true,
    why: "Phantom's Ethereum account signs the mint.",
  },
  {
    id: "base",
    name: "Base",
    domain: 6,
    chainId: "0x2105",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    mintInApp: true,
    why: "Phantom's Ethereum account signs the mint.",
  },
  {
    id: "arbitrum",
    name: "Arbitrum",
    domain: 3,
    chainId: "0xa4b1",
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    mintInApp: false,
    why: "Phantom's network list does not include Arbitrum, so this lane exports the payload. There is no mint button.",
  },
  {
    id: "solana",
    name: "Solana",
    domain: 5,
    chainId: "",
    usdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    mintInApp: false,
    why: "A Solana mint goes through TokenMessengerMinter, not this Ethereum call. USDC on Solana still moves from Send.",
  },
];

export function cctpDomain(id: CctpId): CctpDomain {
  const row = CCTP_DOMAINS.find((d) => d.id === id);
  if (!row) throw new Error("Unknown CCTP domain.");
  return row;
}

type Eth = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

function phantomEth(): Eth {
  const w = window as unknown as {
    phantom?: { ethereum?: Eth };
    ethereum?: Eth & { isMetaMask?: boolean; providers?: Array<Eth & { isMetaMask?: boolean }> };
  };
  if (w.phantom?.ethereum) return w.phantom.ethereum;
  const mask = w.ethereum?.providers?.find((p) => p.isMetaMask);
  if (mask) return mask;
  if (w.ethereum) return w.ethereum;
  throw new Error("Open this page in Phantom. The Ethereum account signs the mint.");
}

function word(n: bigint): string {
  if (n < 0n) throw new Error("Bad amount.");
  return n.toString(16).padStart(64, "0");
}

function addrWord(a: string): string {
  const h = a.toLowerCase().replace(/^0x/, "");
  if (!/^[\da-f]{40}$/.test(h)) throw new Error("That is not an Ethereum address.");
  return h.padStart(64, "0");
}

function hexBytes(hex: string): Uint8Array {
  const h = hex.trim().toLowerCase().replace(/^0x/, "");
  if (!h || h.length % 2 || !/^[\da-f]+$/.test(h)) throw new Error("The message is not hex.");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesHex(b: Uint8Array): string {
  return Array.from(b, (n) => n.toString(16).padStart(2, "0")).join("");
}

function pad(n: number): number {
  return Math.ceil(n / 32) * 32;
}

export function encodeReceive(message: string, attestation: string): string {
  const msg = hexBytes(message);
  const att = hexBytes(attestation);
  const msgOff = 64n;
  const attOff = 64n + 32n + BigInt(pad(msg.length));
  const msgPad = "00".repeat(pad(msg.length) - msg.length);
  const attPad = "00".repeat(pad(att.length) - att.length);
  return `${RECEIVE}${word(msgOff)}${word(attOff)}${word(BigInt(msg.length))}${bytesHex(msg)}${msgPad}${word(BigInt(att.length))}${bytesHex(att)}${attPad}`;
}

export function encodeBurn(amount: bigint, destinationDomain: number, mintRecipient: string, burnToken: string): string {
  return `${BURN}${word(amount)}${word(BigInt(destinationDomain))}${addrWord(mintRecipient)}${addrWord(burnToken)}${word(0n)}${word(0n)}${word(2000n)}`;
}

function encodeApprove(spender: string, amount: bigint): string {
  return `${APPROVE}${addrWord(spender)}${word(amount)}`;
}

async function onChain(eth: Eth, domain: CctpDomain) {
  if (domain.id === "ethereum") {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: domain.chainId }] });
    return;
  }
  if (domain.id !== "base") throw new Error(domain.why);
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: domain.chainId }] });
  } catch (e) {
    const code = (e as { code?: number }).code;
    if (code !== 4902) throw e;
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: domain.chainId,
          chainName: "Base",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://mainnet.base.org"],
          blockExplorerUrls: ["https://basescan.org"],
        },
      ],
    });
  }
}

async function send(eth: Eth, from: string, to: string, data: string): Promise<string> {
  const hash = (await eth.request({
    method: "eth_sendTransaction",
    params: [{ from, to, data, value: "0x0" }],
  })) as string;
  for (let i = 0; i < 20; i++) {
    const rec = (await eth.request({ method: "eth_getTransactionReceipt", params: [hash] })) as { status?: string } | null;
    if (rec) {
      if (rec.status === "0x0") throw new Error("The chain rejected the transaction.");
      return hash;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return hash;
}

export type CctpCall = { to: string; data: string; note: string };

export type CctpResult =
  | { kind: "sent"; hash: string }
  | { kind: "export"; why: string; chainId: string; calls: CctpCall[] };

function units(usd: number): bigint {
  if (!(usd > 0) || usd > 1_000_000) throw new Error("Amount has to be between $0 and $1,000,000.");
  return BigInt(Math.round(usd * 1e6));
}

/** Burn USDC on Ethereum or Base. Arbitrum returns the calldata and does not send. */
export async function burnUsdc(input: {
  source: "ethereum" | "base" | "arbitrum";
  destination: CctpId;
  recipient: string;
  usd: number;
}): Promise<CctpResult> {
  const source = cctpDomain(input.source);
  const dest = cctpDomain(input.destination);
  if (dest.id === "solana") throw new Error("A Solana recipient is not this 0x field. Burn on Solana from Send, then mint onto Ethereum or Base here.");
  if (dest.domain === source.domain) throw new Error("Pick a different destination.");
  const amount = units(input.usd);
  const data = encodeBurn(amount, dest.domain, input.recipient, source.usdc);
  const approve = encodeApprove(MESSENGER, amount);
  if (!source.mintInApp) {
    return {
      kind: "export",
      why: source.why,
      chainId: source.chainId,
      calls: [
        { to: source.usdc, data: approve, note: "approve TokenMessengerV2" },
        { to: MESSENGER, data, note: "depositForBurn" },
      ],
    };
  }
  const eth = phantomEth();
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const from = accounts[0];
  if (!from) throw new Error("Phantom returned no Ethereum account.");
  await onChain(eth, source);
  await send(eth, from, source.usdc, approve);
  const hash = await send(eth, from, MESSENGER, data);
  return { kind: "sent", hash };
}

type IrisMessage = { message?: string; attestation?: string; status?: string };

/** Ask Circle for the signed message, then mint on Ethereum or Base. Arbitrum and Solana are not sent. */
export async function closeMint(input: {
  sourceDomain: number;
  txHash: string;
  destination: CctpId;
}): Promise<CctpResult> {
  const dest = cctpDomain(input.destination);
  const hash = input.txHash.trim();
  if (!/^0x[\da-fA-F]{64}$/.test(hash)) throw new Error("Paste the burn transaction hash.");
  const res = await fetch(`${IRIS}/${input.sourceDomain}?transactionHash=${hash}`);
  const json = (await res.json().catch(() => null)) as { messages?: IrisMessage[]; message?: string; attestation?: string; error?: string } | null;
  if (!res.ok) throw new Error(json?.error || "Circle has no attestation for that burn yet.");
  const row = json?.messages?.[0] ?? json;
  const message = row?.message ?? "";
  const attestation = row?.attestation ?? "";
  if (!message || !attestation || attestation === "PENDING") throw new Error("Circle has not attested this burn yet.");
  const data = encodeReceive(message, attestation);
  if (!dest.mintInApp) {
    return {
      kind: "export",
      why: dest.why,
      chainId: dest.chainId,
      calls: [{ to: TRANSMITTER, data, note: "receiveMessage" }],
    };
  }
  const eth = phantomEth();
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const from = accounts[0];
  if (!from) throw new Error("Phantom returned no Ethereum account.");
  await onChain(eth, dest);
  const sent = await send(eth, from, TRANSMITTER, data);
  return { kind: "sent", hash: sent };
}
