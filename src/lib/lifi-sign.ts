/** Send the LI.FI transaction with the injected EVM wallet. Senda never holds the key. */

import { EVM_CHAINS, quoteIsSane, type EvmMarket, type LifiQuote } from "@/lib/trade-book.mjs";
import { spendCap } from "@/lib/spend-cap";

type Eth = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

const CHAINS = EVM_CHAINS;

function ethereum(): Eth {
  const eth = (window as unknown as { ethereum?: Eth }).ethereum;
  if (!eth) throw new Error("No EVM wallet in this browser.");
  return eth;
}

function hex(value: string | number | bigint): string {
  const text = String(value);
  if (text.startsWith("0x")) return text;
  return `0x${BigInt(text).toString(16)}`;
}

function padAddress(address: string): string {
  return address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

function padWord(value: bigint): string {
  return value.toString(16).padStart(64, "0");
}

async function onChain(chainId: number) {
  const eth = ethereum();
  const next = hex(chainId);
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: next }] });
  } catch (error) {
    const code = (error as { code?: number }).code;
    const known = CHAINS[chainId];
    if (code !== 4902 || !known) throw error;
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: next,
        chainName: known.name,
        nativeCurrency: { name: known.symbol, symbol: known.symbol, decimals: 18 },
        rpcUrls: [known.rpc],
        blockExplorerUrls: [known.explorer],
      }],
    });
  }
}

async function account(): Promise<string> {
  const accounts = (await ethereum().request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts?.[0];
  if (!address) throw new Error("The wallet returned no account.");
  return address;
}

async function allowance(token: string, owner: string, spender: string): Promise<bigint> {
  const data = `0xdd62ed3e${padAddress(owner)}${padAddress(spender)}`;
  const raw = (await ethereum().request({ method: "eth_call", params: [{ to: token, data }, "latest"] })) as string;
  return BigInt(raw || "0x0");
}

async function send(tx: { from: string; to: string; data: string; value?: string; gas?: string }) {
  const body: Record<string, string> = { from: tx.from, to: tx.to, data: tx.data, value: tx.value || "0x0" };
  if (tx.gas) body.gas = tx.gas;
  const hash = (await ethereum().request({ method: "eth_sendTransaction", params: [body] })) as string;
  if (!hash) throw new Error("The wallet did not return a transaction.");
  return hash;
}

async function mined(hash: string) {
  for (let i = 0; i < 20; i += 1) {
    const receipt = await ethereum().request({ method: "eth_getTransactionReceipt", params: [hash] });
    if (receipt) return;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("The approval is still pending.");
}

async function approve(token: string, owner: string, spender: string, amount: bigint) {
  const current = await allowance(token, owner, spender);
  if (current >= amount) return;
  if (current > 0n) {
    const zero = await send({ from: owner, to: token, data: `0x095ea7b3${padAddress(spender)}${padWord(0n)}` });
    await mined(zero);
  }
  const hash = await send({ from: owner, to: token, data: `0x095ea7b3${padAddress(spender)}${padWord(amount)}` });
  await mined(hash);
}

export async function signLifi(market: EvmMarket, quote: LifiQuote, spend: { token: string; amount: bigint; usd: number }): Promise<string> {
  if (!(spend.usd > 0) || spend.amount <= 0n) throw new Error("Enter an amount.");
  if (spend.usd > spendCap()) throw new Error(`That is about $${spend.usd.toFixed(0)}. Your send cap is $${spendCap()}. Raise it on Your money.`);
  if (!quote.ready || !quote.to || !quote.data) throw new Error("Quote again from this wallet. LI.FI has not built the transaction.");
  if (quote.fromAmountUSD && quote.toAmountUSD && !quoteIsSane(quote.fromAmountUSD, quote.toAmountUSD)) {
    throw new Error("The quote is more than 5% under the dollars in. The wallet was not asked to sign.");
  }
  await onChain(market.chainId);
  const owner = await account();
  const token = quote.fromToken || spend.token;
  if (quote.approvalAddress) await approve(token, owner, quote.approvalAddress, spend.amount);
  return send({
    from: owner,
    to: quote.to,
    data: quote.data,
    value: quote.value && quote.value !== "0x0" && quote.value !== "0x" ? hex(quote.value) : "0x0",
    gas: quote.gasLimit ? hex(quote.gasLimit) : undefined,
  });
}
