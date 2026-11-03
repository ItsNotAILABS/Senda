import { createHmac, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";

/** Live desks. The first request is a channel id. Every later request is a signed playlist or segment. */
const DESKS: Record<string, string> = {
  "bloomberg-us": "https://bloomberg.com/media-manifest/streams/us.m3u8",
  "bloomberg-eu": "https://bloomberg.com/media-manifest/streams/eu.m3u8",
  "bloomberg-plus": "https://bloomberg.com/media-manifest/streams/phoenix-us.m3u8",
  yahoo: "https://d1ewctnvcwvvvu.cloudfront.net/playlist.m3u8",
  "cnbc-eu": "https://amg01079-nbcuuk-amg01079c1-samsung-es-1261.playouts.now.amagi.tv/playlist/amg01079-nbcuukfast-cnbcpe-samsunges/playlist.m3u8",
  reuters: "https://amg00453-reuters-amg00453c1-rakuten-uk-2110.playouts.now.amagi.tv/playlist/amg00453-reuters-reuters-rakutenuk/playlist.m3u8",
  abc: "https://abcnews-streams.akamaized.net/hls/live/2023560/abcnewshudson1/master.m3u8",
  cbs: "https://cbsnews.akamaized.net/hls/live/2020607/cbsnlineup_8/master.m3u8",
  nbc: "https://d1si3n1st4nkgb.cloudfront.net/10502/88896001/hls/master.m3u8?ads.xumo_channelId=88896001",
  fox: "https://fox-foxnewsnow-vizio.amagi.tv/playlist.m3u8",
  jazeera: "https://live-hls-apps-aje-fa.getaj.net/AJE/index.m3u8",
  cheddar: "https://hls.livecdn.io/cheddar.com/cheddar/playlist.m3u8",
  dw: "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8",
};

const SECRET = "senda-tv-live";

function sign(url: string) {
  return createHmac("sha256", SECRET).update(url).digest("base64url");
}

function signed(url: string, token: string) {
  const expect = sign(url);
  const a = Buffer.from(expect);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

function gate(url: string) {
  return `/api/tv?u=${encodeURIComponent(url)}&t=${sign(url)}`;
}

function rewrite(body: string, base: string) {
  const root = new URL(base);
  return body
    .split("\n")
    .map((line) => {
      const raw = line.trim();
      if (!raw) return line;
      if (raw.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_, uri: string) => `URI="${gate(new URL(uri, root).toString())}"`);
      }
      return gate(new URL(raw, root).toString());
    })
    .join("\n");
}

export const Route = createFileRoute("/api/tv")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const q = new URL(request.url).searchParams;
        const channel = q.get("c") || "";
        const pointed = q.get("u") || "";
        const token = q.get("t") || "";
        let target = "";
        if (channel && DESKS[channel]) target = DESKS[channel];
        else if (pointed.startsWith("https://") && signed(pointed, token)) target = pointed;
        else return new Response("No desk.", { status: 400 });
        let upstream: Response;
        try {
          upstream = await fetch(target, {
            headers: { "user-agent": "Senda", accept: "*/*" },
            redirect: "follow",
            signal: AbortSignal.timeout(12_000),
          });
        } catch {
          return new Response("The desk did not answer.", { status: 502 });
        }
        if (!upstream.ok) return new Response("The desk did not answer.", { status: 502 });
        const type = upstream.headers.get("content-type") || "";
        const playlist = type.includes("mpegurl") || type.includes("m3u8") || target.includes(".m3u8") || target.includes("manifest");
        if (playlist) {
          const text = await upstream.text();
          if (!text.trimStart().startsWith("#EXTM3U")) return new Response("Not a picture.", { status: 502 });
          return new Response(rewrite(text, target), {
            headers: {
              "content-type": "application/vnd.apple.mpegurl",
              "cache-control": "no-store",
            },
          });
        }
        return new Response(upstream.body, {
          headers: {
            "content-type": type || "video/mp2t",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
