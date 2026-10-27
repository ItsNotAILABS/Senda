import { useState } from "react";
import { toast } from "sonner";
import { connectPhantom } from "@/lib/phantom";
import { payUsdc } from "@/lib/solana-pay";
import { rememberTrade } from "@/lib/trade-log";
import { USDC } from "@/lib/jup-exec";
import { cn } from "@/lib/utils";

const RAILS = [
  { id: "coinbase", title: "Coinbase", line: "Paste the Solana USDC address Coinbase is showing. They sell it to dollars in Coinbase. Senda does not." },
  { id: "binance", title: "Binance", line: "Paste the address Binance shows for USDC on Solana. The network has to say Solana. They withdraw inside Binance." },
  { id: "kraken", title: "Kraken", line: "Paste the Solana address Kraken shows for USDC. They cash it out in Kraken." },
  { id: "person", title: "A person", line: "Their Phantom address. They hold the USDC. There is no bank on this one." },
  { id: "kucoin", title: "KuCoin", line: "Paste the Solana USDC address KuCoin is showing. They credit the dollars. A KuCoin card, in a country where they offer one, spends that balance. Senda does not see the card." },
] as const;

/** Five ways out that are not Bitso. Each one is a USDC send to an address the user pastes. */
export function OutRails({ owner }: { owner: string }) {
  const [rail, setRail] = useState<(typeof RAILS)[number]["id"]>("person");
  const [usd, setUsd] = useState("5");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const picked = RAILS.find((row) => row.id === rail) ?? RAILS[3];

  async function send() {
    const n = Number(usd);
    if (!(n >= 0.01) || !to.trim()) {
      toast.error("Enter the amount and the address they are showing now.");
      return;
    }
    setBusy(true);
    try {
      const who = owner || (await connectPhantom());
      const paid = await payUsdc({ owner: who, to: to.trim(), usd: n, memo: rail });
      rememberTrade({ symbol: "USDC", side: "send", usd: n, mint: USDC, signature: paid.signature });
      toast.success(`Sent. ${paid.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The wallet did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 border-t border-white/10 pt-4">
      <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">Not Bitso</p>
      <h3 className="text-lg font-semibold">Five other ways out.</h3>
      <p className="text-sm text-muted">None of these is a bank transfer from Senda. You paste a fresh Solana address. Phantom sends USDC. The other company, or the person, does the rest.</p>
      <div className="flex flex-wrap gap-1">
        {RAILS.map((row) => (
          <button key={row.id} type="button" onClick={() => setRail(row.id)} className={cn("min-h-9 rounded-full px-3 text-xs font-semibold", rail === row.id ? "bg-white text-black" : "border border-white/10 text-muted")}>
            {row.title}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">{picked.line}</p>
      <input value={usd} onChange={(e) => setUsd(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="USDC to send" className="w-full bg-transparent font-mono text-4xl outline-none" />
      <input value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="Solana address" spellCheck={false} className="min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-xs" />
      <button type="button" disabled={busy || !to} onClick={() => void send()} className="min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
        {busy ? "Waiting on Phantom" : `Send $${usd || "0"} USDC`}
      </button>
      <p className="text-[11px] text-subtle">A debit card is not printed here. Coinbase’s Visa spends the dollars after this USDC lands on the Coinbase address. Bitso’s card spends the pesos after the Bitso send above. The card company is the one that swipes.</p>
    </section>
  );
}
