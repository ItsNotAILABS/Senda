/** Public headlines. Titles and the publisher link. Nothing is invented. */

import { createServerFn } from "@tanstack/react-start";

export type NewsDesk = "crypto" | "commodities" | "names" | "macro";
export type Headline = { title: string; source: string; url: string; desk: NewsDesk; at: number; blurb: string };

const FEEDS: Array<{ desk: NewsDesk; source: string; url: string }> = [
  { desk: "crypto", source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { desk: "crypto", source: "Cointelegraph", url: "https://cointelegraph.com/rss" },
  { desk: "crypto", source: "Decrypt", url: "https://decrypt.co/feed" },
  { desk: "crypto", source: "The Block", url: "https://www.theblock.co/rss.xml" },
  { desk: "crypto", source: "CryptoSlate", url: "https://cryptoslate.com/feed/" },
  { desk: "crypto", source: "Bitcoin Magazine", url: "https://bitcoinmagazine.com/feed" },
  { desk: "crypto", source: "The Defiant", url: "https://thedefiant.io/feed" },
  { desk: "crypto", source: "DL News", url: "https://www.dlnews.com/rss/" },
  { desk: "crypto", source: "Bitcoin.com", url: "https://news.bitcoin.com/feed/" },
  {
    desk: "crypto",
    source: "Wire",
    url: "https://news.google.com/rss/search?q=bitcoin+OR+ethereum+OR+solana+when:1d&hl=en-US&gl=US&ceid=US:en",
  },
  { desk: "commodities", source: "OilPrice", url: "https://oilprice.com/rss/main" },
  { desk: "commodities", source: "FT", url: "https://www.ft.com/commodities?format=rss" },
  { desk: "commodities", source: "CNBC", url: "https://www.cnbc.com/id/10000664/device/rss/rss.html" },
  { desk: "commodities", source: "BBC", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
  {
    desk: "commodities",
    source: "Wire",
    url: "https://news.google.com/rss/search?q=gold+OR+silver+OR+%22crude+oil%22+OR+copper+OR+commodities+when:1d&hl=en-US&gl=US&ceid=US:en",
  },
  {
    desk: "names",
    source: "Wire",
    url: "https://news.google.com/rss/search?q=SpaceX+OR+OpenAI+OR+Anthropic+OR+Anduril+OR+Neuralink+OR+Stripe+OR+xAI+OR+%22pre-IPO%22+when:7d&hl=en-US&gl=US&ceid=US:en",
  },
  { desk: "names", source: "TechCrunch", url: "https://techcrunch.com/feed/" },
  { desk: "names", source: "CNBC", url: "https://www.cnbc.com/id/19854910/device/rss/rss.html" },
  {
    desk: "macro",
    source: "Trading Economics",
    url: "https://news.google.com/rss/search?q=site:tradingeconomics.com+when:3d&hl=en-US&gl=US&ceid=US:en",
  },
  {
    desk: "macro",
    source: "Investing",
    url: "https://news.google.com/rss/search?q=site:investing.com+(gold+OR+oil+OR+fed+OR+nasdaq)+when:2d&hl=en-US&gl=US&ceid=US:en",
  },
  {
    desk: "macro",
    source: "MarketWatch",
    url: "https://news.google.com/rss/search?q=site:marketwatch.com+(stocks+OR+commodities+OR+fed)+when:1d&hl=en-US&gl=US&ceid=US:en",
  },
  {
    desk: "macro",
    source: "Reuters",
    url: "https://news.google.com/rss/search?q=site:reuters.com+(markets+OR+commodities+OR+currencies)+when:1d&hl=en-US&gl=US&ceid=US:en",
  },
];

const AMP = "&" + "amp;";
const LT = "&" + "lt;";
const GT = "&" + "gt;";
const QUOT = "&" + "quot;";
const APOS = "&" + "apos;";
const APOS39 = "&" + "#39;";

function decode(raw: string) {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .split(AMP).join("&")
    .split(LT).join("<")
    .split(GT).join(">")
    .split(QUOT).join('"')
    .split(APOS).join("'")
    .split(APOS39).join("'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function titles(xml: string, desk: NewsDesk, source: string): Headline[] {
  const out: Headline[] = [];
  for (const block of xml.split(/<(?:item|entry)[\s>]/i).slice(1, 13)) {
    const title = decode(block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
    const url = decode(
      block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ||
        block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] ||
        block.match(/<guid[^>]*>(https?:[\s\S]*?)<\/guid>/i)?.[1] ||
        "",
    );
    const stamp = decode(block.match(/<(?:pubDate|updated|published)[^>]*>([\s\S]*?)<\/(?:pubDate|updated|published)>/i)?.[1] || "");
    const blurb = decode(block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] || block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1] || "").slice(0, 180);
    const at = stamp ? Date.parse(stamp) || 0 : 0;
    const named = title.includes(" - ") ? title.split(" - ").slice(-1)[0]?.trim() : "";
    if (title) out.push({ title: title.replace(/ - [^-]+$/, "") || title, source: named && source === "Wire" ? named : source, url, desk, at, blurb });
  }
  return out;
}

let cached: { at: number; rows: Headline[] } | null = null;

export const loadHeadlines = createServerFn({ method: "GET" }).handler(async (): Promise<Headline[]> => {
  if (cached && Date.now() - cached.at < 20_000) return cached.rows;
  const batches = await Promise.all(
    FEEDS.map(async (feed) => {
      try {
        const r = await fetch(feed.url, {
          headers: {
            accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
            "user-agent": "Mozilla/5.0 (compatible; SendaDesk/1.0; +https://senda.pocketnova.app)",
          },
          signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) return [];
        return titles(await r.text(), feed.desk, feed.source);
      } catch {
        return [];
      }
    }),
  );
  const seen = new Set<string>();
  const rows: Headline[] = [];
  for (const batch of batches) {
    for (const row of batch) {
      const key = row.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }
  rows.sort((a, b) => b.at - a.at);
  cached = { at: Date.now(), rows };
  return rows;
});
