/** The company the person is actually using. Every tab reads this. */

const KEY = "senda.using.v1";

export type Using = {
  symbol: string;
  name: string;
  last: number;
  premium: number | null;
  mint: string;
};

export function readUsing(): Using | null {
  if (typeof window === "undefined") return null;
  try {
    const row = JSON.parse(window.localStorage.getItem(KEY) || "") as Using;
    return row?.symbol ? row : null;
  } catch {
    return null;
  }
}

export function writeUsing(row: Using) {
  window.localStorage.setItem(KEY, JSON.stringify(row));
  window.dispatchEvent(new Event("senda-using"));
}
