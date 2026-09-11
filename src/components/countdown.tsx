import { useEffect, useState } from "react";
import { EVENT } from "@/lib/event";
import { cn } from "@/lib/utils";

type Parts = { days: number; hours: number; minutes: number; seconds: number };

function split(ms: number): Parts {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

const EMPTY: Parts = { days: 0, hours: 0, minutes: 0, seconds: 0 };

export function Countdown() {
  const target = new Date(EVENT.startsAt).getTime();
  const [parts, setParts] = useState<Parts | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const tick = () => {
      const delta = target - Date.now();
      setLive(delta <= 0);
      setParts(split(delta));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [target]);

  if (live) {
    return (
      <p className="font-display text-xl font-semibold tracking-tight text-fg">
        Doors are open. See you on the floor.
      </p>
    );
  }

  const shown = parts ?? EMPTY;
  const ready = parts !== null;
  const cells: { label: string; value: string }[] = [
    { label: "Days", value: pad(shown.days) },
    { label: "Hours", value: pad(shown.hours) },
    { label: "Minutes", value: pad(shown.minutes) },
    { label: "Seconds", value: pad(shown.seconds) },
  ];

  return (
    <div
      className="grid grid-cols-4 gap-2 sm:gap-3"
      role="timer"
      aria-live="polite"
      aria-label="Time until Sovereign Summit"
    >
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="rounded-xl bg-elevated px-2 py-3 text-center shadow-panel sm:px-3 sm:py-4"
        >
          <div
            className={cn(
              "font-mono text-2xl font-medium tabular-nums text-fg sm:text-3xl md:text-4xl",
              !ready && "opacity-0",
            )}
          >
            {cell.value}
          </div>
          <div className="mt-1 text-xs tracking-widest text-muted uppercase">
            {cell.label}
          </div>
        </div>
      ))}
    </div>
  );
}
