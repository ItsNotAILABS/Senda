/** Phantom's Ethereum account signs the Hyperliquid order. The key never comes here. */

type Eth = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

type Typed = {
  domain: { name: string; version: string; chainId: number; verifyingContract: `0x${string}` };
  types: Record<string, readonly { name: string; type: string }[]>;
  primaryType: string;
  message: Record<string, unknown>;
};

function ethereum(): Eth {
  const win = window as unknown as { phantom?: { ethereum?: Eth }; ethereum?: Eth & { isPhantom?: boolean } };
  const eth = win.phantom?.ethereum || (win.ethereum?.isPhantom ? win.ethereum : undefined);
  if (!eth?.request) throw new Error("Open this in Phantom. Perps sign with the Ethereum address in that account.");
  return eth;
}

function phantomWallet() {
  return {
    async getAddresses(): Promise<`0x${string}`[]> {
      const accounts = (await ethereum().request({ method: "eth_requestAccounts" })) as string[];
      const address = accounts?.[0];
      if (!address) throw new Error("Phantom returned no Ethereum address.");
      return [address as `0x${string}`];
    },
    async getChainId() {
      return 1;
    },
    async signTypedData(params: Typed) {
      const [address] = await this.getAddresses();
      const sig = (await ethereum().request({
        method: "eth_signTypedData_v4",
        params: [address, JSON.stringify(params)],
      })) as string;
      if (!sig?.startsWith("0x")) throw new Error("Phantom did not sign.");
      return sig as `0x${string}`;
    },
  };
}

function px(mark: number, side: "long" | "short", szDecimals: number): string {
  const slipped = side === "long" ? mark * 1.01 : mark * 0.99;
  const digits = Math.max(0, 6 - szDecimals);
  const sig = Number(slipped.toPrecision(5));
  return sig.toFixed(digits).replace(/\.?0+$/, "");
}

function sz(notional: number, mark: number, szDecimals: number): string {
  const size = notional / mark;
  const text = size.toFixed(szDecimals).replace(/\.?0+$/, "");
  if (!text || Number(text) <= 0) throw new Error("That size is smaller than this market allows.");
  return text;
}

function readStatus(status: unknown): { oid: string; avg: string; filled: string } {
  if (!status || typeof status !== "object") throw new Error("Hyperliquid is still working the order.");
  if ("error" in status) throw new Error(String((status as { error: string }).error));
  if ("filled" in status) {
    const filled = (status as { filled: { oid: number; avgPx: string; totalSz: string } }).filled;
    return { oid: String(filled.oid), avg: filled.avgPx, filled: filled.totalSz };
  }
  if ("resting" in status) {
    const resting = (status as { resting: { oid: number } }).resting;
    return { oid: String(resting.oid), avg: "", filled: "0" };
  }
  throw new Error("Hyperliquid did not accept the order.");
}

export async function hlAccount(): Promise<string> {
  const [address] = await phantomWallet().getAddresses();
  return address;
}

export async function hlFund(amount: number): Promise<void> {
  if (!(amount > 0)) throw new Error("Enter an amount.");
  const hl = await import("@nktkas/hyperliquid");
  const client = new hl.ExchangeClient({ transport: new hl.HttpTransport(), wallet: phantomWallet() });
  await client.usdClassTransfer({ amount: amount.toFixed(2), toPerp: true });
}

export async function hlUnify(user: string): Promise<void> {
  const hl = await import("@nktkas/hyperliquid");
  const client = new hl.ExchangeClient({ transport: new hl.HttpTransport(), wallet: phantomWallet() });
  await client.userSetAbstraction({ user: user as `0x${string}`, abstraction: "unifiedAccount" });
}

export async function hlOpen(input: {
  asset: number;
  side: "long" | "short";
  margin: number;
  leverage: number;
  mark: number;
  szDecimals: number;
}): Promise<{ oid: string; avg: string; filled: string }> {
  if (!(input.margin > 0) || !(input.mark > 0)) throw new Error("Enter a margin.");
  const hl = await import("@nktkas/hyperliquid");
  const client = new hl.ExchangeClient({ transport: new hl.HttpTransport(), wallet: phantomWallet() });
  const leverage = Math.max(1, Math.round(input.leverage));
  await client.updateLeverage({ asset: input.asset, isCross: true, leverage });
  const notional = input.margin * leverage;
  const sent = await client.order({
    orders: [{
      a: input.asset,
      b: input.side === "long",
      p: px(input.mark, input.side, input.szDecimals),
      s: sz(notional, input.mark, input.szDecimals),
      r: false,
      t: { limit: { tif: "FrontendMarket" } },
    }],
    grouping: "na",
  });
  return readStatus(sent.response.data.statuses[0]);
}

export async function hlClose(input: {
  asset: number;
  side: "long" | "short";
  size: number;
  mark: number;
  szDecimals: number;
}): Promise<{ oid: string }> {
  const hl = await import("@nktkas/hyperliquid");
  const client = new hl.ExchangeClient({ transport: new hl.HttpTransport(), wallet: phantomWallet() });
  const closing = input.side === "long" ? "short" : "long";
  const sent = await client.order({
    orders: [{
      a: input.asset,
      b: closing === "long",
      p: px(input.mark, closing, input.szDecimals),
      s: input.size.toFixed(input.szDecimals).replace(/\.?0+$/, ""),
      r: true,
      t: { limit: { tif: "FrontendMarket" } },
    }],
    grouping: "na",
  });
  return { oid: readStatus(sent.response.data.statuses[0]).oid };
}
