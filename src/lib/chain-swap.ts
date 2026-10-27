/** A same-chain swap. deBridge builds it. The wallet on that chain signs it. */

const TX = "https://dln.debridge.finance/v1.0/chain/transaction";

export type ChainQuote = {
  to: string;
  data: string;
  value: string;
  outUi: number;
  outSymbol: string;
  usdOut: number;
};

type Evm = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };

function provider(): Evm {
  const w = window as unknown as { ethereum?: Evm; phantom?: { ethereum?: Evm } };
  const found = w.phantom?.ethereum || w.ethereum;
  if (!found) throw new Error("An Ethereum wallet has to be in this browser.");
  return found;
}

export async function evmSender(): Promise<string> {
  const accounts = (await provider().request({ method: "eth_requestAccounts" })) as string[];
  const from = accounts?.[0];
  if (!from) throw new Error("The wallet did not return an address.");
  return from;
}

export async function quoteSameChain(input: {
  chainId: number;
  tokenIn: string;
  tokenInDecimals: number;
  tokenOut: string;
  usd: number;
  sender: string;
}): Promise<ChainQuote> {
  const atoms = BigInt(Math.round(input.usd * 10 ** input.tokenInDecimals));
  if (atoms <= 0n) throw new Error("Enter an amount.");
  const qs = new URLSearchParams({
    chainId: String(input.chainId),
    tokenIn: input.tokenIn,
    tokenInAmount: atoms.toString(),
    tokenOut: input.tokenOut,
    tokenOutRecipient: input.sender,
    senderAddress: input.sender,
    slippage: "auto",
  });
  const res = await fetch(`${TX}?${qs.toString()}`, { headers: { accept: "application/json" } });
  const body = (await res.json()) as {
    errorMessage?: string;
    tx?: { to?: string; data?: string; value?: string };
    tokenOut?: { symbol?: string; decimals?: number; amount?: string; approximateUsdValue?: number };
  };
  if (!res.ok || !body.tx?.to || !body.tx.data) throw new Error(body.errorMessage || "That chain did not quote this token.");
  const dec = body.tokenOut?.decimals ?? 18;
  const outUi = Number(body.tokenOut?.amount || "0") / 10 ** dec;
  const usdOut = Number(body.tokenOut?.approximateUsdValue) || 0;
  if (usdOut > 0 && usdOut < input.usd * 0.5) {
    throw new Error(`The quote only returns about $${usdOut.toFixed(2)}. It was not sent.`);
  }
  return { to: body.tx.to, data: body.tx.data, value: body.tx.value || "0x0", outUi, outSymbol: body.tokenOut?.symbol || "", usdOut };
}

export async function signSameChain(quote: ChainQuote, from: string, chainId: number): Promise<string> {
  const wallet = provider();
  const hex = `0x${chainId.toString(16)}`;
  await wallet.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] }).catch(() => undefined);
  const hash = await wallet.request({
    method: "eth_sendTransaction",
    params: [{ from, to: quote.to, data: quote.data, value: quote.value }],
  });
  if (typeof hash !== "string") throw new Error("The wallet did not return a transaction.");
  return hash;
}
