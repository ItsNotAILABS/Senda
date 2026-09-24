import { Link } from "@tanstack/react-router";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { cn } from "@/lib/utils";

export function NameCard({
  stock,
  protectHref,
}: {
  stock: HouseListing;
  protectHref?: boolean;
}) {
  const rich = (stock.premium ?? 0) > 0;
  const thin = Math.abs(stock.premium ?? 0) > 0.08;

  return (
    <article className="flex flex-col rounded-2xl bg-paper p-4 text-ink">
      <p className="font-display text-xl leading-none tracking-tight">{stock.symbol}</p>
      <p className="mt-1 truncate text-xs text-ink/50">{stock.name}</p>
      <p className="mt-3 font-display text-3xl leading-none tabular-nums">{formatUsd(stock.last)}</p>
      <p className={cn("mt-2 text-xs font-medium", rich ? "text-down" : "text-up")}>
        {formatPremium(stock.premium)} vs mark
      </p>
      {thin ? (
        <p className="mt-1 text-[11px] leading-snug text-ink/55">Thin book · last vs mark priced wide</p>
      ) : (
        <p className="mt-1 text-[11px] text-ink/45">PreStocks SPV</p>
      )}
      <Link
        to="/house/$id"
        params={{ id: stock.id }}
        className="mt-4 flex min-h-11 items-center justify-center rounded-full bg-ink text-sm font-semibold text-paper"
      >
        {protectHref ? "Buy + Protect" : "Trade"}
      </Link>
    </article>
  );
}
