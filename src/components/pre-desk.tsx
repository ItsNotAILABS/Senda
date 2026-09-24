import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  contractTitle,
  formatClock,
  loadPlayTickets,
  placePlay,
  remainingMs,
  settlePlay,
  yesAsk,
  type PlayTicket,
} from "@/lib/play-book";
import { formatPremium, formatUsd, formatValuation, jupiterSwap, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

export function PreDesk({ names }: { names: HouseListing[] }) {
  const rows = useMemo(
    () => [...names].filter((n) => n.venue === "prestocks" && n.last > 0).sort((a, b) => (a.premium ?? 0) - (b.premium ?? 0)),
    [names],
  );
  const [symbol, setSymbol] = useState(rows[0]?.symbol ?? "");
  const [spend, setSpend] = useState(25);
  const [side, setSide] = useState<"over" | "diverge">("over");
  const [tickets, setTickets] = useState<PlayTicket[]>(() => loadPlayTickets());
  const wallet = useWallet();
  const name = rows.find((r) => r.symbol === symbol) ?? rows[0];
  const cheap = rows[0];

  function take() {
    if (!name) return;
    const paid = wallet.investOut(spend, `${name.symbol} 1d`);
    if (!paid.ok) {
      toast.error(paid.error);
      return;
    }
    const gap = name.mark > 0 ? (name.last - name.mark) / name.mark : 0;
    const p = side === "over" ? (gap >= 0 ? 0.62 : 0.38) : Math.abs(gap) > 0.02 ? 0.45 : 0.55;
    const ask = yesAsk(p);
    placePlay({
      stockId: name.id,
      symbol: name.symbol,
      tenor: "1d",
      kind: side,
      title: contractTitle(name.symbol, "1d", side === "over" ? "mark" : "gap"),
      spend,
      ask,
      contracts: Math.round((spend / ask) * 100) / 100,
      openLast: name.last,
      openMark: name.mark,
    });
    setTickets(loadPlayTickets());
    toast.success("Contract is on the book. It settles when the day window ends.");
  }

  function settle() {
    const prices: Record<string, { last: number; mark: number }> = {};
    for (const n of rows) prices[n.id] = { last: n.last, mark: n.mark };
    const done = settlePlay(prices);
    for (const t of done) {
      if (t.pnl > 0) wallet.investIn(t.spend + t.pnl, `${t.symbol} settled`);
    }
    setTickets(loadPlayTickets());
    toast.success(done.length ? `${done.length} contract${done.length === 1 ? "" : "s"} settled.` : "Nothing is due yet.");
  }

  async function share() {
    if (!name) return;
    const text = `${name.symbol} trades ${formatPremium(name.premium)} versus its SPV mark. Token ${formatUsd(name.last)}, mark ${formatUsd(name.mark)}. ${name.url}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied. That is the print, not advice.");
    } catch {
      toast.error("Could not copy.");
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px]">
      <section className="border-b border-border xl:border-r xl:border-b-0">
        <header className="px-5 pt-6 pb-4 lg:px-8">
          <h1 className="font-display text-4xl">Pre-IPO</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            These eight names are PreStocks. Each token is backed by an SPV that holds the private company. The list is the live book, cheapest versus the SPV mark first.
            {cheap ? ` ${cheap.symbol} is the widest gap right now, ${formatPremium(cheap.premium)}.` : ""}
          </p>
        </header>
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-subtle">
            <tr>
              <th className="px-5 py-2 font-medium lg:px-8">Company</th>
              <th className="px-2 py-2 text-right font-medium">Token</th>
              <th className="px-2 py-2 text-right font-medium">Mark</th>
              <th className="px-5 py-2 text-right font-medium lg:px-8">Vs mark</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const on = r.symbol === name?.symbol;
              return (
                <tr
                  key={r.id}
                  onClick={() => setSymbol(r.symbol)}
                  className={cn("cursor-pointer border-t border-border", on ? "bg-elevated" : "hover:bg-surface")}
                >
                  <td className="px-5 py-3 lg:px-8">
                    <span className="font-medium">{r.symbol}</span>
                    <span className="mt-0.5 block text-xs text-muted">{r.sector}</span>
                  </td>
                  <td className="px-2 py-3 text-right font-mono tabular-nums">{formatUsd(r.last)}</td>
                  <td className="px-2 py-3 text-right font-mono tabular-nums">{formatUsd(r.mark)}</td>
                  <td className={cn("px-5 py-3 text-right font-mono tabular-nums lg:px-8", (r.premium ?? 0) < 0 ? "text-up" : "text-down")}>
                    {formatPremium(r.premium)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="px-5 py-8 text-sm text-muted">PreStocks did not answer. Try again in a moment.</p> : null}
      </section>

      <aside className="px-5 py-6 lg:px-6">
        {name ? (
          <>
            <p className="text-xs text-subtle">{name.sector}</p>
            <h2 className="font-display text-4xl">{name.symbol}</h2>
            <p className="mt-3 text-sm text-muted">{name.description}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Stat k="Implied value" v={formatValuation(name.valuation)} />
              <Stat k="SPV value" v={formatValuation(name.markValuation || 0)} />
              <Stat k="Supply" v={name.supply ? name.supply.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"} />
              <Stat k="Day left" v={formatClock(remainingMs("1d"))} />
            </dl>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href={jupiterSwap(name.mint)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg">
                Buy on Jupiter
              </a>
              <a href={name.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent">
                Company page
              </a>
              <button type="button" onClick={() => void share()} className="inline-flex min-h-11 items-center text-sm text-muted">
                Copy the print
              </button>
            </div>

            <div className="mt-6 rounded-xl border border-border p-4">
              <p className="text-xs text-subtle">One-day contract</p>
              <p className="mt-1 text-sm">Settles on the next PreStocks print, not a coin flip. Cash leaves your balance now.</p>
              <div className="mt-3 flex gap-1">
                <Side on={side === "over"} label="Above the mark" onClick={() => setSide("over")} />
                <Side on={side === "diverge"} label="Gap widens" onClick={() => setSide("diverge")} />
              </div>
              <div className="mt-3 flex gap-1">
                {[25, 100, 500].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSpend(n)}
                    className={cn("min-h-9 rounded-lg px-3 font-mono text-xs tabular-nums", spend === n ? "bg-fg text-bg" : "bg-elevated text-muted")}
                  >
                    ${n}
                  </button>
                ))}
              </div>
              <button type="button" onClick={take} className="mt-3 min-h-11 rounded-lg bg-fg px-4 text-sm font-semibold text-bg">
                Take ${spend}
              </button>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-subtle">Your contracts</p>
                <button type="button" onClick={settle} className="text-xs text-muted">
                  Settle what is due
                </button>
              </div>
              <ul className="mt-2 divide-y divide-border">
                {tickets.filter((t) => !t.settled).slice(0, 6).map((t) => (
                  <li key={t.id} className="py-2 text-sm">
                    <span className="font-medium">{t.symbol}</span>
                    <span className="mt-0.5 block text-xs text-muted">{t.title}</span>
                  </li>
                ))}
                {tickets.every((t) => t.settled) ? <li className="py-2 text-sm text-muted">None open.</li> : null}
              </ul>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">No PreStocks names.</p>
        )}
      </aside>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-subtle">{k}</dt>
      <dd className="font-mono tabular-nums">{v}</dd>
    </div>
  );
}

function Side({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("min-h-9 rounded-lg px-3 text-xs", on ? "bg-fg text-bg" : "bg-elevated text-muted")}>
      {label}
    </button>
  );
}
