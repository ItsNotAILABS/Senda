import { useEffect, useState } from "react";
import { loadHeadlines, type Headline, type NewsDesk } from "@/lib/headlines";
import { cn } from "@/lib/utils";

const FACES: Array<[NewsDesk | "all", string]> = [
  ["all", "All"],
  ["crypto", "Crypto"],
  ["commodities", "Commodities"],
  ["names", "PreStocks"],
  ["macro", "Macro"],
];

const TAGS = ["BTC", "ETH", "SOL", "GOLD", "OIL", "FED", "OPENAI", "SPACEX", "SEC"];

let last: { rows: Headline[]; at: number } = { rows: [], at: 0 };
let inflight: Promise<Headline[]> | null = null;
let timer: number | null = null;
const listeners = new Set<(rows: Headline[], at: number) => void>();

function pull() {
  if (!inflight) {
    inflight = loadHeadlines()
      .then((rows) => {
        last = { rows, at: Date.now() };
        listeners.forEach((fn) => fn(rows, last.at));
        return rows;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

function watch(fn: (rows: Headline[], at: number) => void) {
  listeners.add(fn);
  if (last.rows.length) fn(last.rows, last.at);
  void pull().catch(() => undefined);
  if (timer == null) timer = window.setInterval(() => void pull().catch(() => undefined), 30_000);
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && timer != null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

function ago(at: number, now: number) {
  if (!at) return "";
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function band(at: number, now: number) {
  if (!at) return "Earlier";
  if (now - at < 45 * 60 * 1000) return "Breaking";
  if (now - at < 18 * 60 * 60 * 1000) return "Today";
  return "Earlier";
}

export function NewsWire({
  desk = "all",
  query = "",
  limit = 16,
  bare = false,
}: {
  desk?: NewsDesk | "all";
  query?: string;
  limit?: number;
  bare?: boolean;
}) {
  const [rows, setRows] = useState<Headline[]>(last.rows);
  const [ready, setReady] = useState(last.rows.length > 0);
  const [pulled, setPulled] = useState(last.at);
  const [now, setNow] = useState(() => Date.now());
  const [face, setFace] = useState<NewsDesk | "all">(desk);
  const [source, setSource] = useState("All");
  const [tag, setTag] = useState("");
  const [q, setQ] = useState(query);
  const needle = (query || q).trim().toLowerCase();
  const words = needle.split(/\s+/).filter((w) => w.length > 2);

  useEffect(() => watch((next, at) => {
    setRows(next);
    setPulled(at);
    setReady(true);
  }), []);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const onVis = () => {
      if (document.visibilityState === "visible") void pull().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => setSource("All"), [face]);

  const pool = rows.filter((h) => face === "all" || h.desk === face);
  const sources = ["All", ...Array.from(new Set(pool.map((h) => h.source)))];
  const sourced = source === "All" ? pool : pool.filter((h) => h.source === source);
  const tagged = tag ? sourced.filter((h) => `${h.title} ${h.blurb}`.toUpperCase().includes(tag)) : sourced;
  const hit = words.length ? tagged.filter((h) => words.some((w) => `${h.title} ${h.blurb}`.toLowerCase().includes(w))) : tagged;
  const shown = (hit.length ? hit : tagged).slice(0, limit);
  const fresh = pulled > 0 && now - pulled < 45_000;
  let lastBand = "";

  return (
    <section className={cn("rounded-[22px] bg-[#10131c]", bare ? "p-0" : "p-4")}>
      <div className={cn("flex items-center gap-2", bare ? "pb-2" : "")}>
        <span className={cn("size-1.5 rounded-full", fresh ? "bg-[#c6f56a]" : "bg-white/30")} />
        <p className="text-[11px] tracking-[0.14em] text-white/45 uppercase">
          {pulled ? `Live · ${ago(pulled, now)} · ${pool.length} wires` : "Asking the wires"}
        </p>
      </div>
      {bare ? null : (
        <>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the wire"
            className="mt-3 min-h-11 w-full rounded-full bg-black/40 px-4 text-sm outline-none placeholder:text-white/35"
          />
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {FACES.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFace(id)}
                className={cn("min-h-9 shrink-0 rounded-full px-4 text-sm font-semibold", face === id ? "bg-white text-black" : "bg-[#2a2a2e] text-white/75")}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto">
            <button type="button" onClick={() => setTag("")} className={cn("min-h-8 shrink-0 rounded-full px-3 text-xs font-semibold", tag === "" ? "bg-[#d7e36a] text-black" : "text-white/55")}>
              Any
            </button>
            {TAGS.map((id) => (
              <button key={id} type="button" onClick={() => setTag(tag === id ? "" : id)} className={cn("min-h-8 shrink-0 rounded-full px-3 text-xs font-semibold", tag === id ? "bg-[#d7e36a] text-black" : "text-white/55")}>
                {id}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto">
            {sources.slice(0, 14).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setSource(id)}
                className={cn("min-h-8 shrink-0 rounded-full px-3 text-xs font-semibold", source === id ? "bg-white text-black" : "text-white/45")}
              >
                {id}
              </button>
            ))}
          </div>
        </>
      )}
      {needle && hit.length === 0 && sourced.length > 0 ? <p className="mt-3 text-xs text-white/45">Nothing on that search. The rest of the wire is below.</p> : null}
      <ul className={cn(bare ? "" : "mt-3")}>
        {shown.map((h) => {
          const group = band(h.at, now);
          const head = group !== lastBand;
          lastBand = group;
          return (
            <li key={`${h.desk}-${h.source}-${h.title}`}>
              {bare || !head ? null : <p className="pt-3 text-[11px] tracking-[0.16em] text-[#c6f56a] uppercase">{group}</p>}
              <a href={h.url || undefined} target="_blank" rel="noreferrer" className="block border-t border-white/10 py-3">
                <span className="block text-[15px] leading-snug">{h.title}</span>
                {h.blurb && h.blurb.toLowerCase() !== h.title.toLowerCase() ? <span className="mt-1 block text-xs leading-snug text-white/45">{h.blurb}</span> : null}
                <span className="mt-1 block text-[11px] tracking-[0.14em] text-white/40 uppercase">
                  {h.source}
                  {h.at ? ` · ${ago(h.at, now)}` : ""} · {h.desk === "names" ? "PreStocks" : h.desk}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      {ready && shown.length === 0 ? <p className="py-4 text-sm text-white/45">The wire has not come back yet.</p> : null}
    </section>
  );
}
