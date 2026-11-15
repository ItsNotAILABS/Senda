/** Kinds of agent a person can make. Money is not part of making one. */

export type AgentKind =
  | "analysis"
  | "marketing"
  | "business"
  | "decision"
  | "portfolio"
  | "travel"
  | "economics"
  | "desk"
  | "research";

export type KindCard = {
  id: AgentKind;
  title: string;
  line: string;
  example: string;
  /** Only these may queue a trade, and only after a size is set. */
  trades: boolean;
  reads: boolean;
};

export const KINDS: KindCard[] = [
  { id: "analysis", title: "Financial analysis", line: "Reads the live book and writes who is cheap, who is rich, and where the pool is thin.", example: "Write me the book. Name the cheap end and the rich end, and say which pool is too thin to touch.", trades: false, reads: true },
  { id: "marketing", title: "Marketing", line: "Turns what you sell into an audience, an offer, a channel, and the next thing to publish.", example: "We sell a wallet-native desk for tokenized pre-IPO names. Write the audience, the offer, and one post.", trades: false, reads: false },
  { id: "business", title: "Business", line: "Writes the unit you sell, the constraint, and the decision sitting in front of you.", example: "A one-person desk. The constraint is time, not capital. What do I stop doing this week?", trades: false, reads: false },
  { id: "decision", title: "Decision", line: "Lays the options out and names what would change the call. It does not pick for you.", example: "Stay in the current role or take the contract. I need the options and what would change the call.", trades: false, reads: false },
  { id: "portfolio", title: "Portfolio", line: "Reads the names you care about against the live book. It does not need a size, and it does not sign.", example: "Watch OpenAI, Anthropic, and SpaceX. Tell me which one is off its mark.", trades: false, reads: true },
  { id: "travel", title: "Travel", line: "Builds the trip from the cities, the dates, and the budget you actually wrote.", example: "Fort Worth to Mexico City, four nights, next month, keep it under $900.", trades: false, reads: false },
  { id: "economics", title: "Economics", line: "Frames the question, then checks any name you mentioned against the live print.", example: "What does a rich print on a private name actually mean if I cannot redeem the share?", trades: false, reads: true },
  { id: "desk", title: "Trading desk", line: "Can queue a buy or a sell once you set a size. Until then it only reads. You still sign.", example: "Watch SpaceX. If it is cheap versus the mark, queue a buy. Do not sign.", trades: true, reads: true },
  { id: "research", title: "Research", line: "Keeps a question, a finding, and what to read next. You come back to the same note.", example: "Keep a note on how FX perps are printed versus how a Solana hold actually settles.", trades: false, reads: true },
];

export function kindOf(id: string | undefined): KindCard {
  return KINDS.find((k) => k.id === id) ?? KINDS[0];
}

/** Venues a person can actually distinguish. A signature exists here only where the desk already builds one. */
export const VENUES: { name: string; chain: string; sign: string }[] = [
  { name: "Jupiter", chain: "Solana", sign: "A hold is a Jupiter route. Your wallet signs it." },
  { name: "Avantis", chain: "Base", sign: "A perp on Markets is Avantis calldata. Your wallet signs it on Base." },
  { name: "Ostium", chain: "Arbitrum", sign: "The FX, metal, oil, index, and soft print. This desk reads it and does not sign Arbitrum." },
  { name: "Drift", chain: "Solana", sign: "Solana-native perps. Not a ticket on this desk." },
  { name: "Hyperliquid", chain: "its own book", sign: "The deep crypto perp book. Not a ticket on this desk." },
  { name: "Lighter", chain: "its own book", sign: "Another crypto perp book, often cheap to open. Not a ticket on this desk." },
];

export function openBrief(kind: AgentKind, purpose: string): string[] {
  const text = purpose.trim();
  const first = text.split(/[.\n]/)[0]?.trim() || text;
  if (kind === "marketing") {
    return [
      `Audience. Who this is for is in the brief: ${first}`,
      "Offer. Say the thing they can do here, not the chain it sits on.",
      "Channel. One place they already are. Do not invent a campaign.",
      "Next. Write one post from the sentence they gave you, then stop.",
    ];
  }
  if (kind === "business") {
    return [
      `Unit. What is being sold, in their words: ${first}`,
      "Constraint. Name the one limit they wrote. If they wrote none, say so.",
      "Stop. One thing to stop this week so the unit can move.",
      "Decision. The call in front of them, not a plan for the year.",
    ];
  }
  if (kind === "decision") {
    return [
      `Call. ${first}`,
      "Options. Only the ones they named. Do not add a third to look thorough.",
      "Changes. What fact, if it arrived, would flip the call.",
      "Not chosen. This agent does not pick. They do.",
    ];
  }
  if (kind === "travel") {
    return [
      `Trip. ${first}`,
      "Stay. Nights and city, only if they wrote them.",
      "Cap. The budget they named. If they named none, do not invent one.",
      "Open. What is still missing before this is a real itinerary.",
    ];
  }
  if (kind === "research") {
    return [
      `Question. ${first}`,
      "Finding. Only what the book or a venue line below can support.",
      "Next. The one page or print to read on the next visit.",
      "Kept. This note stays on the agent. Come back and add to it.",
    ];
  }
  return [];
}
