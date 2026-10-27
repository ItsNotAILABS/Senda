import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { noteFill } from "@/lib/account-book";
import { FillButton } from "@/components/fill-button";
import { openOstium } from "@/lib/ostium-trade";
import { ostiumBook, type WorldLane, type WorldRow } from "@/lib/world-book";
import { cn } from "@/lib/utils";

const LANES: { id: WorldLane | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "fx", label: "FX" },
  { id: "metals", label: "Metals" },
  { id: "energy", label: "Energy" },
  { id: "softs", label: "Softs" },
  { id: "index", label: "Index" },
  { id: "crypto", label: "Crypto" },
  { id: "shares", label: "Shares" },
];

function money(n: number | null) {
  if (n == null || !(n > 0)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toPrecision(4);
}

export function OstiumBook() {
  const [rows, setRows] = useState<WorldRow[]>([]);
  const [lane, setLane] = useState<WorldLane | "all">("all");
  const [q, setQ] = useState("");
  const [usd, setUsd] = useState(10);
  const [lev, setLev] = useState(2);
  const [busy, setBusy] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    let live = true;
    const pull = () => {
      ostiumBook()
        .then((list) => live && setRows(list))
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 20_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (lane !== "all" && row.lane !== lane) return false;
      if (!query) return true;
      return `${row.id} ${row.base} ${row.hold?.symbol ?? ""}`.toLowerCase().includes(query);
    });
  }, [rows, lane, q]);
  const pages = Math.max(1, Math.ceil(shown.length / 24));
  const safe = Math.min(page, pages - 1);
  const view = shown.slice(safe * 24, safe * 24 + 24);

  async function trade(row: WorldRow, buy: boolean) {
    if (row.pairIndex == null || row.mid == null) return;
    const useLev = row.maxLeverage != null && row.maxLeverage > 0 ? Math.min(lev, row.maxLeverage) : lev;
    setBusy(`${row.id}:${buy ? "long" : "short"}`);
    try {
      const hash = await openOstium({
        pairIndex: row.pairIndex,
        buy,
        collateral: usd,
        leverage: useLev,
        price: row.mid,
      });
      noteFill({ desk: "ostium", symbol: row.base, side: buy ? "buy" : "sell", usd, sig: hash });
      toast.success(`${buy ? "Long" : "Short"} ${row.base} sent. ${hash.slice(0, 10)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Arbitrum did not take the order.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="px-3 py-3">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Ostium</p>
      <h2 className="mt-1 text-2xl font-semibold">{rows.filter((r) => r.pairIndex != null).length || rows.length || "—"} markets</h2>
      <p className="mt-1 text-sm text-white/55">Long and short clear in USDC on Arbitrum. Phantom or MetaMask signs. A Solana token, when there is one, is a separate buy.</p>
      <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search the book" className="mt-3 min-h-11 w-full rounded-full bg-[#1c1c1e] px-4 text-sm outline-none" />
      <div className="mt-3 flex gap-1 overflow-x-auto">
        {LANES.map((item) => (
          <button key={item.id} type="button" onClick={() => { setLane(item.id); setPage(0); }} className={cn("min-h-8 shrink-0 rounded-full px-3 text-xs font-semibold", lane === item.id ? "bg-white text-black" : "bg-white/10 text-white/70")}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        {[10, 25, 50].map((n) => (
          <button key={n} type="button" onClick={() => setUsd(n)} className={cn("grid size-11 place-items-center rounded-full text-sm font-semibold", usd === n ? "bg-white text-black" : "border border-white/15")}>
            ${n}
          </button>
        ))}
        {[2, 5, 10].map((n) => (
          <button key={n} type="button" onClick={() => setLev(n)} className={cn("grid size-11 place-items-center rounded-full text-sm font-semibold", lev === n ? "bg-white text-black" : "border border-white/15")}>
            {n}x
          </button>
        ))}
      </div>
      <ul className="mt-3 space-y-2">
        {view.map((row) => (
          <li key={row.id} className="rounded-2xl border border-white/10 bg-black px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap gap-1">
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase">{row.lane}</span>
                  <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/60">Arbitrum</span>
                  {row.hold ? <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/60">Solana hold</span> : null}
                  <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/60">{row.open === false ? "Closed" : row.pairIndex != null ? "Signs" : "Price"}</span>
                </div>
                <p className="mt-2 font-semibold">{row.base}<span className="text-white/40">/{row.quote}</span></p>
                <p className="text-xs text-white/45">
                  {row.id}
                  {row.maxLeverage ? ` · up to ${row.maxLeverage}x` : ""}
                  {row.hold ? ` · ${row.hold.symbol} on Solana` : ""}
                  {row.open === false ? " · Closed" : row.open ? " · Open" : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm">{money(row.mid)}</p>
                <p className="font-mono text-[11px] text-white/40">{money(row.bid)} / {money(row.ask)}</p>
                <button
                  type="button"
                  onClick={() => {
                    const text = `${row.base}/${row.quote}\n${row.lane} · Arbitrum · ${row.pairIndex != null ? "signs" : "price"}\n${money(row.mid)}`;
                    if (typeof navigator.share === "function") void navigator.share({ title: `${row.base}/${row.quote}`, text }).catch(() => undefined);
                    else void navigator.clipboard.writeText(text).then(() => toast.success("Card copied."));
                  }}
                  className="mt-2 text-[11px] font-semibold text-white/70"
                >
                  Share
                </button>
              </div>
            </div>
            {row.pairIndex != null && row.mid != null && row.open !== false ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" disabled={busy !== ""} onClick={() => void trade(row, true)} className="min-h-10 rounded-full bg-[#d7e36a] text-sm font-semibold text-black">
                  {busy === `${row.id}:long` ? "…" : `Long $${usd}`}
                </button>
                <button type="button" disabled={busy !== ""} onClick={() => void trade(row, false)} className="min-h-10 rounded-full bg-[#e23b4a] text-sm font-semibold text-white">
                  {busy === `${row.id}:short` ? "…" : `Short $${usd}`}
                </button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-white/40">{row.open === false ? "Session is closed." : row.pairIndex == null ? "Price only. This name is not on the Arbitrum book." : "Waiting on a price."}</p>
            )}
            {row.hold ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <FillButton mint={row.hold.mint} usd={usd} price={row.spot ?? row.mid ?? undefined} symbol={row.hold.symbol} label={`Buy $${usd} ${row.hold.symbol}`} className="min-h-10 rounded-full border border-white/15 text-xs font-semibold" />
                <FillButton mint={row.hold.mint} usd={usd} side="sell" price={row.spot ?? row.mid ?? undefined} symbol={row.hold.symbol} label={`Sell $${usd}`} className="min-h-10 rounded-full border border-white/15 text-xs font-semibold" />
              </div>
            ) : null}
          </li>
        ))}
        {shown.length === 0 ? <li className="py-8 text-sm text-white/45">{rows.length ? "Nothing matches." : "Loading the Ostium book…"}</li> : null}
      </ul>
      {shown.length > 24 ? (
        <div className="mt-3 flex items-center justify-between text-xs text-white/45">
          <button type="button" disabled={safe <= 0} onClick={() => setPage(Math.max(0, safe - 1))} className="h-9 rounded-full bg-white/10 px-3 disabled:opacity-40">Back</button>
          <span className="font-mono">{shown.length} · {safe + 1} / {pages}</span>
          <button type="button" disabled={safe + 1 >= pages} onClick={() => setPage(safe + 1)} className="h-9 rounded-full bg-white/10 px-3 disabled:opacity-40">Next</button>
        </div>
      ) : null}
    </div>
  );
}
