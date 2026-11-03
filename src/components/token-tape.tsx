import { useEffect, useState } from "react";
import { toast } from "sonner";
import { connectPhantom } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { loadTape, type TapeCoin } from "@/lib/jup-tape";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

function px(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const s = n.toPrecision(3);
  return `$${s}`;
}

export function TokenTape() {
  const wallet = useWallet();
  const [rows, setRows] = useState<TapeCoin[]>([]);
  const [q, setQ] = useState("");
  const [usd, setUsd] = useState(5);
  const [busy, setBusy] = useState("");
  useEffect(() => {
    let live = true;
    loadTape()
      .then((next) => {
        if (live) setRows(next);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  const query = q.trim().toLowerCase();
  const shown = query
    ? rows.filter((r) => r.symbol.toLowerCase().includes(query) || r.name.toLowerCase().includes(query))
    : rows;

  async function trade(item: TapeCoin, side: "buy" | "sell") {
    setBusy(`${item.id}:${side}`);
    try {
      const existing = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      const owner = existing || (await connectPhantom());
      if (!existing) {
        const linked = wallet.linkChain(owner, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      const done = await runPrestock({ owner, mint: item.id, side, usd, price: item.price });
      toast.success(`${item.symbol} signed. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The swap did not send.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="px-3 py-3">
      <p className="text-[11px] tracking-[0.16em] text-[#d7e36a]">SPOT</p>
      <h2 className="mt-1 text-3xl font-semibold tracking-tight">Every coin, in its own card.</h2>
      <p className="mt-2 text-sm text-white/55">
        {rows.length || "—"} Solana markets Jupiter is trading. Traded, trending, and organic. Search any of them. The swap is the mint you tap.
      </p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="SOL, NVDA, Anduril"
        className="mt-4 min-h-12 w-full rounded-full bg-[#1c1c1e] px-4 text-sm outline-none placeholder:text-white/35"
      />
      <div className="mt-3 flex gap-2">
        {[1, 5, 25].map((n) => (
          <button key={n} type="button" onClick={() => setUsd(n)} className={cn("grid size-11 place-items-center rounded-full font-mono text-sm", usd === n ? "bg-white text-black" : "bg-[#2a2a2e] text-white")}>
            ${n}
          </button>
        ))}
      </div>
      {shown.length === 0 ? <p className="mt-6 text-sm text-white/50">{rows.length === 0 ? "Reading Jupiter." : "No coin by that name."}</p> : null}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {shown.map((item) => (
          <article key={item.id} className="flex flex-col rounded-[22px] bg-[#16181e] p-4">
            <div className="flex items-center gap-2">
              {item.icon ? (
                <img src={item.icon} alt="" className="size-8 rounded-full bg-white/10 object-cover" />
              ) : (
                <span className="grid size-8 place-items-center rounded-full bg-[#2a2e38] text-[10px] text-white/50">?</span>
              )}
              <span>
                <span className="block text-sm font-semibold">{item.symbol}</span>
                <span className={cn("block text-xs", item.change < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]")}>
                  {item.change >= 0 ? "+" : ""}
                  {item.change.toFixed(1)}%
                </span>
              </span>
            </div>
            <p className="mt-8 font-mono text-2xl tabular-nums">{px(item.price)}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" disabled={busy !== ""} onClick={() => void trade(item, "buy")} className="min-h-11 rounded-full bg-[#d7e36a] text-sm font-semibold text-black disabled:opacity-50">
                {busy === `${item.id}:buy` ? "…" : `Buy $${usd}`}
              </button>
              <button type="button" disabled={busy !== ""} onClick={() => void trade(item, "sell")} className="min-h-11 rounded-full border border-white/15 text-sm font-semibold disabled:opacity-50">
                {busy === `${item.id}:sell` ? "…" : `Sell $${usd}`}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}