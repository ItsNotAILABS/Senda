import { useMemo, useState } from "react";
import { toast } from "sonner";
import { TabLead } from "@/components/tab-lead";
import { OPEN_PROGRAMS, USDC_MINT, buildLaunchPlan, type OpenProgramId, type QuoteLeg, type SharedBook } from "@/lib/pools/model";
import { cn } from "@/lib/utils";

function short(s: string) {
  if (s.length < 12) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function impactLabel(raw: string | null) {
  if (!raw) return "—";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "—";
  const pct = Math.abs(n) <= 1 ? n * 100 : n;
  return `${pct.toFixed(2)}%`;
}

export function PoolsDesk({ books }: { books: SharedBook[] }) {
  const live = books.filter((b) => b.hops.length > 0);
  const [picked, setPicked] = useState(live[0]?.symbol ?? books[0]?.symbol ?? "");
  const [tokenName, setTokenName] = useState("");
  const [ticker, setTicker] = useState("");
  const [programId, setProgramId] = useState<OpenProgramId>("meteora-dlmm");
  const [useUsdc, setUseUsdc] = useState(true);
  const [useStock, setUseStock] = useState(true);

  const stock = live.find((b) => b.symbol === picked) ?? live[0] ?? null;

  const quotes = useMemo(() => {
    const legs: QuoteLeg[] = [];
    if (useUsdc) legs.push({ kind: "usdc", symbol: "USDC", mint: USDC_MINT });
    if (useStock && stock) legs.push({ kind: "prestocks", symbol: stock.symbol, mint: stock.mint });
    return legs;
  }, [useUsdc, useStock, stock]);

  const plan = useMemo(
    () =>
      buildLaunchPlan({
        name: tokenName.trim() || "Untitled",
        symbol: ticker,
        supply: 1_000_000_000,
        decimals: 6,
        feeBps: 100,
        lock: "burn",
        programId,
        quotes,
      }),
    [tokenName, ticker, programId, quotes],
  );

  function copy(text: string, label: string) {
    void navigator.clipboard?.writeText(text).then(
      () => toast.success(`${label} copied.`),
      () => toast.error("Could not copy."),
    );
  }

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <TabLead
        kicker="Pools"
        title="The same pools"
        accent="everyone else trades."
        line="Jupiter names the venue and the pool account. A launch opens another pool on one of those programs, quoted in USDC or a PreStock. Nothing here is a private book."
        live={["$25 USDC routes, read from Jupiter just now.", "A launch plan. The wallet still has to sign it."]}
        coming={["Sending the open-pool transaction from this page."]}
      />

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4 lg:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Live routes</p>
              <h2 className="mt-1 text-2xl tracking-tight">Where the names trade</h2>
            </div>
            <p className="font-mono text-xs text-subtle">{live.length} with a route · $25 USDC</p>
          </div>
          <ul className="mt-4 divide-y divide-white/8">
            {books.map((b) => (
              <li key={b.mint}>
                <button
                  type="button"
                  onClick={() => setPicked(b.symbol)}
                  className={cn(
                    "flex w-full flex-col gap-2 py-3 text-left sm:flex-row sm:items-center",
                    picked === b.symbol ? "text-fg" : "text-white/80",
                  )}
                >
                  <span className="w-36 shrink-0">
                    <span className="block text-sm font-semibold">{b.symbol}</span>
                    <span className="block text-[11px] text-subtle">{b.name}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    {b.hops.length === 0 ? (
                      <span className="text-xs text-subtle">{b.error || "No shared pool."}</span>
                    ) : (
                      b.hops.map((h) => (
                        <span key={`${b.mint}-${h.pool}`} className="mr-3 inline-flex flex-col">
                          <span className="text-xs font-medium">{h.label}</span>
                          <span className="font-mono text-[11px] text-subtle">{h.pool ? short(h.pool) : "—"} · {h.percent}%</span>
                        </span>
                      ))
                    )}
                  </span>
                  <span className="shrink-0 text-right font-mono text-[11px] text-subtle">
                    <span className="block">{impactLabel(b.impact)} impact</span>
                    <span className="block">{b.outAmount ? `${Number(b.outAmount).toLocaleString("en-US")} raw` : "—"}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {stock && stock.hops[0] ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3">
              <p className="text-[11px] tracking-[0.14em] text-subtle uppercase">{stock.symbol} pool account</p>
              <button type="button" onClick={() => copy(stock.hops[0].pool, "Pool")} className="mt-1 break-all text-left font-mono text-sm">
                {stock.hops[0].pool}
              </button>
              <p className="mt-2 text-xs text-subtle">
                {stock.hops.map((h) => h.label).join(" → ")}
                {stock.hops[0].programId ? ` · program ${short(stock.hops[0].programId)}` : " · program is whatever that venue deploys. Jupiter already routes it."}
              </p>
            </div>
          ) : null}
        </section>

        <section className="rounded-[22px] border border-white/10 bg-[radial-gradient(120%_80%_at_100%_-20%,rgb(214_255_74/0.14),transparent_42%),linear-gradient(165deg,#1a1f2e,#0b0d14)] p-4 lg:p-5">
          <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Open one on the same programs</p>
          <h2 className="mt-1 text-2xl tracking-tight">Pair a new mint</h2>
          <p className="mt-1 text-xs text-white/55">Fixed supply. One or two quotes. The position is burned. This page builds the plan. It does not pretend the pool is open.</p>

          <label className="mt-4 block text-[11px] text-subtle uppercase">Name</label>
          <input
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            placeholder="Name"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
          />
          <label className="mt-3 block text-[11px] text-subtle uppercase">Ticker</label>
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="TICKER"
            maxLength={10}
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm outline-none"
          />

          <p className="mt-4 text-[11px] text-subtle uppercase">Program</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {OPEN_PROGRAMS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProgramId(p.id)}
                className={cn("min-h-9 rounded-full px-3 text-xs", programId === p.id ? "bg-white text-black" : "border border-white/15 text-white/70")}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-white/45">{OPEN_PROGRAMS.find((p) => p.id === programId)?.shape}</p>

          <p className="mt-4 text-[11px] text-subtle uppercase">Quote</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => setUseUsdc((v) => !v)} className={cn("min-h-9 rounded-full px-3 text-xs", useUsdc ? "bg-accent text-accent-fg" : "border border-white/15 text-white/70")}>
              USDC
            </button>
            {live.map((b) => (
              <button
                key={b.mint}
                type="button"
                onClick={() => {
                  setPicked(b.symbol);
                  setUseStock(true);
                }}
                className={cn("min-h-9 rounded-full px-3 text-xs", useStock && stock?.symbol === b.symbol ? "bg-accent text-accent-fg" : "border border-white/15 text-white/70")}
              >
                {b.symbol}
              </button>
            ))}
          </div>

          <ol className="mt-4 space-y-2">
            {plan.steps.map((s) => (
              <li key={s.n} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                <p className="text-xs font-semibold">{s.n}. {s.op}</p>
                <p className="mt-1 break-all text-[11px] leading-relaxed text-white/55">{s.detail}</p>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-white/70">{plan.line}</p>
          <button
            type="button"
            onClick={() => copy(JSON.stringify(plan, null, 2), "Plan")}
            className="mt-4 flex min-h-12 w-full items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg"
          >
            Copy the plan
          </button>
          <p className="mt-2 text-center font-mono text-[10px] text-white/40">{plan.programAccount}</p>
        </section>
      </div>
    </div>
  );
}
