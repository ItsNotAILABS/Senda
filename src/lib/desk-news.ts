import { createServerFn } from "@tanstack/react-start";

export type DeskHeadline = {
  id: string;
  title: string;
  body: string;
  source: string;
  url: string;
  image?: string;
  at: string;
};

const FEEDS: { source: string; url: string }[] = [
  { source: "Cointelegraph", url: "https://cointelegraph.com/rss" },
  { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml" },
  { source: "The Block", url: "https://www.theblock.co/rss.xml" },
];

function field(block: string, tag: string): string {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(block);
  if (!m) return "";
  return m[1]
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&/g, "&")
    .replace(/"/g, '"')
    .replace(/&#39;|'/g, "'")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function parse(xml: string, source: string): DeskHeadline[] {
  const out: DeskHeadline[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) && out.length < 8) {
    const block = m[1];
    const title = field(block, "title");
    const link = field(block, "link").split("?")[0];
    if (!title || !link.startsWith("http")) continue;
    const img =
      /<media:content[^>]*url="([^"]+)"/i.exec(block)?.[1] ||
      /<img[^>]+src="([^"]+)"/i.exec(block)?.[1];
    out.push({
      id: link,
      title,
      body: field(block, "description").slice(0, 320),
      source,
      url: link,
      image: img && img.startsWith("http") ? img : undefined,
      at: field(block, "pubDate"),
    });
  }
  return out;
}

let cache: { at: number; rows: DeskHeadline[] } | null = null;

async function load(): Promise<DeskHeadline[]> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.rows;
  const batches = await Promise.all(
    FEEDS.map(async (feed) => {
      try {
        const r = await fetch(feed.url, {
          headers: { accept: "application/rss+xml, application/xml, text/xml", "user-agent": "Senda/1.0" },
          signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) return [];
        return parse(await r.text(), feed.source);
      } catch {
        return [];
      }
    }),
  );
  const seen = new Set<string>();
  const rows: DeskHeadline[] = [];
  for (const batch of batches) {
    for (const row of batch) {
      if (seen.has(row.title)) continue;
      seen.add(row.title);
      rows.push(row);
    }
  }
  rows.sort((a, b) => Date.parse(b.at || "0") - Date.parse(a.at || "0"));
  const next = rows.slice(0, 18);
  if (next.length) cache = { at: Date.now(), rows: next };
  return next;
}

export const deskNews = createServerFn({ method: "GET" }).handler(async () => load());
