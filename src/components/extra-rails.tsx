import { useEffect, useState } from "react";
import { toast } from "sonner";
import { dflowOrder, dflowQuote } from "@/lib/dflow";
import { bindDflowTx } from "@/lib/dflow-bind";
import { placeLimit } from "@/lib/jup-limit";
import { quoteJup, USDC } from "@/lib/jup-exec";
import { pythMark } from "@/lib/pyth-mark";
import { chainRpc, connectPhantom, liveSolAddress, sendVersioned } from "@/lib/phantom";
import { marginfiBanks, type MarginBank } from "@/lib/marginfi";

/** DFlow next to the Jupiter quote, a Pyth mark for the majors, and a Jupiter limit. Not a second Buy for an xStock. */
export function ExtraRails({
  mint,
  symbol,
  usd,
  side,
  price,
  decimals,
  jupOut,
}: {
  mint: string;
  symbol: string;
  usd: number;
  side: "buy" | "sell";
  price: number;
  decimals: number;
  jupOut: number;
}) {
  const [dflow, setDflow] = useState("");
  const [better, setBetter] = useState(false);
  const [pyth, setPyth] = useState("");
  const [limit, setLimit] = useState(price > 0 ? String(price) : "");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!(price > 0)) return;
    setLimit(String(price));
  }, [price, symbol]);

  useEffect(() => {
    if (!(usd > 0) || mint.length < 32) return;
    let on = true;
    dflowQuote({ data: { mint, usd, side, price, decimals } })
      .then((row) => {
        if (!on) return;
        if (!row.ok) {
          setDflow(row.reason);
          setBetter(false);
          return;
        }
        const out = Number(row.outAmount) / 10 ** (side === "buy" ? decimals : 6);
        const ahead = jupOut > 0 && out > jupOut * 1.0001;
        setBetter(ahead);
        setDflow(ahead ? `DFlow pays more: ${out.toFixed(4)} vs Jupiter ${jupOut.toFixed(4)}.` : `Jupiter is ahead or tied. DFlow would pay ${out.toFixed(4)}.`);
      })
      .catch(() => on && setDflow("DFlow did not answer."));
    pythMark({ data: { symbol } })
      .then((row) => on && setPyth(row.ok ? `Pyth ${row.symbol} ${row.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : row.reason))
      .catch(() => on && setPyth("Pyth did not answer."));
    return () => {
      on = false;
    };
  }, [mint, usd, side, price, decimals, symbol, jupOut]);

  async function signDflow() {
    setBusy("dflow");
    try {
      const owner = liveSolAddress() || (await connectPhantom());
      const row = await dflowOrder({ data: { owner, mint, usd, side, price, decimals } });
      if (!row.ok || !row.transaction) throw new Error(row.ok ? "DFlow did not return a transaction." : row.reason);
      const jup = await quoteJup({ data: { mint, usd, side, price, decimals } });
      if ("error" in jup) throw new Error(jup.error);
      const inputMint = side === "buy" ? USDC : mint;
      const outputMint = side === "buy" ? mint : USDC;
      const amount = side === "sell" && price > 0 ? Math.round((usd / price) * 10 ** decimals) : Math.round(usd * 1e6);
      const tx = await bindDflowTx(
        { quote: row, transaction: row.transaction, owner, inputMint, outputMint, amount, jupiterOut: jup.outAmount },
        chainRpc,
      );
      const sig = await sendVersioned(tx);
      toast.success(`DFlow signed. solscan.io/tx/${sig}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "DFlow did not send.");
    } finally {
      setBusy("");
    }
  }

  async function restLimit() {
    const px = Number(limit);
    if (!(px > 0) || !(usd >= 5)) {
      toast.error("A Jupiter limit needs a price and at least $5.");
      return;
    }
    setBusy("limit");
    try {
      const owner = liveSolAddress() || (await connectPhantom());
      const making = side === "buy" ? Math.round(usd * 1e6) : Math.max(1, Math.round((usd / price) * 10 ** decimals));
      const taking = side === "buy" ? Math.max(1, Math.round((usd / px) * 10 ** decimals)) : Math.round(usd * 1e6);
      const done = await placeLimit({
        maker: owner,
        inputMint: side === "buy" ? USDC : mint,
        outputMint: side === "buy" ? mint : USDC,
        makingAmount: String(making),
        takingAmount: String(taking),
      });
      toast.success(`Limit resting. solscan.io/tx/${done.signature}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The limit was not placed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mt-3 space-y-2 px-4 text-sm">
      <p className="text-white/70">{dflow || "Asking DFlow…"}</p>
      {better ? (
        <button type="button" disabled={busy !== ""} onClick={() => void signDflow()} className="min-h-11 w-full rounded-full border border-[#d7e36a]/50 text-sm font-semibold text-[#d7e36a] disabled:opacity-40">
          {busy === "dflow" ? "Waiting for the wallet…" : "Sign the DFlow route"}
        </button>
      ) : null}
      <p className="text-white/55">{pyth || "Asking Pyth…"}</p>
      <label className="block text-xs text-white/45">
        Limit price
        <input value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^0-9.]/g, ""))} className="mt-1 min-h-11 w-full rounded-xl bg-black/40 px-3 font-mono text-sm outline-none" />
      </label>
      <button type="button" disabled={busy !== "" || usd < 5} onClick={() => void restLimit()} className="min-h-11 w-full rounded-full bg-white/10 text-sm font-semibold disabled:opacity-40">
        {busy === "limit" ? "Waiting for the wallet…" : "Place Jupiter limit"}
      </button>
      <p className="text-[11px] text-white/40">The market button above is still Jupiter. A limit rests until the pool reaches this price. It is not a fill.</p>
    </div>
  );
}

export function MarginfiBook() {
  const [rows, setRows] = useState<MarginBank[]>([]);
  const [line, setLine] = useState("Reading Marginfi banks.");

  useEffect(() => {
    marginfiBanks()
      .then((out) => {
        setRows(out.rows);
        setLine(out.reason);
      })
      .catch(() => setLine("Marginfi did not answer. No deposit is offered."));
  }, []);

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4">
      <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Solana · Marginfi</p>
      <p className="mt-2 text-sm text-white/60">{line}</p>
      {rows.length ? (
        <ul className="mt-3 divide-y divide-white/10">
          {rows.map((row) => (
            <li key={row.symbol} className="flex items-baseline justify-between gap-3 py-2 text-sm">
              <span className="font-semibold">{row.symbol}</span>
              <span className="font-mono text-xs text-white/60">
                supply {(row.supplyApy * 100).toFixed(2)}% · borrow {(row.borrowApy * 100).toFixed(2)}%
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-[11px] text-white/40">Use it only when the borrow rate is better than Kamino. This desk will not sign a Marginfi deposit until a bank transaction comes back.</p>
    </section>
  );
}
