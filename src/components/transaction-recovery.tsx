import { useEffect, useState } from "react";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, RefreshCw } from "lucide-react";
import { rpc } from "@/lib/phantom";
import { listTransactions, reconcileTransactions, type JournalEntry } from "@/lib/tx-journal.mjs";

const LABELS: Record<JournalEntry["status"], string> = {
  pending: "Unconfirmed — verify before retrying",
  confirmed: "Confirmed — awaiting finality",
  finalized: "Finalized on Solana",
  failed: "Failed on-chain",
};

/** A wallet's recovery receipts: nothing here initiates transactions or signs. */
export function TransactionRecovery({ owner }: { owner: string }) {
  const [rows, setRows] = useState<JournalEntry[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!owner) {
      setRows([]);
      setError("");
      return;
    }
    const read = () => {
      try {
        setRows(listTransactions(window.localStorage, owner));
        setError("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not read transaction recovery records.");
      }
    };
    read();
    // Storage events sync tabs; polling local storage also catches this tab's new broadcasts.
    window.addEventListener("storage", read);
    const poll = window.setInterval(read, 5000);
    return () => {
      window.removeEventListener("storage", read);
      window.clearInterval(poll);
    };
  }, [owner]);

  async function recheck() {
    if (busy || !owner) return;
    setBusy(true);
    setError("");
    try {
      const updated = await reconcileTransactions(window.localStorage, owner, rpc);
      setRows(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The Solana RPC did not answer. Status remains unknown.");
    } finally {
      setBusy(false);
    }
  }

  if (!owner || (!rows.length && !error)) return null;
  const unresolved = rows.filter((r) => r.status === "pending" || r.status === "confirmed").length;

  return (
    <section className="overflow-hidden rounded-[18px] border border-white/10 bg-[#10131c]">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          {unresolved ? <Clock3 className="size-4 text-amber-300" /> : <CheckCircle2 className="size-4 text-emerald-300" />}
          Chain receipts
        </span>
        <span className="font-mono text-xs text-muted">
          {unresolved ? `${unresolved} to verify` : `${rows.length} recorded`} · {expanded ? "Hide" : "Review"}
        </span>
      </button>
      {expanded ? (
        <div className="border-t border-white/10 px-4 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2 py-3">
            <p className="max-w-md text-xs text-muted">
              Receipts are stored in this browser for the selected wallet, not in a custodial Senda account. Never repeat an unknown transfer blindly.
            </p>
            <button
              type="button"
              onClick={() => void recheck()}
              disabled={busy}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/20 px-4 text-xs font-semibold disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
              {busy ? "Checking chain…" : "Recheck on-chain"}
            </button>
          </div>
          {error ? (
            <p role="alert" className="flex gap-2 py-2 text-xs text-red-300">
              <AlertTriangle className="size-4 shrink-0" />{error}
            </p>
          ) : null}
          <div className="space-y-2">
            {rows.slice(0, 8).map((entry) => (
              <div key={entry.signature} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold">
                    {entry.kind === "swap" ? "Swap" : "Send"} · {entry.asset === "SOL" || entry.asset === "USDC" ? entry.asset : `${entry.asset.slice(0, 5)}…`}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">{LABELS[entry.status]}</p>
                  <p className="mt-1 truncate font-mono text-[10px] text-subtle">
                    {new Date(entry.submittedAt).toLocaleString()} · {entry.signature.slice(0, 8)}…{entry.signature.slice(-6)}
                  </p>
                </div>
                <a
                  href={`https://solscan.io/tx/${entry.signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-9 items-center gap-1 rounded-full border border-white/15 px-3 text-xs font-semibold"
                >
                  Explorer <ArrowUpRight className="size-3.5" />
                </a>
              </div>
            ))}
          </div>
          <p className="pt-3 text-[11px] text-subtle">
            A confirmed signature is not final settlement. A timeout can still settle later. Only a chain verification changes receipt status.
          </p>
        </div>
      ) : null}
    </section>
  );
}
