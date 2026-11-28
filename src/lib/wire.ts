/** Public headlines and the moves already on the book. No written story. */

import { createServerFn } from "@tanstack/react-start";

export type Headline = { title: string; link: string; source: string };

const FEEDS: { source: string; url: string }[] = [
  { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { source: "Cointelegraph", url: "https://cointelegraph.com/rss" },
];

export const loadHeadlines = createServerFn({ method: "GET" }).handler(async (): Promise<Headline[]> => {
  const batches = await Promise.all(
    FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.url, {
          headers: { accept: "application/rss+xml, application/xml, text/xml", "user-agent": "Senda" },
          redirect: "follow",
          signal: AbortSignal.timeout(8_000),
        });
        if (!res.ok) return [];
        const xml = await res.text();
        const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
        const rows: Headline[] = [];
        for (const item of items) {
          const title = text(item, "title");
          const link = text(item, "link");
          if (!title || !link.startsWith("https://")) continue;
          rows.push({ title, link, source: feed.source });
          if (rows.length >= 12) break;
        }
        return rows;
      } catch {
        return [];
      }
    }),
  );
  return batches.flat();
});

function text(block: string, tag: string): string {
  const raw = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`))?.[1] || "";
  return raw
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/"/g, '"')
    .replace(/<[^>]+>/g, "")
    .trim();
}
