import { formatChips } from "@/lib/markets";
import { cn } from "@/lib/utils";

export function ChipFace({
  value,
  selected,
  disabled,
  onClick,
  size = "md",
  armedMark,
}: {
  value: number;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  size?: "md" | "sm" | "xs";
  armedMark?: boolean;
}) {
  const dim =
    size === "xs"
      ? "h-7 w-7 text-[0.65rem]"
      : size === "sm"
        ? "h-10 w-10 text-xs"
        : value >= 100
          ? "h-14 w-14 text-sm"
          : "h-12 w-12 text-sm";
  const skin = cn(
    "relative grid shrink-0 place-items-center rounded-full font-mono font-medium",
    dim,
    "bg-chip text-chip-ink",
    "shadow-[inset_0_0_0_3px_rgb(242_239_232_/_0.22),inset_0_0_0_6px_rgb(11_12_16_/_0.35),0_6px_0_rgb(90_18_18)]",
    size === "xs" && "shadow-[inset_0_0_0_2px_rgb(242_239_232_/_0.22),0_3px_0_rgb(90_18_18)]",
  );

  if (!onClick) {
    return (
      <span className={skin} aria-hidden>
        <span className="leading-none">{value >= 100 ? formatChips(value) : value}</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={Boolean(selected)}
      aria-label={`Arm ${value} chip`}
      data-chip-armed={armedMark && selected ? "1" : undefined}
      className={cn(
        skin,
        "min-h-11 min-w-11",
        "transition-[transform,box-shadow,filter] duration-150 ease-out hover:brightness-110 active:translate-y-0.5 active:shadow-[inset_0_0_0_3px_rgb(242_239_232_/_0.22),inset_0_0_0_6px_rgb(11_12_16_/_0.35),0_3px_0_rgb(90_18_18)]",
        selected && "ring-2 ring-fg ring-offset-2 ring-offset-bg",
        disabled && "opacity-40",
      )}
    >
      <span className="leading-none">{value >= 100 ? formatChips(value) : value}</span>
    </button>
  );
}

export function ChipStack({ values }: { values: number[] }) {
  if (values.length === 0) return null;
  const show = values.slice(-4);
  return (
    <span className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2">
      {show.map((v, i) => (
        <span
          key={`${v}-${i}`}
          className="chip-stack-in"
          style={{ marginLeft: i === 0 ? 0 : -10, zIndex: i + 1 }}
        >
          <ChipFace value={v} size="xs" />
        </span>
      ))}
    </span>
  );
}
