import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { BetPad } from "@/components/bet-pad";
import { BookStrip } from "@/components/book-strip";
import { ChipFlights, useChipFlights } from "@/components/chip-flights";
import { ChipRail } from "@/components/chip-rail";
import { DepthBook } from "@/components/depth-book";
import { StreetChart } from "@/components/street-chart";
import { markToMarket, type Side } from "@/lib/lmsr";
import {
  BUY_IN_CHIPS,
  DEFAULT_CHIP,
  formatCents,
  formatChips,
  formatDate,
  formatPays,
  formatVolume,
  streetLast,
} from "@/lib/markets";
import { venueLabel } from "@/lib/feeds";
import type { MarketView, PositionView } from "@/lib/pit";
import type { StreetBook } from "@/lib/street";
import { localPrint, formatAgo, type TapePrint } from "@/lib/tape";
import { useStreetBook } from "@/lib/use-street";

function Rules({ text }: { text: string }) {
  if (!text.trim()) return null;
  const short = text.trim().length < 280;
  return (
    <details className="rounded-xl bg-elevated p-4 shadow-panel" open={short}>
      <summary className="min-h-11 cursor-pointer font-mono text-[0.65rem] tracking-[0.18em] text-subtle uppercase">
        Rules
      </summary>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted">{text.trim()}</p>
    </details>
  );
}

function BookTrades({
  street,
  pit,
  venue,
}: {
  street: { id: string; at: number; side: Side; price: number; size: number }[];
  pit: TapePrint[];
  venue: string;
}) {
  const rows = [
    ...street.map((t) => ({
      id: `st:${t.id}`,
      at: t.at,
      side: t.side,
      price: t.price,
      size: t.size,
      label: venue,
      source: "street" as const,
    })),
    ...pit.map((p) => ({
      id: p.id,
      at: p.at,
      side: p.side,
      price: p.price,
      size: p.size,
      label: "Pit",
      source: "pit" as const,
    })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 12);

  if (rows.length === 0) {
    return (
      <p className="px-1 font-mono text-[0.65rem] tracking-wide text-subtle uppercase">
        Waiting on the next print
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <li
          key={r.id}
          className="flex items-center justify-between gap-2 rounded-md bg-elevated px-3 py-2 font-mono text-xs shadow-panel"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="text-subtle">{formatAgo(r.at)}</span>
            <span className="text-muted">{r.label}</span>
            <span className={r.side === "no" ? "text-accent" : "text-fg"}>{r.side.toUpperCase()}</span>
            <span className="tabular-nums">{formatCents(r.price)}</span>
          </span>
          <span className="shrink-0 text-subtle tabular-nums">
            {r.source === "street"
              ? r.size >= 1000
                ? `${(r.size / 1000).toFixed(1)}k`
                : r.size.toFixed(0)
              : `${Math.round(r.size)}`}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function FeltTable({
  market,
  position,
  chips,
  frozen,
  prints,
  streetSeed,
  onTrade,
  onBuyIn,
  onLocalPrint,
}: {
  market: MarketView;
  position: PositionView;
  chips: number;
  frozen: boolean;
  prints: TapePrint[];
  streetSeed?: StreetBook | null;
  onTrade: (
    side: Side,
    spend: number,
  ) => Promise<{ ok: boolean; error?: string; cost?: number; shares?: number; pYesAfter?: number }>;
  onBuyIn?: () => Promise<{ ok: boolean; error?: string }>;
  onLocalPrint: (print: TapePrint) => void;
}) {
  const [armed, setArmed] = useState<number | null>(DEFAULT_CHIP);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Side | null>(null);
  const [call, setCall] = useState<string | null>(null);
  const { flights, stacks, launch } = useChipFlights();
  const { book: street, loading: streetLoading } = useStreetBook(
    {
      venue: market.venue,
      venueKey: market.venueKey,
      tokenYes: market.tokenYes,
      conditionId: market.conditionId,
      seriesTicker: market.seriesTicker,
    },
    streetSeed,
  );

  const closed = market.status !== "open" || frozen;
  const mtm = markToMarket(position.yesShares, position.noShares, market.pYes);
  const spend = armed;

  const last = street.last ?? streetLast(market);
  const bid = street.bid ?? market.bidYes;
  const ask = street.ask ?? market.askYes;
  const yesPrice = last;
  const noPrice = 1 - last;
  const depthBids =
    street.bids.length > 0 ? street.bids : bid != null ? [{ price: bid, size: 0 }] : [];
  const depthAsks =
    street.asks.length > 0 ? street.asks : ask != null ? [{ price: ask, size: 0 }] : [];

  const extras = useMemo(
    () => ({
      bidYes: bid,
      askYes: ask,
      lastYes: last,
      liquidity: market.liquidity,
      volume24h: market.volume24h,
      openInterest: market.openInterest,
      change24h: market.change24h,
      tokenYes: market.tokenYes,
      conditionId: market.conditionId,
      seriesTicker: market.seriesTicker,
      description: market.description,
      rules: market.rules,
      spread: bid != null && ask != null ? ask - bid : market.spread,
      lastUsd: market.lastUsd,
      markUsd: market.markUsd,
      premium: market.premium,
      holders: market.holders,
      valuation: market.valuation,
      swapUrl: market.swapUrl,
      mint: market.mint,
      sector: market.sector,
    }),
    [bid, ask, last, market],
  );

  async function drop(side: Side) {
    if (closed || busy) return;
    if (!spend) {
      toast("Arm a chip on the rail first.");
      return;
    }
    setBusy(true);
    try {
      if (chips < spend) {
        if (chips === 0 && onBuyIn) {
          const inn = await onBuyIn();
          if (!inn.ok) {
            toast.error(inn.error ?? "Cage rejected the buy-in.");
            return;
          }
          toast(`Cage handed you ${formatChips(BUY_IN_CHIPS)} chips.`);
        } else {
          toast.error("Not enough chips. Visit the cage.");
          return;
        }
      }
      const res = await onTrade(side, spend);
      if (!res.ok) {
        toast.error(res.error ?? "Trade rejected.");
        return;
      }
      launch(`${market.id}-${side}`, spend);
      const price = side === "yes" ? yesPrice : noPrice;
      const pays = spend / Math.min(0.99, Math.max(0.01, price));
      setFlash(side);
      window.setTimeout(() => setFlash(null), 420);
      setCall(`${spend} on ${side.toUpperCase()} at ${formatCents(price)} · pays ${formatPays(pays)} if it hits`);
      onLocalPrint(
        localPrint({
          marketId: market.id,
          name: market.name,
          question: market.question,
          venue: market.venue,
          side,
          price,
          size: spend,
        }),
      );
      toast.success(`Dropped ${spend} on ${side.toUpperCase()} · street ${formatCents(price)}`);
    } finally {
      setBusy(false);
    }
  }

  const desc = market.description || market.blurb;
  const rules = market.rules && market.rules !== desc ? market.rules : market.rules || "";

  return (
    <div className="flex flex-1 flex-col pb-36 md:pb-8">
      <ChipFlights flights={flights} />
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-3 py-3 sm:px-6">
        <Link
          to="/"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted hover:bg-elevated hover:text-fg"
          aria-label="Back to pit floor"
        >
          <ArrowLeft className="size-5" strokeWidth={1.75} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[0.65rem] tracking-[0.2em] text-subtle uppercase">
            {venueLabel(market.venue)} · resolves {formatDate(market.resolveBy)}
            {frozen ? " · FROZEN" : market.status !== "open" ? ` · ${market.status}` : ""}
          </p>
          <h1 className="font-display text-xl font-semibold tracking-tight text-balance sm:text-2xl">
            {market.question}
          </h1>
        </div>
        {market.url ? (
          <a
            href={market.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm text-muted hover:bg-elevated hover:text-fg"
            aria-label={`Open on ${venueLabel(market.venue)}`}
          >
            <ExternalLink className="size-4" strokeWidth={1.75} />
            <span className="hidden sm:inline">{venueLabel(market.venue)}</span>
          </a>
        ) : null}
      </div>

      {desc ? (
        <p className="mx-auto max-w-3xl px-4 text-sm leading-relaxed text-muted">{desc}</p>
      ) : null}

      <div className="mx-auto mt-4 w-full max-w-5xl px-3 sm:px-6">
        <BookStrip book={extras} venue={market.venue} streetYes={last} volume={market.volume} />
      </div>

      <div className="mx-auto mt-4 grid w-full max-w-5xl gap-3 px-3 sm:px-6 lg:grid-cols-[1.4fr_1fr]">
        <StreetChart history={street.history} last={last} loading={streetLoading} />
        <DepthBook bids={depthBids} asks={depthAsks} loading={streetLoading} />
      </div>

      <div className="mx-auto mt-5 w-full max-w-5xl px-3 sm:px-6">
        <div className="grid grid-cols-2 gap-2">
          <BetPad
            side="yes"
            price={yesPrice}
            spend={spend}
            disabled={closed}
            busy={busy}
            flash={flash === "yes"}
            padKey={`${market.id}-yes`}
            stack={stacks[`${market.id}-yes`]}
            onDrop={() => void drop("yes")}
          />
          <BetPad
            side="no"
            price={noPrice}
            spend={spend}
            disabled={closed}
            busy={busy}
            flash={flash === "no"}
            padKey={`${market.id}-no`}
            stack={stacks[`${market.id}-no`]}
            onDrop={() => void drop("no")}
          />
        </div>
        <p className="mt-3 text-center text-sm text-muted">
          {call ??
            (spend
              ? `Tap YES or NO at street ${formatCents(last)}. ${spend} paper chips, not a real order.`
              : "Arm a chip, then tap YES or NO.")}
        </p>
      </div>

      <div className="mx-auto mt-5 grid w-full max-w-5xl grid-cols-3 gap-2 px-3 sm:px-6">
        <div className="rounded-lg bg-elevated px-3 py-3 shadow-panel">
          <p className="font-mono text-[0.6rem] tracking-wider text-subtle uppercase">YES sh</p>
          <p className="font-mono text-lg tabular-nums">{position.yesShares.toFixed(2)}</p>
        </div>
        <div className="rounded-lg bg-elevated px-3 py-3 shadow-panel">
          <p className="font-mono text-[0.6rem] tracking-wider text-subtle uppercase">NO sh</p>
          <p className="font-mono text-lg tabular-nums">{position.noShares.toFixed(2)}</p>
        </div>
        <div className="rounded-lg bg-elevated px-3 py-3 shadow-panel">
          <p className="font-mono text-[0.6rem] tracking-wider text-subtle uppercase">Mark</p>
          <p className="font-mono text-lg tabular-nums">{mtm.toFixed(1)}</p>
        </div>
      </div>

      <div className="mx-auto mt-6 grid w-full max-w-5xl gap-3 px-3 sm:px-6 lg:grid-cols-2">
        <Rules text={rules} />
        <div>
          <p className="mb-2 font-mono text-[0.65rem] tracking-[0.18em] text-subtle uppercase">
            This book · {venueLabel(market.venue)} prints
          </p>
          <BookTrades
            street={street.trades}
            pit={prints.filter((p) => p.marketId === market.id)}
            venue={venueLabel(market.venue)}
          />
        </div>
      </div>

      {chips === 0 ? (
        <p className="mx-auto mt-4 px-4 text-center text-xs text-muted">
          Empty stack — first tap buys in {formatChips(BUY_IN_CHIPS)} chips, then drops.
        </p>
      ) : null}

      <p className="mx-auto mt-6 max-w-xl px-4 text-center font-mono text-[0.65rem] tracking-wide text-subtle uppercase">
        24h {formatVolume(market.volume24h || market.volume, market.venue)} · paper fill only
      </p>

      <div className="mx-auto mt-6 hidden w-full max-w-xl px-3 md:block">
        <ChipRail armed={armed} onArm={setArmed} disabled={closed || busy} variant="inline" />
      </div>
      <div className="md:hidden">
        <ChipRail armed={armed} onArm={setArmed} disabled={closed || busy} variant="dock" />
      </div>
    </div>
  );
}
