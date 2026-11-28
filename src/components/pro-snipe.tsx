import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LAUNCH_FEE_BPS } from "@/lib/launch-gate";

type LaunchRow = {
  mint: string;
  symbol: string;
  name: string;
  launchpad: string;
  holders: number;
  price: number;
  score: number;
  scoreMs: number;
  refused: string | null;
  devMints: number | null;
};

type Mission = { id: string; leftToday: number; status: string };

/** New-mint lane. Rug rules refuse before a queue. Pro opens the wallet only if it is armed. */
export function ProSnipe({
  token,
  call,
}: {
  token: string;
  call: (token: string, method: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>;
}) {
  const [rows, setRows] = useState<LaunchRow[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [missionId, setMissionId] = useState("");
  const [usd, setUsd] = useState(0.5);
  const [order, setOrder] = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    setBusy("load");
    try {
      const [board, mine] = await Promise.all([
        call(token, "list_launches", { limit: 12 }),
        call(token, "list_missions"),
        call(token, "wake_limits"),
      ]);
      const next = (board.launches as LaunchRow[]) || [];
      setRows(next);
      const open = ((mine.missions as Mission[]) || []).filter((row) => row.status === "open" && row.leftToday >= 0.5);
      setMissions(open);
      setMissionId((id) => id || open[0]?.id || "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Launches did not load.");
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function queue(row: LaunchRow) {
    if (!missionId) {
      toast.error("Open a mission first. The aim is the cap.");
      return;
    }
    setBusy(row.mint);
    try {
      const result = await call(token, "queue_launch", {
        missionId,
        mint: row.mint,
        usd,
        order,
        limitPrice: order === "limit" ? Number(limitPrice) : undefined,
        why: `${row.launchpad} score ${row.score}. Fee ${LAUNCH_FEE_BPS} bps shown, not collected.`,
      });
      toast.success(String(result.note || `${row.symbol} queued.`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "It was not queued.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="rounded-3xl border border-white/15 bg-black px-4 py-4 text-white">
      <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">Pro · Launches</p>
      <h2 className="mt-1 text-lg font-semibold tracking-tight">New Solana mints. Pump.fun when Jupiter marks it.</h2>
      <p className="mt-2 text-sm leading-relaxed text-white/60">
        The rug rules are always on. Mint authority, freeze authority, or a deployer with 8 or more mints refuses the buy. A passing mint gets a MatDaemon similarity score against a clean launch. That number is not a profit forecast, and the milliseconds are the score, not the landing. A market order queues only if Jupiter quotes. A limit waits. If Pro is armed, a queued buy opens the wallet. {LAUNCH_FEE_BPS} bps is shown and not collected.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {[0.5, 1, 5].map((n) => (
          <button key={n} type="button" onClick={() => setUsd(n)} className={`min-h-10 rounded-full px-3 text-xs font-semibold ${usd === n ? "bg-white text-black" : "bg-white/10"}`}>${n}</button>
        ))}
        <button type="button" onClick={() => setOrder("market")} className={`min-h-10 rounded-full px-3 text-xs font-semibold ${order === "market" ? "bg-white text-black" : "bg-white/10"}`}>Market</button>
        <button type="button" onClick={() => setOrder("limit")} className={`min-h-10 rounded-full px-3 text-xs font-semibold ${order === "limit" ? "bg-white text-black" : "bg-white/10"}`}>Limit</button>
        {order === "limit" ? (
          <input value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} inputMode="decimal" placeholder="Limit price" className="min-h-10 w-28 rounded-full bg-white/10 px-3 font-mono text-xs" />
        ) : null}
      </div>
      {missions.length ? (
        <select value={missionId} onChange={(e) => setMissionId(e.target.value)} className="mt-3 min-h-10 w-full rounded-2xl bg-white/10 px-3 text-xs">
          {missions.map((row) => <option key={row.id} value={row.id}>Mission · ${row.leftToday} left today</option>)}
        </select>
      ) : <p className="mt-3 text-xs text-white/45">No open mission with at least $0.50 left.</p>}
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.mint} className="rounded-2xl bg-white/5 px-3 py-2 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{row.symbol} <span className="font-normal text-white/45">{row.name}</span></p>
                <p className="mt-0.5 text-[11px] text-white/45">{row.launchpad} · {row.holders} holders{row.devMints != null ? ` · dev ${row.devMints}` : ""} · score {row.score} · {row.scoreMs}ms</p>
                <p className="text-[11px] text-white/40">{row.refused || (row.price ? `$${row.price < 1 ? row.price.toPrecision(3) : row.price.toFixed(2)}` : "No price yet")}</p>
              </div>
              <button type="button" disabled={!!row.refused || busy !== ""} onClick={() => void queue(row)} className="min-h-10 shrink-0 rounded-full bg-white px-3 text-xs font-semibold text-black disabled:opacity-30">
                {busy === row.mint ? "Checking" : row.refused ? "Refused" : order === "limit" ? "Rest" : "Queue"}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {!rows.length ? <p className="mt-3 text-xs text-white/40">{busy === "load" ? "Reading Jupiter…" : "No recent mints."}</p> : null}
    </section>
  );
}
