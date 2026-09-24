import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { FillButton } from "@/components/fill-button";
import { impactPct, outUi, quoteJup, type JupQuote } from "@/lib/jup-exec";
import { addAuto, addView, loadLab, pushTape } from "@/lib/lab-store";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { cn } from "@/lib/utils";

const CATS = [
  ["deriv", "Derivatives"],
  ["think", "Think"],
  ["games", "Games"],
  ["agent", "Agents"],
  ["pred", "Predict"],
  ["social", "Social"],
  ["lend", "Lending"],
  ["struct", "Structured"],
  ["launch", "Launch"],
  ["auto", "Automations"],
  ["sim", "Sims"],
  ["growth", "Growth"],
] as const;

type Cat = (typeof CATS)[number][0];

export function LabDesk({ house }: { house: HouseListing[] }) {
  const names = useMemo(
    () => house.filter((h) => h.venue === "prestocks" && h.last > 0 && !/xai/i.test(h.symbol)),
    [house],
  );
  const [cat, setCat] = useState<Cat>("deriv");
  const [pick, setPick] = useState(names[0]?.symbol ?? "OPENAI");
  const stock = names.find((n) => n.symbol === pick) ?? names[0];

  return (
    <main className="flex flex-1 flex-col lg:flex-row">
      <nav className="flex gap-1 overflow-x-auto px-4 py-4 lg:w-44 lg:flex-col lg:overflow-visible lg:px-4">
        {CATS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setCat(id)}
            className={cn(
              "min-h-11 shrink-0 rounded-full px-4 text-left text-sm font-semibold lg:rounded-xl",
              cat === id ? "bg-accent text-accent-fg" : "bg-elevated text-muted lg:bg-transparent",
            )}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1 px-4 pb-8 lg:pr-8">
        <header className="pt-2 pb-4">
          <p className="text-sm text-muted">Lab · two live tools each</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight lg:text-5xl">Built on the print</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Every ticket quotes Jupiter or the live PreStocks last. Senda does not warehouse. Laptop desk — pick a
            book on the left.
          </p>
        </header>
        {!stock ? (
          <p className="text-sm text-muted">Waiting on PreStocks.</p>
        ) : (
          <div className="mb-4 flex gap-1 overflow-x-auto">
            {names.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setPick(n.symbol)}
                className={cn(
                  "min-h-11 shrink-0 rounded-full px-3 text-xs font-semibold",
                  n.symbol === stock.symbol ? "bg-fg text-bg" : "bg-elevated text-muted",
                )}
              >
                {n.symbol}
              </button>
            ))}
          </div>
        )}
        {stock ? <Panels cat={cat} stock={stock} names={names} /> : null}
      </div>
    </main>
  );
}

function Panels({ cat, stock, names }: { cat: Cat; stock: HouseListing; names: HouseListing[] }) {
  if (cat === "deriv") return <Deriv stock={stock} />;
  if (cat === "think") return <Think names={names} stock={stock} />;
  if (cat === "games") return <Games names={names} />;
  if (cat === "agent") return <Agent names={names} />;
  if (cat === "pred") return <Predict stock={stock} />;
  if (cat === "social") return <Social stock={stock} />;
  if (cat === "lend") return <Lend stock={stock} />;
  if (cat === "struct") return <Struct names={names} />;
  if (cat === "launch") return <Launch />;
  if (cat === "auto") return <Autos stock={stock} names={names} />;
  if (cat === "sim") return <Sims stock={stock} />;
  return <Growth names={names} />;
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-elevated p-4">
      <h2 className="font-display text-2xl">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 lg:grid-cols-2">{children}</div>;
}

function Fill({ mint, side, label }: { mint: string; side: "buy" | "sell"; label: string }) {
  return (
    <FillButton
      mint={mint}
      usd={25}
      side={side}
      label={label}
      className="mt-3 flex min-h-11 w-full items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg"
    />
  );
}

function useQuote(mint: string, usd: number, side: "buy" | "sell" = "buy") {
  const [q, setQ] = useState<JupQuote | { error: string } | null>(null);
  useEffect(() => {
    let live = true;
    setQ(null);
    quoteJup({ data: { mint, usd, side } })
      .then((r) => live && setQ(r))
      .catch(() => live && setQ({ error: "No route" }));
    return () => {
      live = false;
    };
  }, [mint, usd, side]);
  return q;
}

function Deriv({ stock }: { stock: HouseListing }) {
  const q = useQuote(stock.mint, 25, "buy");
  const ok = q && !("error" in q);
  return (
    <Grid>
      <Card title="1 · Spot">
        <p className="text-sm text-muted">Market buy USDC → {stock.symbol}. Live route.</p>
        <p className="mt-2 text-sm">
          {!q ? "Quoting…" : "error" in q ? q.error : `$25 → ${outUi(q).toFixed(4)} · ${q.route[0] ?? "Jupiter"} · ${impactPct(q).toFixed(2)}% impact`}
        </p>
        <Fill mint={stock.mint} side="buy" label="Fill spot on Jupiter" />
      </Card>
      <Card title="2 · Trigger vs mark">
        <p className="text-sm text-muted">
          Last {formatUsd(stock.last)} vs mark {formatUsd(stock.mark)} ({formatPremium(stock.premium)}).
          {(stock.premium ?? 0) < 0 ? " Cheap to the SPV — buy the mint." : " Rich to the SPV — sell the mint."}
        </p>
        <Fill
          mint={stock.mint}
          side={(stock.premium ?? 0) < 0 ? "buy" : "sell"}
          label={(stock.premium ?? 0) < 0 ? "Buy the discount" : "Sell the premium"}
        />
      </Card>
    </Grid>
  );
}

function Think({ names, stock }: { names: HouseListing[]; stock: HouseListing }) {
  const ranked = [...names].sort((a, b) => Math.abs(b.premium ?? 0) - Math.abs(a.premium ?? 0));
  const q10 = useQuote(stock.mint, 10);
  const q100 = useQuote(stock.mint, 100);
  const q1000 = useQuote(stock.mint, 1000);
  const line = (q: ReturnType<typeof useQuote>, n: number) =>
    !q ? "…" : "error" in q ? "no route" : `$${n} → ${outUi(q).toFixed(3)} · ${impactPct(q).toFixed(2)}%`;
  return (
    <Grid>
      <Card title="1 · Premium board">
        <ul className="divide-y divide-border">
          {ranked.slice(0, 8).map((n) => (
            <li key={n.id} className="flex justify-between py-2 text-sm">
              <span>{n.symbol}</span>
              <span className="font-mono text-xs">
                {formatUsd(n.last)} · {formatPremium(n.premium)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="2 · Size ladder">
        <p className="text-sm text-muted">{stock.symbol} impact at three sizes. Same mint, live.</p>
        <p className="mt-2 font-mono text-xs">{line(q10, 10)}</p>
        <p className="font-mono text-xs">{line(q100, 100)}</p>
        <p className="font-mono text-xs">{line(q1000, 1000)}</p>
      </Card>
    </Grid>
  );
}

function Games({ names }: { names: HouseListing[] }) {
  const [a, setA] = useState(names[0]?.symbol ?? "");
  const [b, setB] = useState(names[1]?.symbol ?? "");
  const [open, setOpen] = useState<Record<string, number>>({});
  const left = names.find((n) => n.symbol === a);
  const right = names.find((n) => n.symbol === b);
  function arm() {
    const snap: Record<string, number> = {};
    for (const n of names) snap[n.symbol] = n.last;
    setOpen(snap);
    toast.success("Race armed on this print.");
  }
  const score = (n?: HouseListing) => {
    if (!n || !open[n.symbol]) return null;
    return (n.last - open[n.symbol]) / open[n.symbol];
  };
  return (
    <Grid>
      <Card title="1 · Two-name race">
        <p className="text-sm text-muted">Arm on the live last. Whoever moves more from that print wins. No house.</p>
        <div className="mt-2 flex gap-2">
          <select value={a} onChange={(e) => setA(e.target.value)} className="min-h-11 flex-1 rounded-xl bg-bg px-2 text-sm">
            {names.map((n) => (
              <option key={n.symbol}>{n.symbol}</option>
            ))}
          </select>
          <select value={b} onChange={(e) => setB(e.target.value)} className="min-h-11 flex-1 rounded-xl bg-bg px-2 text-sm">
            {names.map((n) => (
              <option key={n.symbol}>{n.symbol}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={arm} className="mt-3 min-h-11 w-full rounded-full bg-fg text-sm font-semibold text-bg">
          Arm race
        </button>
        {left && right && open[left.symbol] ? (
          <p className="mt-2 font-mono text-xs">
            {left.symbol} {((score(left) ?? 0) * 100).toFixed(2)}% · {right.symbol} {((score(right) ?? 0) * 100).toFixed(2)}%
          </p>
        ) : null}
      </Card>
      <Card title="2 · Closest to mark">
        <Closest names={names} />
      </Card>
    </Grid>
  );
}

function Closest({ names }: { names: HouseListing[] }) {
  const ranked = [...names].sort((a, b) => Math.abs(a.premium ?? 9) - Math.abs(b.premium ?? 9));
  const top = ranked[0];
  return (
    <div>
      <p className="text-sm text-muted">Live |last − mark| / mark. Tightest book right now.</p>
      <ol className="mt-2 space-y-1">
        {ranked.slice(0, 5).map((n, i) => (
          <li key={n.id} className="flex justify-between text-sm">
            <span>
              {i + 1}. {n.symbol}
            </span>
            <span className="font-mono text-xs">{formatPremium(n.premium)}</span>
          </li>
        ))}
      </ol>
      {top ? <Fill mint={top.mint} side="buy" label={`Buy ${top.symbol}`} /> : null}
    </div>
  );
}

function Agent({ names }: { names: HouseListing[] }) {
  const cheap = [...names].sort((a, b) => (a.premium ?? 0) - (b.premium ?? 0))[0];
  const rich = [...names].sort((a, b) => (b.premium ?? 0) - (a.premium ?? 0))[0];
  return (
    <Grid>
      <Card title="1 · Tape brief">
        <p className="text-sm">
          {names.length} PreStocks printing. Cheapest to mark: {cheap?.symbol} {formatPremium(cheap?.premium)}. Richest:{" "}
          {rich?.symbol} {formatPremium(rich?.premium)}. Mean absolute premium{" "}
          {(
            names.reduce((s, n) => s + Math.abs(n.premium ?? 0), 0) / Math.max(1, names.length) *
            100
          ).toFixed(2)}
          %.
        </p>
        <p className="mt-2 text-xs text-muted">Rule agent on the live book. No inventory, no invented price.</p>
      </Card>
      <Card title="2 · Ticket agent">
        <p className="text-sm text-muted">Buys the name furthest under its SPV mark.</p>
        {cheap ? (
          <>
            <p className="mt-2 text-sm font-semibold">
              {cheap.symbol} · {formatUsd(cheap.last)} · {formatPremium(cheap.premium)}
            </p>
            <Fill mint={cheap.mint} side="buy" label={`Fill ${cheap.symbol}`} />
          </>
        ) : null}
      </Card>
    </Grid>
  );
}

function Predict({ stock }: { stock: HouseListing }) {
  const [views, setViews] = useState(loadLab().views);
  function take(kind: "up" | "over") {
    setViews(addView({ symbol: stock.symbol, mint: stock.mint, kind, open: stock.last, mark: stock.mark }).views);
    toast.success(`${kind === "up" ? "Up" : "Over mark"} marked on ${stock.symbol}.`);
  }
  return (
    <Grid>
      <Card title="1 · Finishes up">
        <p className="text-sm text-muted">Mark the print. Later, last vs this open. The trade is the Jupiter buy, not a house digital.</p>
        <button type="button" onClick={() => take("up")} className="mt-3 min-h-11 w-full rounded-full bg-fg text-sm font-semibold text-bg">
          Mark up · {formatUsd(stock.last)}
        </button>
        <Fill mint={stock.mint} side="buy" label="Buy the view" />
      </Card>
      <Card title="2 · Above SPV mark">
        <p className="text-sm text-muted">
          Mark {formatUsd(stock.mark)}. Now {stock.last > stock.mark ? "above" : "below"}.
        </p>
        <button type="button" onClick={() => take("over")} className="mt-3 min-h-11 w-full rounded-full bg-fg text-sm font-semibold text-bg">
          Mark over
        </button>
        <ul className="mt-3 space-y-1">
          {views.slice(0, 4).map((v) => (
            <li key={v.id} className="font-mono text-[11px] text-subtle">
              {v.symbol} {v.kind} from {v.open.toFixed(2)}
              {stock.symbol === v.symbol ? ` · now ${stock.last > v.open ? "up" : "down"}` : ""}
            </li>
          ))}
        </ul>
      </Card>
    </Grid>
  );
}

function Social({ stock }: { stock: HouseListing }) {
  const [tape, setTape] = useState(loadLab().tape);
  return (
    <Grid>
      <Card title="1 · Fill tape">
        <button
          type="button"
          onClick={() => setTape(pushTape(`${stock.symbol} spot ${formatUsd(stock.last)}`).tape)}
          className="min-h-11 rounded-full bg-fg px-4 text-sm font-semibold text-bg"
        >
          Post this print
        </button>
        <ul className="mt-3 space-y-1">
          {tape.length === 0 ? <li className="text-sm text-subtle">Tape empty.</li> : null}
          {tape.map((l) => (
            <li key={l} className="font-mono text-xs">
              {l}
            </li>
          ))}
        </ul>
      </Card>
      <Card title="2 · Buy this mint">
        <p className="break-all font-mono text-[11px] text-subtle">{stock.mint}</p>
        <FillButton
          mint={stock.mint}
          usd={25}
          price={stock.last}
          label={`Buy $25 ${stock.symbol}`}
          className="mt-3 min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg"
        />
      </Card>
    </Grid>
  );
}

function Lend({ stock }: { stock: HouseListing }) {
  const [qty, setQty] = useState("10");
  const tokens = Number(qty) || 0;
  const collat = tokens * stock.last;
  const ltv = collat * 0.5;
  const liq = stock.last * 0.75;
  return (
    <Grid>
      <Card title="1 · Collateral vs last">
        <p className="text-sm text-muted">50% LTV on live last. You already hold the mint — this does not invent shares.</p>
        <input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          inputMode="decimal"
          className="mt-2 min-h-11 w-full rounded-xl bg-bg px-3 text-sm outline-none"
          aria-label="Tokens held"
        />
        <p className="mt-2 text-sm">
          {tokens} {stock.symbol} · collateral {formatUsd(collat)} · borrow up to {formatUsd(ltv)}
        </p>
      </Card>
      <Card title="2 · Liquidation print">
        <p className="text-sm">
          Maintenance 75% of last. A move to {formatUsd(liq)} on {stock.symbol} is the line. Mark is {formatUsd(stock.mark)}.
        </p>
        <Fill mint={stock.mint} side="sell" label="Sell collateral on Jupiter" />
      </Card>
    </Grid>
  );
}

function Struct({ names }: { names: HouseListing[] }) {
  const pack = ["OPENAI", "ANTHROPIC", "SPACEX", "ANDURIL", "KALSHI", "NEURALINK", "FIGUREAI", "POLYMARKET"];
  const legs = pack.map((s) => names.find((n) => n.symbol === s)).filter((n): n is HouseListing => !!n);
  const sum = legs.reduce((s, n) => s + n.last, 0);
  return (
    <Grid>
      <Card title="1 · PRE8 weights">
        <p className="text-sm text-muted">$800 split by live last, not a paper index.</p>
        <ul className="mt-2 space-y-1">
          {legs.map((n) => (
            <li key={n.id} className="flex justify-between text-sm">
              <span>{n.symbol}</span>
              <span className="font-mono text-xs">${((n.last / Math.max(sum, 1)) * 800).toFixed(0)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="2 · Peg hedge">
        <ul className="space-y-1">
          {legs.slice(0, 6).map((n) => (
            <li key={n.id} className="flex justify-between text-sm">
              <span>{n.symbol}</span>
              <span className="font-mono text-xs">
                {formatPremium(n.premium)} · hedge ${Math.abs((n.premium ?? 0) * n.last * 10).toFixed(0)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </Grid>
  );
}

function Launch() {
  return (
    <Grid>
      <Card title="Buy a name">
        <p className="text-sm text-muted">The eight PreStocks already exist. The buy happens on this account.</p>
        <Link to="/pre" className="mt-3 flex min-h-11 items-center justify-center rounded-full bg-fg text-sm font-semibold text-bg">
          Open the book
        </Link>
      </Card>
      <Card title="Pay with what's in Phantom">
        <p className="text-sm text-muted">SOL or USDC. You stay on the money page.</p>
        <Link to="/wallet" className="mt-3 flex min-h-11 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg">
          Convert
        </Link>
      </Card>
    </Grid>
  );
}

function Autos({ stock, names }: { stock: HouseListing; names: HouseListing[] }) {
  const [autos, setAutos] = useState(loadLab().autos);
  const hot = names.filter((n) => Math.abs(n.premium ?? 0) > 0.02);
  return (
    <Grid>
      <Card title="1 · Daily DCA">
        <p className="text-sm text-muted">$25 of {stock.symbol} each session. The fill is Jupiter, not a balance debit.</p>
        <button
          type="button"
          onClick={() => {
            setAutos(addAuto({ kind: "dca", symbol: stock.symbol, mint: stock.mint, usd: 25, threshold: 0 }).autos);
            toast.success("DCA armed.");
          }}
          className="mt-3 min-h-11 rounded-full bg-fg px-4 text-sm font-semibold text-bg"
        >
          Arm $25 / day
        </button>
        <ul className="mt-2">
          {autos.map((a) => (
            <li key={a.id} className="text-xs">
              {a.kind} {a.symbol} ${a.usd}
              <FillButton mint={a.mint} usd={a.usd} label="Buy it" className="ml-2 font-semibold text-accent" />
            </li>
          ))}
        </ul>
      </Card>
      <Card title="2 · Premium alert">
        <p className="text-sm text-muted">Names more than 2% off mark, this poll.</p>
        {hot.length === 0 ? <p className="mt-2 text-sm">None past 2%.</p> : null}
        <ul>
          {hot.map((n) => (
            <li key={n.id} className="text-sm">
              {n.symbol} {formatPremium(n.premium)}
            </li>
          ))}
        </ul>
      </Card>
    </Grid>
  );
}

function Sims({ stock }: { stock: HouseListing }) {
  const daily = Math.max(Math.abs(stock.change24h ?? 0.02), 0.01);
  const paths = [1, 2, 3, 4].map((k) => {
    let p = stock.last;
    const pts = [p];
    let s = k * 17;
    for (let i = 0; i < 12; i += 1) {
      s = (s * 16807) % 2147483647;
      const z = (s / 2147483647) * 2 - 1;
      p *= 1 + z * daily * 0.15;
      pts.push(p);
    }
    return pts;
  });
  const q = useQuote(stock.mint, 100);
  return (
    <Grid>
      <Card title="1 · Path">
        <p className="text-sm text-muted">12 steps from today’s move ({((stock.change24h ?? 0) * 100).toFixed(2)}%). Not a forecast.</p>
        <svg viewBox="0 0 240 80" className="mt-2 h-24 w-full">
          {paths.map((pts, i) => {
            const min = Math.min(...pts);
            const max = Math.max(...pts);
            const d = pts
              .map((p, x) => {
                const y = 70 - ((p - min) / Math.max(max - min, 1e-6)) * 60;
                return `${x === 0 ? "M" : "L"} ${x * 20} ${y}`;
              })
              .join(" ");
            return <path key={i} d={d} fill="none" stroke="currentColor" strokeOpacity={0.7} strokeWidth="1.4" />;
          })}
        </svg>
      </Card>
      <Card title="2 · Slippage">
        <p className="text-sm">
          {!q ? "Quoting $100…" : "error" in q ? q.error : `$100 ${stock.symbol} impact ${impactPct(q).toFixed(2)}% via ${q.route[0] ?? "Jupiter"}. Min out ${outUi(q).toFixed(4)}.`}
        </p>
      </Card>
    </Grid>
  );
}

function Growth({ names }: { names: HouseListing[] }) {
  const cheap = [...names].sort((a, b) => (a.premium ?? 0) - (b.premium ?? 0))[0];
  const tag = typeof window === "undefined" ? "@you" : (window.localStorage.getItem("senda.wallet.v2") ? "your tag" : "@you");
  return (
    <Grid>
      <Card title="1 · Invite">
        <p className="text-sm">Share Senda. Same cash account, Jupiter fills. Tag {tag}.</p>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText("Senda — PreStocks on Jupiter. Join with my tag.");
            toast.success("Invite copied.");
          }}
          className="mt-3 min-h-11 rounded-full bg-fg px-4 text-sm font-semibold text-bg"
        >
          Copy invite
        </button>
      </Card>
      <Card title="2 · Copy the discount">
        {cheap ? (
          <>
            <p className="text-sm">
              {cheap.symbol} is the discount vs mark ({formatPremium(cheap.premium)}).
            </p>
            <Fill mint={cheap.mint} side="buy" label={`Copy ${cheap.symbol}`} />
          </>
        ) : null}
      </Card>
    </Grid>
  );
}
