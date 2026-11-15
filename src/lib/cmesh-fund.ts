/** SOL on Phantom becomes ETH on Robinhood Chain. Relay builds it. Phantom signs it. Then CMESH can be bought. */

import { Connection, PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { chainRpc, sendVersioned } from "@/lib/phantom";
import { buyCmesh, ethToWei, robinhoodEth } from "@/lib/pons";

const RELAY = "https://api.relay.link/quote/v2";
const SOLANA = "https://solana-rpc.publicnode.com";

type Ix = { programId: string; data: string; keys: { pubkey: string; isSigner: boolean; isWritable: boolean }[] };

function weiText(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const frac = (wei % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "") || "0";
  return `${whole}.${frac}`;
}

async function relayQuote(solOwner: string, evmTo: string, lamports: bigint) {
  const res = await fetch(RELAY, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      user: solOwner,
      recipient: evmTo,
      originChainId: 792703809,
      destinationChainId: 4663,
      originCurrency: "11111111111111111111111111111111",
      destinationCurrency: "0x0000000000000000000000000000000000000000",
      amount: lamports.toString(),
      tradeType: "EXACT_INPUT",
    }),
  });
  const body = (await res.json()) as {
    message?: string;
    requestId?: string;
    details?: { currencyOut?: { amount?: string } };
    steps?: { items?: { data?: { instructions?: Ix[]; addressLookupTableAddresses?: string[] }; check?: { endpoint?: string } }[] }[];
  };
  const data = body.steps?.[0]?.items?.[0]?.data;
  if (!res.ok || !data?.instructions?.length || !body.requestId) {
    throw new Error(body.message || "Relay did not quote SOL into ETH on Robinhood Chain.");
  }
  return {
    requestId: body.requestId,
    instructions: data.instructions,
    tables: data.addressLookupTableAddresses ?? [],
    ethOut: BigInt(body.details?.currencyOut?.amount || "0"),
    check: body.steps?.[0]?.items?.[0]?.check?.endpoint || "",
  };
}

async function signRelay(owner: string, instructions: Ix[], tables: string[]): Promise<string> {
  const connection = new Connection(SOLANA, "confirmed");
  const lookups = [];
  for (const address of tables) {
    const found = await connection.getAddressLookupTable(new PublicKey(address));
    if (!found.value) throw new Error("The conversion could not load its address table.");
    lookups.push(found.value);
  }
  const hash = (await chainRpc("getLatestBlockhash", [{ commitment: "confirmed" }])) as { value?: { blockhash?: string } };
  if (!hash?.value?.blockhash) throw new Error("No blockhash.");
  const message = new TransactionMessage({
    payerKey: new PublicKey(owner),
    recentBlockhash: hash.value.blockhash,
    instructions: instructions.map(
      (ix) =>
        new TransactionInstruction({
          programId: new PublicKey(ix.programId),
          keys: ix.keys.map((key) => ({ pubkey: new PublicKey(key.pubkey), isSigner: key.isSigner, isWritable: key.isWritable })),
          data: Buffer.from(ix.data, "hex"),
        }),
    ),
  }).compileToV0Message(lookups);
  return sendVersioned(new VersionedTransaction(message));
}

async function waitForEth(requestId: string, check: string, evmTo: string, before: bigint): Promise<bigint> {
  const endpoint = check.startsWith("http") ? check : `https://api.relay.link${check.startsWith("/") ? "" : "/"}${check}`;
  for (let i = 0; i < 20; i += 1) {
    await new Promise((r) => setTimeout(r, 3000));
    const now = await robinhoodEth(evmTo);
    if (now > before) return now;
    try {
      const res = await fetch(endpoint || `https://api.relay.link/intents/status/v3?requestId=${requestId}`);
      const body = (await res.json()) as { status?: string };
      if (body.status === "failure" || body.status === "refund") {
        throw new Error("Relay refunded the SOL. No ETH arrived, so CMESH was not bought.");
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Relay refunded")) throw e;
    }
  }
  throw new Error("The SOL is signed. ETH has not landed on Robinhood Chain yet. Tap Buy again when it shows. CMESH was not bought.");
}

/** Uses ETH already on Robinhood Chain. If it is short, converts spare SOL first, then buys what that ETH can cover. */
export async function buyCmeshCovered(wantEth: string, solOwner: string): Promise<{ hash: string; wallet: string; from: string; converted: boolean }> {
  return buyAfter(ethToWei(wantEth), 80_000_000_000_000n, solOwner);
}

async function evmAccount(): Promise<string> {
  const w = window as unknown as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> }; phantom?: { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } } };
  const provider = w.phantom?.ethereum || w.ethereum;
  if (!provider) throw new Error("Open this in Phantom. The ETH has to land in Phantom's Ethereum account.");
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  const from = Array.isArray(accounts) ? String(accounts[0] || "") : "";
  if (!/^0x[a-fA-F0-9]{40}$/.test(from)) throw new Error("The wallet did not give an Ethereum account.");
  return from;
}

async function buyAfter(want: bigint, gasKeep: bigint, solOwner: string): Promise<{ hash: string; wallet: string; from: string; converted: boolean }> {
  const from = await evmAccount();
  let have = await robinhoodEth(from);
  let converted = false;
  if (have < want + gasKeep) {
    const bal = (await chainRpc("getBalance", [solOwner, { commitment: "confirmed" }])) as { value?: number } | number;
    const lamports = typeof bal === "number" ? BigInt(bal) : BigInt(bal?.value ?? 0);
    const keep = 4_000_000n;
    if (lamports <= keep + 5_000_000n) {
      throw new Error(`${(Number(lamports) / 1e9).toFixed(4)} SOL is on this Phantom. That is not enough to convert into ETH and still pay the Solana fee.`);
    }
    const quote = await relayQuote(solOwner, from, lamports - keep);
    if (quote.ethOut <= 0n) throw new Error("Relay quoted no ETH.");
    await signRelay(solOwner, quote.instructions, quote.tables);
    converted = true;
    have = await waitForEth(quote.requestId, quote.check, from, have);
  }
  const spend = have > gasKeep ? (have - gasKeep < want ? have - gasKeep : want) : 0n;
  if (spend <= 0n) throw new Error("ETH landed, but not enough is left after the fee to buy CMESH.");
  const done = await buyCmesh(weiText(spend));
  return { ...done, converted };
}
