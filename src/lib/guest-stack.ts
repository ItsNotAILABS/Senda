import type { Side } from "@/lib/lmsr";
import type { LedgerLeg } from "@/lib/ledger";

const KEY = "the-pit.guest-stack.v1";

export type GuestPosition = { yes: number; no: number };

export type GuestJournalLine = {
  account: string;
  dr: number;
  cr: number;
  ref: string;
  createdAt: string;
};

export type GuestState = {
  chips: number;
  positions: Record<string, GuestPosition>;
  journal: GuestJournalLine[];
};

const EMPTY: GuestState = { chips: 0, positions: {}, journal: [] };

export function loadGuest(): GuestState {
  if (typeof window === "undefined") return { ...EMPTY, positions: {} };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { chips: 0, positions: {}, journal: [] };
    const parsed = JSON.parse(raw) as Partial<GuestState>;
    return {
      chips: Math.max(0, Math.round(Number(parsed.chips) || 0)),
      positions: parsed.positions && typeof parsed.positions === "object" ? parsed.positions : {},
      journal: Array.isArray(parsed.journal) ? parsed.journal.slice(-48) : [],
    };
  } catch {
    return { chips: 0, positions: {}, journal: [] };
  }
}

export function saveGuest(state: GuestState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota — play on without persist */
  }
}

export function guestPosition(state: GuestState, marketId: string): GuestPosition {
  return state.positions[marketId] ?? { yes: 0, no: 0 };
}

function withLegs(state: GuestState, chips: number, legs: LedgerLeg[], ref: string): GuestState {
  const createdAt = new Date().toISOString();
  return {
    chips,
    positions: { ...state.positions },
    journal: [
      ...state.journal,
      ...legs.map((l) => ({
        account: l.account,
        dr: l.dr,
        cr: l.cr,
        ref,
        createdAt,
      })),
    ].slice(-48),
  };
}

export function applyGuestBuyIn(state: GuestState, chips: number, legs: LedgerLeg[], ref: string): GuestState {
  return withLegs(state, state.chips + chips, legs, ref);
}

export function applyGuestDelta(state: GuestState, chipsDelta: number, legs: LedgerLeg[], ref: string): GuestState {
  return withLegs(state, Math.max(0, Math.round(state.chips + chipsDelta)), legs, ref);
}

export function applyGuestCashOut(state: GuestState, legs: LedgerLeg[], ref: string): GuestState {
  return withLegs(state, 0, legs, ref);
}

export function applyGuestTrade(
  state: GuestState,
  marketId: string,
  side: Side,
  cost: number,
  shares: number,
  legs: LedgerLeg[],
  ref: string,
): GuestState {
  const createdAt = new Date().toISOString();
  const cur = guestPosition(state, marketId);
  const nextPos =
    side === "yes"
      ? { yes: cur.yes + shares, no: cur.no }
      : { yes: cur.yes, no: cur.no + shares };
  return {
    chips: Math.max(0, Math.round(state.chips - cost)),
    positions: { ...state.positions, [marketId]: nextPos },
    journal: [
      ...state.journal,
      ...legs.map((l) => ({
        account: l.account,
        dr: l.dr,
        cr: l.cr,
        ref,
        createdAt,
      })),
    ].slice(-48),
  };
}
