import { ChipFace } from "@/components/chip-face";
import { CHIP_DENOMS } from "@/lib/markets";
import { cn } from "@/lib/utils";

export function ChipRail({
  armed,
  onArm,
  disabled,
  variant = "dock",
}: {
  armed: number | null;
  onArm: (n: number | null) => void;
  disabled?: boolean;
  variant?: "dock" | "inline";
}) {
  return (
    <div
      className={cn(
        variant === "dock" &&
          "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md",
      )}
    >
      <div className="mx-auto flex max-w-xl flex-col gap-2">
        <div className="flex items-center justify-between px-1 md:px-0">
          <p className="font-mono text-[0.65rem] tracking-[0.18em] text-muted uppercase">
            Chip rail
          </p>
          <p className="text-xs text-subtle">
            {armed ? `${armed} armed · tap a side` : "Arm a chip, then tap a side"}
          </p>
        </div>
        <div className="flex items-end justify-between gap-2 sm:justify-center sm:gap-3">
          {CHIP_DENOMS.map((d) => (
            <ChipFace
              key={d}
              value={d}
              selected={armed === d}
              disabled={disabled}
              armedMark
              onClick={() => onArm(armed === d ? null : d)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
