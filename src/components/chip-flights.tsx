import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChipFace } from "@/components/chip-face";

export type Flight = {
  id: string;
  value: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

function railOrigin(): { x: number; y: number } {
  const armed = document.querySelector("[data-chip-armed='1']");
  if (armed) {
    const r = armed.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return { x: window.innerWidth / 2, y: window.innerHeight - 56 };
}

export function padRect(key: string): DOMRect | null {
  const els = document.querySelectorAll(`[data-pad='${key}']`);
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width > 2 && r.height > 2) return r;
  }
  return null;
}

export function useChipFlights() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [stacks, setStacks] = useState<Record<string, number[]>>({});

  const launch = useCallback((padKey: string, value: number, to?: DOMRect | null) => {
    const target = to ?? padRect(padKey);
    const from = railOrigin();
    const end = target
      ? { x: target.left + target.width / 2, y: target.top + target.height / 2 }
      : { x: from.x, y: from.y - 180 };
    const id = `${padKey}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const flight: Flight = {
      id,
      value,
      x0: from.x - 20,
      y0: from.y - 20,
      x1: end.x - 20,
      y1: end.y - 20,
    };
    setFlights((prev) => [...prev.slice(-7), flight]);
    window.setTimeout(() => {
      setFlights((prev) => prev.filter((f) => f.id !== id));
      setStacks((prev) => {
        const next = [...(prev[padKey] ?? []), value].slice(-4);
        return { ...prev, [padKey]: next };
      });
    }, 480);
  }, []);

  return { flights, stacks, launch };
}

export function ChipFlights({ flights }: { flights: Flight[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || flights.length === 0) return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-50" aria-hidden>
      {flights.map((f) => (
        <div
          key={f.id}
          className="chip-fly absolute"
          style={{
            left: f.x0,
            top: f.y0,
            ["--dx" as string]: `${f.x1 - f.x0}px`,
            ["--dy" as string]: `${f.y1 - f.y0}px`,
          }}
        >
          <ChipFace value={f.value} size="sm" />
        </div>
      ))}
    </div>,
    document.body,
  );
}
