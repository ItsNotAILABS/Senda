/** What an agent is allowed to ask for. None of these sign. */

import type { Job } from "@/lib/agent-shift";

export type OrderType = "market" | "limit" | "stop";
export type AgentAction = "swap" | "pay" | "lend" | "watch";

export const ORDER_TYPES: { id: OrderType; title: string; line: string }[] = [
  { id: "market", title: "Market", line: "Signs at the live print when you press sign." },
  { id: "limit", title: "Limit", line: "Queues only when the last is through your price." },
  { id: "stop", title: "Stop", line: "Queues only after the last trades through your price." },
];

export const ACTIONS: { id: AgentAction; title: string; line: string }[] = [
  { id: "swap", title: "Swap", line: "Buy or sell on Jupiter. Phantom signs." },
  { id: "pay", title: "Pay", line: "USDC to the address on the contract. Phantom signs each send." },
  { id: "lend", title: "Lend", line: "SPYx, QQQx, NVDAx. The queue points at the Kamino market. This desk does not deposit." },
  { id: "watch", title: "Watch", line: "Writes the tape. Nothing moves." },
];

export type Strategy = {
  id: string;
  title: string;
  line: string;
  job: Job;
  action: AgentAction;
  order: OrderType;
  side: "buy" | "sell";
  symbols: string[];
  mandate: string;
};

export const STRATEGIES: Strategy[] = [
  {
    id: "inkind",
    title: "In-kind yield",
    line: "Kraken's vaults lend SPYx, QQQx, and NVDAx and pay you more of the same token. Yield is variable, a withdrawal can take three days, and the US, UK, Canada, Australia, and the UAE are excluded. This desk only watches.",
    job: "clerk",
    action: "lend",
    order: "market",
    side: "buy",
    symbols: ["SPYx", "QQQx", "NVDAx"],
    mandate: "Watch SPYx, QQQx, and NVDAx. Yield, when it is paid, comes back as the same xStock through Kamino. Do not send.",
  },
  {
    id: "limit-bid",
    title: "Limit bid",
    line: "A buy that waits until the last is at or under your price.",
    job: "discount",
    action: "swap",
    order: "limit",
    side: "buy",
    symbols: [],
    mandate: "Queue a buy only when the last is at or under the limit. The user signs the swap.",
  },
  {
    id: "stop-out",
    title: "Stop out",
    line: "A sell that waits until the last trades down through your price.",
    job: "cover",
    action: "swap",
    order: "stop",
    side: "sell",
    symbols: [],
    mandate: "Queue a sell only after the last trades through the stop. The user signs.",
  },
  {
    id: "invoice",
    title: "Approved pay",
    line: "Visa's pilot lets a trusted agent pay an invoice it was already cleared for. Here the contract is the clearance: one address, one cap. Phantom still signs every send.",
    job: "clerk",
    action: "pay",
    order: "market",
    side: "buy",
    symbols: [],
    mandate: "Pay USDC only to the address on this contract, and only up to the cap. The user signs each send.",
  },
];
