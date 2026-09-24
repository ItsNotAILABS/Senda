import { ChipStack } from "@/components/chip-face";
import type { Side } from "@/lib/lmsr";
import { formatCents, formatPays, paysIfHits } from "@/lib/markets";
import { cn } from "@/lib/utils";

export function BetPad({
  side,
  price,
  spend,
  disabled,
  busy,
  flash,
  variant = "stack",
  padKey,
  stack,
  title,
  formatPrice = formatCents,
  onDrop,
}: {
  side: Side;
  price: number;
  spend: number | null;
  disabled?: boolean;
  busy?: boolean;
  flash?: boolean;
  variant?: "stack" | "row";
  padKey?: string;
  stack?: number[];
  title?: string;
  formatPrice?: (p: number) => string;
  onDrop: () => void;
}) {
  const label = title ?? (side === "yes" ? "YES" : "NO");
  const pays = spend ? paysIfHits(spend, price) : 0;
  const compact = variant === "row";
  const stock = Boolean(title);

  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={onDrop}
      data-pad={padKey}
      aria-label={
        spend
          ? `Drop ${spend} on ${label} at ${formatPrice(price)}`
          : `Arm a chip, then drop ${label}`
      }
      className={cn(
        "relative flex w-full flex-col items-center justify-center overflow-hidden text-center",
        "border border-fg/15 bg-felt-ink/50",
        "transition-[background-color,box-shadow,transform] duration-150 ease-out",
        "hover:bg-felt-ink/70 active:not-disabled:scale-[0.96]",
        compact
          ? "min-h-16 rounded-xl px-3 py-2"
          : "min-h-24 rounded-[1.5rem] px-3 py-3 sm:min-h-28",
        flash && "chip-land ring-2 ring-fg",
        disabled && "opacity-50",
      )}
    >
      <span
        className={cn(
          "font-display font-semibold tracking-tight leading-none",
          compact ? "text-xl" : "text-3xl sm:text-4xl",
          side === "no" ? "text-accent" : "text-fg",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "mt-1 font-mono tabular-nums text-fg/85",
          compact ? "text-xs" : "text-sm",
        )}
      >
        {formatPrice(price)}
      </span>
      <span className="mt-1.5 font-mono text-[0.65rem] tracking-wide text-subtle uppercase">
        {busy
          ? "Dropping…"
          : spend
            ? stock
              ? `Drop ${spend} · ${formatPrice(spend)} notional`
              : `Drop ${spend} · pays ${formatPays(pays)}`
            : "Arm a chip"}
      </span>
      {stack && stack.length > 0 ? <ChipStack values={stack} /> : null}
    </button>
  );
}

