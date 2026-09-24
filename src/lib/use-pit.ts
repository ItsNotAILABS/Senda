import { useCallback, useEffect, useMemo, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  applyGuestBuyIn,
  applyGuestCashOut,
  applyGuestDelta,
  applyGuestTrade,
  loadGuest,
  saveGuest,
  type GuestState,
} from "@/lib/guest-stack";
import { cashOutLegs } from "@/lib/ledger";
import { BUY_IN_CHIPS } from "@/lib/markets";
import {
  buyIn as buyInFn,
  cashOut as cashOutFn,
  getPit,
  paperCredit as paperCreditFn,
  paperDebit as paperDebitFn,
  trade as tradeFn,
  type MarketView,
  type PitSnapshot,
  type PositionView,
} from "@/lib/pit";
import type { Side } from "@/lib/lmsr";

export type PitModel = {
  loading: boolean;
  snap: PitSnapshot | null;
  markets: MarketView[];
  chips: number;
  positions: PositionView[];
  signedIn: boolean;
  frozen: boolean;
  variance: number;
  totals: { dr: number; cr: number };
  refresh: () => Promise<void>;
  buyIn: () => Promise<{ ok: boolean; error?: string }>;
  cashOut: () => Promise<{ ok: boolean; error?: string; cashed?: number }>;
  trade: (
    marketId: string,
    side: Side,
    spend: number,
  ) => Promise<{
    ok: boolean;
    error?: string;
    cost?: number;
    shares?: number;
    pYesAfter?: number;
  }>;
  credit: (amount: number, ref: string) => Promise<{ ok: boolean; error?: string }>;
  debit: (amount: number, ref: string) => Promise<{ ok: boolean; error?: string }>;
  positionFor: (marketId: string) => PositionView;
};

export function usePit(seed?: PitSnapshot | null): PitModel {
  const { user, isPending } = useCurrentUserState();
  const [snap, setSnap] = useState<PitSnapshot | null>(seed ?? null);
  const [guest, setGuest] = useState<GuestState>(() => loadGuest());
  const [loading, setLoading] = useState(!seed);

  useEffect(() => {
    setGuest(loadGuest());
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await getPit();
      setSnap(next);
    } catch {
      /* keep last snapshot */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, user?.id]);

  const serverSignedIn = Boolean(snap?.signedIn);
  const chips = serverSignedIn ? (snap?.chips ?? 0) : guest.chips;
  const frozen = Boolean(snap?.frozen);
  const variance = snap?.variance ?? 0;
  const totals = snap?.totals ?? { dr: 0, cr: 0 };
  const markets = snap?.markets ?? [];

  const positions: PositionView[] = useMemo(() => {
    if (serverSignedIn) return snap?.positions ?? [];
    return Object.entries(guest.positions).map(([marketId, p]) => ({
      marketId,
      yesShares: p.yes,
      noShares: p.no,
    }));
  }, [serverSignedIn, snap?.positions, guest.positions]);

  const positionFor = useCallback(
    (marketId: string): PositionView => {
      return (
        positions.find((p) => p.marketId === marketId) ?? {
          marketId,
          yesShares: 0,
          noShares: 0,
        }
      );
    },
    [positions],
  );

  const buyIn = useCallback(async () => {
    if (frozen) return { ok: false, error: "Cage frozen — ledger variance is not zero." };
    try {
      const res = await buyInFn();
      if (!res.ok) return { ok: false, error: res.error };
      if (!serverSignedIn) {
        const next = applyGuestBuyIn(loadGuest(), BUY_IN_CHIPS, res.legs, res.ref);
        saveGuest(next);
        setGuest(next);
      }
      await refresh();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Buy-in failed." };
    }
  }, [frozen, serverSignedIn, refresh]);

  const cashOut = useCallback(async () => {
    if (frozen) return { ok: false, error: "Cage frozen — ledger variance is not zero." };
    if (serverSignedIn) {
      try {
        const res = await cashOutFn();
        if (!res.ok) return { ok: false, error: res.error };
        await refresh();
        return { ok: true, cashed: res.cashed };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Cash-out failed." };
      }
    }
    const current = loadGuest();
    if (current.chips <= 0) return { ok: false, error: "No chips to cash out." };
    const ref = `cashout:guest:${Date.now()}`;
    const legs = cashOutLegs(current.chips, ref);
    const next = applyGuestCashOut(current, legs, ref);
    saveGuest(next);
    setGuest(next);
    return { ok: true, cashed: current.chips };
  }, [frozen, serverSignedIn, refresh]);

  const trade = useCallback(
    async (marketId: string, side: Side, spend: number) => {
      if (frozen) return { ok: false, error: "Table frozen — ledger variance is not zero." };
      const stack = serverSignedIn ? (snap?.chips ?? 0) : loadGuest().chips;
      if (stack < spend) return { ok: false, error: "Not enough chips." };
      try {
        const res = await tradeFn({ data: { marketId, side, spend } });
        if (!res.ok) return { ok: false, error: res.error };
        if (!serverSignedIn) {
          const next = applyGuestTrade(
            loadGuest(),
            marketId,
            side,
            res.cost,
            res.shares,
            res.legs,
            res.ref,
          );
          saveGuest(next);
          setGuest(next);
        }
        await refresh();
        return {
          ok: true,
          cost: res.cost,
          shares: res.shares,
          pYesAfter: res.pYesAfter,
        };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Trade failed." };
      }
    },
    [frozen, serverSignedIn, snap?.chips, refresh],
  );

  const credit = useCallback(
    async (amount: number, ref: string) => {
      if (!(amount > 0)) return { ok: true };
      try {
        const res = await paperCreditFn({ data: { amount, ref } });
        if (!res.ok) return { ok: false, error: res.error };
        if (!serverSignedIn) {
          const next = applyGuestDelta(loadGuest(), amount, res.legs, res.ref);
          saveGuest(next);
          setGuest(next);
        }
        await refresh();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Credit failed." };
      }
    },
    [serverSignedIn, refresh],
  );

  const debit = useCallback(
    async (amount: number, ref: string) => {
      if (!(amount > 0)) return { ok: true };
      if (frozen) return { ok: false, error: "Cage frozen — ledger variance is not zero." };
      const stack = serverSignedIn ? (snap?.chips ?? 0) : loadGuest().chips;
      if (stack < amount) return { ok: false, error: "Not enough chips." };
      try {
        const res = await paperDebitFn({ data: { amount, ref } });
        if (!res.ok) return { ok: false, error: res.error };
        if (!serverSignedIn) {
          const next = applyGuestDelta(loadGuest(), -amount, res.legs, res.ref);
          saveGuest(next);
          setGuest(next);
        }
        await refresh();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Debit failed." };
      }
    },
    [frozen, serverSignedIn, snap?.chips, refresh],
  );

  return {
    loading: loading || isPending,
    snap,
    markets,
    chips,
    positions,
    signedIn: serverSignedIn,
    frozen,
    variance,
    totals,
    refresh,
    buyIn,
    cashOut,
    trade,
    credit,
    debit,
    positionFor,
  };
}
