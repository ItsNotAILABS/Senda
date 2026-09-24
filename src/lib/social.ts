/** Local social tape: your fills, copies, games. Same cash. */

const KEY = "senda.social.v1";

export type Post = {
  id: string;
  tag: string;
  kind: "trade" | "game" | "copy" | "perp" | "basket";
  text: string;
  symbol?: string;
  createdAt: string;
};

export function loadFeed(): Post[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as Post[];
    return Array.isArray(p) ? p.slice(0, 60) : [];
  } catch {
    return [];
  }
}

export function pushPost(rows: Post[], post: Omit<Post, "id" | "createdAt">): Post[] {
  const next = [{ ...post, id: `so${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString() }, ...rows].slice(0, 60);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
  return next;
}
