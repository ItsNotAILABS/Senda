import { Link } from "@tanstack/react-router";
import { formatBps, type WrapperPair } from "@/lib/basis";
import { wrapLine } from "@/lib/explain";
import { formatUsd } from "@/lib/sol-house";
import { quoteWrap, wrapCapture } from "@/lib/wrap-quote";
import { cn } from "@/lib/utils";

export function BasisBook({
  pairs,
  spend,
  busy,
  onQuote,
  onBuyCheap,
  onFadeRich,
  onLiftWrap,
}: {
  pairs: WrapperPair[];
  spend: number;
  busy?: boolean;
  onQuote: (symbols: string[]) => void;
  onBuyCheap: (pair: WrapperPair) => void;
  onFadeRich: (pair: WrapperPair) => void;
  onLiftWrap: (pair: WrapperPair) => void;
}) {
  if (pairs.length === 0) return null;

  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-mono text-xs tracking-wide text-subtle uppercase">Wrap book</h2>
        <p className="font-mono text-xs tracking-wide text-subtle uppercase">Prem to mark · not EV</p>
      </div>
      {pairs.map((p) => {
        const q = quoteWrap(p);
        const cheap = q?.cheap ?? null;
        const pId = p.prestocks?.id ?? p.tessera?.id;
        const capture = q ? wrapCapture(q, spend) : 0;
        return (
          <div key={p.family} className="rounded-xl bg-elevated px-3 py-3 shadow-panel">
            <div className="flex items-baseline justify-between gap-2">
              {pId ? (
                <Link
                  to="/house/$id"
                  params={{ id: pId }}
                  className="font-display text-base font-semibold text-fg hover:underline"
                >
                  {p.label}
                </Link>
              ) : (
                <p className="font-display text-base font-semibold">{p.label}</p>
              )}
              {cheap ? (
                <p className="font-mono text-xs tracking-wide text-muted uppercase">{cheap} cheap to mark</p>
              ) : (
                <p className="font-mono text-xs tracking-wide text-subtle uppercase">even</p>
              )}
            </div>
            <p className="mt-1 text-sm leading-snug text-muted">{wrapLine(p)}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-xs tabular-nums">
              <div>
                <p className="text-subtle uppercase">SPV · {p.prestocks?.symbol ?? "PreStocks"}</p>
                <p>
                  last {p.prestocks ? formatUsd(p.prestocks.last) : "—"} · mark{" "}
                  {p.prestocks ? formatUsd(p.prestocks.mark) : "—"}
                </p>
                <p className="text-muted">prem {formatBps(p.prestocksPrem)}</p>
              </div>
              <div>
                <p className="text-subtle uppercase">Loan · {p.tessera?.symbol ?? "Tessera"}</p>
                <p>
                  last {p.tessera ? formatUsd(p.tessera.last) : "—"} · mark{" "}
                  {p.tessera ? formatUsd(p.tessera.mark) : "—"}
                </p>
                <p className="text-muted">prem {formatBps(p.tesseraPrem)}</p>
              </div>
            </div>
            {q ? (
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs tabular-nums sm:grid-cols-4">
                <div>
                  <dt className="text-subtle uppercase">Headline</dt>
                  <dd>{formatBps(q.headline)}</dd>
                </div>
                <div>
                  <dt className="text-subtle uppercase">Fee band</dt>
                  <dd>
                    {formatBps(q.band)}
                    <span className="text-subtle"> · 20bp+DEX</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-subtle uppercase">Tradable</dt>
                  <dd className={q.insideBand ? "text-subtle" : "text-fg"}>
                    {q.insideBand ? "inside band" : formatBps(q.tradable)}
                  </dd>
                </div>
                <div>
                  <dt className="text-subtle uppercase">Paper ${spend}</dt>
                  <dd>{q.insideBand ? "—" : `~$${capture.toFixed(1)}`}</dd>
                </div>
              </dl>
            ) : null}
            <p className="mt-2 text-xs leading-snug text-subtle">
              {q?.residual ?? "Last dollars are not a share. Wrap is premium-to-mark."}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-4">
              <button
                type="button"
                disabled={busy || !cheap}
                onClick={() => onLiftWrap(p)}
                className={cn(
                  "min-h-11 rounded-full bg-up font-semibold text-xs text-up-fg",
                  busy && "opacity-50",
                )}
              >
                Lift wrap
              </button>
              <button
                type="button"
                disabled={busy || !cheap}
                onClick={() => onBuyCheap(p)}
                className={cn(
                  "min-h-11 rounded-md bg-bg font-display text-xs font-semibold text-fg",
                  busy && "opacity-50",
                )}
              >
                Buy cheap
              </button>
              <button
                type="button"
                disabled={busy || !cheap}
                onClick={() => onFadeRich(p)}
                className={cn(
                  "min-h-11 rounded-full bg-down font-semibold text-xs text-down-fg",
                  busy && "opacity-50",
                )}
              >
                Short rich
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  onQuote(
                    [p.tessera?.symbol, p.prestocks?.symbol].filter((s): s is string => Boolean(s)),
                  )
                }
                className="min-h-11 rounded-md bg-bg font-display text-xs font-semibold text-fg"
              >
                60s both
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
