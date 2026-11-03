import { useEffect, useRef, useState, type FormEvent } from "react";
import Hls from "hls.js";
import { toast } from "sonner";
import { searchTv, loadTv, type Clip } from "@/lib/tv";
import { writeWatch } from "@/lib/tv-watch";
import { NewsWire } from "@/components/news-wire";
import { cn } from "@/lib/utils";

const DESKS = [
  { id: "bloomberg-us", name: "Bloomberg" },
  { id: "bloomberg-eu", name: "Bloomberg Europe" },
  { id: "bloomberg-plus", name: "Bloomberg TV+" },
  { id: "yahoo", name: "Yahoo Finance" },
  { id: "cnbc-eu", name: "CNBC Europe" },
  { id: "reuters", name: "Reuters" },
  { id: "abc", name: "ABC News" },
  { id: "cbs", name: "CBS News" },
  { id: "nbc", name: "NBC News Now" },
  { id: "fox", name: "LiveNOW Fox" },
  { id: "jazeera", name: "Al Jazeera" },
  { id: "cheddar", name: "Cheddar" },
  { id: "dw", name: "DW" },
] as const;

export function TvDesk() {
  const video = useRef<HTMLVideoElement>(null);
  const [desk, setDesk] = useState<(typeof DESKS)[number]["id"]>("bloomberg-us");
  const [err, setErr] = useState("");
  const [clip, setClip] = useState<Clip | null>(null);
  const [found, setFound] = useState<Clip[]>([]);
  const [crypto, setCrypto] = useState<Clip[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const on = DESKS.find((d) => d.id === desk) ?? DESKS[0];

  useEffect(() => {
    const el = video.current;
    if (clip) {
      el?.pause();
      return;
    }
    if (!el) return;
    writeWatch({ id: on.id, title: "Live", channel: on.name, live: true });
    setErr("");
    const src = `/api/tv?c=${on.id}`;
    el.muted = true;
    if (el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = src;
      void el.play().catch(() => undefined);
      return;
    }
    if (!Hls.isSupported()) {
      setErr("This browser cannot play the live picture.");
      return;
    }
    const hls = new Hls({ liveDurationInfinity: true, backBufferLength: 30 });
    hls.loadSource(src);
    hls.attachMedia(el);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      void el.play().catch(() => undefined);
    });
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (data.fatal) setErr("This desk didn't answer.");
    });
    return () => hls.destroy();
  }, [on.id, on.name, clip]);

  useEffect(() => {
    let live = true;
    loadTv()
      .then((rows) => {
        if (!live) return;
        setCrypto(rows.filter((row) => ["CoinDesk", "Cointelegraph", "Decrypt", "Coin Bureau", "Bankless", "Solana", "Milk Road"].includes(row.channel)));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  function putClip(row: Clip) {
    setClip(row);
    writeWatch({ id: row.id, title: row.title, channel: row.channel, live: false });
  }

  async function lookUp(e: FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (query.length < 2) return;
    setBusy(true);
    try {
      const rows = await searchTv({ data: { q: query } });
      setFound(rows);
      if (rows[0]) putClip(rows[0]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Search did not answer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 px-3 py-3 lg:px-4">
      <section className="overflow-hidden rounded-[22px] border border-white/10 bg-black">
        <div className="flex gap-1 overflow-x-auto border-b border-white/10 bg-[#10131c] px-2 py-2">
          {DESKS.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                setClip(null);
                setDesk(row.id);
              }}
              className={cn(
                "min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold",
                desk === row.id && !clip ? "bg-accent text-accent-fg" : "text-muted hover:bg-white/10",
              )}
            >
              {row.name}
            </button>
          ))}
        </div>
        <div className="relative bg-black">
          <video ref={video} controls playsInline className={cn("aspect-video w-full bg-black", clip && "hidden")} />
          {clip ? (
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <iframe
                key={clip.id}
                src={`https://www.youtube-nocookie.com/embed/${clip.id}?autoplay=1`}
                title={clip.title}
                className="absolute inset-0 h-full w-full"
                allow="autoplay; encrypted-media; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : null}
          {err && !clip ? <p className="absolute bottom-4 left-4 rounded-full bg-black/70 px-3 py-1 text-xs text-white">{err}</p> : null}
        </div>
        <div className="flex items-center justify-between gap-3 bg-[#10131c] px-4 py-3">
          <p className="text-sm font-semibold">{clip ? clip.title : on.name}</p>
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">{clip ? "Video" : "Live"}</p>
        </div>
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
        <p className="font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">YouTube</p>
        <form onSubmit={(e) => void lookUp(e)} className="mt-3 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Look up a video"
            className="min-h-12 min-w-0 flex-1 rounded-full border border-white/10 bg-black/40 px-4 text-sm outline-none"
          />
          <button type="submit" disabled={busy} className="min-h-12 rounded-full bg-white px-5 text-sm font-semibold text-black disabled:opacity-50">
            {busy ? "Looking…" : "Play"}
          </button>
        </form>
        {found.length > 0 ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {found.map((row) => (
              <li key={row.id}>
                <button type="button" onClick={() => putClip(row)} className="w-full rounded-2xl bg-black/40 px-3 py-3 text-left">
                  <p className="line-clamp-2 text-sm font-semibold">{row.title}</p>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-muted">The picture above is the live desk. This is only for a video you look up.</p>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between px-1">
          <p className="text-sm font-semibold">Crypto</p>
          <p className="text-[11px] tracking-[0.14em] text-white/40 uppercase">Latest from the channels</p>
        </div>
        <ul className="flex gap-2 overflow-x-auto">
          {crypto.map((row) => (
            <li key={row.id} className="w-40 shrink-0">
              <button type="button" onClick={() => putClip(row)} className="w-full overflow-hidden rounded-2xl bg-[#10131c] text-left">
                <img src={`https://i.ytimg.com/vi/${row.id}/hqdefault.jpg`} alt="" className="aspect-video w-full object-cover" />
                <span className="block px-2 py-2 text-[11px] text-white/45">{row.channel}</span>
                <span className="line-clamp-2 block px-2 pb-3 text-xs font-semibold">{row.title}</span>
              </button>
            </li>
          ))}
        </ul>
        {crypto.length === 0 ? <p className="mt-2 text-xs text-white/40">The crypto channels have not answered yet.</p> : null}
      </section>

      <NewsWire desk="crypto" limit={12} />
    </div>
  );
}
