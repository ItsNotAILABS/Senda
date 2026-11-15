import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SOL, signRoute } from "@/lib/jup-sign";
import { VALIDATORS, deactivateStake, delegateSol, listStakeAccounts, type StakeAcct } from "@/lib/native-stake";
import { connectPhantom } from "@/lib/phantom";
import { rememberTrade } from "@/lib/trade-log";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const STAKES = [
  { symbol: "JitoSOL", mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", line: "Jito. The deepest liquid stake." },
  { symbol: "JupSOL", mint: "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v", line: "Jupiter’s validator." },
  { symbol: "mSOL", mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", line: "Marinade." },
  { symbol: "INF", mint: "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm", line: "Sanctum basket of stakes." },
  { symbol: "bSOL", mint: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1", line: "BlazeStake." },
  { symbol: "hSOL", mint: "he1iusmfkpAdwvxLNGV8Y1iSbj4rUy6yMhEA3fotn9A", line: "Helius." },
  { symbol: "dSOL", mint: "Dso1bDeDjCQxTrWHqUUi63oBvV7Mdm6WaobLbQ7gnPQ", line: "Drift." },
  { symbol: "PSOL", mint: "pSo1f9nQXWgXibFtKf7NWYxb5enAM4qfP6UJSiXRQfL", line: "Phantom." },
  { symbol: "bbSOL", mint: "Bybit2vBJGhPF52GBdNaQfUJ6ZpThSgHBobjWZpLPb4B", line: "Bybit." },
  { symbol: "vSOL", mint: "vSoLxydx6akxyMD9XEcPvGYNGq6Nn66oqVb3UkGkei7", line: "The Vault." },
  { symbol: "JSOL", mint: "7Q2afV64in6N6SeZsAAB81TJzwDoD6zpqmHkzi9Dcavn", line: "JPool." },
  { symbol: "BNSOL", mint: "BNso1VUJnh4zcfpZa6986Ea66P6TCp59hvtNJ8b1X85", line: "Binance." },
  { symbol: "bonkSOL", mint: "BonK1YhkXEGLZzwtcvRTip3gAL9nCeQD7ppZBLXhtTs", line: "Bonk." },
  { symbol: "bpSOL", mint: "BPSoLzmLQn47EP5aa7jmFngRL8KC3TWAeAwXwZD8ip3P", line: "Backpack." },
  { symbol: "hyloSOL", mint: "hy1oXYgrBW6PVcJ4s6s2FKavRdwgWTXdfE69AxT7kPT", line: "Hylo." },
] as const;

/** Liquid stake. Jupiter builds the swap. Phantom signs. Nothing is locked at a validator from here. */
export function StakeBoard({ owner }: { owner: string }) {
  const wallet = useWallet();
  const [pick, setPick] = useState<(typeof STAKES)[number]>(STAKES[0]);
  const [mode, setMode] = useState<"liquid" | "validator">("validator");
  const [validator, setValidator] = useState<(typeof VALIDATORS)[number]>(VALIDATORS[0]);
  const [accounts, setAccounts] = useState<StakeAcct[]>([]);
  const [amount, setAmount] = useState("0.05");
  const [q, setQ] = useState("");
  const [px, setPx] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState("");
  const [fail, setFail] = useState("");
  const solPx = px[SOL] || 0;
  const shown = STAKES.filter((row) => `${row.symbol} ${row.line}`.toLowerCase().includes(q.trim().toLowerCase()));

  useEffect(() => {
    let live = true;
    const ids = [SOL, ...STAKES.map((row) => row.mint)].join(",");
    void fetch(`https://lite-api.jup.ag/price/v3?ids=${ids}`, { headers: { accept: "application/json" } })
      .then((r) => r.json() as Promise<Record<string, { usdPrice?: number }>>)
      .then((body) => {
        if (!live) return;
        const next: Record<string, number> = {};
        for (const [mint, row] of Object.entries(body)) next[mint] = Number(row?.usdPrice) || 0;
        setPx(next);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    setAccounts(listStakeAccounts());
  }, []);

  async function delegate() {
    const n = Number(amount);
    if (!(n >= 0.01)) return toast.error("Stake at least 0.01 SOL.");
    setBusy("delegate");
    setFail("");
    try {
      const addr = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(addr, "Phantom", "phantom");
        if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Phantom did not stay.");
      }
      const sig = await delegateSol(addr, validator.vote, validator.name, n);
      rememberTrade({ symbol: "SOL", side: "buy", usd: n * (solPx || 0), mint: validator.vote, signature: sig });
      setAccounts(listStakeAccounts());
      toast.success(`Delegated to ${validator.name}. ${sig.slice(0, 8)}… The stake account is yours.`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "The delegation did not sign.";
      setFail(message);
      toast.error(message);
    } finally {
      setBusy("");
    }
  }

  async function stop(row: StakeAcct) {
    setBusy(row.stake);
    setFail("");
    try {
      const addr = owner || (await connectPhantom());
      const sig = await deactivateStake(addr, row.stake);
      toast.success(`Deactivated. ${sig.slice(0, 8)}… The SOL stays there until the epoch lets you withdraw.`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not deactivate.";
      setFail(message);
      toast.error(message);
    } finally {
      setBusy("");
    }
  }

  async function run(unstake: boolean) {
    const n = Number(amount);
    if (!(n > 0)) return toast.error("Enter the SOL.");
    setBusy(unstake ? "out" : "in");
    setFail("");
    try {
      const addr = owner || (await connectPhantom());
      if (!owner) {
        const linked = wallet.linkChain(addr, "Phantom", "phantom");
        if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "Phantom did not stay.");
      }
      const done = await signRoute({
        owner: addr,
        inputMint: unstake ? pick.mint : SOL,
        outputMint: unstake ? SOL : pick.mint,
        amountRaw: Math.round(n * 1e9),
        outDecimals: 9,
        usd: n * (solPx || 1),
      });
      rememberTrade({ symbol: pick.symbol, side: unstake ? "sell" : "buy", usd: n * (solPx || 0), mint: pick.mint, signature: done.signature });
      toast.success(`${unstake ? "Unstaked" : "Staked"} ${pick.symbol}. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "The stake did not sign.";
      setFail(message);
      toast.error(message);
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#0c0e14]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-[11px] tracking-[0.18em] text-accent uppercase">Stake</p>
          <h2 className="mt-1 text-2xl tracking-tight">{mode === "validator" ? "Stake to a validator" : "Liquid stake"}</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">
            {mode === "validator"
              ? "Senda builds the stake account. Your wallet owns it and signs the delegation. This is not a handoff to another app."
              : `${STAKES.length} tokens Jupiter already lists. SOL in, the token out. Unstake swaps it back. Your wallet signs.`}
          </p>
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={() => setMode("validator")} className={cn("min-h-9 rounded-full px-3 text-xs font-semibold", mode === "validator" ? "bg-white text-black" : "bg-white/10")}>Validator</button>
          <button type="button" onClick={() => setMode("liquid")} className={cn("min-h-9 rounded-full px-3 text-xs font-semibold", mode === "liquid" ? "bg-white text-black" : "bg-white/10")}>Liquid</button>
        </div>
        <p className="font-mono text-sm text-muted">{solPx > 0 ? `SOL $${solPx.toFixed(2)}` : "Price loading"}</p>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
        <div className="border-b border-white/10 p-4 lg:border-r lg:border-b-0">
          {mode === "validator" ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {VALIDATORS.map((row) => {
                const on = validator.vote === row.vote;
                return (
                  <li key={row.vote}>
                    <button type="button" onClick={() => setValidator(row)} className={cn("w-full rounded-2xl border px-3 py-3 text-left", on ? "border-white bg-white text-black" : "border-white/10 bg-black/20")}>
                      <span className="block text-sm font-semibold">{row.name}</span>
                      <span className={cn("mt-1 block truncate font-mono text-[10px]", on ? "text-black/60" : "text-subtle")}>{row.vote}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stakes" className="min-h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none" />
          <ul className="mt-3 grid max-h-[420px] gap-2 overflow-auto sm:grid-cols-2">
            {shown.map((row) => {
              const on = pick.mint === row.mint;
              const price = px[row.mint] || 0;
              return (
                <li key={row.mint}>
                  <button type="button" onClick={() => setPick(row)} className={cn("w-full rounded-2xl border px-3 py-3 text-left transition", on ? "border-white bg-white text-black" : "border-white/10 bg-black/20 hover:border-white/30")}>
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold">{row.symbol}</span>
                      <span className={cn("font-mono text-[11px]", on ? "text-black/60" : "text-subtle")}>{price > 0 ? `$${price.toFixed(2)}` : ""}</span>
                    </span>
                    <span className={cn("mt-1 block text-xs", on ? "text-black/70" : "text-muted")}>{row.line}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {shown.length === 0 ? <p className="mt-3 text-sm text-subtle">No stake matches that.</p> : null}
            </>
          )}
        </div>
        <div className="p-5">
          {mode === "validator" ? (
            <>
              <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">Delegate</p>
              <h3 className="mt-1 text-xl">{validator.name}</h3>
              <p className="mt-1 text-sm text-muted">The stake account is created in your wallet. You can deactivate it here. Withdraw waits for the epoch.</p>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" aria-label="SOL" className="mt-4 w-full bg-transparent font-mono text-4xl tabular-nums outline-none" />
              <p className="font-mono text-xs text-subtle">{solPx > 0 ? `About $${(Number(amount) * solPx || 0).toFixed(2)}. Rent is added on top.` : "Rent is added on top of this SOL."}</p>
              <button type="button" disabled={busy !== ""} onClick={() => void delegate()} className="mt-4 min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
                {busy === "delegate" ? "Waiting on the wallet" : `Delegate ${amount || "0"} SOL`}
              </button>
              <ul className="mt-4 space-y-2">
                {accounts.map((row) => (
                  <li key={row.stake} className="flex items-center justify-between gap-2 rounded-xl bg-black/30 px-3 py-2">
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{row.name}</span>
                      <span className="block truncate font-mono text-[10px] text-subtle">{row.sol} SOL · {row.stake.slice(0, 4)}…</span>
                    </span>
                    <button type="button" disabled={busy !== ""} onClick={() => void stop(row)} className="min-h-9 shrink-0 rounded-full border border-white/15 px-3 text-xs font-semibold">
                      {busy === row.stake ? "Waiting" : "Deactivate"}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
          <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">Order</p>
          <h3 className="mt-1 text-xl">{pick.symbol}</h3>
          <p className="mt-1 text-sm text-muted">{pick.line} You can spend the token. This is not a locked validator deposit.</p>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" aria-label="SOL" className="mt-4 w-full bg-transparent font-mono text-4xl tabular-nums outline-none" />
          <p className="font-mono text-xs text-subtle">{solPx > 0 ? `About $${(Number(amount) * solPx || 0).toFixed(2)} of SOL` : "Jupiter prices it when you sign."}</p>
          <button type="button" disabled={busy !== ""} onClick={() => void run(false)} className="mt-4 min-h-12 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
            {busy === "in" ? "Waiting on Phantom" : `Stake into ${pick.symbol}`}
          </button>
          <button type="button" disabled={busy !== ""} onClick={() => void run(true)} className="mt-2 min-h-11 w-full rounded-full border border-white/15 text-sm font-semibold disabled:opacity-40">
            {busy === "out" ? "Waiting" : `Unstake ${pick.symbol}`}
          </button>
            </>
          )}
          {fail ? <p key={fail} className="senda-shake mt-3 text-sm text-down">{fail}</p> : null}
        </div>
      </div>
    </section>
  );
}
