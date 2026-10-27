import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SOL, signRoute } from "@/lib/jup-sign";
import { payUsdc } from "@/lib/solana-pay";
import { openJupPerp } from "@/lib/jup-perps";
import { addMeteora } from "@/lib/meteora-add";
import { connectPhantom } from "@/lib/phantom";
import { rememberTrade } from "@/lib/trade-log";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const JITO = "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn";
const INF = "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm";
const MARKETS = [
  { symbol: "SOL", mint: SOL, decimals: 9 },
  { symbol: "ETH", mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", decimals: 8 },
  { symbol: "BTC", mint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", decimals: 8 },
] as const;
const POOLS = [
  { id: "sol-usdc", name: "SOL/USDC", pool: "5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6", line: "SOL and USDC, both in this Phantom.", x: { decimals: 9, usd: false }, y: { decimals: 6, usd: true } },
  { id: "jito-sol", name: "JitoSOL/SOL", pool: "BoeMUkCLHchTD31HdXsbDExuZZfcUppSLpYtV3LZTH6U", line: "JitoSOL and SOL. Stake first if you do not hold JitoSOL.", x: { decimals: 9, usd: false }, y: { decimals: 9, usd: false } },
] as const;

/** Jito liquid stake, a Jupiter SOL perpetual, and one Meteora SOL/USDC position. Each one asks Phantom. */
export function ProgramDesk() {
  const wallet = useWallet();
  const owner = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
  const [solPx, setSolPx] = useState(0);
  const [px, setPx] = useState<Record<string, number>>({});
  const [market, setMarket] = useState<(typeof MARKETS)[number]["symbol"]>("SOL");
  const [poolId, setPoolId] = useState<(typeof POOLS)[number]["id"]>("sol-usdc");
  const [stake, setStake] = useState("0.05");
  const [side, setSide] = useState<"long" | "short">("short");
  const [lev, setLev] = useState(2);
  const [perpUsd, setPerpUsd] = useState("10");
  const [lp, setLp] = useState("10");
  const [inf, setInf] = useState("0.05");
  const [squad, setSquad] = useState("");
  const [squadUsd, setSquadUsd] = useState("10");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let live = true;
    const ids = MARKETS.map((row) => row.mint).join(",");
    void fetch(`https://lite-api.jup.ag/price/v3?ids=${ids}`, { headers: { accept: "application/json" } })
      .then((r) => r.json() as Promise<Record<string, { usdPrice?: number }>>)
      .then((body) => {
        if (!live) return;
        const next: Record<string, number> = {};
        for (const row of MARKETS) next[row.symbol] = Number(body[row.mint]?.usdPrice) || 0;
        setPx(next);
        setSolPx(next.SOL || 0);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  async function who() {
    const addr = owner || (await connectPhantom());
    if (!owner) {
      const linked = wallet.linkChain(addr, "Phantom", "phantom");
      if (!linked.ok && linked.error !== "Already linked.") throw new Error(linked.error || "The wallet did not stay.");
    }
    return addr;
  }

  async function stakeSol(unstake: boolean) {
    const n = Number(stake);
    if (!(n > 0)) return;
    setBusy(unstake ? "unstake" : "stake");
    try {
      const addr = await who();
      const done = await signRoute({
        owner: addr,
        inputMint: unstake ? JITO : SOL,
        outputMint: unstake ? SOL : JITO,
        amountRaw: Math.round(n * 1e9),
        outDecimals: 9,
        usd: n * (solPx || 1),
      });
      rememberTrade({ symbol: "JitoSOL", side: unstake ? "sell" : "buy", usd: n * (solPx || 0), mint: JITO, signature: done.signature });
      toast.success(`${unstake ? "Unstaked" : "Staked"}. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The stake did not sign.");
    } finally {
      setBusy("");
    }
  }

  async function perp() {
    setBusy("perp");
    try {
      const addr = await who();
      const row = MARKETS.find((item) => item.symbol === market) ?? MARKETS[0];
      const done = await openJupPerp({
        owner: addr,
        side,
        usd: Number(perpUsd),
        leverage: lev,
        marketMint: row.mint,
        marketDecimals: row.decimals,
        marketPrice: px[row.symbol] || 0,
      });
      rememberTrade({ symbol: `${row.symbol}-${side}`, side: side === "long" ? "buy" : "sell", usd: done.quote.collateral, mint: row.mint, signature: done.signature });
      toast.success(`Position signed. Entry $${done.quote.entry.toFixed(2)}. Liq $${done.quote.liq.toFixed(2)}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Jupiter did not open it.");
    } finally {
      setBusy("");
    }
  }

  async function pool() {
    setBusy("lp");
    try {
      const addr = await who();
      const chosen = POOLS.find((item) => item.id === poolId) ?? POOLS[0];
      const done = await addMeteora({
        owner: addr,
        pool: chosen.pool,
        usd: Number(lp),
        x: chosen.x,
        y: chosen.y,
        solPrice: solPx,
      });
      rememberTrade({ symbol: chosen.name, side: "buy", usd: Number(lp) * 2, mint: chosen.pool, signature: done.signature });
      toast.success(`Position ${done.position.slice(0, 4)}… is open. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Meteora did not open the position.");
    } finally {
      setBusy("");
    }
  }

  async function intoInf() {
    const n = Number(inf);
    if (!(n > 0)) return;
    setBusy("inf");
    try {
      const addr = await who();
      const done = await signRoute({
        owner: addr,
        inputMint: SOL,
        outputMint: INF,
        amountRaw: Math.round(n * 1e9),
        outDecimals: 9,
        usd: n * (solPx || 1),
      });
      rememberTrade({ symbol: "INF", side: "buy", usd: n * (solPx || 0), mint: INF, signature: done.signature });
      toast.success(`INF is in this Phantom. ${done.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The INF swap did not sign.");
    } finally {
      setBusy("");
    }
  }

  async function toSquad() {
    const n = Number(squadUsd);
    if (!(n > 0) || squad.length < 32) {
      toast.error("Paste the vault address and an amount.");
      return;
    }
    setBusy("squad");
    try {
      const addr = await who();
      const paid = await payUsdc({ owner: addr, to: squad, usd: n, memo: "Squads" });
      rememberTrade({ symbol: "USDC", side: "send", usd: n, mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", signature: paid.signature });
      toast.success(`In the vault. ${paid.signature.slice(0, 8)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The vault did not get the USDC.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-4 p-3">
      <section className="rounded-2xl border border-white/10 p-4">
        <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Jito</p>
        <h2 className="mt-1 text-xl font-semibold">Stake SOL. Hold JitoSOL.</h2>
        <p className="mt-1 text-sm text-muted">Jupiter swaps SOL for JitoSOL. The token stays in this Phantom and earns stake. Unstake swaps it back. This is not a locked validator deposit.</p>
        <input value={stake} onChange={(e) => setStake(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="SOL to stake" className="mt-3 w-full bg-transparent font-mono text-4xl outline-none" />
        <p className="font-mono text-xs text-subtle">{solPx > 0 ? `About $${(Number(stake) * solPx).toFixed(2)}` : "Waiting on the SOL price."}</p>
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={busy !== ""} onClick={() => void stakeSol(false)} className="min-h-11 flex-1 rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">{busy === "stake" ? "…" : "Stake"}</button>
          <button type="button" disabled={busy !== ""} onClick={() => void stakeSol(true)} className="min-h-11 flex-1 rounded-full border border-white/15 text-sm font-semibold disabled:opacity-40">{busy === "unstake" ? "…" : "Unstake"}</button>
        </div>
      </section>
      <section className="rounded-2xl border border-white/10 p-4">
        <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Jupiter perps</p>
        <h2 className="mt-1 text-xl font-semibold">A SOL position on their pool.</h2>
        <p className="mt-1 text-sm text-muted">Jupiter’s perpetual, not the cash ticket. A short posts USDC. A long posts the coin itself, so a BTC long needs wrapped BTC already in this Phantom. At least $10. Five times is the most this desk will ask for.</p>
        <div className="mt-3 flex gap-1">
          {MARKETS.map((row) => (
            <button key={row.symbol} type="button" onClick={() => setMarket(row.symbol)} className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold", market === row.symbol ? "bg-white text-black" : "border border-white/10 text-muted")}>{row.symbol}</button>
          ))}
        </div>
        <div className="mt-3 flex gap-1">
          {(["short", "long"] as const).map((id) => (
            <button key={id} type="button" onClick={() => setSide(id)} className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold capitalize", side === id ? "bg-white text-black" : "border border-white/10 text-muted")}>{id}</button>
          ))}
        </div>
        <input value={perpUsd} onChange={(e) => setPerpUsd(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="Collateral in dollars" className="mt-3 w-full bg-transparent font-mono text-4xl outline-none" />
        <div className="mt-2 flex gap-1">
          {[1.2, 2, 5].map((n) => (
            <button key={n} type="button" onClick={() => setLev(n)} className={cn("min-h-9 flex-1 rounded-full text-xs font-semibold", lev === n ? "bg-accent text-accent-fg" : "border border-white/10 text-muted")}>{n}×</button>
          ))}
        </div>
        <button type="button" disabled={busy !== ""} onClick={() => void perp()} className="mt-3 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">{busy === "perp" ? "Waiting on Phantom" : `Open ${side}`}</button>
      </section>
      <section className="rounded-2xl border border-white/10 p-4">
        <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Meteora</p>
        <h2 className="mt-1 text-xl font-semibold">SOL/USDC liquidity.</h2>
        <p className="mt-1 text-sm text-muted">Five bins each side of the price. Both tokens have to already be in this Phantom. The position shows up in the wallet.</p>
        <div className="mt-3 flex gap-1">
          {POOLS.map((row) => (
            <button key={row.id} type="button" onClick={() => setPoolId(row.id)} className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold", poolId === row.id ? "bg-white text-black" : "border border-white/10 text-muted")}>{row.name}</button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">{POOLS.find((row) => row.id === poolId)?.line}</p>
        <input value={lp} onChange={(e) => setLp(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="Dollars of each side" className="mt-3 w-full bg-transparent font-mono text-4xl outline-none" />
        <button type="button" disabled={busy !== ""} onClick={() => void pool()} className="mt-3 min-h-11 w-full rounded-full bg-white text-sm font-semibold text-black disabled:opacity-40">{busy === "lp" ? "Waiting on Phantom" : `Add $${lp || "0"} each side`}</button>
      </section>
      <section className="rounded-2xl border border-white/10 p-4">
        <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Sanctum</p>
        <h2 className="mt-1 text-xl font-semibold">SOL into INF.</h2>
        <p className="mt-1 text-sm text-muted">Jupiter swaps SOL for Sanctum Infinity. INF is the pool token. It is not a stake receipt you can unstake here.</p>
        <input value={inf} onChange={(e) => setInf(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="SOL into INF" className="mt-3 w-full bg-transparent font-mono text-4xl outline-none" />
        <button type="button" disabled={busy !== ""} onClick={() => void intoInf()} className="mt-3 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">{busy === "inf" ? "Waiting on Phantom" : "Swap to INF"}</button>
      </section>
      <section className="rounded-2xl border border-white/10 p-4">
        <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Squads</p>
        <h2 className="mt-1 text-xl font-semibold">USDC into a vault.</h2>
        <p className="mt-1 text-sm text-muted">Open the multisig in Squads, copy the vault address, paste it here. Phantom sends the USDC. This desk does not create the signers.</p>
        <a href="https://app.squads.so" target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-accent">Open Squads</a>
        <input value={squad} onChange={(e) => setSquad(e.target.value.trim())} placeholder="Squads vault address" spellCheck={false} className="mt-3 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 font-mono text-xs" />
        <input value={squadUsd} onChange={(e) => setSquadUsd(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="USDC to the vault" className="mt-2 w-full bg-transparent font-mono text-4xl outline-none" />
        <button type="button" disabled={busy !== ""} onClick={() => void toSquad()} className="mt-3 min-h-11 w-full rounded-full bg-white text-sm font-semibold text-black disabled:opacity-40">{busy === "squad" ? "Waiting on Phantom" : "Send to the vault"}</button>
      </section>
      <section className="rounded-2xl border border-white/10 p-4">
        <p className="text-[11px] tracking-[0.16em] text-accent uppercase">Kamino</p>
        <h2 className="mt-1 text-xl font-semibold">Lend on their market.</h2>
        <p className="mt-1 text-sm text-muted">A Kamino deposit is their instruction, not a Jupiter swap. This button opens the lend market. Phantom signs there, not here.</p>
        <a href="https://app.kamino.finance/lend" target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg">Open Kamino lend</a>
      </section>
    </div>
  );
}
