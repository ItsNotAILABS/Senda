import { useEffect, useState } from "react";
import { toast } from "sonner";
import { placeLimit, restingOrders, type RestingOrder } from "@/lib/jup-limit";
import { USDC } from "@/lib/jup-exec";
import { connectPhantom, mintDecimals } from "@/lib/phantom";
import { loadCoins } from "@/lib/coin-tape";

/** A resting Jupiter order. It does not fill in this tab. Jupiter fills it. */
export function OrdersDesk() {
  const [owner, setOwner] = useState("");
  const [mint, setMint] = useState("");
  const [symbol, setSymbol] = useState("");
  const [px, setPx] = useState("");
  const [usd, setUsd] = useState("5");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [rows, setRows] = useState<RestingOrder[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadCoins()
      .then((coins) => {
        const row = coins.find((c) => c.symbol !== "USDC");
        if (!row) return;
        setMint(row.id);
        setSymbol(row.symbol);
        setPx(String(row.price));
      })
      .catch(() => undefined);
  }, []);

  async function refresh(who = owner) {
    if (!who) return;
    setRows(await restingOrders(who).catch(() => []));
  }

  async function sign() {
    const price = Number(px);
    const size = Number(usd);
    if (!mint || !(price > 0) || !(size > 0)) {
      toast.error("Need a mint, a limit price, and a size.");
      return;
    }
    setBusy(true);
    try {
      const who = owner || (await connectPhantom());
      setOwner(who);
      const decimals = await mintDecimals(mint);
      const tokens = BigInt(Math.max(1, Math.floor((size / price) * 10 ** decimals)));
      const usdc = String(Math.round(size * 1_000_000));
      const done = await placeLimit(
        side === "buy"
          ? { maker: who, inputMint: USDC, outputMint: mint, makingAmount: usdc, takingAmount: tokens.toString() }
          : { maker: who, inputMint: mint, outputMint: USDC, makingAmount: tokens.toString(), takingAmount: usdc },
      );
      toast.success(`Limit resting. ${done.signature.slice(0, 8)}…`);
      await refresh(who);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The limit order did not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 py-6">
      <p className="font-mono text-[10px] tracking-[0.16em] text-white/40 uppercase">Orders</p>
      <h1 className="text-3xl tracking-tight">A limit, not a market.</h1>
      <p className="text-sm leading-relaxed text-white/50">
        A buy pays USDC. A sell pays the token. Jupiter rests it until the other side is there. Phantom signs. Senda does not match it, and it does not invent a fill.
      </p>
      <label className="block text-xs text-white/45">
        Token mint {symbol ? `· ${symbol}` : ""}
        <input value={mint} onChange={(e) => setMint(e.target.value.trim())} spellCheck={false} className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 font-mono text-xs outline-none" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setSide("buy")} className={`min-h-11 rounded-full text-sm font-semibold ${side === "buy" ? "bg-accent text-accent-fg" : "border border-white/10"}`}>Buy limit</button>
        <button type="button" onClick={() => setSide("sell")} className={`min-h-11 rounded-full text-sm font-semibold ${side === "sell" ? "bg-white text-black" : "border border-white/10"}`}>Sell limit</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-white/45">
          Limit price, USD
          <input value={px} onChange={(e) => setPx(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 font-mono text-sm outline-none" />
        </label>
        <label className="block text-xs text-white/45">
          USDC
          <input value={usd} onChange={(e) => setUsd(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 font-mono text-sm outline-none" />
        </label>
      </div>
      <button type="button" disabled={busy} onClick={() => void sign()} className="h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
        {busy ? "Waiting on Phantom" : "Sign the limit"}
      </button>
      <button type="button" onClick={() => void refresh()} className="text-xs font-semibold text-white/50">
        Refresh resting orders
      </button>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.order} className="rounded-xl border border-white/10 px-3 py-2 font-mono text-[11px]">
            {row.order.slice(0, 8)}… paying {row.makingAmount} for {row.takingAmount}
          </li>
        ))}
      </ul>
      {!rows.length ? <p className="text-xs text-white/35">No active trigger orders came back for this wallet.</p> : null}
    </div>
  );
}
