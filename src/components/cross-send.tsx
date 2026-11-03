import { useState } from "react";
import { toast } from "sonner";
import { Buffer } from "buffer";
import { VersionedTransaction } from "@solana/web3.js";
import { BRIDGE_RAILS, getUsdcBridge, type BridgeRailId } from "@/lib/lifi";
import { sendVersioned } from "@/lib/phantom";
import { humanWalletError } from "@/lib/mobile-wallet";
import { rememberClear } from "@/lib/clearing";
import { connectPhantom } from "@/lib/phantom";
import { spendCap } from "@/lib/spend-cap";

function bytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/** USDC leaves Solana and arrives as USDC on another chain. Not a bank deposit. */
export function CrossSend({ owner }: { owner: string }) {
  const [rail, setRail] = useState<BridgeRailId>("base");
  const [usd, setUsd] = useState(20);
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [sig, setSig] = useState("");

  async function go() {
    setBusy(true);
    setSig("");
    setNote("");
    try {
      if (usd > spendCap()) throw new Error(`That is over the spend cap of ${spendCap()}.`);
      if (!/^0x[a-fA-F0-9]{40}$/.test(to.trim())) throw new Error("That is not an EVM address.");
      const who = owner || (await connectPhantom());
      const quoted = await getUsdcBridge({ data: { rail, usd, fromAddress: who, toAddress: to.trim() } });
      if ("error" in quoted) throw new Error(quoted.error);
      if (!globalThis.Buffer) globalThis.Buffer = Buffer;
      const tx = VersionedTransaction.deserialize(bytes(quoted.tx));
      const signature = await sendVersioned(tx);
      setSig(signature);
      setNote(`About ${quoted.toUi.toFixed(2)} USDC via ${quoted.tool}. They receive USDC on that chain, not a bank deposit.`);
      rememberClear({
        desk: "send",
        title: `USDC to ${rail}`,
        legs: [
          { side: "out", asset: "USDC", amount: usd, where: "Solana" },
          { side: "in", asset: "USDC", amount: quoted.toUi, where: to.trim() },
        ],
        feeUsd: Math.max(0, Math.round((usd - quoted.toUi) * 100) / 100),
        sig: signature,
        status: "signed",
      });
      toast.success("Signed. USDC is leaving Solana.");
    } catch (e) {
      toast.error(humanWalletError(e instanceof Error ? e.message : "The bridge did not sign."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 border-t border-white/10 pt-4">
      <p className="font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">Another chain</p>
      <p className="mt-1 text-sm text-muted">You sign on Solana. They get USDC on the chain you pick. This is not a peso payout and not a card.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {BRIDGE_RAILS.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => setRail(row.id)}
            className={`min-h-10 rounded-full px-3 text-sm font-semibold ${rail === row.id ? "bg-accent text-accent-fg" : "border border-white/10 text-muted"}`}
          >
            {row.label}
          </button>
        ))}
      </div>
      <label className="mt-3 block text-xs text-subtle">
        Their address on that chain
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x…" className="mt-1 min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 font-mono text-sm outline-none" />
      </label>
      <label className="mt-3 block text-xs text-subtle">
        USDC
        <input value={usd} onChange={(e) => setUsd(Math.max(1, Number(e.target.value) || 0))} inputMode="decimal" className="mt-1 min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 font-mono text-sm outline-none" />
      </label>
      <button type="button" disabled={busy} onClick={() => void go()} className="mt-3 min-h-12 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg disabled:opacity-50">
        {busy ? "Waiting for the wallet…" : `Send ${usd} USDC`}
      </button>
      {note ? <p className="mt-2 text-sm text-muted">{note}</p> : null}
      {sig ? (
        <a className="mt-2 block truncate font-mono text-xs text-accent" href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer">
          {sig}
        </a>
      ) : null}
    </div>
  );
}
