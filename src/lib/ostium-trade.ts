/** Ostium on Arbitrum. Phantom's Ethereum account signs. Senda does not hold the key. */

const TRADING = "0x6D0bA1f9996DBD8885827e1b2e8f6593e7702411";
const STORAGE = "0xcCd5891083A8acD2074690F65d3024E7D13d66E7";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const OPEN = "0x1365e4e4";
const GRAPH = "https://api.subgraph.ormilabs.com/api/public/67a599d5-c8d2-4cc4-9c4d-2975a97bc5d8/subgraphs/ost-prod/live/gn";

const ALIAS: Record<string, string> = {
  "US500-USD": "SPX-USD",
  "US30-USD": "DJI-USD",
  "US100-USD": "NDX-USD",
  "GER40-EUR": "DAX-EUR",
  "UK100-GBP": "FTSE-GBP",
  "JP225-JPY": "NIK-JPY",
  "HK50-HKD": "HSI-HKD",
  "XCU-USD": "HG-USD",
  "WTI-USD": "CL-USD",
};

type Eth = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

function ethereum(): Eth {
  const w = window as unknown as { phantom?: { ethereum?: Eth }; ethereum?: Eth };
  const eth = w.phantom?.ethereum ?? w.ethereum;
  if (!eth?.request) throw new Error("Open this in Phantom. Its Ethereum account signs Arbitrum.");
  return eth;
}

function word(value: bigint): string {
  return value.toString(16).padStart(64, "0");
}

function addr(value: string): string {
  return value.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

function priceWord(price: number): bigint {
  return BigInt(Math.round(price * 1e5)) * 10n ** 13n;
}

let pairs: Map<string, number> | null = null;

async function pairIndex(symbol: string): Promise<number> {
  if (!pairs) {
    const res = await fetch(GRAPH, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ query: "{ pairs(first: 200) { id from to } }" }),
    });
    const json = (await res.json()) as { data?: { pairs?: { id?: string; from?: string; to?: string }[] } };
    pairs = new Map();
    for (const row of json.data?.pairs ?? []) {
      if (row.from && row.to && row.id != null) pairs.set(`${row.from}-${row.to}`, Number(row.id));
    }
  }
  const key = ALIAS[symbol] ?? symbol;
  const id = pairs.get(key);
  if (id == null || !Number.isFinite(id)) throw new Error("Ostium does not list that pair. Nothing was signed.");
  return id;
}

async function onArbitrum() {
  const eth = ethereum();
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xa4b1" }] });
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 4902) throw error;
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: "0xa4b1",
        chainName: "Arbitrum One",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: ["https://arb1.arbitrum.io/rpc"],
        blockExplorerUrls: ["https://arbiscan.io"],
      }],
    });
  }
}

async function mined(hash: string) {
  const eth = ethereum();
  for (let i = 0; i < 20; i += 1) {
    const receipt = await eth.request({ method: "eth_getTransactionReceipt", params: [hash] });
    if (receipt) return;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("The USDC approval is still pending.");
}

export async function openOstium(input: {
  pair: string;
  trader: string;
  side: "long" | "short";
  collateral: number;
  leverage: number;
  price: number;
}): Promise<string> {
  if (!(input.collateral > 0) || !(input.leverage > 0) || !(input.price > 0)) throw new Error("Enter the margin. The price has to be live.");
  const index = await pairIndex(input.pair);
  await onArbitrum();
  const eth = ethereum();
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const trader = accounts?.[0];
  if (!trader) throw new Error("Phantom returned no Ethereum account.");
  if (input.trader && trader.toLowerCase() !== input.trader.toLowerCase()) {
    /* The account Phantom just unlocked is the one that signs. */
  }
  const collateral = BigInt(Math.max(1, Math.round(input.collateral * 1e6)));
  const allowanceData = `0xdd62ed3e${addr(trader)}${addr(STORAGE)}`;
  const allowance = BigInt(((await eth.request({ method: "eth_call", params: [{ to: USDC, data: allowanceData }, "latest"] })) as string) || "0x0");
  if (allowance < collateral) {
    const approve = `0x095ea7b3${addr(STORAGE)}${word(1_000_000n * 1_000_000n)}`;
    const approved = (await eth.request({ method: "eth_sendTransaction", params: [{ from: trader, to: USDC, data: approve, value: "0x0" }] })) as string;
    await mined(approved);
  }
  const data = OPEN
    + word(collateral)
    + word(priceWord(input.price))
    + word(0n)
    + word(0n)
    + addr(trader)
    + word(BigInt(Math.round(input.leverage * 100)))
    + word(BigInt(index))
    + word(0n)
    + word(input.side === "long" ? 1n : 0n)
    + word(0n)
    + addr("0x0000000000000000000000000000000000000000")
    + word(0n)
    + word(0n)
    + word(200n);
  const hash = (await eth.request({
    method: "eth_sendTransaction",
    params: [{ from: trader, to: TRADING, data, value: "0x0" }],
  })) as string;
  if (!hash) throw new Error("Phantom did not return the transaction.");
  return hash;
}
