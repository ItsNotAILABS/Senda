import { useEffect, useState } from "react";
import { toast } from "sonner";
import { loadClearing } from "@/lib/clearing-key";
import { assetPayLink } from "@/lib/solana-pay";

/** A Solana address created on this device. An exchange can pay it. Phantom can import the key. */
export function ClearingCard() {
  const [address, setAddress] = useState("");
  const [secret, setSecret] = useState("");
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const row = loadClearing();
      setAddress(row.address);
      setSecret(row.secret);
    } catch {
      toast.error("This browser would not keep a clearing key.");
    }
  }, []);

  const link = address ? assetPayLink("USDC", address, 0, "Senda clearing") : "";

  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">Clearing address</p>
      <h2 className="mt-1 text-lg tracking-tight">An address on this device</h2>
      <p className="mt-2 text-sm text-muted">
        No Phantom yet is fine. Withdraw USDC or SOL on Solana from an exchange to this address. The key stays in this browser. Senda never receives it. Import the key into Phantom when you want to move it. The wrong network loses the funds.
      </p>
      {address ? <p className="mt-3 break-all font-mono text-xs">{address}</p> : <p className="mt-3 text-sm text-muted">Creating the address…</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!address}
          onClick={() => {
            void navigator.clipboard.writeText(address);
            toast.success("Address copied.");
          }}
          className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40"
        >
          Copy address
        </button>
        <button
          type="button"
          disabled={!link}
          onClick={() => {
            void navigator.clipboard.writeText(link);
            toast.success("USDC pay link copied.");
          }}
          className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold disabled:opacity-40"
        >
          Copy USDC link
        </button>
        <button type="button" onClick={() => setShow((v) => !v)} className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold">
          {show ? "Hide key" : "Show key"}
        </button>
      </div>
      {show && secret ? (
        <div className="mt-3">
          <p className="text-xs text-subtle">Phantom import. Anyone who sees this can take the funds.</p>
          <p className="mt-1 break-all font-mono text-[11px]">{secret}</p>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(secret);
              toast.success("Key copied.");
            }}
            className="mt-2 min-h-10 rounded-full border border-white/15 px-4 text-sm font-semibold"
          >
            Copy key
          </button>
        </div>
      ) : null}
    </section>
  );
}
