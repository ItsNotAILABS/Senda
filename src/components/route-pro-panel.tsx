import { useState } from "react";
import { toast } from "sonner";
import { USDC } from "@/lib/jup-exec";
import { raceRoute } from "@/lib/jup-sign";
import { routePro, saveRoutePro, type RoutePro } from "@/lib/route-pro";
import { cn } from "@/lib/utils";

const XRP = "6UpQcMAb5xMzxc7ZfPaVMgx3KqsvKZdT5U718BzD5We2";

/** Pro route controls. Fast is a quote race. It is not a claim that the fill lands in that many milliseconds. */
export function RouteProPanel() {
  const [pro, setPro] = useState<RoutePro>(routePro);
  const [line, setLine] = useState("");
  const [busy, setBusy] = useState(false);

  function put(next: RoutePro) {
    setPro(next);
    saveRoutePro(next);
  }

  async function probe() {
    setBusy(true);
    setLine("");
    try {
      const raced = await raceRoute({
        inputMint: USDC,
        outputMint: XRP,
        amountRaw: 5_000_000,
        outDecimals: 6,
        pro,
      });
      const text = `XRP $${5} → ${raced.outUi.toLocaleString("en-US", { maximumFractionDigits: 4 })} · ${raced.why} · impact ${raced.impact.toFixed(2)}%`;
      setLine(text);
      toast.success(text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Jupiter did not quote.";
      setLine(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[24px] border border-white/10 bg-[#101114] p-4">
      <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">Pro route</p>
      <h2 className="mt-1 text-lg font-semibold">Smart route</h2>
      <p className="mt-1 text-xs leading-relaxed text-white/50">
        Fast takes the first quote that clears the impact cap and does not wait for the slower lane. Best price still compares both. The time shown is the quote. You still sign. The chain lands the fill after that.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["fast", "price"] as const).map((aim) => (
          <button key={aim} type="button" onClick={() => put({ ...pro, aim })} className={cn("min-h-10 rounded-full px-3 text-xs font-semibold", pro.aim === aim ? "bg-white text-black" : "bg-white/10")}>
            {aim === "fast" ? "Fast" : "Best price"}
          </button>
        ))}
        <button type="button" onClick={() => put({ ...pro, direct: !pro.direct })} className={cn("min-h-10 rounded-full px-3 text-xs font-semibold", pro.direct ? "bg-white text-black" : "bg-white/10")}>
          {pro.direct ? "Direct only" : "Direct or multi-hop"}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {([30, 50, 80, 100] as const).map((n) => (
          <button key={n} type="button" onClick={() => put({ ...pro, slippageBps: n })} className={cn("min-h-10 rounded-full px-3 font-mono text-xs", pro.slippageBps === n ? "bg-accent text-accent-fg" : "bg-white/10")}>
            {(n / 100).toFixed(2)}% slip
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {([0.5, 1, 3, 5] as const).map((n) => (
          <button key={n} type="button" onClick={() => put({ ...pro, maxImpact: n })} className={cn("min-h-10 rounded-full px-3 font-mono text-xs", pro.maxImpact === n ? "bg-accent text-accent-fg" : "bg-white/10")}>
            {n}% impact
          </button>
        ))}
      </div>
      <button type="button" disabled={busy} onClick={() => void probe()} className="mt-3 min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:opacity-40">
        {busy ? "Quoting XRP…" : "Time a $5 XRP quote"}
      </button>
      {line ? <p className="mt-2 font-mono text-[11px] leading-relaxed text-white/60">{line}</p> : null}
    </section>
  );
}
