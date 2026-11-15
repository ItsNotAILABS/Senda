import { useState } from "react";
import { toast } from "sonner";
import { USDC } from "@/lib/jup-exec";
import { signRoute } from "@/lib/jup-sign";
import { connectPhantom } from "@/lib/phantom";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";

const LEGS = [
  { symbol: "SPYx", mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W" },
  { symbol: "QQQx", mint: "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ" },
] as const;

/** Two listed ETFs, equal dollars, two signatures. The tokens land in the wallet. */
export function EtfTicket({ owner }: { owner: string }) {
  const wallet = useWallet();
  const [usd, setUsd] = useState("10");
  const [busy, setBusy] = useState(false);

  async function buy() {
    const n = Number(usd);
    if (!(n >= 2)) return toast.error("At least $2. Each fund gets half.");
    setBusy(true);
    try {
      const addr = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(addr, "Phantom", "phantom");
        if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Phantom did not stay.");
      }
      const each = Math.round((n / LEGS.length) * 100) / 100;
      for (const leg of LEGS) {
        const done = await signRoute({
          owner: addr,
          inputMint: USDC,
          outputMint: leg.mint,
          amountRaw: Math.round(each * 1e6),
          outDecimals: 8,
          usd: each,
        });
        toast.success(`${done.outUi.toFixed(4)} ${leg.symbol}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The fund did not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[28px] bg-[#141824] p-4">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">ETF</p>
      <h2 className="mt-1 text-xl">SPYx and QQQx</h2>
      <p className="mt-1 text-sm text-subtle">Half the dollars in each. The wallet signs twice. Both tokens stay in it.</p>
      <input value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal" aria-label="Dollars" className="mt-3 w-full bg-transparent font-mono text-4xl outline-none" />
      <button type="button" disabled={busy} onClick={() => void buy()} className="mt-3 min-h-12 w-full rounded-full bg-[#d7e36a] text-sm font-semibold text-black disabled:opacity-40">
        {busy ? "Waiting on the wallet" : `Buy $${usd || "0"} of the pair`}
      </button>
    </section>
  );
}
