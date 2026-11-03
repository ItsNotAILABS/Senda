import { useEffect, useState } from "react";
import { toast } from "sonner";
import { bluetoothSend, nearbyChannel, nfcWrite } from "@/lib/nearby";
import { formatMoney, type NearbyNote } from "@/lib/wallet";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

export function NearbyDesk() {
  const w = useWallet();
  const [mode, setMode] = useState<"send" | "receive">("send");
  const [raw, setRaw] = useState("");
  const [recv, setRecv] = useState("");
  const [note, setNote] = useState<NearbyNote | null>(null);
  const amount = Number(raw) || 0;

  useEffect(() => {
    const ch = nearbyChannel();
    if (!ch) return;
    ch.onmessage = (ev: MessageEvent<string>) => {
      if (typeof ev.data === "string") setRecv(ev.data);
    };
    return () => ch.close();
  }, []);

  function issue() {
    const r = w.nearbySend(amount, "USD");
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setNote(r.note);
    nearbyChannel()?.postMessage(r.note.payload);
    toast.success(`Locked ${formatMoney(amount)} in a nearby note.`);
  }

  function claim(payload: string) {
    const r = w.nearbyClaim(payload);
    if (!r.ok) toast.error(r.error);
    else {
      toast.success("Note claimed · cash is yours.");
      setRecv("");
      setMode("receive");
    }
  }

  return (
    <div className="flex flex-col px-5 pb-8">
      <p className="text-sm text-muted">
        Offline send. We lock the cash in a note, then move it by Bluetooth, NFC, or the code. The other phone claims it — no bank, no internet required on their side.
      </p>
      <div className="mt-4 flex gap-1">
        {(["send", "receive"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "min-h-11 flex-1 rounded-full text-sm font-semibold capitalize",
              mode === m ? "bg-fg text-bg" : "bg-elevated text-muted",
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === "send" ? (
        <div className="mt-5 flex flex-col gap-3">
          <label>
            <span className="text-xs font-medium text-subtle">USD</span>
            <input
              inputMode="decimal"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="0"
              className="mt-1 min-h-14 w-full rounded-2xl bg-elevated px-4 text-3xl font-semibold tabular-nums outline-none"
            />
          </label>
          <p className="text-xs text-subtle">Cash {formatMoney(w.w.balances.USD)}</p>
          <button
            type="button"
            disabled={!(amount > 0)}
            onClick={issue}
            className="min-h-12 rounded-full bg-accent text-base font-semibold text-accent-fg disabled:opacity-40"
          >
            Create note
          </button>
          {note ? (
            <div className="rounded-2xl bg-elevated px-4 py-4">
              <p className="text-xs font-medium tracking-wide text-subtle uppercase">Show this</p>
              <p className="mt-2 text-4xl font-semibold tracking-widest tabular-nums">{note.code}</p>
              <p className="mt-2 text-sm text-muted">{formatMoney(note.amount, note.ccy)} from {note.fromTag}</p>
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void bluetoothSend(note.payload)
                      .then(() => toast.success("Sent over Bluetooth."))
                      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Bluetooth failed."));
                  }}
                  className="min-h-12 rounded-full bg-fg text-sm font-semibold text-bg"
                >
                  Send via Bluetooth
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void nfcWrite(note.payload)
                      .then(() => toast.success("Hold phones together."))
                      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "NFC failed."));
                  }}
                  className="min-h-12 rounded-full bg-elevated text-sm font-semibold"
                >
                  Write NFC
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(note.payload);
                    toast.success("Payload copied.");
                  }}
                  className="min-h-12 rounded-full bg-elevated text-sm font-semibold"
                >
                  Copy payload
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          <p className="text-sm text-muted">Paste the payload, or type what Bluetooth/NFC dropped in.</p>
          <textarea
            value={recv}
            onChange={(e) => setRecv(e.target.value)}
            placeholder="SENDA1.…"
            rows={4}
            className="rounded-2xl bg-elevated px-4 py-3 font-mono text-sm outline-none placeholder:text-subtle"
          />
          <button
            type="button"
            disabled={!recv.trim()}
            onClick={() => claim(recv)}
            className="min-h-12 rounded-full bg-fg text-sm font-semibold text-bg disabled:opacity-40"
          >
            Claim
          </button>
        </div>
      )}
    </div>
  );
}
