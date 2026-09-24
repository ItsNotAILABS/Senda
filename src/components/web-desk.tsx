import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { JupRow } from "@/components/jup-ticket";
import { TokenMark } from "@/components/token-mark";
import { BIC, sendaIban } from "@/lib/iso20022";
import { formatChg, formatPremium, formatUsd, getHouse, type HouseListing } from "@/lib/sol-house";
import { formatMoney, sendaDeposit, type Ccy } from "@/lib/wallet";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

export function WebDesk() {
  const { w, usd, ready } = useWallet();
  const [rows, setRows] = useState<HouseListing[]>([]);
  const [id, setId] = useState<string | null>(null);
  const [usdSize, setUsdSize] = useState(100);

  useEffect(() => {
    let live = true;
    const pull = () =>
      getHouse()
        .then((h) => {
          if (!live) return;
          const pre = h.filter((r) => r.venue === "prestocks" && r.last > 0 && !/xai/i.test(r.symbol));
          setRows(pre);
          setId((cur) => cur ?? pre[0]?.id ?? null);
        })
        .catch(() => undefined);
    void pull();
    const t = window.setInterval(pull, 20_000);
    return () => {
      live = false;
      window.clearInterval(t);
    };
  }, []);

  const stock = rows.find((r) => r.id === id) ?? rows[0];
  const ach = sendaDeposit(w.tag);
  const opened = (w.opened?.length ? w.opened : ["USD"]) as Ccy[];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-6 border-b border-border px-5">
        <div className="min-w-0">
          <p className="text-[11px] text-subtle">Equity</p>
          <p className="font-mono text-lg leading-none tabular-nums" suppressHydrationWarning>
            {ready ? formatMoney(usd) : "—"}
          </p>
        </div>
        <p className="hidden min-w-0 truncate font-mono text-[11px] text-subtle md:block">
          {w.tag} · {BIC} · {ach.routing} {ach.account}
        </p>
        <p className="ml-auto hidden font-mono text-[11px] text-subtle lg:block">
          {stock ? `${stock.symbol} ${formatUsd(stock.last)}` : "book"}
        </p>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)_280px]">
        <section className="flex min-h-0 flex-col border-b border-border lg:border-r lg:border-b-0">
          <div className="flex h-10 shrink-0 items-center justify-between px-4">
            <h2 className="text-xs font-medium tracking-wide text-subtle uppercase">Book</h2>
            <span className="font-mono text-[11px] text-subtle">{rows.length}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-bg text-[11px] text-subtle">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-2 py-2 text-right font-medium">Last</th>
                  <th className="px-4 py-2 text-right font-medium">vs mark</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const on = stock?.id === r.id;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setId(r.id)}
                      className={cn("cursor-pointer border-t border-border", on ? "bg-elevated" : "hover:bg-surface")}
                    >
                      <td className="px-4 py-2">
                        <span className="flex items-center gap-2">
                          <span className={cn("h-4 w-0.5 rounded-full", on ? "bg-accent" : "bg-transparent")} />
                          <TokenMark stock={r} size={20} />
                          <span className="text-sm font-medium">{r.symbol}</span>
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-xs tabular-nums">{formatUsd(r.last)}</td>
                      <td className={cn("px-4 py-2 text-right font-mono text-xs tabular-nums", (r.premium ?? 0) < 0 ? "text-up" : "text-down")}>
                        {formatPremium(r.premium)}
                        <span className="ml-2 text-subtle">{formatChg(r.change24h)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-auto border-b border-border lg:border-r lg:border-b-0">
          {stock ? (
            <>
              <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <TokenMark stock={stock} size={36} />
                    <div>
                      <h2 className="font-display text-3xl leading-none">{stock.symbol}</h2>
                      <p className="mt-1 truncate text-xs text-subtle">{stock.name}</p>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {[25, 100, 500].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setUsdSize(n)}
                      className={cn(
                        "min-h-9 rounded-lg px-3 font-mono text-xs font-medium",
                        usdSize === n ? "bg-fg text-bg" : "bg-elevated text-muted",
                      )}
                    >
                      ${n}
                    </button>
                  ))}
                </div>
              </div>
              <dl className="mx-6 mb-4 grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-border bg-border">
                <Stat k="Last" v={formatUsd(stock.last)} />
                <Stat k="Mark" v={formatUsd(stock.mark)} />
                <Stat k="24h" v={formatChg(stock.change24h)} />
                <Stat k="Premium" v={formatPremium(stock.premium)} />
              </dl>
              <JupRow stock={stock} usd={usdSize} pane />
              <p className="mt-auto px-6 pb-4 font-mono text-[10px] text-subtle">
                Agent only · mint {stock.mint}
              </p>
            </>
          ) : (
            <p className="px-6 py-10 text-sm text-muted">Loading the live book.</p>
          )}
        </section>

        <aside className="min-h-0 overflow-auto">
          <Rail title="Cash">
            <ul>
              {opened.map((c) => (
                <li key={c} className="flex items-baseline justify-between border-t border-border px-4 py-2 text-sm">
                  <span>{c}</span>
                  <span className="font-mono text-xs tabular-nums">{formatMoney(w.balances[c] ?? 0, c)}</span>
                </li>
              ))}
            </ul>
            <p className="px-4 py-2 font-mono text-[10px] leading-relaxed break-all text-subtle">
              {sendaIban(w.tag, "EUR")}
            </p>
          </Rail>
          <Rail title="Cards">
            {w.cards.length === 0 ? (
              <Link to="/cards" search={{ spend: 0 }} className="block px-4 py-2 text-sm font-medium">
                Issue a debit
              </Link>
            ) : (
              <ul>
                {w.cards.slice(0, 4).map((c) => (
                  <li key={c.id} className="flex justify-between border-t border-border px-4 py-2 text-sm">
                    <span>{c.label}</span>
                    <span className="font-mono text-xs text-subtle">··{c.last4}</span>
                  </li>
                ))}
              </ul>
            )}
          </Rail>
          <Rail title="Messages">
            {w.txs.length === 0 ? (
              <p className="px-4 py-2 text-sm text-subtle">No pain.001 yet.</p>
            ) : (
              <ul>
                {w.txs.slice(0, 6).map((t) => (
                  <li key={t.id} className="border-t border-border px-4 py-2">
                    <p className="text-sm">
                      {t.kind} · {t.counterparty}
                    </p>
                    <p className="truncate font-mono text-[10px] text-subtle">
                      {t.iso ?? t.note}
                      {t.uetr ? ` · ${t.uetr.slice(0, 13)}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Rail>
        </aside>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="bg-bg px-3 py-2">
      <dt className="text-[11px] text-subtle">{k}</dt>
      <dd className="mt-0.5 font-mono text-sm tabular-nums">{v}</dd>
    </div>
  );
}

function Rail({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="px-4 pt-4 pb-2 text-xs font-medium tracking-wide text-subtle uppercase">{title}</h2>
      {children}
    </section>
  );
}
