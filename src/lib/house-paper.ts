/** Paper longs/shorts on tokenized house names. Chips are notional $1. */

const KEY = "the-pit.house-pos.v1";

export type HousePos = { shares: number; cost: number };

export type HouseBook = Record<string, HousePos>;

export function loadHouseBook(): HouseBook {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as HouseBook;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveHouseBook(book: HouseBook): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(book));
  } catch {
    /* ignore */
  }
}

export function applyHouseDrop(
  book: HouseBook,
  id: string,
  side: "yes" | "no",
  spend: number,
  price: number,
): HouseBook {
  if (!(price > 0) || !(spend > 0)) return book;
  const shares = spend / price;
  const cur = book[id] ?? { shares: 0, cost: 0 };
  const next =
    side === "yes"
      ? { shares: cur.shares + shares, cost: cur.cost + spend }
      : { shares: cur.shares - shares, cost: cur.cost - spend };
  return { ...book, [id]: next };
}

export function markHouse(pos: HousePos | undefined, price: number): number {
  if (!pos) return 0;
  return pos.shares * price;
}
