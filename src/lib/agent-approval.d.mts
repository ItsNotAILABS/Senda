export declare function approveAgentQueue(env: {
  armed?: boolean;
  action?: string;
  order?: string;
  job?: string;
  side: "buy" | "sell";
  maxUsd: number;
  spentUsd?: number;
  signedOn?: string;
  limitPx?: number;
  payTo?: string;
  symbols: string[];
  queue: {
    action?: string;
    order?: string;
    side: "buy" | "sell";
    symbol: string;
    usd: number;
    limitPx?: number;
    payTo?: string;
  } | null;
}, capUsd: number, day: string): {
  action: "swap" | "pay";
  order: "market" | "limit" | "stop";
  side: "buy" | "sell";
  usd: number;
  payTo: string;
};
