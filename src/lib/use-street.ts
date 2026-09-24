import { useEffect, useState } from "react";
import { getStreetBook, type StreetBook, type StreetRef } from "@/lib/street";

const EMPTY: StreetBook = {
  history: [],
  bids: [],
  asks: [],
  trades: [],
  bid: null,
  ask: null,
  last: null,
};

export function useStreetBook(
  ref: StreetRef | null,
  seed?: StreetBook | null,
): {
  book: StreetBook;
  loading: boolean;
} {
  const [book, setBook] = useState<StreetBook>(seed ?? EMPTY);
  const [loading, setLoading] = useState(Boolean(ref) && !(seed && seed.history.length + seed.bids.length > 0));

  useEffect(() => {
    if (!ref || !ref.venueKey) {
      setBook(EMPTY);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const hasSeed = Boolean(seed && (seed.history.length > 1 || seed.bids.length > 0));
    if (!hasSeed) setLoading(true);

    const run = () =>
      getStreetBook({
        data: {
          venue: ref.venue,
          venueKey: ref.venueKey,
          tokenYes: ref.tokenYes ?? "",
          conditionId: ref.conditionId ?? "",
          seriesTicker: ref.seriesTicker ?? "",
        },
      })
        .then((next) => {
          if (!cancelled) {
            setBook(next);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });

    void run();
    const id = window.setInterval(() => void run(), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [ref?.venue, ref?.venueKey, ref?.tokenYes, ref?.conditionId, ref?.seriesTicker]);

  return { book, loading };
}
