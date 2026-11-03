/** Public YouTube channels. The player is YouTube's. Senda does not rehost the picture. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type Channel = { id: string; name: string; desk: "markets" | "crypto" | "world" };

export const CHANNELS: Channel[] = [
  { id: "UCyxnPZfofoutjmyvaV0GGeQ", name: "Bloomberg Television", desk: "markets" },
  { id: "UCIALMKvObZNtJ6AmdCLP7Lg", name: "Bloomberg Markets", desk: "markets" },
  { id: "UCH5_L3ytGbBziX0CLuYdQ1Q", name: "CNBC", desk: "markets" },
  { id: "UCEAZeUIeJs0IjQiqTCdVSIg", name: "Yahoo Finance", desk: "markets" },
  { id: "UCMliswJ7oukCeW35GSayhRA", name: "WSJ", desk: "markets" },
  { id: "UCNlCW7jh8dUV5sjAx8P-JcA", name: "Financial Times", desk: "markets" },
  { id: "UCXIJgqnII2ZOINSWNOGFThA", name: "Fox Business", desk: "markets" },
  { id: "UC7TghOL755nBk7HelHoi9LQ", name: "CoinDesk", desk: "crypto" },
  { id: "UCOZRnhGFjclZcBFHDoIn2Ig", name: "Cointelegraph", desk: "crypto" },
  { id: "UC-dmTM1R31S8uFgPmexxkNg", name: "Decrypt", desk: "crypto" },
  { id: "UCnThE8FLrlN-tYvZhZL0uaA", name: "Coin Bureau", desk: "crypto" },
  { id: "UCCRxYlYOmLE2l5wxs3ckJtg", name: "Bankless", desk: "crypto" },
  { id: "UCr6ZZ2qD4ZPM-15mdTPI6PA", name: "Solana", desk: "crypto" },
  { id: "UCWPil6c2lnmMbh2cJRwuHzQ", name: "Milk Road", desk: "crypto" },
  { id: "UChqUTb7kYRX8-EiaN3XFrSQ", name: "Reuters", desk: "world" },
  { id: "UCkFclpi8U9VJjfxLYoms7Aw", name: "Sky News", desk: "world" },
  { id: "UCfiwzLy-8yKzIbsmZTzxDgw", name: "Al Jazeera", desk: "world" },
  { id: "UChDKyKQ59fYz3JO2fl0Z6sg", name: "NBC News", desk: "world" },
];

export type Clip = { id: string; title: string; channel: string; channelId: string };

function decode(value: string) {
  return value
    .replace(/&/g, "&")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/</g, "<")
    .replace(/>/g, ">");
}

function fromFeed(xml: string, channel: Channel): Clip[] {
  return xml
    .split("<entry>")
    .slice(1, 3)
    .map((entry) => {
      const id = entry.match(/<yt:videoId>([^<]+)/)?.[1] ?? "";
      const title = decode(entry.match(/<title>([^<]+)/)?.[1] ?? "");
      return { id, title, channel: channel.name, channelId: channel.id };
    })
    .filter((clip) => clip.id.length === 11);
}

export const loadTv = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await Promise.all(
    CHANNELS.map(async (channel) => {
      try {
        const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`, {
          headers: { accept: "application/atom+xml", "user-agent": "Senda" },
          signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) return [];
        return fromFeed(await r.text(), channel);
      } catch {
        return [];
      }
    }),
  );
  return rows.flat();
});

export const searchTv = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ q: z.string().trim().min(2).max(80) }).parse(input))
  .handler(async ({ data }) => {
    const r = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(data.q)}&sp=EgIQAQ%3D%3D`, {
      headers: { "user-agent": "Mozilla/5.0", accept: "text/html" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error("YouTube did not answer.");
    const html = await r.text();
    const clips: Clip[] = [];
    const seen = new Set<string>();
    const re = /"videoId":"([\w-]{11})"([\s\S]{0,700}?)?"title":\{"runs":\[\{"text":"((?:\\.|[^"\\]){2,180})"/g;
    for (const hit of html.matchAll(re)) {
      const id = hit[1];
      if (seen.has(id)) continue;
      seen.add(id);
      clips.push({
        id,
        title: decode(hit[3].replace(/\\u0026/g, "&").replace(/\\"/g, '"')),
        channel: "YouTube",
        channelId: "",
      });
      if (clips.length >= 12) break;
    }
    if (!clips.length) throw new Error("Nothing came back for that.");
    return clips;
  });
