import { useEffect, useState } from "react";
import { dropVow, listVows, movePct, researchOk, reward, saveVow, type Vow } from "@/lib/conviction";
import { SOL } from "@/lib/jup-sign";
import { cn } from "@/lib/utils";

const KNOWN: Record<string, string> = {
  SOL,
  INF: "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm",
  BSOL: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1",
  JSOL: "7Q2afV64in6N6SeZsAAB81TJzwDoD6zpqmHkzi9Dcavn",
  HSOL: "he1iusmfkpAdwvxLNGV8Y1iSbj4rUy6yMhEA3fotn9A",
  JUPSOL: "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v",
};

function money(n: number): string {
  if (!(n > 0)) return "—";
  if (n < 1) return `$${n.toPrecision(3)}`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: n >= 100 ? 2 : 4 })}`;
}

function age(at: number): string {
  const mins = Math.max(0, Date.now() - at) / 60_000;
  if (mins < 60) return `${Math.max(1, Math.round(mins))}m`;
  if (mins < 60 * 48) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

async function mintFor(symbol: string): Promise<string | null> {
  const known = KNOWN[symbol];
  if (known) return known;
  const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(symbol)}`);
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ id?: string; symbol?: string; liquidity?: number }>;
  const hits = (Array.isArray(rows) ? rows : []).filter((row) => (row.symbol || "").toUpperCase() === symbol && row.id);
  hits.sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0));
  return hits[0]?.id || null;
}

async function prices(mints: string[]): Promise<Record<string, number>> {
  if (!mints.length) return {};
  const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${mints.join(",")}`);
  if (!res.ok) return {};
  const body = (await res.json()) as Record<string, { usdPrice?: number }>;
  const out: Record<string, number> = {};
  for (const mint of mints) {
    const px = Number(body[mint]?.usdPrice);
    if (px > 0) out[mint] = px;
  }
  return out;
}

export function ConvictionDesk() {
  const [symbol, setSymbol] = useState("SOL");
  const [side, setSide] = useState<"long" | "short">("long");
  const [size, setSize] = useState("25");
  const [thesis, setThesis] = useState("");
  const [mark, setMark] = useState(0);
  const [markLine, setMarkLine] = useState("");
  const [rows, setRows] = useState<Vow[]>([]);
  const [now, setNow] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const ready = researchOk(thesis);

  function load() {
    setRows(listVows());
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const mints = [...new Set(rows.map((row) => row.mint))];
    if (!mints.length) return;
    let live = true;
    const pull = () => {
      prices(mints).then((book) => live && setNow(book)).catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 20_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [rows]);

  useEffect(() => {
    const name = symbol.trim().toUpperCase();
    if (!name) return;
    let live = true;
    setMark(0);
    setMarkLine("Reading the live mark.");
    mintFor(name)
      .then(async (mint) => {
        if (!live) return;
        if (!mint) {
          setMarkLine("That name is not a Jupiter token. No mark, no conviction.");
          return;
        }
        const book = await prices([mint]);
        if (!live) return;
        const px = book[mint];
        if (!(px > 0)) {
          setMarkLine("Jupiter did not price it.");
          return;
        }
        setMark(px);
        setMarkLine("");
      })
      .catch(() => live && setMarkLine("The mark did not come back."));
    return () => {
      live = false;
    };
  }, [symbol]);

  async function commit() {
    const name = symbol.trim().toUpperCase();
    const usd = Number(size);
    if (!ready || !(usd > 0) || !name) return;
    setBusy(true);
    try {
      const mint = await mintFor(name);
      if (!mint) {
        setMarkLine("That name is not a Jupiter token. No mark, no conviction.");
        return;
      }
      const book = await prices([mint]);
      const entry = book[mint];
      if (!(entry > 0)) {
        setMarkLine("Jupiter did not price it.");
        return;
      }
      const saved = saveVow({ symbol: name, mint, side, size: usd, entry, thesis });
      if (!saved) return;
      setMark(entry);
      setThesis("");
      load();
      setNow((cur) => ({ ...cur, [mint]: entry }));
    } finally {
      setBusy(false);
    }
  }

  const ranked = rows
    .map((row) => {
      const live = now[row.mint] || 0;
      const move = live > 0 ? movePct(row.side, row.entry, live) : null;
      const pay = move == null ? 0 : reward(move, Date.now() - row.at);
      return { row, live, move, pay };
    })
    .sort((a, b) => b.pay - a.pay || b.row.at - a.row.at);

  return (
    <div className="space-y-3 p-3 pb-28">
      <p className="text-sm leading-snug text-white/60">
        Write the research. Then a side and a dollar size, stamped at the live mark. The reward is the move your way after that, and it grows only while that research keeps standing. A flat or wrong mark pays nothing. The size is a record, not an order.
      </p>
      <label className="block text-xs text-white/45">
        Name
        <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} className="mt-1 min-h-12 w-full rounded-2xl bg-[#1c1c1e] px-4 font-mono text-lg outline-none" />
      </label>
      <p className="font-mono text-2xl tabular-nums">{mark > 0 ? money(mark) : "—"}</p>
      {markLine ? <p className="text-sm text-white/50">{markLine}</p> : null}
      <div className="flex gap-2">
        {(["long", "short"] as const).map((id) => (
          <button key={id} type="button" onClick={() => setSide(id)} className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold capitalize", side === id ? "bg-white text-black" : "bg-[#2a2a2e]")}>
            {id}
          </button>
        ))}
      </div>
      <label className="block text-xs text-white/45">
        Size, a record in dollars
        <input value={size} onChange={(e) => setSize(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="mt-1 min-h-12 w-full rounded-2xl bg-[#1c1c1e] px-4 font-mono text-lg outline-none" />
      </label>
      <label className="block text-xs text-white/45">
        Research
        <textarea value={thesis} onChange={(e) => setThesis(e.target.value)} placeholder="Why this, why now, and what would prove you wrong." className="mt-1 min-h-28 w-full rounded-2xl bg-[#1c1c1e] px-4 py-3 text-sm leading-snug outline-none" />
      </label>
      <p className={cn("text-xs", ready ? "text-[#c6f56a]" : "text-white/40")}>{ready ? "Research holds." : "A few sentences. A ticker is not research."}</p>
      <button type="button" disabled={busy || !ready || !(mark > 0) || !(Number(size) > 0)} onClick={() => void commit()} className="min-h-12 w-full rounded-full bg-[#c6f56a] text-sm font-semibold text-black disabled:opacity-40">
        {busy ? "Reading the mark" : "Commit at this mark"}
      </button>
      <ul className="divide-y divide-white/10">
        {ranked.map(({ row, live, move, pay }) => (
          <li key={row.id} className="py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold">{row.symbol} · {row.side} · ${row.size} record</p>
              <p className={cn("font-mono text-sm", pay > 0 ? "text-[#c6f56a]" : "text-white/50")}>
                {move == null ? "—" : `${move >= 0 ? "+" : ""}${move.toFixed(2)}%`}
              </p>
            </div>
            <p className="mt-1 font-mono text-[11px] text-white/40">
              In at {money(row.entry)} · now {live > 0 ? money(live) : "—"} · stood {age(row.at)}
              {pay > 0 ? ` · reward ${pay.toFixed(2)}` : move != null && move < 0 ? " · pays nothing" : " · no reward yet"}
            </p>
            <p className="mt-1 text-sm leading-snug text-white/60">{row.thesis}</p>
            <button type="button" onClick={() => { dropVow(row.id); load(); }} className="mt-2 min-h-10 text-xs text-white/40">Drop</button>
          </li>
        ))}
        {ranked.length === 0 ? <li className="py-3 text-sm text-white/45">Nothing committed. The clock starts at the mark, not at the idea.</li> : null}
      </ul>
      <p className="text-[11px] leading-snug text-white/35">Reward is the percent your way, times how long the research has stood. The first moment is just the move. Nothing is paid out.</p>
    </div>
  );
}
