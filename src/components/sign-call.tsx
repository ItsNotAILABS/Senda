import { cn } from "@/lib/utils";

/** The same call Phantom and MetaMask show: what you are signing, then their popup. */
export function SignCall({
  open,
  wallet,
  title,
  lines,
  account,
  waiting,
  onReject,
  onSign,
}: {
  open: boolean;
  wallet: "Phantom" | "MetaMask" | "Backpack";
  title: string;
  lines: string[];
  account: string;
  waiting: boolean;
  onReject: () => void;
  onSign: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/70 p-3 sm:place-items-center" role="dialog" aria-modal="true" aria-labelledby="sign-call-title">
      <div className="senda-call w-full max-w-md rounded-[28px] border border-white/15 bg-[#12141c] p-5 shadow-[0_24px_80px_rgb(0_0_0/0.55)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] tracking-[0.16em] text-accent uppercase">{wallet}</p>
          <span className={cn("inline-flex items-center gap-2 rounded-full px-2 py-1 text-[11px] font-semibold", waiting ? "bg-accent text-accent-fg" : "bg-white/10")}>
            <span className={cn("size-1.5 rounded-full bg-current", waiting && "senda-dot")} />
            {waiting ? `Waiting on ${wallet}` : "Needs your approval"}
          </span>
        </div>
        <h2 id="sign-call-title" className="mt-3 text-2xl tracking-tight">{title}</h2>
        <p className="mt-2 font-mono text-xs text-muted">{account || "The wallet will choose the account."}</p>
        <ul className="mt-4 space-y-2 rounded-2xl bg-black/40 p-3">
          {lines.map((line) => (
            <li key={line} className="text-sm text-white/80">{line}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-subtle">
          {waiting
            ? `${wallet} has the request. Approve it there. This page cannot sign for you.`
            : `The next tap opens ${wallet}. Reject here and nothing is asked.`}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" disabled={waiting} onClick={onReject} className="min-h-12 rounded-full border border-white/15 text-sm font-semibold disabled:opacity-40">
            Reject
          </button>
          <button type="button" disabled={waiting} onClick={onSign} className="min-h-12 rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
            {waiting ? "Waiting" : "Sign"}
          </button>
        </div>
      </div>
    </div>
  );
}
