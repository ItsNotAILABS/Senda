import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { FillButton } from "@/components/fill-button";
import { LiveChart } from "@/components/price-chart";
import { registryOne, registryPage, type RegFamily, type RegRow } from "@/lib/registry";
import { hlOpen } from "@/lib/hl-sign";
import { toast } from "sonner";

const FAMILIES: { id: RegFamily | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "coin", label: "Coins" },
  { id: "xstock", label: "xStocks" },
  { id: "name", label: "Pre-IPO" },
  { id: "ostium", label: "Ostium" },
  { id: "hl", label: "Hyperliquid" },
  { id: "network", label: "Networks" },
  { id: "desk", label: "Desks" },
  { id: "stake", label: "Stake" },
  { id: "vault", label: "Vaults" },
  { id: "perp", label: "Perps" },
];

function money(n: number | null) {
  if (n == null || !(n > 0)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n < 1 ? 4 : 2 });
}

export function RegistryDesk() {
  const [q, setQ] = useState("");
  const [family, setFamily] = useState<RegFamily | "all">("all");
  const [rows, setRows] = useState<RegRow[]>([]);
  const [total, setTotal] = useState(0);
  const [matched, setMatched] = useState(0);
  const [families, setFamilies] = useState<Record<string, number>>({});
  const [note, setNote] = useState("Reading the venues…");

  useEffect(() => {
    let live = true;
    const handle = window.setTimeout(() => {
      registryPage({ data: { q, family, offset: 0, limit: 60 } })
        .then((page) => {
          if (!live) return;
          setRows(page.rows);
          setTotal(page.total);
          setMatched(page.matched);
          setFamilies(page.families);
          setNote(`${page.total.toLocaleString("en-US")} markets the venues returned. ${page.matched.toLocaleString("en-US")} match.`);
        })
        .catch(() => live && setNote("The venues did not answer."));
    }, q ? 280 : 0);
    return () => {
      live = false;
      window.clearTimeout(handle);
    };
  }, [q, family]);

  function more() {
    registryPage({ data: { q, family, offset: rows.length, limit: 60 } })
      .then((page) => setRows((cur) => [...cur, ...page.rows]))
      .catch(() => setNote("The venues did not answer."));
  }

  return (
    <div className="px-3 py-3">
      <p className="text-[11px] tracking-[0.16em] text-white/40 uppercase">Registry</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">Every market a venue returned</h2>
      <p className="mt-2 text-sm text-white/55">Coins, xStocks, PreStocks, Ostium, the full Hyperliquid book, stake receipts, Kamino vaults, Jupiter perps, every network on the desk, and every product desk. A row is here because that book exists. Kalshi and Polymarket stay on their tabs.</p>
      <p className="mt-1 text-xs text-white/40">{note}</p>
      <div className="mt-3 flex gap-2 overflow-x-auto">
        {FAMILIES.map((item) => (
          <button key={item.id} type="button" onClick={() => setFamily(item.id)} className={family === item.id ? "min-h-9 shrink-0 rounded-full bg-white px-3 text-sm font-semibold text-black" : "min-h-9 shrink-0 rounded-full bg-white/10 px-3 text-sm text-white/70"}>
            {item.label}
            {item.id !== "all" && families[item.id] ? ` ${families[item.id]}` : ""}
          </button>
        ))}
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the registry" className="mt-3 min-h-11 w-full rounded-full bg-[#1c1c1e] px-4 text-sm outline-none" />
      <ul className="mt-2 divide-y divide-white/10">
        {rows.map((row) => (
          <li key={row.id}>
            <Link to="/wire" search={{ id: row.id }} className="flex items-center gap-3 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{row.symbol}</span>
                <span className="block truncate text-xs text-white/45">{row.venue} · {row.chain} · {row.name}</span>
              </span>
              <span className="font-mono text-xs">{money(row.price)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {rows.length < matched ? (
        <button type="button" onClick={more} className="mt-2 min-h-11 w-full rounded-full bg-white/10 text-sm font-semibold">
          Show more · {(matched - rows.length).toLocaleString("en-US")} left
        </button>
      ) : null}
      {total > 0 && rows.length === 0 ? <p className="mt-3 text-sm text-white/45">Nothing matched.</p> : null}
    </div>
  );
}

export function InstrumentPage({ id }: { id: string }) {
  const [row, setRow] = useState<RegRow | null | undefined>(undefined);
  const [usd, setUsd] = useState(10);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    registryOne({ data: { id } })
      .then((found) => live && setRow(found))
      .catch(() => live && setRow(null));
    return () => {
      live = false;
    };
  }, [id]);

  async function sendHl(isBuy: boolean) {
    if (!row || row.asset == null || row.price == null || row.szDecimals == null || busy) return;
    setBusy(true);
    try {
      const done = await hlOpen({
        asset: row.asset,
        side: isBuy ? "long" : "short",
        margin: usd > 0 ? usd : 1,
        leverage: Math.min(row.maxLev && row.maxLev > 0 ? row.maxLev : 3, 5),
        mark: row.price,
        szDecimals: row.szDecimals,
      });
      toast.success(`${row.symbol} filled ${done.filled || "the order"} @ ${done.avg || "the mark"}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hyperliquid did not take the order.");
    } finally {
      setBusy(false);
    }
  }

  if (row === undefined) return <p className="px-4 py-6 text-sm text-white/50">Reading the registry…</p>;
  if (!row) {
    return (
      <div className="px-4 py-6">
        <p className="text-lg font-semibold">Not on the book</p>
        <p className="mt-2 text-sm text-white/55">That id was not returned by a venue.</p>
        <Link to="/wire" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[#d7e36a]">
          Back to markets
        </Link>
      </div>
    );
  }

  const canSwap = row.family !== "desk" && row.family !== "network" && row.mint.length >= 32 && (row.sign === "jupiter" || row.sign === "prestock") && !row.note.startsWith("Halted");

  return (
    <div className="px-3 py-3">
      <Link to="/wire" className="text-sm text-white/50">
        Markets
      </Link>
      <p className="mt-3 text-[11px] tracking-[0.16em] text-white/40 uppercase">{row.venue} · {row.chain}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{row.symbol}</h1>
      <p className="text-sm text-white/55">{row.name}</p>
      <p className="mt-3 font-mono text-4xl">{money(row.price)}</p>
      {row.fdv ? <p className="mt-1 text-sm text-white/45">Implied FDV {money(row.fdv)}. The fill is the token, not the valuation.</p> : null}
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Fact k="Signs" v={row.sign === "hyperliquid" ? "Phantom Ethereum · Hyperliquid" : row.sign === "arbitrum" ? "Phantom Ethereum" : row.sign === "jup-perps" ? "Jupiter perp" : "Phantom on Solana"} />
        <Fact k="Liquidity" v={row.liquidity != null ? money(row.liquidity) : row.venue} />
        <Fact k="Holders" v={row.holders != null ? row.holders.toLocaleString("en-US") : "—"} />
        <Fact k="Day" v={day(row.change)} />
      </div>
      <p className="mt-3 text-sm text-white/60">{row.note}</p>
      {row.mint.length >= 32 && row.price != null ? <div className="mt-4 h-64 overflow-hidden rounded-[22px]">{<LiveChart mint={row.mint} symbol={row.symbol} live={row.price} compact />}</div> : null}
      {canSwap ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <FillButton mint={row.mint} symbol={row.symbol} side="buy" usd={5} price={row.price ?? undefined} label={`Buy $5 ${row.symbol}`} className="min-h-12 rounded-full bg-[#c6f56a] text-sm font-semibold text-black" />
          <FillButton mint={row.mint} symbol={row.symbol} side="sell" usd={5} price={row.price ?? undefined} label={`Sell $5 ${row.symbol}`} className="min-h-12 rounded-full bg-[#ff5d73] text-sm font-semibold text-white" />
        </div>
      ) : row.sign === "hyperliquid" && row.asset != null && row.price != null && row.szDecimals != null ? (
        <div className="mt-4">
          <input inputMode="decimal" aria-label="Dollars" value={String(usd)} onChange={(e) => setUsd(Math.max(0, Number(e.target.value) || 0))} className="min-h-11 w-full rounded-full bg-[#1c1c1e] px-4 font-mono text-sm outline-none" />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={() => void sendHl(true)} className="min-h-12 rounded-full bg-[#c6f56a] text-sm font-semibold text-black disabled:opacity-50">Long ${usd > 0 ? usd : 1}</button>
            <button type="button" disabled={busy} onClick={() => void sendHl(false)} className="min-h-12 rounded-full bg-[#ff5d73] text-sm font-semibold text-white disabled:opacity-50">Short ${usd > 0 ? usd : 1}</button>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-white/45">
          {row.sign === "arbitrum" ? "This pair is on Ostium. Open the Ostium desk and sign with the Ethereum account. There is no Solana buy button." : row.sign === "jup-perps" ? "Open the perps desk. Jupiter builds the order. Phantom signs." : row.sign === "hyperliquid" ? "The mark is not in yet. Open the Hyperliquid desk." : "No swap until a venue quotes it."}
        </p>
      )}
      {row.perp && row.sign !== "jup-perps" && row.sign !== "arbitrum" ? <p className="mt-2 text-sm text-white/45">This name also has a Jupiter perpetual. That order is on the perps desk, not this spot button.</p> : null}
      {row.mint ? <p className="mt-3 break-all font-mono text-[11px] text-white/35">{row.mint}</p> : null}
    </div>
  );
}

function day(n: number | null) {
  if (n == null) return "—";
  const pct = Math.abs(n) <= 2 ? n * 100 : n;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl bg-[#141418] px-3 py-3">
      <p className="text-[11px] text-white/40">{k}</p>
      <p className="mt-1 font-mono text-sm">{v}</p>
    </div>
  );
}
