import { PublicKey } from "@solana/web3.js";

export function solAddress(raw: string): string | null {
  try {
    return new PublicKey(raw.trim()).toBase58();
  } catch {
    return null;
  }
}

export function FlowSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex flex-wrap gap-2 text-[11px] tracking-[0.14em] uppercase">
      {steps.map((label, i) => (
        <span key={label} className={i === current ? "text-accent" : i < current ? "text-white/70" : "text-subtle"}>
          {i + 1} {label}
        </span>
      ))}
    </div>
  );
}

export function SignedReceipt({
  title,
  amount,
  detail,
  sig,
}: {
  title: string;
  amount: string;
  detail: string;
  sig: string;
}) {
  return (
    <div className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
      <p className="text-[11px] tracking-[0.14em] text-accent uppercase">{title}</p>
      <p className="mt-1 font-mono text-2xl tabular-nums">{amount}</p>
      <p className="mt-1 text-sm text-muted">{detail}</p>
      <a className="mt-2 block truncate font-mono text-xs text-accent" href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer">
        {sig}
      </a>
    </div>
  );
}

/** What this tab actually moves, and what it only stores. */
export function DeskAudit({ live, hold }: { live: string; hold: string }) {
  return (
    <p className="rounded-2xl border border-white/10 bg-black/25 px-4 py-2 text-xs leading-relaxed text-muted">
      <span className="font-semibold text-accent">Audit</span> {live} <span className="text-subtle">{hold}</span>
    </p>
  );
}
