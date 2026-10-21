/** What is on in this browser. The agent reads the same row. */

const KEY = "senda.tv.v1";

export type Watch = {
  id: string;
  title: string;
  channel: string;
  live: boolean;
};

export function readWatch(): Watch | null {
  if (typeof window === "undefined") return null;
  try {
    const row = JSON.parse(window.localStorage.getItem(KEY) || "") as Watch;
    return row?.id ? row : null;
  } catch {
    return null;
  }
}

export function writeWatch(row: Watch) {
  window.localStorage.setItem(KEY, JSON.stringify(row));
  window.dispatchEvent(new Event("senda-tv"));
}
