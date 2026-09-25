import { useEffect, useState } from "react";
import { toast } from "sonner";
import { connectPhantom } from "@/lib/phantom";
import { runPrestock } from "@/lib/prestock";
import { FillButton } from "@/components/fill-button";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { useWalletCtx as useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";

const SLIPS = "senda.slips.v2";

type Slip = { id: string; symbol: string; mint: string; dir: "up" | "down"; stake: number; start: number; open: boolean };

function loadSlips(): Slip[] {
  if (typeof window === "undefined") return [];
  try {
    const p = JSON.parse(window.localStorage.getItem(SLIPS) || "[]") as Slip[];
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function saveSlips(rows: Slip[]) {
  try {
    window.localStorage.setItem(SLIPS, JSON.stringify(rows.slice(0, 12)));
  } catch {
    /* quota */
  }
}

export function PlayFloor({ names }: { names: HouseListing[] }) {
  const live = names.filter((n) => n.last > 0 && !/xai/i.test(n.symbol));
  const wallet = useWallet();
  const [a, setA] = useState(live[0]?.symbol ?? "");
  const [b, setB] = useState(live[1]?.symbol ?? live[0]?.symbol ?? "");
  const [back, setBack] = useState(live[0]?.symbol ?? "");
  const [open, setOpen] = useState<Record<string, number>>({});
  const [size, setSize] = useState(25);
  const [slipName, setSlipName] = useState(live[0]?.symbol ?? "");
  const [dir, setDir] = useState<"up" | "down">("up");
  const [stake, setStake] = useState(10);
  const [slips, setSlips] = useState<Slip[]>([]);
  const [slipBusy, setSlipBusy] = useState(false);
  const left = live.find((n) => n.symbol === a);
  const right = live.find((n) => n.symbol === b);
  const ranked = [...live].sort((x, y) => (y.change24h ?? 0) - (x.change24h ?? 0));

  useEffect(() => setSlips(loadSlips()), []);

  function arm() {
    const snap: Record<string, number> = {};
    for (const n of live) snap[n.symbol] = n.last;
    setOpen(snap);
    setBack(a);
    toast.success("Race is live from this print.");
  }

  const move = (n?: HouseListing) => (n && open[n.symbol] ? (n.last - open[n.symbol]) / open[n.symbol] : n?.change24h ?? 0);
  const leftMove = move(left) ?? 0;
  const rightMove = move(right) ?? 0;
  const leader = Math.abs(leftMove) === Math.abs(rightMove) ? null : Math.abs(leftMove) > Math.abs(rightMove) ? left : right;

  async function lockSlip() {
    const name = live.find((n) => n.symbol === slipName);
    if (!name || slipBusy) return;
    setSlipBusy(true);
    try {
      const existing = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
      const owner = existing || (await connectPhantom());
      if (!existing) {
        const linked = wallet.linkChain(owner, "Phantom", "phantom");
        if (!linked.ok) throw new Error(linked.error || "Could not keep the address.");
      }
      const done = await runPrestock({ owner, mint: name.mint, side: "buy", usd: stake, price: name.last });
      const row: Slip = { id: crypto.randomUUID(), symbol: name.symbol, mint: name.mint, dir, stake, start: name.last, open: true };
      const next = [row, ...slips];
      setSlips(next);
      saveSlips(next);
      toast.success(`Bought $${stake} of ${name.symbol}. ${done.signature.slice(0, 8)}… That's the stake.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The stake did not send.");
    } finally {
      setSlipBusy(false);
    }
  }

  async function settle(row: Slip) {
    const name = live.find((n) => n.symbol === row.symbol);
    if (!name || slipBusy) return;
    const won = row.dir === "up" ? name.last > row.start : name.last < row.start;
    if (!won) {
      setSlipBusy(true);
      try {
        const existing = wallet.w.links.find((l) => l.kind === "phantom" || l.kind === "solana")?.address ?? "";
        const owner = existing || (await connectPhantom());
        await runPrestock({ owner, mint: row.mint || name.mint, side: "sell", usd: row.stake, price: name.last });
        toast.success(`${row.symbol} did not. Sold the stake back to USDC.`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not sell the stake back.");
        return;
      } finally {
        setSlipBusy(false);
      }
    } else {
      toast.success(`${row.symbol} went your way. The tokens stay in the wallet.`);
    }
    const next = slips.map((s) => (s.id === row.id ? { ...s, open: false } : s));
    setSlips(next);
    saveSlips(next);
  }

  return (
    <div className="space-y-3 px-3 py-3 lg:px-4">
      <header className="rounded-[28px] border border-white/10 bg-[#101018] p-6">
        <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Play</p>
        <h1 className="mt-2 text-4xl">Games on the live print</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          A race and a board on the live print. A slip buys the name. If it goes your way, the tokens stay. If it doesn't, settling sells them back to USDC.
        </p>
      </header>

      <section className="rounded-[28px] border border-white/10 bg-[#101018] p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Race</p>
            <p className="text-xs text-muted">Two names. The one that moves more from the armed print is ahead. Buy the one you backed.</p>
          </div>
          <div className="flex gap-1">
            {[10, 25, 50].map((n) => (
              <button key={n} type="button" onClick={() => setSize(n)} className={cn("min-h-9 rounded-full px-3 font-mono text-xs", size === n ? "bg-accent text-accent-fg" : "bg-black/40 text-muted")}>
                ${n}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Lane name={left} pct={leftMove} on={back === left?.symbol} onPick={() => left && setBack(left.symbol)} armed={Boolean(open[left?.symbol || ""])} />
          <Lane name={right} pct={rightMove} on={back === right?.symbol} onPick={() => right && setBack(right.symbol)} armed={Boolean(open[right?.symbol || ""])} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <select value={a} onChange={(e) => setA(e.target.value)} className="min-h-11 rounded-full bg-black/40 px-3 text-sm">
            {live.map((n) => (
              <option key={n.symbol}>{n.symbol}</option>
            ))}
          </select>
          <select value={b} onChange={(e) => setB(e.target.value)} className="min-h-11 rounded-full bg-black/40 px-3 text-sm">
            {live.map((n) => (
              <option key={`b-${n.symbol}`}>{n.symbol}</option>
            ))}
          </select>
          <button type="button" onClick={arm} className="min-h-11 rounded-full bg-white/10 px-4 text-sm font-semibold">
            Arm the race
          </button>
          {leader ? (
            <FillButton mint={leader.mint} usd={size} price={leader.last} label={`Buy ${leader.symbol} · $${size}`} className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg" />
          ) : null}
        </div>
        <p className="mt-3 text-xs text-subtle">{leader ? `${leader.symbol} is ahead.` : "Arm it and the lanes start from this print."}</p>
      </section>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-[28px] border border-white/10 bg-[#101018] p-5">
          <p className="text-sm font-semibold">The board</p>
          <p className="text-xs text-muted">Every name, by the day. Buy is Jupiter.</p>
          <ul className="mt-3 space-y-2">
            {ranked.map((n) => {
              const pct = (n.change24h ?? 0) * 100;
              const width = Math.min(100, Math.abs(pct) * 4 + 8);
              return (
                <li key={n.id} className="rounded-2xl bg-black/30 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span>
                      <span className="block text-sm font-semibold">{n.symbol}</span>
                      <span className="font-mono text-[11px] text-subtle">{formatUsd(n.last)} · {formatPremium(n.premium)}</span>
                    </span>
                    <span className={cn("font-mono text-sm", pct < 0 ? "text-down" : "text-accent")}>{pct.toFixed(1)}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className={cn("h-full", pct < 0 ? "bg-down" : "bg-accent")} style={{ width: `${width}%` }} />
                  </div>
                  <FillButton mint={n.mint} usd={10} price={n.last} label={`Buy $10`} className="mt-2 inline-flex min-h-8 items-center rounded-full bg-white/10 px-3 text-xs font-semibold" />
                </li>
              );
            })}
          </ul>
        </div>

        <div className="h-fit rounded-[28px] border border-white/10 bg-[#101018] p-5">
          <p className="text-sm font-semibold">Slip</p>
          <p className="mt-1 text-xs text-muted">
            Locking buys ${stake} of the name. Right, and you keep the tokens. Wrong, and settle sells them back.
          </p>
          <select value={slipName} onChange={(e) => setSlipName(e.target.value)} className="mt-3 min-h-11 w-full rounded-2xl bg-black/40 px-3 text-sm">
            {live.map((n) => (
              <option key={n.symbol}>{n.symbol}</option>
            ))}
          </select>
          <div className="mt-2 flex gap-2">
            {(["up", "down"] as const).map((d) => (
              <button key={d} type="button" onClick={() => setDir(d)} className={cn("min-h-10 flex-1 rounded-full text-sm font-semibold", dir === d ? "bg-accent text-accent-fg" : "bg-black/40")}>
                {d === "up" ? "Up" : "Down"}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-1">
            {[5, 10, 25].map((n) => (
              <button key={n} type="button" onClick={() => setStake(n)} className={cn("min-h-9 rounded-full px-3 font-mono text-xs", stake === n ? "bg-accent text-accent-fg" : "bg-black/40 text-muted")}>
                ${n}
              </button>
            ))}
          </div>
          <button type="button" disabled={slipBusy} onClick={() => void lockSlip()} className="mt-3 min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-40">
            {slipBusy ? "Waiting for the wallet…" : `Buy $${stake} as the stake`}
          </button>
          <ul className="mt-4 space-y-2">
            {slips.filter((s) => s.open).map((s) => (
              <li key={s.id} className="rounded-2xl bg-black/30 px-3 py-2 text-sm">
                <p className="font-semibold">{s.symbol} {s.dir} · ${s.stake}</p>
                <p className="font-mono text-[11px] text-subtle">from {formatUsd(s.start)}</p>
                <button type="button" onClick={() => settle(s)} className="mt-2 text-xs font-semibold text-accent">
                  Settle on this print
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Lane({
  name,
  pct,
  on,
  onPick,
  armed,
}: {
  name?: HouseListing;
  pct: number;
  on: boolean;
  onPick: () => void;
  armed: boolean;
}) {
  if (!name) return <div className="rounded-2xl bg-black/30 p-4 text-sm text-subtle">No name</div>;
  const width = Math.min(100, Math.abs(pct) * 400 + 12);
  return (
    <button type="button" onClick={onPick} className={cn("rounded-2xl p-4 text-left", on ? "bg-accent/15 ring-1 ring-accent" : "bg-black/30")}>
      <p className="text-xs text-subtle">{armed ? "From the armed print" : "Today"}</p>
      <p className="mt-1 text-2xl font-semibold">{name.symbol}</p>
      <p className="font-mono text-sm">{formatUsd(name.last)}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div className={cn("h-full", pct < 0 ? "bg-down" : "bg-accent")} style={{ width: `${width}%` }} />
      </div>
      <p className={cn("mt-2 font-mono text-sm", pct < 0 ? "text-down" : "text-accent")}>{(pct * 100).toFixed(2)}%</p>
    </button>
  );
}
