/** Ostium perps clear in USDC on Arbitrum. The wallet signs. Senda does not hold the margin. */

const CHAIN = "0xa4b1";
const TRADING = "0x6D0bA1f9996DBD8885827e1b2e8f6593e7702411";
const STORAGE = "0xcCd5891083A8acD2074690F65d3024E7D13d66E7";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const OPEN = "0x1365e4e4";
const RPC = "https://arb1.arbitrum.io/rpc";

type Eth = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

function provider(): Eth {
  const w = window as unknown as {
    phantom?: { ethereum?: Eth };
    ethereum?: Eth & { isMetaMask?: boolean; providers?: Array<Eth & { isMetaMask?: boolean }> };
  };
  if (w.phantom?.ethereum) return w.phantom.ethereum;
  const list = w.ethereum?.providers;
  const mask = list?.find((p) => p.isMetaMask);
  if (mask) return mask;
  if (w.ethereum?.isMetaMask) return w.ethereum;
  throw new Error("Ostium clears on Arbitrum. Open this page in Phantom or MetaMask and use the Ethereum account.");
}

function word(n: bigint): string {
  if (n < 0n) throw new Error("Bad amount.");
  return n.toString(16).padStart(64, "0");
}

function addressWord(a: string): string {
  return a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

function priceWord(px: number): string {
  const [whole, frac = ""] = px.toFixed(8).split(".");
  const digits = `${whole}${frac.padEnd(8, "0")}`.replace(/^0+/, "") || "0";
  return word(BigInt(digits) * 10n ** 10n);
}

async function call(to: string, data: string): Promise<string> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
  });
  const json = (await res.json()) as { result?: string };
  return json.result ?? "0x0";
}

async function send(eth: Eth, from: string, to: string, data: string): Promise<string> {
  const hash = (await eth.request({
    method: "eth_sendTransaction",
    params: [{ from, to, data, value: "0x0" }],
  })) as string;
  for (let i = 0; i < 24; i++) {
    const rec = (await eth.request({ method: "eth_getTransactionReceipt", params: [hash] })) as { status?: string } | null;
    if (rec) {
      if (rec.status === "0x0") throw new Error("Arbitrum rejected the transaction.");
      return hash;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return hash;
}

async function onArbitrum(eth: Eth) {
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN }] });
  } catch (e) {
    const code = (e as { code?: number }).code;
    if (code !== 4902) throw e;
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: CHAIN,
          chainName: "Arbitrum One",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: [RPC],
          blockExplorerUrls: ["https://arbiscan.io"],
        },
      ],
    });
  }
}

export async function openOstium(input: {
  pairIndex: number;
  buy: boolean;
  collateral: number;
  leverage: number;
  price: number;
}): Promise<string> {
  if (!(input.collateral >= 5)) throw new Error("Ostium wants at least $5 of USDC on Arbitrum.");
  if (!(input.price > 0)) throw new Error("This pair has no price yet.");
  if (!(input.leverage >= 1)) throw new Error("Pick a leverage.");
  const eth = provider();
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const owner = accounts?.[0];
  if (!owner) throw new Error("The wallet returned no account.");
  await onArbitrum(eth);
  const need = BigInt(Math.round(input.collateral * 1_000_000));
  const allowed = BigInt(await call(USDC, `0xdd62ed3e${addressWord(owner)}${addressWord(STORAGE)}`));
  if (allowed < need) await send(eth, owner, USDC, `0x095ea7b3${addressWord(STORAGE)}${word(need)}`);
  const data =
    OPEN +
    word(need) +
    priceWord(input.price) +
    word(0n) +
    word(0n) +
    addressWord(owner) +
    word(BigInt(Math.round(input.leverage * 100))) +
    word(BigInt(input.pairIndex)) +
    word(0n) +
    word(input.buy ? 1n : 0n) +
    word(0n) +
    addressWord("0x0000000000000000000000000000000000000000") +
    word(0n) +
    word(0n) +
    word(200n);
  return send(eth, owner, TRADING, data);
}

const PAIR_GRAPH = "https://api.subgraph.ormilabs.com/api/public/67a599d5-c8d2-4cc4-9c4d-2975a97bc5d8/subgraphs/ost-prod/live/gn";

/** The desk names a pair like EUR-USD. The contract wants the index that pair has right now. */
export async function openOstiumByName(input: {
  pair: string;
  side: "long" | "short";
  collateral: number;
  leverage: number;
  price: number;
}): Promise<string> {
  const [from, to] = input.pair.split("-");
  if (!from || !to) throw new Error("That pair is not named.");
  const res = await fetch(PAIR_GRAPH, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ query: "{ pairs(first: 200) { id from to } }" }),
  });
  if (!res.ok) throw new Error("Ostium did not list its pairs.");
  const json = (await res.json()) as { data?: { pairs?: { id?: string; from?: string; to?: string }[] } };
  const hit = (json.data?.pairs ?? []).find((row) => row.from === from && row.to === to);
  if (hit?.id == null) throw new Error(`${input.pair} is not on the Ostium contract, so nothing was signed.`);
  return openOstium({
    pairIndex: Number(hit.id),
    buy: input.side === "long",
    collateral: input.collateral,
    leverage: input.leverage,
    price: input.price,
  });
}
