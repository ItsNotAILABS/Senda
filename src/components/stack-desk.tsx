import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BookLine } from "@/components/book-line";
import { ProtocolRail } from "@/components/protocol-rail";
import { kaminoMarkets, signKamino, type KaminoReserve } from "@/lib/kamino-lend";
import { checkBook, type BookVerdict } from "@/lib/book-check";
import { USDC } from "@/lib/jup-exec";
import { quoteRoute, signRoute, SOL } from "@/lib/jup-sign";
import { readMintFlags } from "@/lib/mint-flags";
import { connectPhantom, readChain } from "@/lib/phantom";
import { annualVol, deal, modelPremium, windowAverage, type StackSide } from "@/lib/stack-math";
import { useWalletCtx } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const LIFTS = [0, 5, 10];
const DAYS = [7, 14, 28];

function money(n: number): string {
  if (!(n > 0) || !Number.isFinite(n)) return "—";
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function StackDesk() {
  const wallet = useWalletCtx();
  const linked = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [side, setSide] = useState<StackSide>("call");
  const [sizeText, setSizeText] = useState("0.5");
  const [lift, setLift] = useState(5);
  const [days, setDays] = useState(14);
  const [spot, setSpot] = useState(0);
  const [move, setMove] = useState<number | null>(null);
  const [prints, setPrints] = useState<number[]>([]);
  const [spotLine, setSpotLine] = useState("Asking Jupiter for the SOL price.");
  const [reserves, setReserves] = useState<KaminoReserve[]>([]);
  const [held, setHeld] = useState("");
  const [quoteLine, setQuoteLine] = useState("");
  const [outUi, setOutUi] = useState(0);
  const [verdict, setVerdict] = useState<BookVerdict | null>(null);
  const [busy, setBusy] = useState<"swap" | "lend" | "">("");

  const size = Number(sizeText);
  const row = deal({ side, spot, size, liftPct: lift, days });
  const reserve = reserves.find((item) => item.marketName === "Main" && item.symbol === (side === "call" ? "SOL" : "USDC")) ?? null;
  const sizeUsd = side === "call" ? size * spot : size;
  const vol = move == null ? null : annualVol(move);
  const priced = row && vol ? modelPremium({ side, spot, strike: row.strike, sol: row.sol, days, vol }) : null;
  const atm = vol && row ? modelPremium({ side, spot, strike: spot, sol: row.sol, days, vol }) : null;
  const windowPx = windowAverage(prints);
  const lendWindow = reserve && sizeUsd > 0 ? sizeUsd * reserve.supplyApy * (days / 365) : 0;

  useEffect(() => {
    let live = true;
    const pull = () =>
      fetch(`https://lite-api.jup.ag/price/v3?ids=${SOL}`)
        .then((res) => res.json() as Promise<Record<string, { usdPrice?: number; priceChange24h?: number }>>)
        .then((body) => {
          if (!live) return;
          const px = Number(body[SOL]?.usdPrice);
          const day = Number(body[SOL]?.priceChange24h);
          if (px > 0) {
            setSpot(px);
            setPrints((cur) => (cur[cur.length - 1] === px ? cur : [...cur, px].slice(-30)));
            setSpotLine("");
          } else setSpotLine("Jupiter did not price SOL.");
          setMove(Number.isFinite(day) ? day : null);
        })
        .catch(() => live && setSpotLine("Jupiter did not price SOL."));
    void pull();
    const id = window.setInterval(pull, 20_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    kaminoMarkets()
      .then(setReserves)
      .catch(() => setReserves([]));
  }, []);

  useEffect(() => {
    if (!linked) {
      setHeld("");
      return;
    }
    readChain(linked)
      .then((chain) => {
        const usdc = chain.tokens.find((t) => t.symbol === "USDC")?.ui;
        setHeld(`Wallet ${chain.sol.toFixed(3)} SOL · ${usdc != null ? usdc.toFixed(2) : "0.00"} USDC`);
      })
      .catch(() => setHeld(""));
  }, [linked]);

  useEffect(() => {
    setQuoteLine("Asking Jupiter.");
    setVerdict(null);
    setOutUi(0);
  }, [side, size]);

  useEffect(() => {
    if (!(size > 0)) return;
    let live = true;
    const call = side === "call";
    const amountRaw = Math.floor(size * (call ? 1e9 : 1e6));
    quoteRoute({
      inputMint: call ? SOL : USDC,
      outputMint: call ? USDC : SOL,
      amountRaw,
      outDecimals: call ? 6 : 9,
    })
      .then(async (q) => {
        if (!live) return;
        const flags = await readMintFlags(call ? USDC : SOL);
        if (!live) return;
        const next = checkBook({
          inMint: call ? SOL : USDC,
          outMint: call ? USDC : SOL,
          inRaw: q.inAmount,
          outRaw: q.outAmount,
          minRaw: q.otherAmountThreshold || q.outAmount,
          inDecimals: call ? 9 : 6,
          outDecimals: call ? 6 : 9,
          impactPct: q.impact,
          slippageBps: 100,
          shownIn: call ? undefined : size,
          mark: spot > 0 ? spot : undefined,
          symbol: "SOL",
          paused: flags.paused,
          frozenDefault: flags.frozenDefault,
          fees: flags.fees,
        });
        setOutUi(q.outUi);
        setVerdict(next);
        setQuoteLine("");
      })
      .catch((error: unknown) => {
        if (!live) return;
        setOutUi(0);
        setVerdict(null);
        setQuoteLine(error instanceof Error ? error.message : "Jupiter did not quote.");
      });
    return () => {
      live = false;
    };
  }, [side, size, spot]);

  async function swap() {
    if (!(size > 0) || verdict?.ok === false) return;
    setBusy("swap");
    try {
      const owner = linked || (await connectPhantom());
      const call = side === "call";
      const done = await signRoute({
        owner,
        inputMint: call ? SOL : USDC,
        outputMint: call ? USDC : SOL,
        amountRaw: Math.floor(size * (call ? 1e9 : 1e6)),
        outDecimals: call ? 6 : 9,
        inDecimals: call ? 9 : 6,
        usd: sizeUsd,
        symbol: "SOL",
        refPrice: spot || undefined,
      });
      toast.success(`Jupiter filled. ${done.outUi.toFixed(call ? 2 : 4)} ${call ? "USDC" : "SOL"} out.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The swap did not send.");
    } finally {
      setBusy("");
    }
  }

  async function lend() {
    if (!reserve || !(size > 0)) return;
    setBusy("lend");
    try {
      const owner = linked || (await connectPhantom());
      const sig = await signKamino({
        action: "deposit",
        wallet: owner,
        market: reserve.market,
        reserve: reserve.reserve,
        amount: String(size),
      });
      toast.success(`Kamino deposit sent. ${sig.slice(0, 8)}…`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kamino did not build that.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-3 p-3">
      <p className="text-sm leading-snug text-white/60">
        One amount. Senda prices the option from the day's move. Jupiter can swap it. Kamino can lend it. You sign the one you pick.
      </p>
      {held ? <p className="font-mono text-xs text-white/45">{held}</p> : null}
      <div className="flex gap-2">
        {(
          [
            ["call", "Covered call"],
            ["put", "Cash-secured put"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setSide(id);
              setSizeText(id === "call" ? "0.5" : "50");
            }}
            className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold", side === id ? "bg-white text-black" : "bg-[#2a2a2e]")}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="block text-xs text-white/45">
        {side === "call" ? "SOL you would lock" : "USDC you would lock"}
        <input
          value={sizeText}
          onChange={(e) => setSizeText(e.target.value.replace(/[^0-9.]/g, ""))}
          inputMode="decimal"
          className="mt-1 min-h-12 w-full rounded-2xl bg-[#1c1c1e] px-4 font-mono text-lg outline-none"
        />
      </label>
      <div className="flex gap-2">
        {(side === "call" ? [0.1, 0.5, 1] : [25, 50, 100]).map((n) => (
          <button key={n} type="button" onClick={() => setSizeText(String(n))} className={cn("min-h-9 flex-1 rounded-full font-mono text-xs", Number(sizeText) === n ? "bg-white text-black" : "bg-[#2a2a2e]")}>
            {n}
          </button>
        ))}
      </div>
      <div className="rounded-[22px] bg-[#101114] p-4">
        <p className="text-[11px] tracking-[0.14em] text-white/45 uppercase">Jupiter · SOL</p>
        <p className="mt-1 font-mono text-3xl tabular-nums">{spot > 0 ? money(spot) : "—"}</p>
        <p className="mt-1 font-mono text-sm text-[#c6f56a]">
          {priced ? `${money(priced)} at this strike` : "Premium waits on a day move."}
          {atm ? ` · ${money(atm)} at the money` : ""}
        </p>
        {spotLine ? <p className="mt-1 text-sm text-white/50">{spotLine}</p> : null}
        <p className="mt-2 text-sm text-white/55">
          {vol ? `Vol ${(vol * 100).toFixed(1)}% from today's ${move! >= 0 ? "+" : ""}${move!.toFixed(2)}% move, annualized.` : "A flat day gives Senda no volatility, so it does not invent one."}
          {windowPx ? ` Window ${money(windowPx)} across ${prints.length} prints on this screen.` : " The window starts with the next print."}
        </p>
        <div className="mt-3 flex gap-2">
          {LIFTS.map((n) => (
            <button key={n} type="button" onClick={() => setLift(n)} className={cn("min-h-9 flex-1 rounded-full text-xs font-semibold", lift === n ? "bg-white text-black" : "bg-[#2a2a2e]")}>
              {n === 0 ? "ATM" : side === "call" ? `+${n}%` : `−${n}%`}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          {DAYS.map((n) => (
            <button key={n} type="button" onClick={() => setDays(n)} className={cn("min-h-9 flex-1 rounded-full text-xs font-semibold", days === n ? "bg-white text-black" : "bg-[#2a2a2e]")}>
              {n}d
            </button>
          ))}
        </div>
        {row ? (
          <div className="mt-3 space-y-2 text-sm leading-snug">
            <p>
              Strike <span className="font-mono">{money(row.strike)}</span>. Only the price at the end counts. A spike before day {row.days} does not settle it.
            </p>
            {side === "call" ? (
              <>
                <p>Finishes at or under the strike: you keep {row.sol} SOL.</p>
                <p>Finishes over the strike: you sell {row.sol} SOL at {money(row.strike)} and receive {money(row.usdc)}. Anything above the strike is not yours.</p>
              </>
            ) : (
              <>
                <p>Finishes at or over the strike: you keep {money(row.usdc)}.</p>
                <p>Finishes under the strike: you buy {row.sol.toFixed(4)} SOL at {money(row.strike)}, and the {money(row.usdc)} pays for it.</p>
              </>
            )}
            <p className="text-white/50">The model premium is what Senda prices this option at. It is not a bid, and nobody has paid it yet. Collateral is not locked.</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-white/50">{size > 0 ? "Waiting on the SOL price." : "Enter a size."}</p>
        )}
      </div>
      <div className="rounded-[22px] bg-[#101114] p-4">
        <p className="text-[11px] tracking-[0.14em] text-white/45 uppercase">Jupiter · cash now</p>
        <p className="mt-1 text-sm text-white/60">
          {side === "call" ? "Sell the SOL now. This is cash, not the option." : "Buy the SOL now, at today's price, instead of the strike."}
        </p>
        <p className="mt-2 font-mono text-xl tabular-nums">
          {outUi > 0 ? (side === "call" ? `${money(outUi)} USDC` : `${outUi.toFixed(4)} SOL`) : "—"}
        </p>
        {quoteLine ? <p className="mt-1 text-sm text-white/50">{quoteLine}</p> : null}
        {verdict ? <BookLine ok={verdict.ok} line={verdict.line} warn={verdict.warn} /> : null}
        <button type="button" disabled={busy !== "" || !(size > 0) || verdict?.ok === false} onClick={() => void swap()} className="mt-3 min-h-12 w-full rounded-full bg-[#c6f56a] text-sm font-semibold text-black disabled:opacity-40">
          {busy === "swap" ? "Waiting on Phantom" : side === "call" ? "Swap SOL for USDC" : "Swap USDC for SOL"}
        </button>
      </div>
      <div className="rounded-[22px] bg-[#101114] p-4">
        <p className="text-[11px] tracking-[0.14em] text-white/45 uppercase">Kamino · lend it</p>
        {reserve ? (
          <>
            <p className="mt-1 font-mono text-xl">{(reserve.supplyApy * 100).toFixed(2)}% supply</p>
            <p className="mt-1 text-sm text-white/55">
              {sizeUsd > 0
                ? `About ${money(sizeUsd * reserve.supplyApy)} a year, ${money(lendWindow)} over these ${days} days. It moves. Not a promise. `
                : "Enter a size. "}
              ${Math.round(reserve.totalSupplyUsd).toLocaleString("en-US")} is already supplied.
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-white/50">Kamino has not returned the {side === "call" ? "SOL" : "USDC"} reserve.</p>
        )}
        <button type="button" disabled={busy !== "" || !reserve || !(size > 0)} onClick={() => void lend()} className="mt-3 min-h-12 w-full rounded-full bg-white text-sm font-semibold text-black disabled:opacity-40">
          {busy === "lend" ? "Waiting on Phantom" : `Deposit ${size || 0} ${side === "call" ? "SOL" : "USDC"}`}
        </button>
        <p className="mt-2 text-[11px] leading-snug text-white/40">
          {priced && lendWindow > 0 ? `Over ${days} days the model pays ${money(priced)} and Kamino pays ${money(lendWindow)}. They are different jobs.` : "The model and the lend rate are different jobs."}
        </p>
      </div>
      <ProtocolRail owner={linked} solPx={spot} />
    </div>
  );
}
