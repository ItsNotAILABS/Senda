import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

const KEY = "senda.seen.v1";

const STEPS = [
  ["Connect", "Phantom stays the wallet. Senda never takes the key."],
  ["Buy", "A PreStock is a Jupiter swap. The market does not close."],
  ["Use it", "Spend a number, play the print, or hand an agent a cap."],
] as const;

export function Onboard() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, []);
  if (!open) return null;
  function close() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* private */
    }
    setOpen(false);
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 p-4 sm:place-items-center">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#101018] p-6">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">First time</p>
        <h2 className="mt-2 text-3xl">Three steps. Then you’re in.</h2>
        <ol className="mt-4 space-y-2">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="rounded-2xl bg-black/40 px-3 py-3">
              <p className="text-sm font-semibold">
                {i + 1}. {t}
              </p>
              <p className="text-xs text-muted">{d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex gap-2">
          <Link to="/pre" onClick={close} className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">
            Open the book
          </Link>
          <button type="button" onClick={close} className="min-h-11 rounded-full px-4 text-sm text-muted">
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
