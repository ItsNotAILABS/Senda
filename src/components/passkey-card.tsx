import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  forgetPasskey,
  lockPasskeyVisit,
  passkeyReason,
  passkeyVisit,
  readPasskey,
  registerPasskey,
  unlockPasskey,
  type PasskeyRecord,
} from "@/lib/passkey";

export function PasskeyCard() {
  const [row, setRow] = useState<PasskeyRecord | null>(null);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [fault, setFault] = useState("");

  function pull() {
    setRow(readPasskey());
    setOpen(passkeyVisit());
    setReason(passkeyReason());
    setReady(true);
  }

  useEffect(() => {
    pull();
  }, []);

  async function run(work: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setFault("");
    try {
      await work();
      pull();
      toast.success(ok);
    } catch (e) {
      setFault(e instanceof Error ? e.message : "The passkey did not finish.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
      <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Passkey</p>
      <h2 className="mt-1 text-lg font-semibold tracking-tight">This phone approves the vault.</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        The key stays in this phone’s keychain. Senda stores the credential id, not the key. A passkey does not sign Solana and it does not hold USDC. Closing the tab asks again.
      </p>
      {!ready ? <p className="mt-3 text-sm text-subtle">Reading this phone.</p> : null}
      {ready && reason ? <p className="mt-3 text-sm text-muted">{reason} Cash still moves until a passkey exists.</p> : null}
      {ready && !reason && !row ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(registerPasskey, "Passkey saved. This visit is open.")}
          className="mt-3 min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40"
        >
          {busy ? "Waiting on this phone…" : "Add a passkey"}
        </button>
      ) : null}
      {ready && row && !open ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-muted">A passkey is on this phone. Vault moves wait until this visit is unlocked.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(unlockPasskey, "This visit is open.")}
            className="min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40"
          >
            {busy ? "Waiting on this phone…" : "Unlock with passkey"}
          </button>
        </div>
      ) : null}
      {ready && row && open ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-accent">Open for this visit.</p>
          <button
            type="button"
            onClick={() => {
              lockPasskeyVisit();
              pull();
              toast.success("Locked. The passkey is still on this phone.");
            }}
            className="min-h-11 w-full rounded-full border border-white/15 text-sm font-semibold"
          >
            Lock this visit
          </button>
        </div>
      ) : null}
      {ready && row ? (
        <button
          type="button"
          onClick={() => {
            forgetPasskey();
            pull();
            toast.success("Forgot the id. The phone may still keep the key until you delete it in system settings.");
          }}
          className="mt-2 min-h-10 text-sm font-semibold text-white/60"
        >
          Forget the id
        </button>
      ) : null}
      {fault ? <p className="mt-2 text-sm text-down">{fault}</p> : null}
    </section>
  );
}
